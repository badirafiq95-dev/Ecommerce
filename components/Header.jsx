"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LockKeyhole, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import {
  getAdminAccessExiting,
  getAdminAccessIntroPlayed,
  getAdminSession,
  markAdminAccessIntroPlayed
} from "../lib/adminSession";

export function Header() {
  const pathname = usePathname();
  const { count, setIsOpen } = useCart();
  const [showAdminAccess, setShowAdminAccess] = useState(false);
  const [playAdminAccessIntro, setPlayAdminAccessIntro] = useState(false);
  const [playAdminAccessExit, setPlayAdminAccessExit] = useState(false);
  const [homeSection, setHomeSection] = useState("home");

  useEffect(() => {
    const syncAdminAccess = () => {
      const active = getAdminSession();
      const exiting = getAdminAccessExiting();
      setShowAdminAccess(active || exiting);
      setPlayAdminAccessExit(exiting);
      setPlayAdminAccessIntro(active && !exiting && !getAdminAccessIntroPlayed());
    };

    syncAdminAccess();
    window.addEventListener("mint-lane-admin-session-updated", syncAdminAccess);
    return () => {
      window.removeEventListener("mint-lane-admin-session-updated", syncAdminAccess);
    };
  }, []);

  useEffect(() => {
    if (!playAdminAccessIntro) return;

    const timer = window.setTimeout(() => {
      markAdminAccessIntroPlayed();
      setPlayAdminAccessIntro(false);
    }, 2300);

    return () => window.clearTimeout(timer);
  }, [playAdminAccessIntro]);

  useEffect(() => {
    if (pathname !== "/") return;

    const syncSection = () => {
      const products = document.getElementById("products");
      if (!products) {
        setHomeSection("home");
        return;
      }

      setHomeSection(products.getBoundingClientRect().top <= window.innerHeight * 0.46 ? "products" : "home");
    };

    syncSection();
    window.addEventListener("scroll", syncSection, { passive: true });
    window.addEventListener("resize", syncSection);
    return () => {
      window.removeEventListener("scroll", syncSection);
      window.removeEventListener("resize", syncSection);
    };
  }, [pathname]);

  const isHomeActive = pathname === "/" && homeSection === "home";
  const isProductsActive = pathname === "/" && homeSection === "products";
  const isAdminActive = pathname === "/admin";
  const isAccountActive = pathname === "/account";

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Mint Lane Cards home">
        <span className="brand-mark">M</span>
        <span>Mint Lane Cards</span>
      </Link>
      <nav className="nav-links" aria-label="Primary navigation">
        {showAdminAccess ? (
          <span
            className={`admin-access-pill ${
              playAdminAccessExit ? "is-exiting" : playAdminAccessIntro ? "is-intro" : "is-settled"
            }`}
          >
            <ShieldCheck size={16} />
            <span>Admin Access</span>
          </span>
        ) : null}
        <Link className={`nav-pill home-link ${isHomeActive ? "is-active" : ""}`} href="/">
          <Home size={16} />
          <span>Home</span>
        </Link>
        <Link className={`nav-pill ${isProductsActive ? "is-active" : ""}`} href="/#products">Products</Link>
        <Link className="nav-pill" href="/#about">About</Link>
        <Link className={`nav-pill account-link ${isAccountActive ? "is-active" : ""}`} href="/account">
          <UserRound size={16} />
          <span>Account</span>
        </Link>
        <Link className={`admin-login-link nav-pill ${isAdminActive ? "is-active" : ""}`} href="/admin">
          <LockKeyhole size={16} />
          <span>Admin Panel</span>
        </Link>
        <button className="icon-button" type="button" onClick={() => setIsOpen(true)} aria-label="Open cart">
          <ShoppingBag size={20} />
          <span className="cart-count">{count}</span>
        </button>
      </nav>
    </header>
  );
}
