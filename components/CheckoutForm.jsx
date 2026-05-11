"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, MapPin, ShieldCheck, Truck, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { useProductCatalog } from "./useProductCatalog";
import { useCustomerAuth } from "./CustomerAuthProvider";
import { formatPrice } from "../lib/format";
import { compactOrderForStorage, generateOrderId, saveOrder } from "../lib/orders";
import { sendOrderEmail } from "../lib/orderEmail";
import { listenCustomerProfile, saveCustomerOrder, upsertCustomerProfile } from "../lib/firebaseClient";

const INDIA_STATES = [
  "Andaman & Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra & Nagar Haveli & Daman & Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttarakhand",
  "Uttar Pradesh",
  "West Bengal"
];

const EMPTY_ADDRESS = {
  name: "",
  phone: "",
  pincode: "",
  locality: "",
  line1: "",
  city: "",
  state: "",
  landmark: "",
  alternatePhone: "",
  label: "Home"
};

const CHECKOUT_SUCCESS_SESSION_KEY = "freaking-collectibles-checkout-success";

function readCheckoutSuccessSession() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(CHECKOUT_SUCCESS_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function writeCheckoutSuccessSession(orderId) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CHECKOUT_SUCCESS_SESSION_KEY,
      JSON.stringify({ orderId, completedAt: Date.now() })
    );
  } catch {
    // Session restore is a nice-to-have; the order itself is already saved.
  }
}

function replaceCheckoutHistoryWithSuccess(orderId) {
  if (typeof window === "undefined") return;
  const successPath = `/checkout?success=${encodeURIComponent(orderId)}`;
  window.history.replaceState({ ...(window.history.state || {}), checkoutSuccessOrderId: orderId }, "", successPath);
}

function normalizePincode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function matchIndianState(value) {
  const normalizedValue = String(value || "").toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
  return INDIA_STATES.find((state) => state.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim() === normalizedValue) || "";
}

async function lookupPincodeDetails(pincode, signal) {
  const normalizedPincode = normalizePincode(pincode);
  if (normalizedPincode.length !== 6) return null;

  const response = await fetch(`https://api.postalpincode.in/pincode/${normalizedPincode}`, { signal });
  if (!response.ok) throw new Error("Pincode lookup failed");

  const [result] = await response.json();
  const postOffice = result?.PostOffice?.[0];
  if (result?.Status !== "Success" || !postOffice) return null;

  return {
    pincode: normalizedPincode,
    locality: postOffice.Name || postOffice.Block || "",
    city: postOffice.District || postOffice.Division || "",
    state: matchIndianState(postOffice.State) || postOffice.State || ""
  };
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location permission is not supported on this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 12000
    });
  });
}

async function reverseWithNominatim(latitude, longitude) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    addressdetails: "1",
    zoom: "18"
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!response.ok) throw new Error("Location lookup failed");

  const data = await response.json();
  const address = data.address || {};
  const locality = address.suburb || address.neighbourhood || address.village || address.city_district || address.hamlet || "";
  const city = address.city || address.town || address.village || address.county || address.state_district || "";
  const lineParts = [address.house_number, address.road, address.residential || address.quarter || ""].filter(Boolean);

  return {
    pincode: normalizePincode(address.postcode),
    locality,
    city,
    state: matchIndianState(address.state) || address.state || "",
    line1: lineParts.join(", ")
  };
}

async function reverseWithBigDataCloud(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en"
  });
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
  if (!response.ok) throw new Error("Location lookup failed");

  const data = await response.json();
  return {
    pincode: normalizePincode(data.postcode || data.postalCode),
    locality: data.locality || data.city || "",
    city: data.city || data.locality || "",
    state: matchIndianState(data.principalSubdivision) || data.principalSubdivision || "",
    line1: ""
  };
}

async function reverseGeocodeCoordinates(latitude, longitude) {
  try {
    return await reverseWithNominatim(latitude, longitude);
  } catch {
    return reverseWithBigDataCloud(latitude, longitude);
  }
}

function readPaymentScreenshot(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result || "")
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function waitForOrderConfirmationReveal() {
  return new Promise((resolve) => setTimeout(resolve, 2800));
}

export function CheckoutForm() {
  const { items, subtotal, shippingCharge, discountAmount, total, appliedCoupon, clearCart, ready: isCartReady } = useCart();
  const { user, loading: authLoading } = useCustomerAuth();
  const { products, reduceStock } = useProductCatalog();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [isAddressSaved, setIsAddressSaved] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState("address");
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [startedAt] = useState(Date.now());
  const [error, setError] = useState("");
  const [addressAssist, setAddressAssist] = useState({ tone: "", message: "" });
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentFileName, setPaymentFileName] = useState("");
  const paymentSubmitLockedRef = useRef(false);

  useEffect(() => {
    const successId = new URLSearchParams(window.location.search).get("success");
    const storedSuccess = readCheckoutSuccessSession();
    const isRecentSuccess =
      storedSuccess?.orderId &&
      Date.now() - Number(storedSuccess.completedAt || 0) < 24 * 60 * 60 * 1000;

    if (!successId && !submitted && isCartReady && items.length === 0 && isRecentSuccess) {
      router.replace(`/checkout?success=${encodeURIComponent(storedSuccess.orderId)}`, { scroll: false });
      setOrderId(storedSuccess.orderId);
      setSubmitted(true);
      return;
    }

    if (!successId || submitted) return;

    if (!isRecentSuccess || storedSuccess.orderId !== successId) {
      router.replace("/");
      return;
    }

    setOrderId(successId);
    setSubmitted(true);
  }, [isCartReady, items.length, router, submitted]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/account?next=/checkout");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return undefined;
    return listenCustomerProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => {
    if (!user || !profile) return;
    const savedAddress = Array.isArray(profile.addresses) ? profile.addresses[0] : null;
    const savedAddressLine = savedAddress?.line || profile.address || "";
    setAddressForm((current) => ({
      ...current,
      name: current.name || savedAddress?.name || profile.name || user.displayName || "",
      phone: current.phone || savedAddress?.phone || profile.phone || "",
      line1: current.line1 || savedAddress?.line1 || savedAddressLine || "",
      city: current.city || savedAddress?.city || "",
      state: current.state || savedAddress?.state || "",
      pincode: current.pincode || savedAddress?.pincode || "",
      locality: current.locality || savedAddress?.locality || "",
      landmark: current.landmark || savedAddress?.landmark || "",
      alternatePhone: current.alternatePhone || savedAddress?.alternatePhone || "",
      label: current.label || savedAddress?.label || "Home"
    }));
    if (savedAddressLine) {
      setIsAddressSaved(true);
      setCheckoutStage((currentStage) => (currentStage === "address" ? "summary" : currentStage));
    }
  }, [profile, user]);

  useEffect(() => {
    if (!submitted) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [submitted]);

  useEffect(() => {
    const pincode = normalizePincode(addressForm.pincode);
    if (pincode.length !== 6) return undefined;

    const controller = new AbortController();
    setAddressAssist({ tone: "loading", message: "Finding address details..." });

    lookupPincodeDetails(pincode, controller.signal)
      .then((details) => {
        if (!details) {
          setAddressAssist({ tone: "error", message: "Pincode details not found." });
          return;
        }

        setAddressForm((current) => {
          if (normalizePincode(current.pincode) !== pincode) return current;
          return {
            ...current,
            pincode,
            locality: details.locality || current.locality,
            city: details.city || current.city,
            state: details.state || current.state
          };
        });
        setAddressAssist({ tone: "success", message: "City and state filled from pincode." });
      })
      .catch((lookupError) => {
        if (lookupError?.name === "AbortError") return;
        setAddressAssist({ tone: "error", message: "Could not fetch pincode details." });
      });

    return () => controller.abort();
  }, [addressForm.pincode]);

  const updateAddressField = (field, value) => {
    const nextValue = field === "pincode" ? normalizePincode(value) : value;
    setAddressForm((current) => ({ ...current, [field]: nextValue }));
    if (field === "pincode" && normalizePincode(value).length < 6) {
      setAddressAssist({ tone: "", message: "" });
    }
    setIsAddressSaved(false);
    setCheckoutStage("address");
  };

  const handleUseCurrentLocation = async () => {
    if (isLocating) return;
    setError("");
    setIsLocating(true);
    setAddressAssist({ tone: "loading", message: "Detecting your current location..." });

    try {
      const position = await getCurrentPosition();
      const coordinates = position.coords;
      const locationDetails = await reverseGeocodeCoordinates(coordinates.latitude, coordinates.longitude);
      const pincodeDetails = locationDetails.pincode
        ? await lookupPincodeDetails(locationDetails.pincode).catch(() => null)
        : null;

      setAddressForm((current) => ({
        ...current,
        pincode: pincodeDetails?.pincode || locationDetails.pincode || current.pincode,
        locality: locationDetails.locality || pincodeDetails?.locality || current.locality,
        city: pincodeDetails?.city || locationDetails.city || current.city,
        state: pincodeDetails?.state || locationDetails.state || current.state,
        line1: locationDetails.line1 || current.line1
      }));
      setIsAddressSaved(false);
      setCheckoutStage("address");
      setAddressAssist({ tone: "success", message: "Current location details filled. Add landmark manually if needed." });
    } catch (locationError) {
      setAddressAssist({ tone: "error", message: locationError?.message || "Could not detect current location." });
    } finally {
      setIsLocating(false);
    }
  };

  const openPaymentStage = () => {
    setCheckoutStage("payment");
    window.setTimeout(() => {
      document.querySelector(".final-payment-shell")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const buildAddressLine = (address) =>
    [address.line1, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(", ");

  const handleAddressSave = async (event) => {
    event.preventDefault();
    if (!user || isSavingAddress) return;
    setError("");
    setIsSavingAddress(true);
    const addressLine = buildAddressLine(addressForm);

    try {
      await upsertCustomerProfile(user, {
        name: addressForm.name.trim(),
        phone: addressForm.phone.trim(),
        address: addressLine,
        addresses: [
          {
            ...addressForm,
            line: addressLine
          }
        ]
      });
      setIsAddressSaved(true);
      setCheckoutStage("summary");
      window.setTimeout(() => {
        document.querySelector(".checkout-summary-stage")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || paymentSubmitLockedRef.current) return;
    const form = new FormData(event.currentTarget);
    const email = user?.email || "";
    const honeypot = String(form.get("companyWebsite") || "").trim();
    const secondsOnPage = (Date.now() - startedAt) / 1000;
    const paymentFile = form.get("payment");
    const paymentUtr = String(form.get("utr") || "").replace(/\D/g, "").slice(0, 12);

    if (honeypot || secondsOnPage < 3) {
      setError("Please wait a moment and try again.");
      return;
    }

    if (items.length === 0 || total <= 0) {
      setError("Add products to your cart before checkout.");
      return;
    }

    const unavailable = items.find((item) => {
      const product = products.find((currentProduct) => currentProduct.id === item.id);
      return !product || product.stock < item.quantity;
    });

    if (unavailable) {
      setError(`${unavailable.name} does not have enough stock.`);
      return;
    }

    if (!paymentFile || paymentFile.size === 0) {
      setError("Upload payment screenshot before proceeding.");
      return;
    }

    if (paymentUtr.length !== 12) {
      setError("Enter 12 digit UTR number.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    paymentSubmitLockedRef.current = true;
    const id = generateOrderId();
    try {
      const paymentScreenshot = await readPaymentScreenshot(paymentFile);
      const addressLine = buildAddressLine(addressForm);
      const order = {
        id,
        userId: user?.uid || "",
        userEmail: email,
        customerName: addressForm.name.trim(),
        email,
        phone: addressForm.phone.trim(),
        address: addressLine,
        addressDetails: addressForm,
        total,
        billing: {
          subtotal,
          shippingCharge,
          discountAmount,
          couponCode: appliedCoupon?.code || "",
          total
        },
        status: "Payment review",
        createdAt: new Date().toISOString(),
        paymentScreenshot,
        paymentUtr,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        }))
      };
      const storedOrder = compactOrderForStorage(order);
      saveOrder(storedOrder);
      reduceStock(items);
      setOrderId(id);

      void Promise.allSettled([
        saveCustomerOrder(storedOrder, user),
        sendOrderEmail("created", order)
      ]).then(([cloudSave, emailSave]) => {
        if (cloudSave.status === "rejected") {
          console.warn("Order saved locally, but cloud sync failed.", cloudSave.reason);
        }
        if (emailSave.status === "rejected" || emailSave.value?.ok === false) {
          console.warn("Order email could not be sent.", emailSave.status === "rejected" ? emailSave.reason : emailSave.value?.result);
        }
      });

      await waitForOrderConfirmationReveal();
      writeCheckoutSuccessSession(id);
      replaceCheckoutHistoryWithSuccess(id);
      router.replace(`/checkout?success=${encodeURIComponent(id)}`, { scroll: false });
      setSubmitted(true);
      clearCart();
    } catch (submitError) {
      console.warn("Order submit failed.", submitError);
      paymentSubmitLockedRef.current = false;
      setIsSubmitting(false);
      setError("Could not place order. Please try again.");
    }
  };

  if (submitted) {
    return (
      <main className="order-success-shell">
        <section className="order-success-card" aria-live="polite">
          <div className="order-success-visual" aria-hidden="true">
            <div className="success-orbit success-orbit-one" />
            <div className="success-orbit success-orbit-two" />
            <div className="success-cube">
              <span className="success-cube-face success-cube-front"><CheckCircle2 size={44} /></span>
              <span className="success-cube-face success-cube-top" />
              <span className="success-cube-face success-cube-side" />
            </div>
            <div className="success-road">
              <span />
              <Truck size={44} />
            </div>
          </div>
          <p className="eyebrow">Payment confirmation sent</p>
          <h1>Order Successful</h1>
          <p className="order-success-subtitle">Your order is on the way. We have received your payment details and will verify your order shortly.</p>
          <div className="order-success-id">
            <span>Order ID</span>
            <strong>{orderId}</strong>
          </div>
          <div className="order-success-actions">
            <Link className="primary-button" href={`/account/orders/${orderId}?from=success`} replace>View order</Link>
            <Link className="success-secondary-button" href="/" replace>Continue shopping</Link>
          </div>
        </section>
      </main>
    );
  }

  if (authLoading || !user) {
    return (
      <main className="checkout-shell">
        <section className="checkout-summary">
          <p className="eyebrow">Checkout</p>
          <h1>Customer Login</h1>
          <p className="empty-cart">Taking you to customer login before checkout...</p>
        </section>
      </main>
    );
  }

  if (checkoutStage === "payment") {
    return (
      <main className={`final-payment-shell ${isSubmitting ? "is-submitting" : ""}`}>
        {isSubmitting ? (
          <div className="payment-submit-overlay" role="status" aria-live="polite">
            <div className="payment-submit-wait-card">
              <span className="payment-submit-spinner" aria-hidden="true" />
              <strong>Please wait</strong>
              <p>Confirming your payment details...</p>
            </div>
          </div>
        ) : null}
        <section className="final-payment-main">
          <article className="final-payment-hero">
            <div className="final-payment-title">
              <span><LockKeyhole size={21} /></span>
              <div>
                <h1>Final Payment</h1>
                <p>Complete the payment and confirm your order.</p>
              </div>
            </div>
          </article>

          <article className="final-payment-card">
            <div className="final-payment-section-head">
              <h2>Pay the Seller</h2>
              <p>Scan and pay the exact amount to the seller using the QR code below.</p>
            </div>
            <div className="final-payment-seller-grid">
              <div>
                <div className="payment-qr-placeholder" aria-label="UPI QR code">
                  <Image
                    src="/images/QR%20Code.png"
                    alt="UPI payment QR code"
                    width={900}
                    height={880}
                    className="payment-qr-image"
                  />
                </div>
                <p className="upi-app-note">Scan with any UPI app</p>
                <div className="upi-app-row" aria-label="Supported UPI apps">
                  <span className="upi-app-logo upi-app-logo-phonepe"><img src="/images/payment-app-logos/phonepay-removebg-preview.png" alt="PhonePe" /></span>
                  <span className="upi-app-logo upi-app-logo-gpay"><img src="/images/payment-app-logos/Google_pay-removebg-preview.png" alt="GPay" /></span>
                  <span className="upi-app-logo upi-app-logo-paytm"><img src="/images/payment-app-logos/paytm-removebg-preview.png" alt="Paytm" /></span>
                  <span className="upi-app-logo upi-app-logo-bhim"><img src="/images/payment-app-logos/Bhim-removebg-preview.png" alt="BHIM" /></span>
                </div>
              </div>
              <div className="seller-details">
                <h3>Seller Details</h3>
                <p><span>Name</span><strong>Aditya Singh Rathore</strong></p>
                <p><span>UPI ID</span><strong>rathore@19fam</strong></p>
                <p><span>Amount to Pay</span><b>{formatPrice(total)}</b></p>
              </div>
            </div>
            <div className="payment-secure-strip">
              <ShieldCheck size={18} />
              <span>Payment is secured. Your payment details are never stored.</span>
            </div>
          </article>

          <form className="final-payment-confirm-card" onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <input className="spam-field" name="companyWebsite" tabIndex={-1} autoComplete="off" />
            <div className="final-payment-section-head">
              <h2>Confirm Your Payment</h2>
              <p>After making the payment, upload the screenshot and enter UTR number.</p>
            </div>
            <div className="payment-confirm-grid">
              <label className="payment-upload-box">
                <span>Upload Payment Screenshot</span>
                <input
                  name="payment"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  required
                  disabled={isSubmitting}
                  onChange={(event) => setPaymentFileName(event.target.files?.[0]?.name || "")}
                />
                <i><UploadCloud size={28} /></i>
                <strong>{paymentFileName || "Click to upload screenshot"}</strong>
                <small>PNG, JPG or JPEG (Max. 5MB)</small>
              </label>
              <label className="payment-utr-field">
                <span>Enter UTR Number</span>
                <input
                  name="utr"
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  pattern="\d{12}"
                  placeholder="Enter 12 digit UTR number"
                  required
                  disabled={isSubmitting}
                  onChange={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 12);
                  }}
                />
                <small>You can find UTR in your payment app transaction history.</small>
              </label>
            </div>
            {isSubmitting ? <p className="checkout-processing-note">Please wait, placing your order...</p> : null}
            {error ? <p className="checkout-error">{error}</p> : null}
            <button className="final-payment-proceed" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : "Proceed"}
              <ArrowRight size={19} />
            </button>
          </form>
        </section>

        <aside className="final-payment-sidebar">
          <section className="final-order-summary-card">
            <div className="final-sidebar-head">
              <h2>Order Summary</h2>
              <button type="button" onClick={() => setCheckoutStage("summary")}>Edit</button>
            </div>
            <div className="final-sidebar-products">
              {items.map((item) => (
                <article className="final-sidebar-product" key={item.id}>
                  {item.image ? (
                    <Image src={item.image} alt="" width={84} height={84} sizes="84px" unoptimized={item.image.startsWith("data:")} />
                  ) : null}
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.category || "Trading cards"}</span>
                    <p>Qty: {item.quantity}</p>
                    <b>{formatPrice(item.price * item.quantity)}</b>
                  </div>
                </article>
              ))}
            </div>
            <div className="final-price-details">
              <h3>Price Details</h3>
              <div>
                <p><span>Price ({items.length} item{items.length === 1 ? "" : "s"})</span><strong>{formatPrice(subtotal)}</strong></p>
                <p><span>Shipping charge</span><strong>{formatPrice(shippingCharge)}</strong></p>
                {discountAmount > 0 ? (
                  <p className="flip-discount-row"><span>Coupon discount {appliedCoupon?.code ? `(${appliedCoupon.code})` : ""}</span><strong>-{formatPrice(discountAmount)}</strong></p>
                ) : null}
                <p><span>Total Payable</span><strong>{formatPrice(total)}</strong></p>
              </div>
            </div>
            <p className="flip-savings">Your Total Savings on this order Rs. {discountAmount}</p>
          </section>
          <div className="flip-secure-note">
            <ShieldCheck size={38} />
            <strong>Safe and Secure Payments. Easy returns. 100% Authentic products.</strong>
          </div>
          <p className="flip-policy-note">By continuing with the order, you confirm that you agree to Freaking Collectibles' Terms of Use and Privacy Policy.</p>
        </aside>
      </main>
    );
  }

  return (
    <main className="flip-checkout-shell">
      <section className="flip-checkout-flow">
        <article className="checkout-step checkout-login-step">
          <header>
            <span>1</span>
            <h2>Login</h2>
            <CheckCircle2 size={18} />
          </header>
          <p><strong>{profile?.name || user.displayName || "Customer"}</strong> {profile?.phone || addressForm.phone || ""}</p>
        </article>

        <div className="checkout-progress-card" aria-label="Checkout progress">
          <div className={`checkout-progress-step ${isAddressSaved ? "is-done" : "is-current"}`}>
            <span>{isAddressSaved ? <CheckCircle2 size={18} /> : "1"}</span>
            <strong>Address</strong>
          </div>
          <div className="checkout-progress-line" />
          <div className={`checkout-progress-step ${checkoutStage === "summary" ? "is-current" : checkoutStage === "payment" ? "is-done" : ""}`}>
            <span>2</span>
            <strong>Order Summary</strong>
          </div>
          <div className="checkout-progress-line" />
          <div className={`checkout-progress-step ${checkoutStage === "payment" ? "is-current" : ""}`}>
            <span>3</span>
            <strong>Payment</strong>
          </div>
        </div>

        <article className={`checkout-step ${isAddressSaved ? "is-complete" : "is-active"}`}>
          <header>
            <span>{isAddressSaved ? <CheckCircle2 size={16} /> : "2"}</span>
            <h2>Delivery Address</h2>
          </header>
          {isAddressSaved ? (
            <div className="checkout-selected-address-card">
              <div>
                <span>{addressForm.label || "Home"}</span>
                <strong>{addressForm.name || "Customer"} {addressForm.phone ? <small>{addressForm.phone}</small> : null}</strong>
                <p>{buildAddressLine(addressForm)}</p>
              </div>
              <button type="button" onClick={() => {
                setIsAddressSaved(false);
                setCheckoutStage("address");
              }}>
                Change
              </button>
            </div>
          ) : (
          <form className="flip-address-form" onSubmit={handleAddressSave}>
            <label className="flip-radio-row">
              <input type="radio" checked readOnly />
              Add a new address
            </label>
            <button className="flip-location-button" type="button" onClick={handleUseCurrentLocation} disabled={isLocating}>
              <MapPin size={18} />
              {isLocating ? "Detecting location..." : "Use my current location"}
            </button>
            {addressAssist.message ? (
              <p className={`address-autofill-status ${addressAssist.tone ? `is-${addressAssist.tone}` : ""}`} role="status">
                {addressAssist.message}
              </p>
            ) : null}
            <div className="flip-address-grid">
              <input value={addressForm.name} onChange={(event) => updateAddressField("name", event.target.value)} placeholder="Name" required />
              <input value={addressForm.phone} onChange={(event) => updateAddressField("phone", event.target.value)} placeholder="10-digit mobile number" required inputMode="tel" />
              <input value={addressForm.pincode} onChange={(event) => updateAddressField("pincode", event.target.value)} placeholder="Pincode" required inputMode="numeric" maxLength={6} />
              <input value={addressForm.locality} onChange={(event) => updateAddressField("locality", event.target.value)} placeholder="Locality" required />
              <textarea value={addressForm.line1} onChange={(event) => updateAddressField("line1", event.target.value)} placeholder="Address (Area and Street)" required />
              <input value={addressForm.city} onChange={(event) => updateAddressField("city", event.target.value)} placeholder="City/District/Town" required />
              <select value={addressForm.state} onChange={(event) => updateAddressField("state", event.target.value)} required>
                <option value="">--Select State--</option>
                {INDIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              <input value={addressForm.landmark} onChange={(event) => updateAddressField("landmark", event.target.value)} placeholder="Landmark (Optional)" />
              <input value={addressForm.alternatePhone} onChange={(event) => updateAddressField("alternatePhone", event.target.value)} placeholder="Alternate Phone (Optional)" inputMode="tel" />
            </div>
            <fieldset className="flip-address-type">
              <legend>Address Type</legend>
              <label>
                <input type="radio" checked={addressForm.label === "Home"} onChange={() => updateAddressField("label", "Home")} />
                Home (All day delivery)
              </label>
              <label>
                <input type="radio" checked={addressForm.label === "Work"} onChange={() => updateAddressField("label", "Work")} />
                Work (Delivery between 10 AM - 5 PM)
              </label>
            </fieldset>
            {error ? <p className="checkout-error">{error}</p> : null}
            <button className="flip-save-deliver-button" type="submit" disabled={isSavingAddress}>
              {isSavingAddress ? "Saving..." : "Save and Deliver Here"}
            </button>
          </form>
          )}
        </article>

        <article className={`checkout-step checkout-order-step checkout-summary-stage ${isAddressSaved ? "is-summary-open" : ""}`}>
          <header>
            <span>3</span>
            <h2>Order Summary</h2>
          </header>
          {isAddressSaved ? (
            <div className="checkout-order-summary">
              <div className="checkout-deliver-to">
                <div>
                  <span>Deliver to:</span>
                  <strong>{addressForm.name || "Customer"}</strong>
                  <p>{buildAddressLine(addressForm)}</p>
                  <p>{addressForm.phone}</p>
                </div>
                <button type="button" onClick={() => {
                  setIsAddressSaved(false);
                  setCheckoutStage("address");
                }}>
                  Change
                </button>
              </div>
              <div className="checkout-summary-products">
                {items.map((item) => (
                  <article className="checkout-summary-product" key={item.id}>
                    {item.image ? (
                      <Image src={item.image} alt="" width={92} height={92} sizes="92px" unoptimized={item.image.startsWith("data:")} />
                    ) : null}
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.category || "Trading cards"}</span>
                      <p>Qty: {item.quantity}</p>
                      <b>{formatPrice(item.price * item.quantity)}</b>
                    </div>
                    <small><Truck size={16} /> Delivery by tomorrow</small>
                  </article>
                ))}
              </div>
              <button className="checkout-continue-button" type="button" onClick={openPaymentStage}>
                Continue
              </button>
            </div>
          ) : null}
        </article>
      </section>

      <aside className="flip-price-sidebar">
        <section>
          <h2>Price Details</h2>
          <div className="flip-price-box">
            <p><span>Price ({items.length} item{items.length === 1 ? "" : "s"})</span><strong>{formatPrice(subtotal)}</strong></p>
            <p><span>Shipping charge</span><strong>{formatPrice(shippingCharge)}</strong></p>
            {discountAmount > 0 ? (
              <p className="flip-discount-row"><span>Coupon discount {appliedCoupon?.code ? `(${appliedCoupon.code})` : ""}</span><strong>-{formatPrice(discountAmount)}</strong></p>
            ) : null}
            <p><span>Total Payable</span><strong>{formatPrice(total)}</strong></p>
          </div>
          <p className="flip-savings">Your Total Savings on this order Rs. {discountAmount}</p>
        </section>
        <div className="flip-secure-note">
          <ShieldCheck size={38} />
          <strong>Safe and Secure Payments. Easy returns. 100% Authentic products.</strong>
        </div>
        <p className="flip-policy-note">By continuing with the order, you confirm that you agree to Freaking Collectibles' Terms of Use and Privacy Policy.</p>
      </aside>
    </main>
  );
}
