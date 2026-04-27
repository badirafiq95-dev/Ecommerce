import Image from "next/image";
import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { CartDrawer } from "../components/CartDrawer";
import { Header } from "../components/Header";
import { HomeScrollSnap } from "../components/HomeScrollSnap";
import { ProductGrid } from "../components/ProductGrid";
import products from "../data/products.json";

const categories = ["Singles", "Sealed", "Graded", "Supplies"];

export default function HomePage() {
  return (
    <>
      <Header />
      <CartDrawer />
      <HomeScrollSnap />
      <main>
        <section className="hero" id="home">
          <div className="hero-copy reveal">
            <p className="eyebrow">Small batch trading card store</p>
            <h1>Mint Lane Cards</h1>
            <p className="hero-tagline">
              Premium singles, sealed stock, graded slabs, and supplies with a fast manual checkout.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#products">
                Shop cards <ArrowRight size={18} />
              </a>
              <a className="secondary-button" href="#categories">Browse categories</a>
            </div>
          </div>
          <div className="hero-visual reveal">
            <Image
              src="/images/hero-cards.png"
              alt="Trading cards, packs, and graded slabs arranged on a clean studio surface"
              width={1200}
              height={900}
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </div>
        </section>

        <section className="trust-strip" id="about" aria-label="Store benefits">
          <span><ShieldCheck size={18} /> Condition checked</span>
          <span><Truck size={18} /> Packed securely</span>
          <span><Sparkles size={18} /> Fresh weekly drops</span>
        </section>

        <section className="section" id="categories">
          <div className="section-head reveal">
            <p className="eyebrow">Categories</p>
            <h2>Find the right pull faster.</h2>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <a className="category-tile reveal" href="#products" key={category}>
                <span>{category}</span>
                <ArrowRight size={18} />
              </a>
            ))}
          </div>
        </section>

        <section className="section" id="products">
          <div className="section-head reveal">
            <p className="eyebrow">Latest stock</p>
            <h2>Ready to ship or reserve.</h2>
          </div>
          <ProductGrid products={products} />
        </section>
      </main>
      <footer className="footer">
        <strong>Mint Lane Cards</strong>
        <span>WhatsApp: +91 98765 43210</span>
        <span>Email: orders@mintlanecards.example</span>
      </footer>
    </>
  );
}
