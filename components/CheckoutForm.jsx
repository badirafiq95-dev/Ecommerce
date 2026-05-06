"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { useProductCatalog } from "./useProductCatalog";
import { useCustomerAuth } from "./CustomerAuthProvider";
import { formatPrice } from "../lib/format";
import { generateOrderId, saveOrder } from "../lib/orders";
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

export function CheckoutForm() {
  const { items, subtotal, shippingCharge, discountAmount, total, appliedCoupon, clearCart } = useCart();
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setCheckoutStage("summary");
    }
  }, [profile, user]);

  const updateAddressField = (field, value) => {
    setAddressForm((current) => ({ ...current, [field]: value }));
    setIsAddressSaved(false);
    setCheckoutStage("address");
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
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const email = user?.email || "";
    const honeypot = String(form.get("companyWebsite") || "").trim();
    const secondsOnPage = (Date.now() - startedAt) / 1000;

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

    setError("");
    setIsSubmitting(true);
    const id = generateOrderId();
    try {
      const paymentScreenshot = await readPaymentScreenshot(form.get("payment"));
      const addressLine = buildAddressLine(addressForm);
      const order = {
        id,
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
          couponCode: appliedCoupon?.label || "",
          total
        },
        status: "Payment review",
        createdAt: new Date().toISOString(),
        paymentScreenshot,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        }))
      };
      saveOrder(order);
      await saveCustomerOrder(order, user);
      await sendOrderEmail("created", order);
      reduceStock(items);
      setOrderId(id);
      setSubmitted(true);
      clearCart();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="success-panel">
        <CheckCircle2 size={44} />
        <h1>Order request received.</h1>
        <p>Order ID {orderId} is ready for manual confirmation. The admin panel will show this order.</p>
        <Link className="primary-button" href="/">Continue shopping</Link>
      </section>
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
            <button className="flip-location-button" type="button">
              <MapPin size={18} />
              Use my current location
            </button>
            <div className="flip-address-grid">
              <input value={addressForm.name} onChange={(event) => updateAddressField("name", event.target.value)} placeholder="Name" required />
              <input value={addressForm.phone} onChange={(event) => updateAddressField("phone", event.target.value)} placeholder="10-digit mobile number" required inputMode="tel" />
              <input value={addressForm.pincode} onChange={(event) => updateAddressField("pincode", event.target.value)} placeholder="Pincode" required inputMode="numeric" />
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
              <button className="checkout-continue-button" type="button" onClick={() => setCheckoutStage("payment")}>
                Continue
              </button>
              {checkoutStage === "payment" ? (
                <div className="checkout-payment-placeholder">
                  <strong>Payment step ready</strong>
                  <p>Next payment page can be connected here.</p>
                </div>
              ) : null}
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
              <p className="flip-discount-row"><span>Coupon discount {appliedCoupon?.label ? `(${appliedCoupon.label})` : ""}</span><strong>-{formatPrice(discountAmount)}</strong></p>
            ) : null}
            <p><span>Total Payable</span><strong>{formatPrice(total)}</strong></p>
          </div>
          <p className="flip-savings">Your Total Savings on this order Rs. {discountAmount}</p>
        </section>
        <div className="flip-secure-note">
          <ShieldCheck size={38} />
          <strong>Safe and Secure Payments. Easy returns. 100% Authentic products.</strong>
        </div>
        <p className="flip-policy-note">By continuing with the order, you confirm that you agree to Mint Lane's Terms of Use and Privacy Policy.</p>
      </aside>
    </main>
  );
}
