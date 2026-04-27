"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, Mail, PackageCheck, ShieldCheck, UserRound, XCircle } from "lucide-react";
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

function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch {
      setError("Could not continue. Check the email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAuth = async (action) => {
    setError("");
    setLoading(true);
    try {
      await action();
    } catch {
      setError("Login failed. Please try again.");
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
            <Mail size={18} />
            Continue with Google
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

        <form className="customer-auth-form" onSubmit={handleEmailAuth}>
          {mode === "create" ? <input name="name" placeholder="Customer name" /> : null}
          <input name="email" type="email" placeholder="Email ID" required />
          <input name="password" type="password" minLength={6} placeholder="Password" required />
          {error ? <p className="checkout-error">{error}</p> : null}
          <button className="primary-button full" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "create" ? "Create account" : "Login with email"}
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

export default function AccountPage() {
  const { user, loading } = useCustomerAuth();

  return (
    <>
      <Header />
      {loading ? <main className="account-shell"><p className="empty-cart">Loading account...</p></main> : user ? <CustomerDashboard user={user} /> : <AuthPanel />}
    </>
  );
}
