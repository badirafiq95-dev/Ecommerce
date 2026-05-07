export const COUPONS_STORAGE_KEY = "mint-lane-admin-coupons";
export const APPLIED_COUPON_STORAGE_KEY = "mint-lane-coupon";
export const COUPONS_UPDATED_EVENT = "mint-lane-coupons-updated";

export const DEFAULT_COUPONS = [
  { id: "coupon-mint10", code: "MINT10", type: "percent", value: 10 },
  { id: "coupon-save100", code: "SAVE100", type: "fixed", value: 100 },
  { id: "coupon-lane150", code: "LANE150", type: "fixed", value: 150 }
];

export function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function readCoupons() {
  if (typeof window === "undefined") return DEFAULT_COUPONS;

  try {
    const saved = localStorage.getItem(COUPONS_STORAGE_KEY);
    if (saved === null) return DEFAULT_COUPONS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : DEFAULT_COUPONS;
  } catch {
    return DEFAULT_COUPONS;
  }
}

export function saveCoupons(coupons) {
  if (typeof window === "undefined") return coupons;
  localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
  window.dispatchEvent(new Event(COUPONS_UPDATED_EVENT));
  return coupons;
}

export function findCouponByCode(code, coupons = readCoupons()) {
  const normalizedCode = normalizeCouponCode(code);
  return coupons.find((coupon) => normalizeCouponCode(coupon.code) === normalizedCode) || null;
}

export function calculateCouponDiscount(coupon, subtotal, shippingCharge) {
  if (!coupon) return 0;
  const rawDiscount =
    coupon.type === "percent"
      ? Math.round((subtotal * Number(coupon.value || 0)) / 100)
      : Number(coupon.value || 0);
  return Math.min(Math.max(0, rawDiscount), subtotal + shippingCharge);
}
