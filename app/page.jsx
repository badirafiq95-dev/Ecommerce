import { ArrowRight, ExternalLink, Heart, Mail, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { CartDrawer } from "../components/CartDrawer";
import { Header } from "../components/Header";
import { HeroShowcase } from "../components/HeroShowcase";
import { ProductGrid } from "../components/ProductGrid";
import products from "../data/products.json";

function WhatsAppLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2.2c-5.42 0-9.82 4.35-9.82 9.72 0 1.72.46 3.39 1.33 4.86L2.14 21.8l5.18-1.35a9.9 9.9 0 0 0 4.72 1.2c5.42 0 9.82-4.35 9.82-9.73 0-5.37-4.4-9.72-9.82-9.72Zm0 17.82a8.23 8.23 0 0 1-4.18-1.14l-.3-.18-3.07.8.82-2.95-.2-.31a7.99 7.99 0 0 1-1.25-4.32c0-4.47 3.67-8.1 8.18-8.1s8.18 3.63 8.18 8.1-3.67 8.1-8.18 8.1Zm4.49-6.07c-.25-.12-1.47-.72-1.69-.8-.23-.09-.4-.12-.56.12-.17.24-.64.8-.79.96-.15.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.21-.73-.65-1.23-1.45-1.37-1.69-.15-.24-.02-.38.11-.5.12-.12.25-.29.37-.43.13-.14.17-.24.25-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.33-.77-1.82-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.44.06-.67.3-.23.24-.88.85-.88 2.08s.9 2.42 1.02 2.58c.12.16 1.77 2.68 4.29 3.75.6.26 1.07.41 1.44.52.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.17.21-.58.21-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z"
      />
    </svg>
  );
}

function InstagramLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

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
      <footer className="footer reveal" id="contact">
        <div className="footer-main">
          <section className="footer-brand-column" aria-label="Freaking Collectibles">
            <div className="footer-brand-row">
              <span className="footer-logo" aria-hidden="true">
                <img src="/images/website-logo-mark.png" alt="" />
              </span>
              <h2>Freaking Collectibles</h2>
            </div>
            <p>Premium trading cards, graded slabs, collectibles & accessories.</p>
            <div className="footer-trust-grid" aria-label="Store promises">
              <span>
                <ShieldCheck size={20} />
                <strong>100% Authentic</strong>
                <small>Verified Products</small>
              </span>
              <span>
                <PackageCheck size={20} />
                <strong>Secure Packaging</strong>
                <small>Packed with care</small>
              </span>
              <span>
                <Sparkles size={20} />
                <strong>Fast Shipping</strong>
                <small>Quick & reliable</small>
              </span>
            </div>
          </section>

          <section className="footer-contact-column" aria-label="Contact Freaking Collectibles">
            <h3>Contact Us</h3>
            <a className="footer-action-card" href="https://wa.me/919968596934" target="_blank" rel="noopener noreferrer">
              <span className="footer-action-icon footer-whatsapp-icon"><WhatsAppLogo size={22} /></span>
              <span>
                <small>WhatsApp</small>
                <strong>+919968596934</strong>
              </span>
            </a>
            <a className="footer-action-card" href="mailto:freakingcollectibles@gmail.com">
              <span className="footer-action-icon footer-email-icon"><Mail size={22} /></span>
              <span>
                <small>Email</small>
                <strong>freakingcollectibles@gmail.com</strong>
              </span>
            </a>
          </section>

          <section className="footer-social-column" aria-label="Freaking Collectibles Instagram">
            <h3>Follow Us</h3>
            <a className="footer-action-card" href="https://www.instagram.com/arshsingh.tcg/" target="_blank" rel="noopener noreferrer">
              <span className="footer-action-icon footer-instagram-icon"><InstagramLogo size={22} /></span>
              <span>
                <small>Seller Instagram</small>
                <strong>@arshsingh.tcg</strong>
              </span>
              <ExternalLink size={18} />
            </a>
            <a className="footer-action-card" href="https://www.instagram.com/freakingcollectibles.in/" target="_blank" rel="noopener noreferrer">
              <span className="footer-action-icon footer-instagram-icon"><InstagramLogo size={22} /></span>
              <span>
                <small>Official Instagram</small>
                <strong>@freakingcollectibles.in</strong>
              </span>
              <ExternalLink size={18} />
            </a>
          </section>
        </div>

        <div className="footer-bottom">
          <span>&copy; 2026 Freaking Collectibles. All rights reserved.</span>
          <span><ShieldCheck size={17} /> Trusted by collectors across India</span>
          <span>Made with <Heart size={16} fill="currentColor" /> for collectors</span>
        </div>
      </footer>
    </>
  );
}
