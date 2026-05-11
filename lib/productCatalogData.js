import defaultProducts from "../data/products.json";

export const DEFAULT_PRODUCT_IMAGE = "/images/hero-cards.png";

export function normalizeProduct(product) {
  return {
    ...product,
    id: String(product?.id || `product-${Date.now()}`),
    name: String(product?.name || "Untitled product"),
    category: String(product?.category || "Singles"),
    price: Math.max(0, Number(product?.price) || 0),
    stock: Math.max(0, Number(product?.stock) || 0),
    image: product?.image || DEFAULT_PRODUCT_IMAGE,
    tag: product?.tag || "New"
  };
}

export function normalizeProducts(products) {
  return Array.isArray(products) ? products.map(normalizeProduct) : getDefaultProducts();
}

export function getDefaultProducts() {
  return defaultProducts.map(normalizeProduct);
}
