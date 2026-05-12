"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getDefaultProducts, normalizeProduct, normalizeProducts } from "../lib/productCatalogData";

export const PRODUCT_STORAGE_KEY = "mint-lane-products";

function readProducts() {
  const defaultProducts = getDefaultProducts();
  if (typeof window === "undefined") return defaultProducts;

  try {
    const saved = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!saved) return defaultProducts;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? normalizeProducts(parsed) : defaultProducts;
  } catch {
    return defaultProducts;
  }
}

export function useProductCatalog() {
  const [products, setProducts] = useState(getDefaultProducts());

  useEffect(() => {
    setProducts(readProducts());
    let ignore = false;

    fetch("/api/products")
      .then((response) => response.json())
      .then((data) => {
        if (ignore || !Array.isArray(data.products)) return;
        const normalized = normalizeProducts(data.products);
        setProducts(normalized);
        localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(normalized));
        window.dispatchEvent(new Event("mint-lane-products-updated"));
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  const saveProducts = useCallback((nextProducts) => {
    const normalized = nextProducts.map(normalizeProduct);
    setProducts(normalized);
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event("mint-lane-products-updated"));
  }, []);

  useEffect(() => {
    const sync = () => setProducts(readProducts());
    window.addEventListener("storage", sync);
    window.addEventListener("mint-lane-products-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("mint-lane-products-updated", sync);
    };
  }, []);

  const updateProduct = useCallback(
    (id, patch) => {
      saveProducts(products.map((product) => (product.id === id ? normalizeProduct({ ...product, ...patch }) : product)));
    },
    [products, saveProducts]
  );

  const adjustPrice = useCallback(
    (id, amount) => {
      saveProducts(
        products.map((product) =>
          product.id === id ? normalizeProduct({ ...product, price: product.price + amount }) : product
        )
      );
    },
    [products, saveProducts]
  );

  const addProduct = useCallback(
    (product) => {
      saveProducts([
        ...products,
        normalizeProduct({
          id: `product-${Date.now()}`,
          ...product
        })
      ]);
    },
    [products, saveProducts]
  );

  const removeProduct = useCallback(
    (id) => {
      saveProducts(products.filter((product) => product.id !== id));
    },
    [products, saveProducts]
  );

  const reduceStock = useCallback(
    (cartItems) => {
      saveProducts(
        products.map((product) => {
          const cartItem = cartItems.find((item) => item.id === product.id);
          if (!cartItem) return product;
          return normalizeProduct({ ...product, stock: product.stock - cartItem.quantity });
        })
      );
    },
    [products, saveProducts]
  );

  const restoreStock = useCallback(
    (orderItems) => {
      saveProducts(
        products.map((product) => {
          const orderItem = orderItems.find((item) => item.id === product.id);
          if (!orderItem) return product;
          return normalizeProduct({ ...product, stock: product.stock + orderItem.quantity });
        })
      );
    },
    [products, saveProducts]
  );

  const resetProducts = useCallback(() => {
    saveProducts(getDefaultProducts());
  }, [saveProducts]);

  const saveChanges = useCallback(() => {
    saveProducts(products);
  }, [products, saveProducts]);

  const stats = useMemo(() => {
    const stock = products.reduce((sum, product) => sum + product.stock, 0);
    const value = products.reduce((sum, product) => sum + product.price * product.stock, 0);
    return {
      products: products.length,
      stock,
      value,
      categories: new Set(products.map((product) => product.category)).size
    };
  }, [products]);

  return {
    products,
    stats,
    updateProduct,
    adjustPrice,
    addProduct,
    removeProduct,
    reduceStock,
    restoreStock,
    resetProducts,
    saveChanges
  };
}
