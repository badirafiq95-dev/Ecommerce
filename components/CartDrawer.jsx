"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Minus, Plus, TicketPercent, X } from "lucide-react";
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

  const handleCouponSubmit = (event) => {
    event.preventDefault();
    const applied = applyCoupon(couponCode);
    if (applied) setCouponCode("");
  };

  return (
    <>
      <button
        className={`cart-backdrop ${isOpen ? "is-visible" : ""}`}
        aria-label="Close cart"
        onClick={() => setIsOpen(false)}
      />
      <aside className={`cart-drawer ${isOpen ? "is-open" : ""}`} aria-label="Shopping cart">
        <div className="cart-head">
          <div>
            <p className="eyebrow">Your cart</p>
            <h2>Ready when you are.</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <p className="empty-cart">Your cart is empty. Add a few cards to start an order.</p>
          ) : (
            items.map((item) => {
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
                      <button className="remove-button" type="button" onClick={() => handleRemove(item)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="cart-footer">
          {emptyNotice ? (
            <div className="cart-empty-popover" role="status">
              <strong>Oops</strong>
              <span>Add something to your cart before checkout.</span>
            </div>
          ) : null}
          <div className="cart-billing-card" aria-label="Billing details">
            <div className="cart-billing-head">
              <span><TicketPercent size={16} /> Billing</span>
              {appliedCoupon ? <strong>{appliedCoupon.label}</strong> : null}
            </div>
            <div className="cart-billing-lines">
              <p><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
              <p><span>Shipping charge</span><strong>{formatPrice(shippingCharge)}</strong></p>
              {discountAmount > 0 ? (
                <p className="cart-discount-line">
                  <span>Coupon discount</span>
                  <strong>-{formatPrice(discountAmount)}</strong>
                </p>
              ) : null}
            </div>
            <form className="cart-coupon-form" onSubmit={handleCouponSubmit}>
              <label htmlFor="cart-coupon">Apply Coupon</label>
              <div>
                <input
                  id="cart-coupon"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                  placeholder="MINT10"
                  disabled={items.length === 0}
                />
                <button type="submit" disabled={items.length === 0}>Apply</button>
              </div>
            </form>
            {couponNotice ? (
              <p className={`cart-coupon-notice ${appliedCoupon ? "is-success" : ""}`} role="status">
                {appliedCoupon ? <CheckCircle2 size={14} /> : null}
                {couponNotice}
                {appliedCoupon ? <button type="button" onClick={removeCoupon}>Remove</button> : null}
              </p>
            ) : null}
            <div className="total-row cart-final-row">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>
          </div>
          <Link className="primary-button full" href="/checkout" onClick={handleProtectedCheckoutClick}>
            Checkout
          </Link>
        </div>
      </aside>
    </>
  );
}
