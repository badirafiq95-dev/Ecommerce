"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogOut, UserRound, XCircle } from "lucide-react";
import { CartDrawer } from "../../components/CartDrawer";
import { Header } from "../../components/Header";
import { useCustomerAuth } from "../../components/CustomerAuthProvider";
import {
  auth,
  getAppCheckHeaders,
  listenCustomerOrders,
  listenCustomerProfile,
  loginWithGoogle,
  logoutCustomer,
  prepareGoogleLogin,
  upsertCustomerProfile
} from "../../lib/firebaseClient";
import { formatPrice } from "../../lib/format";
import { readCustomerLocalOrders } from "../../lib/orders";

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

const PHONE_PREFIX = "+91";

function getIndianMobileDigits(value) {
  const rawValue = String(value || "");
  const digits = rawValue.replace(/\D/g, "");
  const hasCountryPrefix = rawValue.trim().startsWith(PHONE_PREFIX) || (digits.length > 10 && digits.startsWith("91"));
  const localDigits = hasCountryPrefix ? digits.slice(2) : digits;
  return localDigits.slice(0, 10);
}

function normalizeIndianMobile(value, keepPrefix = false) {
  const rawValue = String(value || "");
  if (keepPrefix && ["", "+", "+9", "+91", "9", "91"].includes(rawValue.trim())) return PHONE_PREFIX;
  const localDigits = getIndianMobileDigits(rawValue);
  if (!keepPrefix && !localDigits) return "";
  return `${PHONE_PREFIX}${localDigits}`;
}

function getSavableIndianMobile(value) {
  const localDigits = getIndianMobileDigits(value);
  return localDigits ? `${PHONE_PREFIX}${localDigits}` : "";
}

function keepPhonePrefixOnDelete(event) {
  if (event.key !== "Backspace" && event.key !== "Delete") return;
  const input = event.currentTarget;
  if (input.selectionStart <= PHONE_PREFIX.length && input.selectionEnd <= PHONE_PREFIX.length) {
    event.preventDefault();
  }
}

function keepPhoneCursorAfterPrefix(event) {
  const input = event.currentTarget;
  if (input.selectionStart < PHONE_PREFIX.length) {
    window.requestAnimationFrame(() => input.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length));
  }
}

function splitProfileName(name) {
  const parts = String(name || "").split(/[.\s_-]+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

function getReadableDate(value) {
  if (!value) return "Recently";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toLocaleString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
}

function normalizePincode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function normalizeAddressPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const localDigits = digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  return localDigits.slice(0, 10);
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

function authErrorMessage(error) {
  if (error?.code === "auth/unauthorized-domain") {
    const currentDomain =
      typeof window !== "undefined" && window.location?.hostname
        ? window.location.hostname
        : "current website domain";
    const firebaseProject =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your Firebase project";
    return `Firebase login blocked hai kyunki "${currentDomain}" "${firebaseProject}" project ke Authorized domains me add nahi hai. Firebase Console me same project open karke Authentication > Settings > Authorized domains me is domain ko add karo, phir refresh karke login try karo.`;
  }
  if (error?.code === "auth/popup-closed-by-user") {
    return "Login cancelled";
  }
  if (error?.code === "auth/popup-blocked") {
    return "Google login popup was blocked. Please allow popups for this website and try again.";
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "Google login is not enabled in Firebase.";
  }
  if (error?.code === "auth/network-request-failed") {
    return "Authentication failed. Please check your connection.";
  }
  if (error?.code === "auth/popup-timeout") {
    return "Authentication timed out. Please try again.";
  }
  if (error?.code?.startsWith("auth/")) {
    return "Authentication failed. Please try again.";
  }
  return error?.message || "Authentication failed. Please try again.";
}

function AuthPanel() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const authAttemptRef = useRef(0);
  const focusTimerRef = useRef(null);
  const armFocusWatchRef = useRef(null);

  useEffect(() => {
    prepareGoogleLogin();
    return () => {
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      if (armFocusWatchRef.current) window.clearTimeout(armFocusWatchRef.current);
    };
  }, []);

  const handleGoogleAuth = async () => {
    const attemptId = authAttemptRef.current + 1;
    authAttemptRef.current = attemptId;
    let focusWatchArmed = false;

    const clearAuthTimers = () => {
      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      if (armFocusWatchRef.current) {
        window.clearTimeout(armFocusWatchRef.current);
        armFocusWatchRef.current = null;
      }
    };

    const handlePossiblePopupReturn = () => {
      if (!focusWatchArmed || authAttemptRef.current !== attemptId) return;
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = window.setTimeout(() => {
        if (authAttemptRef.current !== attemptId) return;
        authAttemptRef.current += 1;
        setLoading(false);
        setError("Login cancelled");
      }, 700);
    };

    clearAuthTimers();
    setError("");
    setLoading(true);
    window.addEventListener("focus", handlePossiblePopupReturn);
    document.addEventListener("visibilitychange", handlePossiblePopupReturn);
    armFocusWatchRef.current = window.setTimeout(() => {
      focusWatchArmed = true;
    }, 500);

    try {
      await loginWithGoogle();
      if (authAttemptRef.current !== attemptId) return;
      setError("");
    } catch (error) {
      if (authAttemptRef.current !== attemptId) return;
      setError(authErrorMessage(error));
    } finally {
      window.removeEventListener("focus", handlePossiblePopupReturn);
      document.removeEventListener("visibilitychange", handlePossiblePopupReturn);
      clearAuthTimers();
      if (authAttemptRef.current === attemptId) {
        setLoading(false);
      }
    }
  };

  return (
    <main className="account-shell">
      <section className="account-auth-card">
        <div className="admin-badge">
          <UserRound size={22} />
        </div>
        <p className="eyebrow">Customer safety</p>
        <h1>Customer Login</h1>
        <p>Track orders, save payment details, edit your profile, and request cancellation from one secure dashboard.</p>

        <div className="auth-choice-grid google-only-auth">
          <button
            type="button"
            onClick={handleGoogleAuth}
            onFocus={prepareGoogleLogin}
            onPointerEnter={prepareGoogleLogin}
            disabled={loading}
          >
            <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.53Z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.29.31-1.88v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.48l3.35-2.6Z" />
              <path fill="#EA4335" d="M12 6c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.96 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.35 2.6C7.2 7.76 9.4 6 12 6Z" />
            </svg>
            <span className="google-login-text">{loading ? "Connecting..." : "Continue with Google"}</span>
          </button>
        </div>
        {error ? <p className="checkout-error">{error}</p> : null}
      </section>
    </main>
  );
}

function CustomerDashboard({ user }) {
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stopProfile = listenCustomerProfile(user.uid, setProfile);
    const syncLocalOrders = () => setOrders(readCustomerLocalOrders(user.uid, user.email));
    syncLocalOrders();
    const stopOrders = listenCustomerOrders(user.uid, setOrders, user.email);
    window.addEventListener("mint-lane-orders-updated", syncLocalOrders);
    window.addEventListener("storage", syncLocalOrders);
    return () => {
      stopProfile();
      stopOrders();
      window.removeEventListener("mint-lane-orders-updated", syncLocalOrders);
      window.removeEventListener("storage", syncLocalOrders);
    };
  }, [user.uid, user.email]);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await upsertCustomerProfile(user, {
      name: String(form.get("name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      address: String(form.get("address") || "").trim(),
      paymentNote: String(form.get("paymentNote") || "").trim()
    });
    setNotice("Profile saved");
    window.setTimeout(() => setNotice(""), 1800);
  };

  const requestCancel = async (order) => {
    if (!cancelReason.trim()) return;
    const token = await auth.currentUser?.getIdToken();
    const appCheckHeaders = await getAppCheckHeaders();
    await fetch(`/api/orders/${order.id}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...appCheckHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ cancelReason: cancelReason.trim() })
    });
    setCancelOrderId("");
    setCancelReason("");
  };

  return (
    <main className="customer-dashboard">
      <section className="customer-hero">
        <div>
          <p className="eyebrow">Customer dashboard</p>
          <h1>Order tracking</h1>
          <p>{user.isAnonymous ? "Anonymous customer" : user.email}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logoutCustomer}>
          <LogOut size={18} />
          Logout
        </button>
      </section>

      <section className="customer-grid">
        <form className="customer-panel" onSubmit={handleProfileSave}>
          <div className="admin-card-head">
            <div>
              <p className="eyebrow">Profile</p>
              <h2>Edit details</h2>
            </div>
            {notice ? <span className="save-status">{notice}</span> : null}
          </div>
          <input name="name" defaultValue={profile?.name || user.displayName || ""} placeholder="Customer name" />
          <input name="phone" defaultValue={profile?.phone || ""} placeholder="Phone number" />
          <textarea name="address" defaultValue={profile?.address || ""} placeholder="Saved address" rows={4} />
          <textarea name="paymentNote" defaultValue={profile?.paymentNote || ""} placeholder="Saved payment details / UPI note" rows={3} />
          <button className="save-button" type="submit">
            <CheckCircle2 size={18} />
            Save profile
          </button>
        </form>

        <section className="customer-panel">
          <p className="eyebrow">Orders</p>
          <h2>Your orders</h2>
          <div className="customer-orders-list">
            {orders.length === 0 ? (
              <p className="empty-cart">No orders are linked to this account yet.</p>
            ) : (
              orders.map((order) => (
                <article className="customer-order-card" key={order.id}>
                  <div className="customer-order-head">
                    <div>
                      <strong>{order.id}</strong>
                      <span>{new Date(order.createdAt).toLocaleString()}</span>
                    </div>
                    <span className={`stock-pill ${order.status === "Approved" ? "in-stock" : order.status === "Rejected" ? "rejected-status" : "low-stock"}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="order-items">
                    {(order.items || []).map((item) => (
                      <div className="order-item" key={`${order.id}-${item.id}`}>
                        <span>{item.name} x {item.quantity}</span>
                        <strong>{formatPrice(item.price * item.quantity)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="total-row">
                    <span>Total</span>
                    <strong>{formatPrice(order.total || 0)}</strong>
                  </div>
                  {order.paymentScreenshot?.name ? (
                    <p className="payment-note">Payment screenshot saved: {order.paymentScreenshot.name}</p>
                  ) : null}
                  {order.status === "Approved" || order.status === "Payment review" ? (
                    cancelOrderId === order.id ? (
                      <div className="cancel-request-box">
                        <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} placeholder="Reason for cancellation" />
                        <div className="order-actions">
                          <button className="reject-button" type="button" onClick={() => requestCancel(order)}>
                            Send request
                          </button>
                          <button className="secondary-button compact" type="button" onClick={() => setCancelOrderId("")}>Close</button>
                        </div>
                      </div>
                    ) : (
                      <button className="reject-button" type="button" onClick={() => setCancelOrderId(order.id)}>
                        <XCircle size={16} />
                        Request cancellation
                      </button>
                    )
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function CustomerProfilePage({ user, initialSection = "profile" }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [orders, setOrders] = useState([]);
  const [addressDrafts, setAddressDrafts] = useState([{ label: "Home", line: "" }]);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [openAddressMenu, setOpenAddressMenu] = useState(null);
  const [addressForm, setAddressForm] = useState({
    name: "",
    phone: "",
    pincode: "",
    locality: "",
    line: "",
    city: "",
    state: "",
    landmark: "",
    alternatePhone: "",
    label: "Home"
  });
  const [profileDraft, setProfileDraft] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    phone: "",
    address: ""
  });
  const [isStateMenuOpen, setIsStateMenuOpen] = useState(false);
  const [isStateMenuPinned, setIsStateMenuPinned] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const stateCloseTimerRef = useRef(null);
  const profileNoticeTimerRef = useRef(null);
  const [notice, setNotice] = useState("");
  const [noticeToken, setNoticeToken] = useState(0);
  const [addressNotice, setAddressNotice] = useState("");
  const [addressAssist, setAddressAssist] = useState({ tone: "", message: "" });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const baseName = profile?.name || user.displayName || user.email?.split("@")[0] || "";
  const { firstName, lastName } = splitProfileName(baseName);

  useEffect(() => {
    return listenCustomerProfile(user.uid, setProfile);
  }, [user.uid]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const syncLocalOrders = () => setOrders(readCustomerLocalOrders(user.uid, user.email));
    syncLocalOrders();
    const stopOrders = listenCustomerOrders(user.uid, setOrders, user.email);
    window.addEventListener("mint-lane-orders-updated", syncLocalOrders);
    window.addEventListener("storage", syncLocalOrders);
    return () => {
      stopOrders();
      window.removeEventListener("mint-lane-orders-updated", syncLocalOrders);
      window.removeEventListener("storage", syncLocalOrders);
    };
  }, [user.uid, user.email]);

  useEffect(() => {
    return () => {
      if (profileNoticeTimerRef.current) window.clearTimeout(profileNoticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAddressFormOpen) return undefined;
    const pincode = normalizePincode(addressForm.pincode);
    if (pincode.length !== 6) {
      setAddressAssist({ tone: "", message: "" });
      return undefined;
    }

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
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setAddressAssist({ tone: "error", message: "Could not fetch pincode details." });
      });

    return () => controller.abort();
  }, [addressForm.pincode, isAddressFormOpen]);

  useEffect(() => {
    if (profile) return;
    const fallbackName = splitProfileName(user.displayName || user.email?.split("@")[0] || "");
    setProfileDraft((current) => {
      const hasDraftValue =
        current.firstName ||
        current.lastName ||
        current.gender ||
        current.address ||
        current.phone;

      return hasDraftValue
        ? current
        : {
            firstName: fallbackName.firstName,
            lastName: fallbackName.lastName,
            gender: "",
            phone: "",
            address: ""
          };
    });
  }, [profile, user.displayName, user.email]);

  useEffect(() => {
    if (!profile) return;
    const nextName = splitProfileName(profile.name || user.displayName || user.email?.split("@")[0] || "");
    setProfileDraft({
      firstName: nextName.firstName,
      lastName: nextName.lastName,
      gender: profile.gender || "",
      phone: normalizeIndianMobile(profile.phone || ""),
      address: profile.address || ""
    });

    const savedAddresses = Array.isArray(profile.addresses) ? profile.addresses : [];
    if (savedAddresses.length) {
      setAddressDrafts(savedAddresses);
      return;
    }

    setAddressDrafts(profile.address ? [{ label: "Home", line: profile.address, name: baseName, phone: profile.phone || "" }] : []);
  }, [profile]);

  const updateProfileDraft = (field, value) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const nextFirstName = profileDraft.firstName.trim();
    const nextLastName = profileDraft.lastName.trim();
    const normalizedPhone = getSavableIndianMobile(profileDraft.phone);
    const nextProfile = {
      ...(profile || {}),
      uid: user.uid,
      name: [nextFirstName, nextLastName].filter(Boolean).join(" "),
      email: user.email || profile?.email || "",
      isAnonymous: user.isAnonymous,
      gender: profileDraft.gender,
      phone: normalizedPhone,
      address: profileDraft.address.trim(),
      addresses: addressDrafts,
      updatedAt: new Date().toISOString()
    };

    setProfileDraft((current) => ({ ...current, phone: normalizedPhone }));
    setProfile(nextProfile);
    if (profileNoticeTimerRef.current) window.clearTimeout(profileNoticeTimerRef.current);
    setNotice("Changes saved");
    setNoticeToken(Date.now());
    profileNoticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      profileNoticeTimerRef.current = null;
    }, 2200);

    upsertCustomerProfile(user, nextProfile).catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Firebase] Profile save queued locally:", error?.message || error);
      }
    });
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    window.setTimeout(async () => {
      await logoutCustomer();
      router.replace("/");
      window.setTimeout(() => setIsLoggingOut(false), 250);
    }, 1350);
  };

  const formatAddressLine = (address) =>
    [address.line, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(", ");

  const resetAddressForm = () => {
    setAddressForm({
      name: "",
      phone: normalizeAddressPhone(profile?.phone || ""),
      pincode: "",
      locality: "",
      line: "",
      city: "",
      state: "",
      landmark: "",
      alternatePhone: "",
      label: "Home"
    });
    setAddressAssist({ tone: "", message: "" });
  };

  const addAddressDraft = () => {
    setEditingAddressIndex(null);
    resetAddressForm();
    setIsAddressFormOpen(true);
    setIsStateMenuOpen(false);
    setIsStateMenuPinned(false);
    setOpenAddressMenu(null);
  };

  const editAddressDraft = (index) => {
    const address = addressDrafts[index];
    setEditingAddressIndex(index);
    setAddressForm({
      name: address.name || baseName || "",
      phone: normalizeAddressPhone(address.phone || profile?.phone || ""),
      pincode: address.pincode || "",
      locality: address.locality || "",
      line: address.line || "",
      city: address.city || "",
      state: address.state || "",
      landmark: address.landmark || "",
      alternatePhone: normalizeAddressPhone(address.alternatePhone || ""),
      label: address.label || "Home"
    });
    setAddressAssist({ tone: "", message: "" });
    setIsAddressFormOpen(true);
    setIsStateMenuOpen(false);
    setIsStateMenuPinned(false);
    setOpenAddressMenu(null);
  };

  const deleteAddressDraft = (index) => {
    const next = addressDrafts.filter((_, currentIndex) => currentIndex !== index);
    setAddressDrafts(next);
    setOpenAddressMenu(null);
    upsertCustomerProfile(user, {
      addresses: next,
      address: next[0]?.line || ""
    });
  };

  const saveAddressForm = async (event) => {
    event.preventDefault();
    setIsSavingAddress(true);
    const normalizedAddressForm = {
      ...addressForm,
      phone: normalizeAddressPhone(addressForm.phone),
      alternatePhone: normalizeAddressPhone(addressForm.alternatePhone),
      pincode: normalizePincode(addressForm.pincode)
    };
    const nextAddress = {
      ...normalizedAddressForm,
      label: normalizedAddressForm.label || "Home",
      line: formatAddressLine(normalizedAddressForm)
    };
    const nextAddresses =
      editingAddressIndex === null
        ? [...addressDrafts, nextAddress]
        : addressDrafts.map((address, index) => (index === editingAddressIndex ? nextAddress : address));

    await upsertCustomerProfile(user, {
      addresses: nextAddresses,
      address: nextAddresses[0]?.line || "",
      phone: profile?.phone || nextAddress.phone
    });
    setAddressDrafts(nextAddresses);
    setAddressNotice("Addresses saved");
    window.setTimeout(() => {
      setAddressNotice("");
      setIsSavingAddress(false);
      setIsAddressFormOpen(false);
      setEditingAddressIndex(null);
      setAddressAssist({ tone: "", message: "" });
    }, 650);
  };

  const switchProfileSection = (section) => {
    if (section !== "addresses") {
      setIsAddressFormOpen(false);
      setEditingAddressIndex(null);
      setOpenAddressMenu(null);
      setIsStateMenuOpen(false);
      setIsStateMenuPinned(false);
      resetAddressForm();
    }
    setActiveSection(section);
  };

  const logoutOverlay =
    isLoggingOut && typeof document !== "undefined"
      ? createPortal(
          <div className="logout-overlay customer-logout-overlay" aria-live="polite">
            <div className="logout-card customer-logout-card">
              <div className="logout-icon">
                <LogOut size={42} />
              </div>
              <p className="eyebrow">Customer exit</p>
              <h2>Logging Out</h2>
              <span>Securing your profile session...</span>
            </div>
          </div>,
          document.body
        )
      : null;

  const renderActivePanel = () => {
    if (activeSection === "orders") {
      return (
        <section className="customer-profile-panel profile-content-panel">
          <div className="profile-panel-head">
            <div>
              <p className="eyebrow">My Orders</p>
              <h1>Order history</h1>
            </div>
          </div>
          <div className="profile-orders-toolbar">
            <input placeholder="Search your orders here" />
            <button type="button">Search Orders</button>
          </div>
          <div className="profile-orders-list">
            {orders.length === 0 ? (
              <p className="empty-cart">No orders are linked to this account yet.</p>
            ) : (
              orders.map((order) => (
                <article className="profile-order-row" key={order.id}>
                  <div>
                    <strong>{order.id}</strong>
                    <span>{new Date(order.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    {(order.items || []).slice(0, 2).map((item) => (
                      <span key={`${order.id}-${item.id}`}>{item.name} x {item.quantity}</span>
                    ))}
                  </div>
                  <strong>{formatPrice(order.total || 0)}</strong>
                  <span className="profile-order-status">{order.status}</span>
                </article>
              ))
            )}
          </div>
        </section>
      );
    }

    if (activeSection === "addresses") {
      const savedAddresses = addressDrafts.filter((address) => address.line?.trim());
      const hasSavedAddress = savedAddresses.length > 0;

      return (
        <section className={`address-book-panel ${isSavingAddress ? "is-saving-address" : ""}`}>
          <div className="address-book-head">
            <h1>Manage Addresses</h1>
            {addressNotice ? <span className="save-status">{addressNotice}</span> : null}
          </div>

          <button className="address-add-strip" type="button" onClick={addAddressDraft}>
            <span>+</span>
            ADD A NEW ADDRESS
          </button>

          {isAddressFormOpen ? (
            <form className="address-entry-form" onSubmit={saveAddressForm}>
              <p>ADD A NEW ADDRESS</p>
              <button className="address-location-button" type="button">Use my current location</button>
              {addressAssist.message ? (
                <p className={`address-autofill-status ${addressAssist.tone ? `is-${addressAssist.tone}` : ""}`} role="status">
                  {addressAssist.message}
                </p>
              ) : null}
              <div className="address-entry-grid">
                <input value={addressForm.name} onChange={(event) => setAddressForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" required />
                <input
                  value={addressForm.phone}
                  onChange={(event) => setAddressForm((current) => ({ ...current, phone: normalizeAddressPhone(event.target.value) }))}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                />
                <input
                  value={addressForm.pincode}
                  onChange={(event) => setAddressForm((current) => ({ ...current, pincode: normalizePincode(event.target.value) }))}
                  placeholder="Pincode"
                  inputMode="numeric"
                  maxLength={6}
                />
                <input value={addressForm.locality} onChange={(event) => setAddressForm((current) => ({ ...current, locality: event.target.value }))} placeholder="Locality" />
                <textarea value={addressForm.line} onChange={(event) => setAddressForm((current) => ({ ...current, line: event.target.value }))} placeholder="Address (Area and Street)" rows={4} required />
                <input value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} placeholder="City/District/Town" />
                <div
                  className={`premium-state-select ${isStateMenuOpen ? "is-open" : ""}`}
                  onMouseEnter={() => {
                    if (stateCloseTimerRef.current) window.clearTimeout(stateCloseTimerRef.current);
                    if (!isStateMenuPinned && !addressForm.state) setIsStateMenuOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (!isStateMenuPinned) {
                      stateCloseTimerRef.current = window.setTimeout(() => setIsStateMenuOpen(false), 120);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsStateMenuPinned((value) => {
                        const nextValue = !value;
                        setIsStateMenuOpen(nextValue);
                        return nextValue;
                      });
                    }}
                  >
                    {addressForm.state || "--Select State--"}
                    <span />
                  </button>
                  {isStateMenuOpen ? (
                    <div className="premium-state-menu">
                      <button
                        className={!addressForm.state ? "is-selected" : ""}
                        type="button"
                        onClick={() => {
                          setAddressForm((current) => ({ ...current, state: "" }));
                          setIsStateMenuOpen(false);
                          setIsStateMenuPinned(false);
                        }}
                      >
                        --Select State--
                      </button>
                      {INDIA_STATES.map((state) => (
                        <button
                          className={addressForm.state === state ? "is-selected" : ""}
                          type="button"
                          key={state}
                          onClick={() => {
                            setAddressForm((current) => ({ ...current, state }));
                            setIsStateMenuOpen(false);
                            setIsStateMenuPinned(false);
                          }}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <input value={addressForm.landmark} onChange={(event) => setAddressForm((current) => ({ ...current, landmark: event.target.value }))} placeholder="Landmark (Optional)" />
                <input
                  value={addressForm.alternatePhone}
                  onChange={(event) => setAddressForm((current) => ({ ...current, alternatePhone: normalizeAddressPhone(event.target.value) }))}
                  placeholder="Alternate Phone (Optional)"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div className="address-type-options">
                <span>Address Type</span>
                <label><input type="radio" checked={addressForm.label === "Home"} onChange={() => setAddressForm((current) => ({ ...current, label: "Home" }))} /> Home</label>
                <label><input type="radio" checked={addressForm.label === "Work"} onChange={() => setAddressForm((current) => ({ ...current, label: "Work" }))} /> Work</label>
              </div>
              <div className="address-form-actions">
                <button className="primary-button" type="submit">{isSavingAddress ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setIsAddressFormOpen(false)}>Cancel</button>
              </div>
            </form>
          ) : null}

          <div className="address-book-list">
            {hasSavedAddress ? (
              savedAddresses.map((address, index) => (
                  <article className="address-book-row" key={`saved-address-${index}`}>
                    <div>
                      <span className="address-type-pill">{address.label || "HOME"}</span>
                      <p className="address-name-line">
                        <strong>{address.name || baseName || "Customer"}</strong>
                        <strong>{address.phone || profile?.phone || ""}</strong>
                      </p>
                      <p className="address-copy">{address.line}</p>
                    </div>
                    <div className="address-row-actions">
                      <button className="address-row-menu" type="button" onClick={() => setOpenAddressMenu(openAddressMenu === index ? null : index)} aria-label="Address actions">
                        <span />
                        <span />
                        <span />
                      </button>
                      {openAddressMenu === index ? (
                        <div className="address-action-menu">
                          <button type="button" onClick={() => editAddressDraft(index)}>Edit</button>
                          <button type="button" onClick={() => deleteAddressDraft(index)}>Delete</button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))
            ) : !isAddressFormOpen ? (
              <article className="address-empty-state">
                <div className="address-empty-icon">!</div>
                <div>
                  <strong>No saved address found</strong>
                  <p>Add a new address to make checkout faster.</p>
                </div>
              </article>
            ) : null}
          </div>
        </section>
      );
    }

    if (activeSection === "notifications") {
      const orderNotifications = orders
        .filter((order) => order.status === "Approved" || order.status === "Rejected")
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

      return (
        <section className="customer-profile-panel profile-content-panel profile-notifications-panel">
          <div className="profile-panel-head">
            <div>
              <p className="eyebrow">Notifications</p>
              <h1>Notifications</h1>
            </div>
          </div>
          {orderNotifications.length ? (
            <div className="profile-notification-list">
              {orderNotifications.map((order) => {
                const isApproved = order.status === "Approved";
                const firstItem = order.items?.[0]?.name || "your order";
                return (
                  <article className={`profile-notification-card ${isApproved ? "is-approved" : "is-rejected"}`} key={`notification-${order.id}`}>
                    <div className="profile-notification-icon">
                      {isApproved ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <strong>{isApproved ? "Order accepted" : "Order rejected"}</strong>
                      <p>
                        Seller has {isApproved ? "accepted" : "rejected"} {firstItem}. Order ID {order.id}.
                      </p>
                      <span>{getReadableDate(order.updatedAt || order.createdAt)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="profile-notification-empty">
              <div className="notification-illustration" aria-hidden="true">
                <span />
                <span />
                <span />
                <div>
                  <strong />
                </div>
              </div>
              <h2>All caught up!</h2>
              <p>There are no new notifications for you.</p>
            </div>
          )}
        </section>
      );
    }

    return (
      <form className="customer-profile-panel" onSubmit={handleProfileSave}>
        <div className="profile-form-main">
          <div className="profile-panel-head">
            <div>
              <p className="eyebrow">My Profile</p>
              <h1>Personal Information</h1>
            </div>
            {notice ? (
              <span className="save-status profile-save-status" key={`profile-notice-${noticeToken}`} role="status">
                <CheckCircle2 size={16} />
                {notice}
              </span>
            ) : null}
          </div>

          <div className="profile-field-grid">
            <label>
              First name
              <input
                name="firstName"
                value={profileDraft.firstName}
                onChange={(event) => updateProfileDraft("firstName", event.target.value)}
                placeholder="First name"
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                value={profileDraft.lastName}
                onChange={(event) => updateProfileDraft("lastName", event.target.value)}
                placeholder="Last name"
              />
            </label>
          </div>

          <section className="profile-section-block">
            <h2>Your Gender</h2>
            <div className="profile-gender-options">
              <label>
                <input
                  name="gender"
                  type="radio"
                  value="Male"
                  checked={profileDraft.gender === "Male"}
                  onChange={(event) => updateProfileDraft("gender", event.target.value)}
                />
                Male
              </label>
              <label>
                <input
                  name="gender"
                  type="radio"
                  value="Female"
                  checked={profileDraft.gender === "Female"}
                  onChange={(event) => updateProfileDraft("gender", event.target.value)}
                />
                Female
              </label>
              <label>
                <input
                  name="gender"
                  type="radio"
                  value="Other"
                  checked={profileDraft.gender === "Other"}
                  onChange={(event) => updateProfileDraft("gender", event.target.value)}
                />
                Other
              </label>
            </div>
          </section>

          <section className="profile-section-block">
            <h2>Email Address</h2>
            <input value={user.email || "Anonymous customer"} readOnly />
          </section>

          <section className="profile-section-block">
            <h2>Mobile Number</h2>
            <input
              name="phone"
              value={profileDraft.phone}
              onFocus={() => {
                if (!profileDraft.phone) updateProfileDraft("phone", PHONE_PREFIX);
              }}
              onClick={keepPhoneCursorAfterPrefix}
              onKeyDown={keepPhonePrefixOnDelete}
              onChange={(event) => updateProfileDraft("phone", normalizeIndianMobile(event.target.value, true))}
              onBlur={() => updateProfileDraft("phone", profileDraft.phone === PHONE_PREFIX ? "" : normalizeIndianMobile(profileDraft.phone))}
              inputMode="numeric"
              maxLength={13}
              autoComplete="tel"
              placeholder="Enter Mobile Number"
              title="Enter +91 followed by 10 digits."
            />
          </section>

          <section className="profile-section-block">
            <h2>Saved Address</h2>
            <textarea
              name="address"
              value={profileDraft.address}
              onChange={(event) => updateProfileDraft("address", event.target.value)}
              rows={4}
              placeholder="House, street, city, PIN"
            />
          </section>

          <button className="primary-button profile-save-button" type="submit">Save profile</button>
        </div>
      </form>
    );
  };

  return (
    <main className={`customer-profile-shell ${isLoggingOut ? "is-logging-out" : ""}`}>
      {logoutOverlay}
      <aside className="customer-profile-sidebar">
        <section className="profile-hello-card">
          <div className="profile-avatar">{firstName.charAt(0) || "M"}</div>
          <div>
            <span>Hello,</span>
            <strong>{baseName || "Customer"}</strong>
          </div>
        </section>
        <nav className="profile-side-nav" aria-label="Profile sections">
          <button className={activeSection === "profile" ? "is-active" : ""} type="button" onClick={() => switchProfileSection("profile")}>Profile Information</button>
          <button type="button" onClick={() => router.push("/account/orders")}>My Orders</button>
          <button className={activeSection === "addresses" ? "is-active" : ""} type="button" onClick={() => switchProfileSection("addresses")}>Manage Addresses</button>
          <button className={activeSection === "notifications" ? "is-active" : ""} type="button" onClick={() => switchProfileSection("notifications")}>Notifications</button>
        </nav>
        <button className="profile-sidebar-logout" type="button" onClick={handleLogout} disabled={isLoggingOut}>
          <LogOut size={18} />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </aside>

      {renderActivePanel()}
    </main>
  );
}

export default function AccountPage() {
  const { user, loading } = useCustomerAuth();
  const router = useRouter();
  const [accountView, setAccountView] = useState("");
  const [profileSection, setProfileSection] = useState("profile");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const nextPath = searchParams.get("next");
    const view = searchParams.get("view");
    const section = searchParams.get("section");
    const isSafeNextPath = nextPath?.startsWith("/") && !nextPath.startsWith("//") && !nextPath.startsWith("/account");
    if (!loading && user && isSafeNextPath) {
      router.replace(nextPath);
      return;
    }

    if (!loading && user && view === "profile") {
      const allowedSections = ["profile", "addresses", "notifications"];
      setAccountView("profile");
      setProfileSection(allowedSections.includes(section) ? section : "profile");
      return;
    }

    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    const handleSectionChange = (event) => {
      const section = event.detail?.section;
      const allowedSections = ["profile", "addresses", "notifications"];
      if (allowedSections.includes(section)) {
        setAccountView("profile");
        setProfileSection(section);
      }
    };

    window.addEventListener("mint-lane-account-section", handleSectionChange);
    return () => window.removeEventListener("mint-lane-account-section", handleSectionChange);
  }, []);

  return (
    <>
      <Header />
      <CartDrawer />
      {loading ? (
        <main className="account-shell"><p className="empty-cart">Loading account...</p></main>
      ) : user && accountView === "profile" ? (
        <CustomerProfilePage user={user} initialSection={profileSection} />
      ) : user ? null : (
        <AuthPanel />
      )}
    </>
  );
}
