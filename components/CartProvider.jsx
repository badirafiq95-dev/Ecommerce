"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "mint-lane-cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [limitNotice, setLimitNotice] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

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

  const clearCart = () => setItems([]);

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      items,
      count,
      total,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      limitNotice,
      showLimitNotice
    };
  }, [items, isOpen, limitNotice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
