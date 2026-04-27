"use client";

import { useEffect, useRef } from "react";

export function HomeScrollSnap() {
  const locked = useRef(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    const hero = document.getElementById("home");
    const products = document.getElementById("products");
    if (!hero || !products) return;

    const unlockSoon = () => {
      window.setTimeout(() => {
        locked.current = false;
      }, 850);
    };

    const jumpTo = (target) => {
      locked.current = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      unlockSoon();
    };

    const handleDirection = (deltaY) => {
      if (locked.current || Math.abs(deltaY) < 24) return;

      const heroBottom = hero.getBoundingClientRect().bottom;
      const productsTop = products.getBoundingClientRect().top;

      if (deltaY > 0 && heroBottom > window.innerHeight * 0.45) {
        jumpTo(products);
      }

      if (deltaY < 0 && productsTop > -window.innerHeight * 0.25 && productsTop < window.innerHeight * 0.45) {
        jumpTo(hero);
      }
    };

    const onWheel = (event) => handleDirection(event.deltaY);
    const onTouchStart = (event) => {
      touchStartY.current = event.touches[0]?.clientY || 0;
    };
    const onTouchEnd = (event) => {
      const endY = event.changedTouches[0]?.clientY || 0;
      handleDirection(touchStartY.current - endY);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}
