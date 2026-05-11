"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  CircleUserRound,
  Grid2X2,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "./CartProvider";
import { useCustomerAuth } from "./CustomerAuthProvider";
import { getAdminAccessExiting, getAdminSession } from "../lib/adminSession";
import { logoutCustomer } from "../lib/firebaseClient";

const BRAND_HOME_SCROLL_KEY = "freaking-collectibles-brand-home-scroll";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { count, setIsOpen } = useCart();
  const { user } = useCustomerAuth();
  const [adminShortcutActive, setAdminShortcutActive] = useState(false);
  const [adminShortcutExiting, setAdminShortcutExiting] = useState(false);
  const [secretOpening, setSecretOpening] = useState(false);
  const [isCustomerLoggingOut, setIsCustomerLoggingOut] = useState(false);
  const [isHelpOpening, setIsHelpOpening] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileMenuDismissed, setIsProfileMenuDismissed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileMenuStyle, setProfileMenuStyle] = useState({});
  const secretClickRef = useRef({ count: 0, timer: null });
  const profileMenuRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const mobileHeaderMenuRef = useRef(null);
  const profilePointerHandledRef = useRef(false);

  useEffect(() => {
    const syncAdminShortcut = () => {
      const exiting = getAdminAccessExiting();
      setAdminShortcutExiting(exiting);
      setAdminShortcutActive(getAdminSession() || exiting);
    };

    syncAdminShortcut();
    window.addEventListener("mint-lane-admin-session-updated", syncAdminShortcut);
    return () => {
      window.removeEventListener("mint-lane-admin-session-updated", syncAdminShortcut);
    };
  }, []);

  useEffect(() => {
    setIsProfileMenuOpen(false);
    setIsProfileMenuDismissed(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/" || typeof window === "undefined") return;
    const shouldScrollTop = window.sessionStorage.getItem(BRAND_HOME_SCROLL_KEY);
    if (!shouldScrollTop) return;

    window.sessionStorage.removeItem(BRAND_HOME_SCROLL_KEY);
    window.requestAnimationFrame(() => {
      window.history.replaceState(null, "", "/");
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (mobileHeaderMenuRef.current?.contains(event.target)) return;
      setIsMobileMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined;

    const updateProfileMenuPosition = () => {
      const trigger = profileTriggerRef.current;
      if (!trigger || !window.matchMedia("(max-width: 768px)").matches) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 230;
      const notchSize = 24;
      const notchCenter = rect.left + rect.width / 2;
      const left = Math.min(
        Math.max(notchCenter - 200, 16),
        window.innerWidth - menuWidth - 16
      );
      const top = rect.bottom + 13;

      setProfileMenuStyle({
        "--profile-menu-left": `${left}px`,
        "--profile-menu-top": `${top}px`,
        "--profile-menu-notch-left": `${notchCenter - left - notchSize / 2}px`
      });
    };

    const handlePointerDown = (event) => {
      if (profileMenuRef.current?.contains(event.target)) return;
      setIsProfileMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsProfileMenuOpen(false);
    };

    updateProfileMenuPosition();
    window.addEventListener("resize", updateProfileMenuPosition);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updateProfileMenuPosition);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const handleSecretAdminTap = () => {
    if (adminShortcutActive) {
      router.push("/admin");
      return;
    }

    const clickState = secretClickRef.current;
    clickState.count += 1;

    if (clickState.timer) {
      window.clearTimeout(clickState.timer);
    }

    if (clickState.count >= 3) {
      clickState.count = 0;
      clickState.timer = null;
      setSecretOpening(true);
      window.sessionStorage.setItem("mint-lane-secret-admin-entry", "true");
      window.setTimeout(() => {
        router.push("/admin");
        setSecretOpening(false);
      }, 520);
      return;
    }

    clickState.timer = window.setTimeout(() => {
      clickState.count = 0;
      clickState.timer = null;
    }, 850);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const targetPath = "/#products";
    const isHomePage = pathname === "/";

    if (!isHomePage) {
      router.push(targetPath);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("mint-lane-premium-jump", {
        detail: { targetId: "products" }
      })
    );
  };

  const handleBrandHomeClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsProfileMenuOpen(false);
    setIsProfileMenuDismissed(false);
    setIsMobileMenuOpen(false);
    setIsOpen(false);

    if (pathname === "/") {
      window.history.replaceState(null, "", "/");
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
      return;
    }

    window.sessionStorage.setItem(BRAND_HOME_SCROLL_KEY, "true");
    router.push("/");
  };

  const profileName = user?.displayName || user?.email?.split("@")[0] || "Login";
  const profileFirstName = profileName.split(/[.\s_-]+/).filter(Boolean)[0] || "Login";
  const handleLogout = async () => {
    if (isCustomerLoggingOut) return;
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsCustomerLoggingOut(true);
    window.setTimeout(async () => {
      await logoutCustomer();
      router.replace("/");
      window.setTimeout(() => setIsCustomerLoggingOut(false), 250);
    }, 1350);
  };

  const handleHelpOpen = () => {
    if (isHelpOpening) return;
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsHelpOpening(true);
    window.setTimeout(() => {
      setIsHelpOpening(false);
      if (pathname === "/") {
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.history.replaceState(null, "", "/#contact");
        return;
      }
      router.push("/#contact");
    }, 760);
  };

  const closeProfileMenuAfterAction = () => {
    setIsProfileMenuOpen(false);
    setIsProfileMenuDismissed(true);
    profileTriggerRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleProfileOpen = () => {
    if (!user) return;
    closeProfileMenuAfterAction();
    setIsMobileMenuOpen(false);
    if (pathname === "/account") {
      window.dispatchEvent(new CustomEvent("mint-lane-account-section", { detail: { section: "profile" } }));
    }
    router.push("/account?view=profile&section=profile");
  };

  const handleOrdersOpen = () => {
    if (!user) return;
    closeProfileMenuAfterAction();
    setIsMobileMenuOpen(false);
    router.push("/account/orders");
  };

  const handleProfileSectionOpen = (section) => {
    if (!user) return;
    closeProfileMenuAfterAction();
    setIsMobileMenuOpen(false);
    if (pathname === "/account") {
      window.dispatchEvent(new CustomEvent("mint-lane-account-section", { detail: { section } }));
    }
    router.push(`/account?view=profile&section=${section}`);
  };

  const positionMobileProfileMenu = (trigger) => {
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 260;
    const notchSize = 24;
    const notchCenter = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(notchCenter - 200, 16),
      window.innerWidth - menuWidth - 16
    );
    const top = rect.bottom + 13;

    setProfileMenuStyle({
      "--profile-menu-left": `${left}px`,
      "--profile-menu-top": `${top}px`,
      "--profile-menu-notch-left": `${notchCenter - left - notchSize / 2}px`
    });
  };

  const handleProfileTriggerPointerDown = (event) => {
    if (!window.matchMedia("(max-width: 768px)").matches || event.pointerType === "mouse") return;

    event.preventDefault();
    profilePointerHandledRef.current = true;

    if (!user) {
      setIsProfileMenuOpen(false);
      setIsProfileMenuDismissed(false);
      router.push("/account?next=/");
      return;
    }

    setIsProfileMenuDismissed(false);
    positionMobileProfileMenu(event.currentTarget);
    setIsProfileMenuOpen((current) => !current);
  };

  const handleProfileTriggerClick = (event) => {
    if (profilePointerHandledRef.current) {
      profilePointerHandledRef.current = false;
      return;
    }

    if (window.matchMedia("(max-width: 768px)").matches) {
      if (!user) {
        setIsProfileMenuOpen(false);
        setIsProfileMenuDismissed(false);
        router.push("/account?next=/");
        return;
      }

      setIsProfileMenuDismissed(false);
      positionMobileProfileMenu(event.currentTarget);
      setIsProfileMenuOpen((current) => !current);
      return;
    }

    setIsProfileMenuDismissed(false);
    if (!user) router.push("/account");
  };

  const customerLogoutOverlay =
    isCustomerLoggingOut && typeof document !== "undefined"
      ? createPortal(
          <div className="logout-overlay customer-logout-overlay" aria-live="polite">
            <div className="logout-card customer-logout-card">
              <div className="logout-icon">
                <LogOut size={42} />
              </div>
              <p className="eyebrow">Customer exit</p>
              <h2>Logging Out</h2>
              <span>Securing your profile session...</span>
            </div>
          </div>,
          document.body
        )
      : null;

  const helpOpeningOverlay =
    isHelpOpening && typeof document !== "undefined"
      ? createPortal(
          <div className="logout-overlay customer-logout-overlay help-redirect-overlay" aria-live="polite">
            <div className="logout-card customer-logout-card">
              <div className="logout-icon">
                <HelpCircle size={42} />
              </div>
              <p className="eyebrow">Help desk</p>
              <h2>Opening Help</h2>
              <span>Taking you to contact details...</span>
            </div>
          </div>,
          document.body
        )
      : null;

  const isHomeRoute = pathname === "/";
  const isCustomerAccountRoute = pathname === "/account" && Boolean(user);

  return (
    <header
      className={`site-header demo-site-header ${isHomeRoute ? "is-home-route" : ""} ${
        pathname === "/admin" ? "is-admin-route" : ""
      } ${isCustomerAccountRoute ? "is-customer-account-route" : ""}`}
    >
      {customerLogoutOverlay}
      {helpOpeningOverlay}
      <div className="brand demo-brand" aria-label="Freaking Collectibles">
        <button
          className={`brand-mark secret-brand-mark ${adminShortcutActive ? "is-admin-unlocked" : ""} ${
            adminShortcutExiting ? "is-admin-locking" : ""
          } ${secretOpening ? "is-secret-opening" : ""}`}
          type="button"
          onClick={handleSecretAdminTap}
          aria-label={adminShortcutActive ? "Open admin panel" : "Freaking Collectibles logo"}
        >
          M
        </button>
        <Link href="/" aria-label="Freaking Collectibles home" onClick={handleBrandHomeClick}>Freaking Collectibles</Link>
      </div>
      <div className="header-shop-tools" aria-label="Store tools">
        <Link className="header-category-button" href="/#products">
          <Grid2X2 size={18} />
          <span>Categories</span>
        </Link>
        <form className="header-search" action="/#products" onSubmit={handleSearchSubmit}>
          <label className="sr-only" htmlFor="site-search">Search cards</label>
          <input id="site-search" name="q" type="search" placeholder="Search cards, sets or products..." />
          <button type="submit" aria-label="Search">
            <Search size={18} />
          </button>
        </form>
        <div className="header-trust" aria-label="Store benefits">
          <span><ShieldCheck size={19} /> Condition checked</span>
          <span><Truck size={20} /> Packed securely</span>
          <span><Sparkles size={20} /> Fresh weekly drops</span>
        </div>
      </div>
      <nav className="nav-links demo-actions" aria-label="Primary navigation">
        <div
          className={`profile-menu ${user ? "is-customer-logged-in" : "is-guest"} ${
            isProfileMenuOpen ? "is-profile-menu-open" : ""
          } ${isProfileMenuDismissed ? "is-profile-menu-dismissed" : ""}`}
          ref={profileMenuRef}
          style={profileMenuStyle}
          onMouseLeave={() => setIsProfileMenuDismissed(false)}
        >
          <button
            className="demo-icon-link profile-menu-link"
            type="button"
            onPointerDown={handleProfileTriggerPointerDown}
            onClick={handleProfileTriggerClick}
            aria-label="Account menu"
            aria-expanded={isProfileMenuOpen}
            ref={profileTriggerRef}
          >
            <CircleUserRound size={29} strokeWidth={1.8} />
            <span>{profileFirstName}</span>
            <ChevronDown size={16} strokeWidth={2} />
          </button>
          <div className="profile-dropdown" aria-label="Customer menu">
            {user ? (
              <>
                <span className="profile-dropdown-title">Your Account</span>
                <button type="button" onClick={handleProfileOpen}>
                  <CircleUserRound className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  My Profile
                </button>
                <button type="button" onClick={handleOrdersOpen}>
                  <BriefcaseBusiness className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  Orders
                </button>
                <button type="button" onClick={() => handleProfileSectionOpen("addresses")}>
                  <Bookmark className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  Saved addresses
                </button>
                <button type="button" onClick={() => handleProfileSectionOpen("notifications")}>
                  <Bell className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  Notification
                </button>
                <button type="button" onClick={handleLogout}>
                  <LogOut className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  {isCustomerLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </>
            ) : (
              <>
                <span>
                  <CircleUserRound className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  My Profile
                </span>
                <span>
                  <BriefcaseBusiness className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  Orders
                </span>
                <span>
                  <Bookmark className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  Saved addresses
                </span>
                <span>
                  <Bell className="account-menu-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
                  Notification
                </span>
              </>
            )}
          </div>
        </div>
        <button className="demo-cart-button" type="button" onClick={() => setIsOpen(true)} aria-label="Open cart">
          <span className="cart-icon-wrap" aria-hidden="true">
            <ShoppingCart size={29} strokeWidth={1.8} />
            <span className="cart-count">{count}</span>
          </span>
          <span className="cart-label">Cart</span>
        </button>
        <div className={`mobile-header-menu ${isMobileMenuOpen ? "is-open" : ""}`} ref={mobileHeaderMenuRef}>
          <button
            className="mobile-menu-trigger"
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu size={34} strokeWidth={2.2} />
          </button>
          <div className="mobile-actions-dropdown" aria-label="Mobile menu">
            <button type="button" onClick={handleHelpOpen}>
              <HelpCircle size={19} strokeWidth={1.9} />
              Help
            </button>
            <button type="button" onClick={user ? handleLogout : () => router.push("/account?next=/")}>
              <LogOut size={19} strokeWidth={1.9} />
              Logout
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
