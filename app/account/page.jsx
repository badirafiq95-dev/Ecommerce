"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, LogOut, Mail, PackageCheck, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { CartDrawer } from "../../components/CartDrawer";
import { Header } from "../../components/Header";
import { useCustomerAuth } from "../../components/CustomerAuthProvider";
import {
  createEmailAccount,
  listenCustomerOrders,
  listenCustomerProfile,
  loginAnonymously,
  loginWithEmail,
  loginWithGoogle,
  logoutCustomer,
  updateFirestoreOrder,
  upsertCustomerProfile
} from "../../lib/firebaseClient";
import { formatPrice } from "../../lib/format";

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

function authErrorMessage(error) {
  if (error?.code === "auth/unauthorized-domain") {
    return "This website domain is not added in Firebase Authorized domains.";
  }
  if (error?.code === "auth/popup-closed-by-user") {
    return "Google login was closed before it finished.";
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "This login method is not enabled in Firebase.";
  }
  if (error?.code === "auth/invalid-credential") {
    return "Email ID or password is incorrect.";
  }
  return error?.message || "Login failed. Please try again.";
}

function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const name = String(form.get("name") || "").trim();
      if (mode === "create") {
        await createEmailAccount(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAuth = async (action) => {
    setError("");
    setLoading(true);
    try {
      await action();
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setLoading(false);
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

        <div className="auth-choice-grid">
          <button type="button" onClick={() => handleQuickAuth(loginWithGoogle)} disabled={loading}>
            <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.53Z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.29.31-1.88v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.48l3.35-2.6Z" />
              <path fill="#EA4335" d="M12 6c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.96 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.35 2.6C7.2 7.76 9.4 6 12 6Z" />
            </svg>
            <span className="google-login-text">Continue with Google</span>
          </button>
          <button type="button" onClick={() => setMode((value) => (value === "create" ? "login" : "create"))} disabled={loading}>
            <ShieldCheck size={18} />
            {mode === "create" ? "Use existing ID" : "Create user ID"}
          </button>
          <button type="button" onClick={() => handleQuickAuth(loginAnonymously)} disabled={loading}>
            <UserRound size={18} />
            Continue anonymously
          </button>
        </div>

        <div className="customer-email-divider">
          <span>Or continue with email</span>
        </div>

        <form className="customer-auth-form" onSubmit={handleEmailAuth}>
          {mode === "create" ? (
            <label className="customer-input-field">
              <UserRound size={18} />
              <input name="name" placeholder="Customer name" />
            </label>
          ) : null}
          <label className="customer-input-field">
            <Mail size={18} />
            <input name="email" type="email" placeholder="Email ID" required />
          </label>
          <label className="customer-input-field">
            <LockKeyhole size={18} />
            <input name="password" type={showPassword ? "text" : "password"} minLength={6} placeholder="Password" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>
          {error ? <p className="checkout-error">{error}</p> : null}
          <button className="primary-button full" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "create" ? "Create account" : "Login with email"}
            <ArrowRight size={18} />
          </button>
        </form>
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
    const stopOrders = listenCustomerOrders(user.uid, setOrders);
    return () => {
      stopProfile();
      stopOrders();
    };
  }, [user.uid]);

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
    await updateFirestoreOrder(order.id, {
      status: "Cancel requested",
      cancelReason: cancelReason.trim(),
      cancelRequestedAt: new Date().toISOString()
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
  const [isStateMenuOpen, setIsStateMenuOpen] = useState(false);
  const [isStateMenuPinned, setIsStateMenuPinned] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const stateCloseTimerRef = useRef(null);
  const [notice, setNotice] = useState("");
  const [addressNotice, setAddressNotice] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const baseName = profile?.name || user.displayName || user.email?.split("@")[0] || "";
  const nameParts = baseName.split(/[.\s_-]+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");

  useEffect(() => {
    return listenCustomerProfile(user.uid, setProfile);
  }, [user.uid]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    return listenCustomerOrders(user.uid, setOrders);
  }, [user.uid]);

  useEffect(() => {
    if (!profile) return;
    const savedAddresses = Array.isArray(profile.addresses) ? profile.addresses : [];
    if (savedAddresses.length) {
      setAddressDrafts(savedAddresses);
      return;
    }

    setAddressDrafts(profile.address ? [{ label: "Home", line: profile.address, name: baseName, phone: profile.phone || "" }] : []);
  }, [profile]);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextFirstName = String(form.get("firstName") || "").trim();
    const nextLastName = String(form.get("lastName") || "").trim();
    await upsertCustomerProfile(user, {
      name: [nextFirstName, nextLastName].filter(Boolean).join(" "),
      gender: String(form.get("gender") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      address: String(form.get("address") || "").trim(),
      addresses: addressDrafts
    });
    setNotice("Saved");
    window.setTimeout(() => setNotice(""), 1800);
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
      phone: profile?.phone || "",
      pincode: "",
      locality: "",
      line: "",
      city: "",
      state: "",
      landmark: "",
      alternatePhone: "",
      label: "Home"
    });
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
      phone: address.phone || profile?.phone || "",
      pincode: address.pincode || "",
      locality: address.locality || "",
      line: address.line || "",
      city: address.city || "",
      state: address.state || "",
      landmark: address.landmark || "",
      alternatePhone: address.alternatePhone || "",
      label: address.label || "Home"
    });
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
    const nextAddress = {
      ...addressForm,
      label: addressForm.label || "Home",
      line: formatAddressLine(addressForm)
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
              <div className="address-entry-grid">
                <input value={addressForm.name} onChange={(event) => setAddressForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" required />
                <input value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} placeholder="10-digit mobile number" />
                <input value={addressForm.pincode} onChange={(event) => setAddressForm((current) => ({ ...current, pincode: event.target.value }))} placeholder="Pincode" />
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
                <input value={addressForm.alternatePhone} onChange={(event) => setAddressForm((current) => ({ ...current, alternatePhone: event.target.value }))} placeholder="Alternate Phone (Optional)" />
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

    if (activeSection === "payments") {
      return (
        <section className="customer-profile-panel profile-content-panel">
          <div className="profile-panel-head">
            <div>
              <p className="eyebrow">Payments</p>
              <h1>Payments</h1>
            </div>
          </div>
          <p className="empty-cart">Payment settings will be added here soon.</p>
        </section>
      );
    }

    if (activeSection === "notifications") {
      return (
        <section className="customer-profile-panel profile-content-panel">
          <div className="profile-panel-head">
            <div>
              <p className="eyebrow">Notifications</p>
              <h1>Notifications</h1>
            </div>
          </div>
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
            {notice ? <span className="save-status">{notice}</span> : null}
          </div>

          <div className="profile-field-grid">
            <label>
              First name
              <input name="firstName" defaultValue={firstName} placeholder="First name" />
            </label>
            <label>
              Last name
              <input name="lastName" defaultValue={lastName} placeholder="Last name" />
            </label>
          </div>

          <section className="profile-section-block">
            <h2>Your Gender</h2>
            <div className="profile-gender-options">
              <label>
                <input name="gender" type="radio" value="Male" defaultChecked={profile?.gender === "Male"} />
                Male
              </label>
              <label>
                <input name="gender" type="radio" value="Female" defaultChecked={profile?.gender === "Female"} />
                Female
              </label>
              <label>
                <input name="gender" type="radio" value="Other" defaultChecked={profile?.gender === "Other"} />
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
            <input name="phone" defaultValue={profile?.phone || ""} placeholder="+91 98765 43210" />
          </section>

          <section className="profile-section-block">
            <h2>Saved Address</h2>
            <textarea name="address" defaultValue={profile?.address || ""} rows={4} placeholder="House, street, city, PIN" />
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
          <button className={activeSection === "payments" ? "is-active" : ""} type="button" onClick={() => switchProfileSection("payments")}>Payments</button>
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
      const allowedSections = ["profile", "addresses", "payments", "notifications"];
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
      const allowedSections = ["profile", "addresses", "payments", "notifications"];
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
