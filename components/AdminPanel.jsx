"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  Store,
  Trash2,
  WalletCards,
  X
} from "lucide-react";
import { formatPrice } from "../lib/format";
import { getAdminSession, setAdminSession, startAdminAccessExit } from "../lib/adminSession";
import { clearActiveOrders, clearRejectedOrders, readOrders, updateOrderStatus } from "../lib/orders";
import { sendOrderEmail } from "../lib/orderEmail";
import { listenAllOrders, updateFirestoreOrder } from "../lib/firebaseClient";
import { useProductCatalog } from "./useProductCatalog";

const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "admin123";
const DEFAULT_IMAGE = "/images/hero-cards.png";
const CATEGORIES = ["Singles", "Sealed", "Graded", "Supplies"];

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) {
      resolve(DEFAULT_IMAGE);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || DEFAULT_IMAGE));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AdminPanel() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(() => getAdminSession());
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [secretEntry, setSecretEntry] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersView, setOrdersView] = useState("");
  const [isClearingOrders, setIsClearingOrders] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const { products, stats, updateProduct, adjustPrice, addProduct, removeProduct, resetProducts, saveChanges, restoreStock } =
    useProductCatalog();
  const rejectedOrders = orders.filter((order) => order.status === "Rejected" || order.status === "Cancelled");
  const activeOrders = orders.filter((order) => order.status !== "Rejected" && order.status !== "Cancelled");
  const visibleOrders = ordersView === "rejected" ? rejectedOrders : activeOrders;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setIsAuthed(getAdminSession());
    setOrders(readOrders());
    if (window.sessionStorage.getItem("mint-lane-secret-admin-entry") === "true") {
      setSecretEntry(true);
      window.sessionStorage.removeItem("mint-lane-secret-admin-entry");
      window.setTimeout(() => setSecretEntry(false), 1400);
    }
  }, []);

  useEffect(() => {
    const syncOrders = () => setOrders(readOrders());
    const stopFirestoreOrders = listenAllOrders((cloudOrders) => {
      if (cloudOrders.length) setOrders(cloudOrders);
    });
    window.addEventListener("mint-lane-orders-updated", syncOrders);
    window.addEventListener("storage", syncOrders);
    return () => {
      stopFirestoreOrders();
      window.removeEventListener("mint-lane-orders-updated", syncOrders);
      window.removeEventListener("storage", syncOrders);
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const adminId = String(form.get("adminId") || "").trim();
    const password = String(form.get("password") || "");

    if (!adminId || !password) {
      setError("");
      window.requestAnimationFrame(() => {
        setError("Oops, admin ID and password required");
      });
      return;
    }

    if (adminId === ADMIN_ID && password === ADMIN_PASSWORD) {
      setError("");
      setIsVerifying(true);
      window.setTimeout(() => {
        setAdminSession(true);
        setIsAuthed(true);
        setIsVerifying(false);
      }, 1550);
      return;
    }

    setError("");
    window.requestAnimationFrame(() => {
      setError("Wrong ID or password");
    });
  };

  const logout = () => {
    startAdminAccessExit();
    setIsLoggingOut(true);
    window.setTimeout(() => {
      setAdminSession(false);
      router.replace("/");
    }, 1850);
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const image = await readImageFile(form.get("photo"));

    addProduct({
      name: String(form.get("name") || "").trim(),
      category: String(form.get("category") || "Singles"),
      price: Number(form.get("price") || 0),
      stock: Number(form.get("stock") || 0),
      tag: String(form.get("tag") || "New").trim(),
      image
    });
    event.currentTarget.reset();
    setNewCategory("");
  };

  const handleSaveChanges = () => {
    saveChanges();
    setSaveStatus("Changes saved");
    window.setTimeout(() => setSaveStatus(""), 1800);
  };

  const approveOrder = (orderId) => {
    const nextOrders = updateOrderStatus(orderId, "Approved");
    setOrders(nextOrders);
    const approvedOrder = nextOrders.find((order) => order.id === orderId);
    if (approvedOrder) {
      updateFirestoreOrder(orderId, { status: "Approved" });
      sendOrderEmail("approved", approvedOrder);
    }
  };

  const rejectOrder = (order) => {
    if (order.status !== "Rejected" && order.status !== "Cancelled") {
      restoreStock(order.items);
    }
    const nextOrders = updateOrderStatus(order.id, "Rejected");
    setOrders(nextOrders);
    const rejectedOrder = nextOrders.find((currentOrder) => currentOrder.id === order.id);
    if (rejectedOrder) {
      updateFirestoreOrder(order.id, { status: "Rejected" });
      sendOrderEmail("rejected", rejectedOrder);
    }
  };

  const handleClearOrders = () => {
    if (visibleOrders.length === 0 || isClearingOrders) return;
    setClearMessage("");
    setIsClearingOrders(true);
    window.setTimeout(() => {
      setOrders(ordersView === "rejected" ? clearRejectedOrders() : clearActiveOrders());
      setIsClearingOrders(false);
      setClearMessage("Successfully cleared");
      window.setTimeout(() => setClearMessage(""), 2200);
    }, 520);
  };

  if (!isAuthed) {
    return (
      <main className={`admin-login-shell ${secretEntry ? "is-secret-entry" : ""}`}>
        <section className={`admin-login-card ${secretEntry ? "is-secret-entry" : ""}`}>
          <div className="admin-badge">
            <ShieldCheck size={22} />
          </div>
          <p className="eyebrow">Owner access</p>
          <h1>Admin Login</h1>
          <p className="admin-login-copy">
            This store control area is for the owner only. Enter the admin ID and password to continue.
          </p>

          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              Admin ID
              <input name="adminId" autoComplete="username" placeholder="Enter admin ID" />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error ? (
              <p className="admin-error">
                <CircleAlert size={18} />
                <span>{error}</span>
              </p>
            ) : null}
            <button className="primary-button full" type="submit">
              <LockKeyhole size={18} />
              {isVerifying ? "Verifying Access" : "Login to Dashboard"}
            </button>
          </form>

          {isVerifying ? (
            <div className="verified-overlay" aria-live="polite">
              <div className="verified-card">
                <div className="verified-orbit">
                  <div className="verified-cube">
                    <Check size={44} />
                  </div>
                </div>
                <p className="eyebrow">Security check</p>
                <h2>Admin Access Verified</h2>
                <span>Opening dashboard...</span>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  const logoutOverlay =
    isLoggingOut && typeof document !== "undefined"
      ? createPortal(
          <div className="logout-overlay" aria-live="polite">
            <div className="logout-card">
              <div className="logout-icon">
                <LogOut size={42} />
              </div>
              <p className="eyebrow">Secure exit</p>
              <h2>Logging Out</h2>
              <span>Returning to home page...</span>
            </div>
          </div>,
          document.body
        )
      : null;

  const ordersModal =
    ordersView && typeof document !== "undefined"
      ? createPortal(
          <div className="orders-modal-backdrop">
            <section className="orders-modal" aria-label="Order requests">
              <div className="orders-modal-head">
                <div>
                  <p className="eyebrow">Order manager</p>
                  <h2>{ordersView === "rejected" ? "Rejected orders" : "Customer orders"}</h2>
                </div>
                <div className="orders-modal-actions">
                  <button
                    className={`clear-orders-button ${ordersView === "rejected" ? "danger-clear" : "soft-clear"}`}
                    type="button"
                    onClick={handleClearOrders}
                    disabled={visibleOrders.length === 0 || isClearingOrders}
                  >
                    <Trash2 size={17} />
                    {isClearingOrders ? "Clearing" : "Clear All"}
                  </button>
                  {clearMessage ? <span className="clear-success">{clearMessage}</span> : null}
                  <button className="icon-button" type="button" onClick={() => setOrdersView("")} aria-label="Close orders">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="orders-list">
                {visibleOrders.length === 0 ? (
                  <p className="empty-cart">
                    {ordersView === "rejected"
                      ? "No rejected orders yet."
                      : "No active orders yet. New checkout requests will appear here automatically."}
                  </p>
                ) : (
                  visibleOrders.map((order, index) => (
                    <article className={`order-card ${isClearingOrders ? "is-clearing" : ""}`} key={order.id}>
                      <div className="order-card-head">
                        <div className="order-card-title">
                          <span className="order-index-badge">{index + 1}</span>
                          <div>
                            <strong>
                              Order {index + 1} - <span className="order-id-label">Order ID:</span> {order.id}
                            </strong>
                            <span>Order Time: {new Date(order.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <span
                          className={`stock-pill ${
                            order.status === "Rejected" || order.status === "Cancelled" ? "rejected-status" : "in-stock"
                          }`}
                        >
                          {order.status === "Cancelled" ? "Rejected" : order.status}
                        </span>
                      </div>
                      <div className="order-customer-grid">
                        <span>
                          <small>Customer Name</small>
                          <strong>{order.customerName}</strong>
                        </span>
                        <span>
                          <small>Email ID</small>
                          <strong>{order.email}</strong>
                        </span>
                        <span>
                          <small>Phone</small>
                          <strong>{order.phone}</strong>
                        </span>
                      </div>
                      <div className="order-address">
                        <small>Address</small>
                        <p>{order.address}</p>
                      </div>
                      {order.paymentScreenshot?.dataUrl ? (
                        <a className="order-attachment" href={order.paymentScreenshot.dataUrl} target="_blank" rel="noreferrer">
                          <img src={order.paymentScreenshot.dataUrl} alt={`Payment screenshot for ${order.id}`} />
                          <span>
                            <small>Payment Screenshot Attachment</small>
                            <strong>{order.paymentScreenshot.name || "View uploaded screenshot"}</strong>
                          </span>
                        </a>
                      ) : (
                        <div className="order-attachment is-empty">
                          <span>
                            <small>Payment Screenshot Attachment</small>
                            <strong>No screenshot attached</strong>
                          </span>
                        </div>
                      )}
                      <div className="order-items">
                        {order.items.map((item) => (
                          <div className="order-item" key={`${order.id}-${item.id}`}>
                            <span>{item.name} x {item.quantity}</span>
                            <strong>{formatPrice(item.price * item.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="total-row">
                        <span>Total</span>
                        <strong>{formatPrice(order.total)}</strong>
                      </div>
                      <div className="order-actions">
                        <button
                          className="approve-button"
                          type="button"
                          onClick={() => approveOrder(order.id)}
                          disabled={order.status === "Approved" || order.status === "Rejected" || order.status === "Cancelled"}
                        >
                          Approve
                        </button>
                        <button
                          className="reject-button"
                          type="button"
                          onClick={() => rejectOrder(order)}
                          disabled={order.status === "Rejected" || order.status === "Cancelled"}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {logoutOverlay}
      {ordersModal}
      <main className={`admin-dashboard ${isLoggingOut ? "is-logging-out" : ""}`}>
      <section className="admin-dashboard-head">
        <div>
          <p className="eyebrow">Private dashboard</p>
          <h1>Store Control</h1>
          <p>Products, stock aur price ko yahan se update karo. Changes browser mein save ho jayenge.</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </section>

      <section className="orders-shortcut">
        <div>
          <p className="eyebrow">Orders</p>
          <h2>View order requests</h2>
        </div>
        <div className="orders-shortcut-actions">
          <button className="save-button" type="button" onClick={() => setOrdersView("active")}>
            <PackageCheck size={18} />
            View Orders ({activeOrders.length})
          </button>
          <button className="rejected-orders-button" type="button" onClick={() => setOrdersView("rejected")}>
            <X size={18} />
            Rejected Orders ({rejectedOrders.length})
          </button>
        </div>
      </section>

      <section className="admin-stat-grid">
        <article>
          <Store size={22} />
          <span>Total Products</span>
          <strong>{stats.products}</strong>
        </article>
        <article>
          <PackageCheck size={22} />
          <span>Total Stock</span>
          <strong>{stats.stock}</strong>
        </article>
        <article>
          <WalletCards size={22} />
          <span>Stock Value</span>
          <strong>{formatPrice(stats.value)}</strong>
        </article>
        <article>
          <ShieldCheck size={22} />
          <span>Categories</span>
          <strong>{stats.categories}</strong>
        </article>
      </section>

      <section className="admin-table-card">
        <div className="admin-card-head">
          <div>
            <p className="eyebrow">Product manager</p>
            <h2>Current inventory</h2>
          </div>
          <div className="admin-card-actions">
            {saveStatus ? <span className="save-status">{saveStatus}</span> : null}
            <button className="save-button compact" type="button" onClick={handleSaveChanges}>
              <Plus size={16} />
              Save Changes
            </button>
            <button className="secondary-button compact" type="button" onClick={resetProducts}>
              <RotateCcw size={16} />
              Reset demo data
            </button>
          </div>
        </div>

        <form className="admin-add-form" onSubmit={handleAddProduct}>
          <input name="name" required placeholder="Product name" />
          <div className={`category-picker ${isCategoryOpen ? "is-open" : ""}`} onBlur={() => setIsCategoryOpen(false)}>
            <input name="category" type="hidden" value={newCategory} required />
            <button type="button" onClick={() => setIsCategoryOpen((value) => !value)}>
              <span>{newCategory || "Category"}</span>
              <span className="category-chevron">⌄</span>
            </button>
            <div className="category-menu">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setNewCategory(category);
                    setIsCategoryOpen(false);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <input name="tag" placeholder="Tag" />
          <input name="price" required min="0" type="number" placeholder="Price" />
          <input name="stock" required min="0" type="number" placeholder="Stock" />
          <label className="admin-photo-upload">
            <span>Upload photo</span>
            <input name="photo" type="file" accept="image/*" />
          </label>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Add Product
          </button>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Tag</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-product-cell">
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={92}
                        height={72}
                        sizes="92px"
                        unoptimized={product.image.startsWith("data:")}
                      />
                      <strong>{product.name}</strong>
                    </div>
                  </td>
                  <td>{product.category}</td>
                  <td>
                    <input
                      className="tag-input"
                      value={product.tag}
                      onChange={(event) => updateProduct(product.id, { tag: event.target.value })}
                      aria-label={`${product.name} tag`}
                    />
                  </td>
                  <td>
                    <div className="price-editor">
                      <button type="button" onClick={() => adjustPrice(product.id, -100)} aria-label={`Decrease ${product.name} price`}>
                        <Minus size={14} />
                      </button>
                      <input
                        min="0"
                        type="number"
                        value={product.price}
                        onChange={(event) => updateProduct(product.id, { price: Number(event.target.value) })}
                        aria-label={`${product.name} price`}
                      />
                      <button type="button" onClick={() => adjustPrice(product.id, 100)} aria-label={`Increase ${product.name} price`}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <small>{formatPrice(product.price)}</small>
                  </td>
                  <td>
                    <input
                      className="stock-input"
                      min="0"
                      type="number"
                      value={product.stock}
                      onChange={(event) => updateProduct(product.id, { stock: Number(event.target.value) })}
                      aria-label={`${product.name} stock`}
                    />
                  </td>
                  <td>
                    <span className={product.stock > 3 ? "stock-pill in-stock" : "stock-pill low-stock"}>
                      {product.stock > 3 ? "In stock" : "Low stock"}
                    </span>
                  </td>
                  <td>
                    <button className="danger-button" type="button" onClick={() => removeProduct(product.id)} aria-label={`Remove ${product.name}`}>
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </main>
    </>
  );
}
