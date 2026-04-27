"use client";

import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";
import { useProductCatalog } from "./useProductCatalog";
import { formatPrice } from "../lib/format";

export function ProductGrid({ products: initialProducts }) {
  const { addItem } = useCart();
  const { products } = useProductCatalog();
  const visibleProducts = products.length ? products : initialProducts;

  return (
    <div className="product-grid">
      {visibleProducts.map((product) => (
        <article className="product-card reveal" key={product.id}>
          <div className="product-image">
            <Image
              src={product.image}
              alt={product.name}
              width={460}
              height={360}
              sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
              loading="lazy"
              unoptimized={product.image.startsWith("data:")}
            />
            <span>{product.tag}</span>
          </div>
          <div className="product-info">
            <div>
              <p>{product.category}</p>
              <h3>{product.name}</h3>
            </div>
            <strong>{formatPrice(product.price)}</strong>
          </div>
          <button className="add-button" type="button" onClick={() => addItem(product)} disabled={product.stock < 1}>
            <ShoppingCart size={18} />
            {product.stock > 0 ? "Add to Cart" : "Sold Out"}
          </button>
        </article>
      ))}
    </div>
  );
}
