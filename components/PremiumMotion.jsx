"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PremiumMotion() {
  const pathname = usePathname();
  const timerRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      document.documentElement.classList.add("motion-ready");
      document.querySelectorAll(".reveal").forEach((element) => {
        element.classList.add("is-visible");
      });
      return undefined;
    }

    const playPageEntry = () => {
      document.body.classList.remove("is-route-entering");
      window.requestAnimationFrame(() => {
        document.body.classList.add("is-route-entering");
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          document.body.classList.remove("is-route-entering");
        }, 980);
      });
    };

    const revealElements = Array.from(document.querySelectorAll(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target;
          const isHeroElement = element.classList.contains("hero-copy") || element.classList.contains("hero-visual");

          if (entry.isIntersecting) {
            const delay = element.dataset.revealDelay || "0ms";
            element.style.setProperty("--reveal-delay", delay);
            element.classList.add("is-visible");
            return;
          }

          if (isHeroElement) {
            const bounds = element.getBoundingClientRect();
            const isStillNearViewport = bounds.bottom > 0 && bounds.top < window.innerHeight;

            if (isStillNearViewport) return;
          }

          element.classList.remove("is-visible");
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08
      }
    );

    revealElements.forEach((element) => observer.observe(element));
    document.documentElement.classList.add("motion-ready");
    playPageEntry();

    const handleHomeEntry = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const isHomeLink = href === "/" || href === "/#" || href === "/#home" || href === "#home";
      if (!isHomeLink) return;
      if (window.location.pathname === "/" && (href === "/" || href === "/#" || href === "/#home")) return;

      revealElements.forEach((element) => element.classList.remove("is-visible"));
      window.setTimeout(playPageEntry, 20);
    };

    const handlePremiumJump = (event) => {
      const targetId = event.detail?.targetId;
      const targetElement = targetId ? document.getElementById(targetId) : null;

      if (!targetElement) return;

      revealElements.forEach((element) => element.classList.remove("is-visible"));
      playPageEntry();
      targetElement.classList.add("is-premium-jump-target");

      window.requestAnimationFrame(() => {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      window.setTimeout(() => {
        targetElement.classList.remove("is-premium-jump-target");
      }, 1100);
    };

    window.addEventListener("hashchange", playPageEntry);
    window.addEventListener("mint-lane-premium-jump", handlePremiumJump);
    document.addEventListener("click", handleHomeEntry);

    return () => {
      observer.disconnect();
      window.clearTimeout(timerRef.current);
      window.removeEventListener("hashchange", playPageEntry);
      window.removeEventListener("mint-lane-premium-jump", handlePremiumJump);
      document.removeEventListener("click", handleHomeEntry);
      document.body.classList.remove("is-route-entering");
    };
  }, [pathname]);

  return <div className="premium-route-wash" aria-hidden="true" />;
}
