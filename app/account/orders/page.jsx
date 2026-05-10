"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartDrawer } from "../../../components/CartDrawer";
import { Header } from "../../../components/Header";
import { useCustomerAuth } from "../../../components/CustomerAuthProvider";
import { listenCustomerOrders } from "../../../lib/firebaseClient";
import { formatPrice } from "../../../lib/format";
import { readCustomerLocalOrders } from "../../../lib/orders";

function getPaymentDisplay(status) {
  if (status === "Approved") {
    return {
      className: "is-confirmed",
      label: "Payment confirmed",
      note: "Your payment has been confirmed by admin."
    };
  }

  if (status === "Rejected") {
    return {
      className: "is-rejected",
      label: "Payment not confirmed",
      note: "Your payment was not confirmed. Please contact support."
    };
  }

  if (status === "Cancelled") {
    return {
      className: "is-cancelled",
      label: "Order cancelled",
      note: "This order has been cancelled."
    };
  }

  return {
    className: "is-pending",
    label: "The seller has not confirmed the payment yet",
    note: "We are waiting for the payment confirmation. Please check again after 2 hours."
  };
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { user, loading } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/account");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return undefined;
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
  }, [user]);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return orders;
    return orders.filter((order) => {
      const itemNames = (order.items || []).map((item) => item.name).join(" ");
      return `${order.id} ${order.status} ${itemNames}`.toLowerCase().includes(normalizedQuery);
    });
  }, [orders, query]);

  return (
    <>
      <Header />
      <CartDrawer />
      <main className="orders-page-shell">
        <nav className="orders-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => router.push("/")}>Home</button>
          <button type="button" onClick={() => router.push("/account?view=profile")}>My Account</button>
          <strong>My Orders</strong>
        </nav>

        <aside className="orders-filter-panel">
          <h1>Filters</h1>
          <section>
            <h2>Order Status</h2>
            {["Payment review", "Approved", "Rejected", "Cancelled"].map((status) => (
              <label key={status}>
                <input type="checkbox" />
                {status}
              </label>
            ))}
          </section>
          <section>
            <h2>Order Time</h2>
            {["Last 30 days", "2026", "2025", "Older"].map((time) => (
              <label key={time}>
                <input type="checkbox" />
                {time}
              </label>
            ))}
          </section>
        </aside>

        <section className="orders-page-content">
          <form className="orders-page-search" onSubmit={(event) => event.preventDefault()}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your orders here" />
            <button type="submit">
              <Search size={18} />
              Search Orders
            </button>
          </form>

          <div className="orders-page-list">
            {loading || !user ? (
              <p className="empty-cart">Loading orders...</p>
            ) : visibleOrders.length === 0 ? (
              <p className="empty-cart">No orders are linked to this account yet.</p>
            ) : (
              visibleOrders.map((order) => {
                const firstItem = order.items?.[0];
                const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Recently";
                const paymentDisplay = getPaymentDisplay(order.status);
                return (
                  <button
                    className="orders-page-card orders-page-card-button"
                    key={order.id}
                    type="button"
                    onClick={() => router.push(`/account/orders/${order.id}`)}
                  >
                    {firstItem?.image ? (
                      <Image
                        className="orders-page-thumb"
                        src={firstItem.image}
                        alt=""
                        width={94}
                        height={60}
                        sizes="94px"
                        unoptimized={firstItem.image.startsWith("data:")}
                      />
                    ) : (
                      <div className="orders-page-thumb orders-page-fallback-image" />
                    )}
                    <div className="orders-page-product">
                      <div>
                        <strong>{firstItem?.name || order.id}</strong>
                        {order.status !== "Approved" ? (
                          <em className={`orders-page-note ${paymentDisplay.className}`}>{paymentDisplay.note}</em>
                        ) : (
                          <span>{(order.items || []).map((item) => `${item.name} x ${item.quantity}`).join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <strong>{formatPrice(order.total || 0)}</strong>
                    <div className={`orders-page-status ${paymentDisplay.className}`}>
                      <strong>{paymentDisplay.label}</strong>
                      {order.status !== "Payment review" ? <span>Updated {orderDate}</span> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>
    </>
  );
}
