"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartDrawer } from "../../../components/CartDrawer";
import { Header } from "../../../components/Header";
import { useCustomerAuth } from "../../../components/CustomerAuthProvider";
import { listenCustomerOrders } from "../../../lib/firebaseClient";
import { formatPrice } from "../../../lib/format";
import { readCustomerLocalOrders } from "../../../lib/orders";

const FILTER_STATUS_OPTIONS = [
  { label: "On the way", value: "Payment review" },
  { label: "Delivered", value: "Approved" },
  { label: "Cancelled", value: "Cancelled" },
  { label: "Returned", value: "Rejected" }
];

const FILTER_TIME_OPTIONS = [
  { label: "Last 30 days", value: "last30" },
  { label: "2026", value: "2026" },
  { label: "2025", value: "2025" },
  { label: "Older", value: "older" }
];

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

function getMobileOrderTitle(status, createdAt) {
  if (status === "Approved") {
    const date = createdAt
      ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(createdAt))
      : "today";
    return `Delivered on ${date}`;
  }

  if (status === "Rejected") return "Order Not Placed";
  if (status === "Cancelled") return "Order Cancelled";
  return "Payment review";
}

function getOrderTimeValue(order) {
  if (!order.createdAt) return "older";
  const date = new Date(order.createdAt);
  if (Number.isNaN(date.getTime())) return "older";
  const daysOld = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld <= 30) return "last30";
  const year = String(date.getFullYear());
  if (year === "2026" || year === "2025") return year;
  return "older";
}

function toggleFilterValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { user, loading } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ statuses: [], times: [] });
  const [draftFilters, setDraftFilters] = useState({ statuses: [], times: [] });

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
    return orders.filter((order) => {
      const itemNames = (order.items || []).map((item) => item.name).join(" ");
      const matchesQuery = !normalizedQuery || `${order.id} ${order.status} ${itemNames}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = activeFilters.statuses.length === 0 || activeFilters.statuses.includes(order.status);
      const matchesTime = activeFilters.times.length === 0 || activeFilters.times.includes(getOrderTimeValue(order));
      return matchesQuery && matchesStatus && matchesTime;
    });
  }, [activeFilters, orders, query]);

  const openFilters = () => {
    setDraftFilters(activeFilters);
    setIsFilterOpen(true);
  };

  const clearFilters = () => {
    setDraftFilters({ statuses: [], times: [] });
    setActiveFilters({ statuses: [], times: [] });
  };

  const applyFilters = () => {
    if (isApplyingFilters) return;
    setIsApplyingFilters(true);
    setActiveFilters(draftFilters);
    window.setTimeout(() => {
      setIsFilterOpen(false);
      setIsApplyingFilters(false);
    }, 420);
  };

  const hasActiveFilters = activeFilters.statuses.length > 0 || activeFilters.times.length > 0;
  const hasDraftFilters = draftFilters.statuses.length > 0 || draftFilters.times.length > 0;

  return (
    <>
      <div className="orders-desktop-chrome">
        <Header />
        <CartDrawer />
      </div>
      <main className="orders-page-shell">
        <header className="mobile-orders-topbar">
          <button type="button" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft size={24} />
          </button>
          <h1>My Orders</h1>
        </header>

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
          <div className="mobile-orders-toolbar">
            <form className="mobile-orders-search" onSubmit={(event) => event.preventDefault()}>
              <Search size={22} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your ord..." />
            </form>
            <button className="mobile-orders-filter-trigger" type="button" onClick={openFilters}>
              <SlidersHorizontal size={22} />
              Filters
            </button>
          </div>

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
                const mobileTitle = getMobileOrderTitle(order.status, order.createdAt);
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
                    <div className="orders-page-mobile-copy">
                      <strong className={paymentDisplay.className}>{mobileTitle}</strong>
                      <span>{firstItem?.name || order.id}</span>
                    </div>
                    <ChevronRight className="orders-page-card-arrow" size={21} />
                    {order.status !== "Approved" ? (
                      <em className={`orders-page-mobile-note ${paymentDisplay.className}`}>{paymentDisplay.note}</em>
                    ) : null}
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

      {isFilterOpen ? (
        <div className="mobile-filter-backdrop" role="presentation" onClick={() => setIsFilterOpen(false)}>
          <section className="mobile-filter-sheet" role="dialog" aria-modal="true" aria-label="Order filters" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-filter-head">
              <h2>Filters</h2>
              <button type="button" onClick={clearFilters} disabled={!hasActiveFilters && !hasDraftFilters}>
                Clear Filter
              </button>
            </div>

            <div className="mobile-filter-group">
              <h3>Order Status</h3>
              <div className="mobile-filter-options">
                {FILTER_STATUS_OPTIONS.map((option) => (
                  <button
                    className={draftFilters.statuses.includes(option.value) ? "is-selected" : ""}
                    key={option.value}
                    type="button"
                    onClick={() => setDraftFilters((current) => ({ ...current, statuses: toggleFilterValue(current.statuses, option.value) }))}
                  >
                    {option.label}
                    <Plus size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mobile-filter-group">
              <h3>Order Time</h3>
              <div className="mobile-filter-options">
                {FILTER_TIME_OPTIONS.map((option) => (
                  <button
                    className={draftFilters.times.includes(option.value) ? "is-selected" : ""}
                    key={option.value}
                    type="button"
                    onClick={() => setDraftFilters((current) => ({ ...current, times: toggleFilterValue(current.times, option.value) }))}
                  >
                    {option.label}
                    <Plus size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mobile-filter-actions">
              <button className="mobile-filter-cancel" type="button" onClick={() => setIsFilterOpen(false)}>Cancel</button>
              <button className={`mobile-filter-apply ${isApplyingFilters ? "is-applying" : ""}`} type="button" onClick={applyFilters} disabled={isApplyingFilters}>
                {isApplyingFilters ? "Applying..." : "Apply"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
