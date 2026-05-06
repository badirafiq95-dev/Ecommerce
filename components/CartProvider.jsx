"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "mint-lane-cart";
const COUPON_STORAGE_KEY = "mint-lane-coupon";
const SHIPPING_CHARGE = 150;
const COUPONS = {
  MINT10: { label: "MINT10", type: "percent", value: 10 },
  SAVE100: { label: "SAVE100", type: "fixed", value: 100 },
  LANE150: { label: "LANE150", type: "fixed", value: 150 }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [limitNotice, setLimitNotice] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponNotice, setCouponNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
      const savedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
      if (savedCoupon && COUPONS[savedCoupon]) setAppliedCoupon(COUPONS[savedCoupon]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    if (appliedCoupon) {
      localStorage.setItem(COUPON_STORAGE_KEY, appliedCoupon.label);
      return;
    }
    localStorage.removeItem(COUPON_STORAGE_KEY);
  }, [appliedCoupon, ready]);

  const showLimitNotice = (product, maxStock) => {
    const token = Date.now();
    setLimitNotice({
      id: product.id,
      message: `Maximum limit: ${maxStock}`,
      token
    });
    window.setTimeout(() => {
      setLimitNotice((current) => (current?.id === product.id && current?.token === token ? null : current));
    }, 2400);
  };

  const addItem = (product) => {
    const maxStock = Math.max(0, Number(product.stock) || 0);
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (!existing) {
        if (maxStock < 1) {
          showLimitNotice(product, 0);
          return current;
        }
        return [...current, { ...product, quantity: 1, stock: maxStock }];
      }

      if (existing.quantity >= maxStock) {
        showLimitNotice(product, maxStock);
        return current;
      }

      return current.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1, stock: maxStock } : item
      );
    });
    setIsOpen(true);
  };

  const removeItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, quantity, maxStock) => {
    if (quantity < 1) return removeItem(id);
    const stockLimit = Number.isFinite(Number(maxStock)) ? Math.max(0, Number(maxStock)) : Infinity;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (quantity > stockLimit) {
          showLimitNotice(item, stockLimit);
          return { ...item, stock: stockLimit };
        }
        return { ...item, quantity, stock: Number.isFinite(stockLimit) ? stockLimit : item.stock };
      })
    );
  };

  const applyCoupon = (code) => {
    const normalizedCode = String(code || "").trim().toUpperCase();
    const coupon = COUPONS[normalizedCode];

    if (!coupon) {
      setCouponNotice("Enter a valid coupon code.");
      return false;
    }

    setAppliedCoupon(coupon);
    setCouponNotice(`${coupon.label} applied successfully.`);
    return true;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponNotice("Coupon removed.");
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setCouponNotice("");
  };

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingCharge = items.length > 0 ? SHIPPING_CHARGE : 0;
    const discountAmount = appliedCoupon
      ? Math.min(
          appliedCoupon.type === "percent"
            ? Math.round((subtotal * appliedCoupon.value) / 100)
            : appliedCoupon.value,
          subtotal + shippingCharge
        )
      : 0;
    const total = Math.max(0, subtotal + shippingCharge - discountAmount);
    return {
      items,
      count,
      subtotal,
      shippingCharge,
      discountAmount,
      total,
      appliedCoupon,
      couponNotice,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      applyCoupon,
      removeCoupon,
      limitNotice,
      showLimitNotice
    };
  }, [items, isOpen, limitNotice, appliedCoupon, couponNotice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
