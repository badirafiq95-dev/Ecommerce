"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Info, LockKeyhole, Minus, PackageCheck, Plus, ShieldCheck, Tag, TicketPercent, Trash2, Truck, X } from "lucide-react";
import { useState } from "react";
import { useCustomerAuth } from "./CustomerAuthProvider";
import { useCart } from "./CartProvider";
import { useProductCatalog } from "./useProductCatalog";
import { formatPrice } from "../lib/format";

export function CartDrawer() {
  const {
    items,
    subtotal,
    shippingCharge,
    discountAmount,
    total,
    appliedCoupon,
    couponNotice,
    applyCoupon,
    removeCoupon,
    isOpen,
    setIsOpen,
    removeItem,
    updateQuantity,
    limitNotice,
    showLimitNotice
  } = useCart();
  const { user, loading: authLoading } = useCustomerAuth();
  const { products } = useProductCatalog();
  const router = useRouter();
  const [emptyNotice, setEmptyNotice] = useState(false);
  const [lineMotion, setLineMotion] = useState({});
  const [couponCode, setCouponCode] = useState("");
  const [couponNoticeToken, setCouponNoticeToken] = useState(0);
  const hasItems = items.length > 0;
  const isSingleItem = items.length === 1;
  const isCouponError = couponNotice === "Invalid coupon.";
  const isCouponRemoved = couponNotice === "Coupon removed.";
  const isCouponSuccess = Boolean(appliedCoupon) || !couponNotice;

  const getAvailableStock = (item) => {
    const currentProduct = products.find((product) => product.id === item.id);
    return Math.max(0, Number(currentProduct?.stock ?? item.stock) || 0);
  };

  const handleProtectedCheckoutClick = (event) => {
    const invalidItem = items.find((item) => item.quantity > getAvailableStock(item));
    if (invalidItem) {
      event.preventDefault();
      showLimitNotice(invalidItem, getAvailableStock(invalidItem));
      return;
    }

    if (items.length === 0) {
      event.preventDefault();
      setEmptyNotice(true);
      window.setTimeout(() => setEmptyNotice(false), 2200);
      return;
    }

    if (authLoading) {
      event.preventDefault();
      return;
    }

    if (!user) {
      event.preventDefault();
      setIsOpen(false);
      router.push("/account?next=/checkout");
    }

    if (items.length > 0) {
      setIsOpen(false);
    }
  };

  const playLineMotion = (itemId, type) => {
    const token = Date.now() + Math.random();
    setLineMotion((current) => ({ ...current, [itemId]: { type, token } }));
    window.setTimeout(() => {
      setLineMotion((current) => {
        if (current[itemId]?.token !== token) return current;
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    }, type === "removing" ? 320 : 260);
  };

  const handleDecrease = (item) => {
    const nextQuantity = item.quantity - 1;
    if (nextQuantity < 1) {
      handleRemove(item);
      return;
    }

    playLineMotion(item.id, "decreasing");
    updateQuantity(item.id, nextQuantity, getAvailableStock(item));
  };

  const handleIncrease = (item) => {
    playLineMotion(item.id, "increasing");
    updateQuantity(item.id, item.quantity + 1, getAvailableStock(item));
  };

  const handleRemove = (item) => {
    playLineMotion(item.id, "removing");
    window.setTimeout(() => removeItem(item.id), 240);
  };

  const handleRemoveClick = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    handleRemove(item);
  };

  const handleCouponSubmit = (event) => {
    event.preventDefault();
    const applied = applyCoupon(couponCode);
    setCouponNoticeToken(Date.now());
    if (applied) setCouponCode("");
  };

  const handleCouponRemove = () => {
    setCouponNoticeToken(Date.now());
    removeCoupon();
  };

  return (
    <>
      <button
        className={`cart-backdrop ${isOpen ? "is-visible" : ""}`}
        aria-label="Close cart"
        onClick={() => setIsOpen(false)}
      />
      <aside className={`cart-drawer ${isOpen ? "is-open" : ""} ${hasItems ? "has-cart-items" : "is-empty-cart"} ${isSingleItem ? "has-single-item" : ""}`} aria-label="Shopping cart">
        <div className="cart-head">
          <div>
            <p className="eyebrow">Your cart</p>
            <h2>Ready when you are.</h2>
            <p className="cart-subtitle">Review your items and checkout when you're ready.</p>
          </div>
          <button className="icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        <div className="cart-items">
          {!hasItems ? (
            <p className="empty-cart">Your cart is empty. Add a few cards to start an order.</p>
          ) : (
            <>
              {items.map((item) => {
                const motion = lineMotion[item.id];
                const motionTone = motion && Math.floor(motion.token) % 2 === 0 ? "motion-a" : "motion-b";

                return (
                  <article className={`cart-line ${motion ? `is-${motion.type} ${motionTone}` : ""}`} key={item.id}>
                    <Image
                      src={item.image}
                      alt=""
                      width={72}
                      height={72}
                      sizes="72px"
                      unoptimized={item.image.startsWith("data:")}
                    />
                    <div>
                      <h3>{item.name}</h3>
                      <p>{formatPrice(item.price)}</p>
                      {limitNotice?.id === item.id ? (
                        <div className="cart-limit-notice" role="status">
                          {limitNotice.message}
                        </div>
                      ) : null}
                      <div className="quantity-row">
                        <button
                          type="button"
                          onClick={() => handleDecrease(item)}
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="quantity-value" key={`quantity-${motion?.token ?? item.quantity}`}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrease(item)}
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus size={14} />
                        </button>
                        {motion ? (
                          <span className="quantity-burst" aria-hidden="true" key={`burst-${motion.token}`}>
                            <i />
                            <i />
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : null}
                        <button className="remove-button" type="button" onClick={(event) => handleRemoveClick(event, item)}>
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              <div className="cart-footer">
                {emptyNotice ? (
                  <div className="cart-empty-popover" role="status">
                    <strong>Oops</strong>
                    <span>Add something to your cart before checkout.</span>
                  </div>
                ) : null}
                <div className="cart-billing-card" aria-label="Billing details">
                  <div className="cart-billing-head">
                    <span><TicketPercent size={16} /> Billing Details</span>
                    {appliedCoupon ? <strong>{appliedCoupon.code}</strong> : null}
                  </div>
                  <div className="cart-billing-lines">
                    <p><span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span><strong>{formatPrice(subtotal)}</strong></p>
                    <p>
                      <span className="shipping-label">Shipping Charge <Info size={13} /></span>
                      <strong>{formatPrice(shippingCharge)}</strong>
                    </p>
                  </div>
                  <form className="cart-coupon-form" onSubmit={handleCouponSubmit}>
                    <label htmlFor="cart-coupon">Apply Coupon</label>
                    <div>
                      <label className="cart-coupon-input-shell" htmlFor="cart-coupon">
                        <Tag size={15} />
                        <input
                          id="cart-coupon"
                          value={couponCode}
                          onChange={(event) => setCouponCode(event.target.value)}
                          placeholder="Enter coupon code"
                          disabled={!hasItems}
                        />
                      </label>
                      <button type="submit" disabled={!hasItems}>Apply</button>
                    </div>
                  </form>
                  <p
                    key={`coupon-notice-${couponNoticeToken}-${couponNotice || "default"}`}
                    className={`cart-coupon-notice ${isCouponSuccess ? "is-success" : ""} ${appliedCoupon ? "is-applied" : ""} ${isCouponError ? "is-error" : ""} ${isCouponRemoved ? "is-removed" : ""}`}
                    role={isCouponError ? "alert" : "status"}
                  >
                    {isCouponError ? <CircleAlert size={15} /> : null}
                    {isCouponSuccess || isCouponRemoved ? <CheckCircle2 size={14} /> : null}
                    {couponNotice || "Only valid coupons are applicable."}
                    {appliedCoupon ? (
                      <button className="cart-coupon-remove" type="button" onClick={handleCouponRemove}>
                        <X size={12} />
                        Remove
                      </button>
                    ) : null}
                  </p>
                  <div className="cart-discount-line">
                    <span>Discount</span>
                    <strong>-{formatPrice(discountAmount)}</strong>
                  </div>
                  <div className="total-row cart-final-row">
                    <span>Total</span>
                    <strong>{formatPrice(total)}</strong>
                  </div>
                </div>
                <Link className="primary-button full cart-secure-checkout" href="/checkout" onClick={handleProtectedCheckoutClick}>
                  <LockKeyhole size={17} />
                  Checkout Securely
                </Link>
                <div className="cart-trust-grid" aria-label="Checkout promises">
                  <div>
                    <ShieldCheck size={22} />
                    <span><strong>Secure Checkout</strong><small>100% safe & trusted</small></span>
                  </div>
                  <div>
                    <Truck size={23} />
                    <span><strong>Fast Delivery</strong><small>Quick & reliable</small></span>
                  </div>
                  <div>
                    <PackageCheck size={22} />
                    <span><strong>Premium Packaging</strong><small>Packed with care</small></span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
