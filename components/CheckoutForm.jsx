"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Upload } from "lucide-react";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { useProductCatalog } from "./useProductCatalog";
import { useCustomerAuth } from "./CustomerAuthProvider";
import { formatPrice } from "../lib/format";
import { generateOrderId, saveOrder } from "../lib/orders";
import { sendOrderEmail } from "../lib/orderEmail";
import { saveCustomerOrder } from "../lib/firebaseClient";

function readPaymentScreenshot(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result || "")
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CheckoutForm() {
  const { items, total, clearCart } = useCart();
  const { user } = useCustomerAuth();
  const { products, reduceStock } = useProductCatalog();
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [startedAt] = useState(Date.now());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const honeypot = String(form.get("companyWebsite") || "").trim();
    const secondsOnPage = (Date.now() - startedAt) / 1000;

    if (honeypot || secondsOnPage < 3) {
      setError("Please wait a moment and try again.");
      return;
    }

    if (items.length === 0 || total <= 0) {
      setError("Add products to your cart before checkout.");
      return;
    }

    const unavailable = items.find((item) => {
      const product = products.find((currentProduct) => currentProduct.id === item.id);
      return !product || product.stock < item.quantity;
    });

    if (unavailable) {
      setError(`${unavailable.name} does not have enough stock.`);
      return;
    }

    setError("");
    setIsSubmitting(true);
    const id = generateOrderId();
    try {
      const paymentScreenshot = await readPaymentScreenshot(form.get("payment"));
      const order = {
        id,
        customerName: String(form.get("name") || "").trim(),
        email,
        phone: String(form.get("phone") || "").trim(),
        address: String(form.get("address") || "").trim(),
        total,
        status: "Payment review",
        createdAt: new Date().toISOString(),
        paymentScreenshot,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        }))
      };
      saveOrder(order);
      await saveCustomerOrder(order, user);
      await sendOrderEmail("created", order);
      reduceStock(items);
      setOrderId(id);
      setSubmitted(true);
      clearCart();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="success-panel">
        <CheckCircle2 size={44} />
        <h1>Order request received.</h1>
        <p>Order ID {orderId} is ready for manual confirmation. The admin panel will show this order.</p>
        <Link className="primary-button" href="/">Continue shopping</Link>
      </section>
    );
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-summary">
        <p className="eyebrow">Checkout</p>
        <h1>Confirm your order</h1>
        <div className="summary-lines">
          {items.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            items.map((item) => (
              <div className="summary-line" key={item.id}>
                <span>{item.name} x {item.quantity}</span>
                <strong>{formatPrice(item.price * item.quantity)}</strong>
              </div>
            ))
          )}
        </div>
        <div className="grand-total">
          <span>Total amount</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <div className="qr-box">
          <Image src="/images/payment-qr.svg" alt="Payment QR code" width={220} height={220} priority />
          <p>Scan and pay the total, then upload the screenshot.</p>
        </div>
      </section>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" required autoComplete="name" placeholder="Your full name" />
        </label>
        <label>
          Email
          <input name="email" required type="email" autoComplete="email" placeholder="you@example.com" />
        </label>
        <label>
          Address
          <textarea name="address" required rows={5} placeholder="House, street, city, PIN" />
        </label>
        <label>
          Phone Number
          <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" />
        </label>
        <label className="file-input">
          <Upload size={18} />
          Upload payment screenshot
          <input name="payment" required type="file" accept="image/*" />
        </label>
        <input className="spam-field" name="companyWebsite" tabIndex="-1" autoComplete="off" />
        {error ? <p className="checkout-error">{error}</p> : null}
        <button className="primary-button full checkout-submit-button" type="submit" disabled={total <= 0 || isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="submit-spinner" />
              Sending order...
            </>
          ) : (
            "Submit order request"
          )}
        </button>
      </form>
    </main>
  );
}
