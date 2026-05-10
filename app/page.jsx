import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { CartDrawer } from "../components/CartDrawer";
import { Header } from "../components/Header";
import { HeroShowcase } from "../components/HeroShowcase";
import { ProductGrid } from "../components/ProductGrid";
import products from "../data/products.json";

export default function HomePage() {
  return (
    <>
      <Header />
      <CartDrawer />
      <main className="demo-home">
        <section className="hero" id="home">
          <span className="hero-line hero-line-one" aria-hidden="true" />
          <span className="hero-line hero-line-two" aria-hidden="true" />
          <span className="hero-orbit" aria-hidden="true" />
          <div className="hero-copy reveal">
            <p className="hero-badge"><ShieldCheck size={15} /> Trusted by collectors</p>
            <h1>Find the right pull faster.</h1>
            <p className="hero-tagline">
              Curated trading cards. Verified condition. Packed with care. Delivered to you.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#products">
                Browse Categories <ArrowRight size={18} />
              </a>
            </div>
          </div>
          <div className="hero-stand" aria-hidden="true" />
          <div className="hero-visual reveal">
            <HeroShowcase />
          </div>
        </section>

        <section className="trust-strip reveal" id="about" aria-label="Store benefits">
          <span><ShieldCheck size={24} /><strong>Condition checked</strong><small>Every card is carefully inspected</small></span>
          <span><Truck size={24} /><strong>Packed securely</strong><small>Safe packaging, always</small></span>
          <span><Sparkles size={24} /><strong>Fresh weekly drops</strong><small>New arrivals every week</small></span>
        </section>

        <section className="section latest-stock-section reveal" id="products">
          <div className="section-head reveal">
            <div>
              <h2>Latest Stock</h2>
            </div>
            <a className="view-all-link" href="#products">View all <ArrowRight size={14} /></a>
          </div>
          <ProductGrid products={products} />
        </section>
      </main>
      <footer className="footer" id="contact">
        <strong>Freaking Collectibles</strong>
        <a href="https://wa.me/919968596934" target="_blank" rel="noopener noreferrer">WhatsApp: +919968596934</a>
        <a href="mailto:freakingcollectibles@gmail.com">Email: freakingcollectibles@gmail.com</a>
      </footer>
    </>
  );
}
