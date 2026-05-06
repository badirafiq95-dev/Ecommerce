"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Home, MessageCircle, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartDrawer } from "../../../../components/CartDrawer";
import { Header } from "../../../../components/Header";
import { useCustomerAuth } from "../../../../components/CustomerAuthProvider";
import { listenCustomerOrders } from "../../../../lib/firebaseClient";
import { formatPrice } from "../../../../lib/format";

function getOrderDisplay(status) {
  if (status === "Approved") {
    return {
      badge: "Confirmed",
      className: "is-confirmed",
      heading: "Payment confirmed",
      message: "Your payment has been confirmed by admin.",
      timeline: "Payment confirmed"
    };
  }

  if (status === "Rejected") {
    return {
      badge: "Rejected",
      className: "is-rejected",
      heading: "Payment not confirmed",
      message: "Your payment was not confirmed. Please contact support.",
      timeline: "Payment rejected"
    };
  }

  if (status === "Cancelled") {
    return {
      badge: "Cancelled",
      className: "is-cancelled",
      heading: "Order cancelled",
      message: "This order has been cancelled.",
      timeline: "Order cancelled"
    };
  }

  return {
    badge: "Processing",
    className: "is-pending",
    heading: "Order Pending",
    message: "We are waiting for the payment confirmation. Please check again after 2 hours.",
    timeline: "Order Pending"
  };
}

export default function CustomerOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId;
  const { user, loading } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/account");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return undefined;
    setOrdersLoaded(false);
    return listenCustomerOrders(user.uid, (nextOrders) => {
      setOrders(nextOrders);
      setOrdersLoaded(true);
    });
  }, [user]);

  const order = useMemo(() => orders.find((currentOrder) => currentOrder.id === orderId), [orderId, orders]);
  const firstItem = order?.items?.[0];
  const itemSummary = (order?.items || []).map((item) => `${item.name} x ${item.quantity}`).join(", ");
  const orderDate = order?.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Today";
  const display = getOrderDisplay(order?.status);
  const deliveryAddress = order?.address || "No saved delivery address linked to this order.";
  const customerName = order?.customerName || user?.displayName || "Customer";
  const customerPhone = order?.phone || "Phone not added";

  return (
    <>
      <Header />
      <CartDrawer />
      <main className="order-detail-shell">
        <nav className="orders-breadcrumb order-detail-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => router.push("/")}>Home</button>
          <button type="button" onClick={() => router.push("/account?view=profile")}>My Account</button>
          <button type="button" onClick={() => router.push("/account/orders")}>My Orders</button>
          <strong>{orderId}</strong>
        </nav>

        {loading || !user || !ordersLoaded ? (
          <section className="order-detail-main-card">
            <p className="empty-cart">Loading order details...</p>
          </section>
        ) : !order ? (
          <section className="order-detail-main-card">
            <h1>Order not found</h1>
            <p className="empty-cart">This order is not linked to your account.</p>
          </section>
        ) : (
          <section className="order-detail-grid">
            <div className="order-detail-main">
              <article className="order-detail-main-card">
                <div className={`order-status-panel ${display.className}`}>
                  <div>
                    <h1>{display.heading}</h1>
                    <p>{display.message}</p>
                  </div>
                  <span>{display.badge}</span>
                </div>

                <div className="order-product-summary">
                  <div>
                    <h2>{firstItem?.name || order.id}</h2>
                    <p>{itemSummary}</p>
                    <strong>{formatPrice(order.total || 0)}</strong>
                  </div>
                  {firstItem?.image ? (
                    <Image
                      src={firstItem.image}
                      alt=""
                      width={92}
                      height={92}
                      sizes="92px"
                      unoptimized={firstItem.image.startsWith("data:")}
                    />
                  ) : (
                    <div className="orders-page-fallback-image" />
                  )}
                </div>

                <div className={`order-timeline ${display.className}`}>
                  <span />
                  <strong>{display.timeline}, {orderDate}</strong>
                </div>

                <button className="order-updates-button" type="button">See All Updates</button>

                <button className="order-chat-row" type="button">
                  <MessageCircle size={22} />
                  Chat with us
                </button>
              </article>

              <div className="order-id-footer">Order #{order.id}</div>
            </div>

            <aside className="order-detail-side">
              <section className="order-side-card">
                <h2>Delivery details</h2>
                <div className="delivery-detail-box">
                  <p>
                    <Home size={18} />
                    <span><strong>Home</strong> {deliveryAddress}</span>
                  </p>
                  <p>
                    <UserRound size={18} />
                    <span><strong>{customerName}</strong> {customerPhone}</span>
                  </p>
                </div>
              </section>

              <section className="order-side-card">
                <h2>Price details</h2>
                <div className="price-detail-box">
                  <p><span>Listing price</span><strong>{formatPrice(order.total || 0)}</strong></p>
                  <p><span>Selling price</span><strong>{formatPrice(order.total || 0)}</strong></p>
                  <p><span>Total amount</span><strong>{formatPrice(order.total || 0)}</strong></p>
                </div>
              </section>
            </aside>
          </section>
        )}
      </main>
    </>
  );
}
