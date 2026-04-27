"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { useProductCatalog } from "./useProductCatalog";
import { formatPrice } from "../lib/format";

export function CartDrawer() {
  const { items, total, isOpen, setIsOpen, removeItem, updateQuantity, limitNotice, showLimitNotice } = useCart();
  const { products } = useProductCatalog();
  const [emptyNotice, setEmptyNotice] = useState(false);

  const getAvailableStock = (item) => {
    const currentProduct = products.find((product) => product.id === item.id);
    return Math.max(0, Number(currentProduct?.stock ?? item.stock) || 0);
  };

  const handleCheckoutClick = (event) => {
    const invalidItem = items.find((item) => item.quantity > getAvailableStock(item));
    if (invalidItem) {
      event.preventDefault();
      showLimitNotice(invalidItem, getAvailableStock(invalidItem));
      return;
    }

    if (items.length > 0) {
      setIsOpen(false);
      return;
    }

    event.preventDefault();
    setEmptyNotice(true);
    window.setTimeout(() => setEmptyNotice(false), 2200);
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
            items.map((item) => (
              <article className="cart-line" key={item.id}>
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
                      onClick={() => updateQuantity(item.id, item.quantity - 1, getAvailableStock(item))}
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1, getAvailableStock(item))}
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus size={14} />
                    </button>
                    <button className="remove-button" type="button" onClick={() => removeItem(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="cart-footer">
          {emptyNotice ? (
            <div className="cart-empty-popover" role="status">
              <strong>Oops</strong>
              <span>Add something to your cart before checkout.</span>
            </div>
          ) : null}
          <div className="total-row">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <Link className="primary-button full" href="/checkout" onClick={handleCheckoutClick}>
            Checkout
          </Link>
        </div>
      </aside>
    </>
  );
}
