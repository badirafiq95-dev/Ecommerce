"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  APPLIED_COUPON_STORAGE_KEY,
  COUPONS_UPDATED_EVENT,
  calculateCouponDiscount,
  findCouponByCode,
  readCoupons
} from "../lib/coupons";

const CartContext = createContext(null);
const STORAGE_KEY = "mint-lane-cart";
const SHIPPING_CHARGE = 150;

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [limitNotice, setLimitNotice] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponNotice, setCouponNotice] = useState("");
  const couponNoticeTimerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
      const nextCoupons = readCoupons();
      setCoupons(nextCoupons);
      const savedCoupon = localStorage.getItem(APPLIED_COUPON_STORAGE_KEY);
      const matchingCoupon = findCouponByCode(savedCoupon, nextCoupons);
      if (matchingCoupon) setAppliedCoupon(matchingCoupon);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const syncCoupons = () => {
      const nextCoupons = readCoupons();
      setCoupons(nextCoupons);
      setAppliedCoupon((current) => {
        if (!current) return current;
        return findCouponByCode(current.code, nextCoupons);
      });
    };

    window.addEventListener(COUPONS_UPDATED_EVENT, syncCoupons);
    window.addEventListener("storage", syncCoupons);
    return () => {
      window.removeEventListener(COUPONS_UPDATED_EVENT, syncCoupons);
      window.removeEventListener("storage", syncCoupons);
    };
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    if (appliedCoupon) {
      localStorage.setItem(APPLIED_COUPON_STORAGE_KEY, appliedCoupon.code);
      return;
    }
    localStorage.removeItem(APPLIED_COUPON_STORAGE_KEY);
  }, [appliedCoupon, ready]);

  useEffect(() => {
    return () => {
      if (couponNoticeTimerRef.current) window.clearTimeout(couponNoticeTimerRef.current);
    };
  }, []);

  const showCouponNotice = (message, duration = 0) => {
    if (couponNoticeTimerRef.current) {
      window.clearTimeout(couponNoticeTimerRef.current);
      couponNoticeTimerRef.current = null;
    }

    setCouponNotice(message);

    if (duration > 0) {
      couponNoticeTimerRef.current = window.setTimeout(() => {
        setCouponNotice((current) => (current === message ? "" : current));
        couponNoticeTimerRef.current = null;
      }, duration);
    }
  };

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
    const coupon = findCouponByCode(normalizedCode, coupons);

    if (!coupon) {
      showCouponNotice("Invalid coupon.", 1500);
      return false;
    }

    setAppliedCoupon(coupon);
    showCouponNotice(`${coupon.code} applied successfully.`);
    return true;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showCouponNotice("Coupon removed.", 1800);
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    showCouponNotice("");
  };

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingCharge = items.length > 0 ? SHIPPING_CHARGE : 0;
    const discountAmount = calculateCouponDiscount(appliedCoupon, subtotal, shippingCharge);
    const total = Math.max(0, subtotal + shippingCharge - discountAmount);
    return {
      items,
      count,
      subtotal,
      shippingCharge,
      discountAmount,
      total,
      appliedCoupon,
      coupons,
      couponNotice,
      ready,
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
  }, [items, isOpen, limitNotice, appliedCoupon, couponNotice, coupons]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
