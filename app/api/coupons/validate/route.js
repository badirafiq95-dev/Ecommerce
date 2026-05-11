import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { calculateCouponDiscount, normalizeCouponCode } from "../../../../lib/coupons";

async function readServerCoupons() {
  try {
    const snapshot = await getAdminDb().collection("coupons").get();
    const coupons = snapshot.docs.map((couponDoc) => ({ id: couponDoc.id, ...couponDoc.data() }));
    return coupons;
  } catch {
    return [];
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const code = normalizeCouponCode(body.code);
  const subtotal = Number(body.subtotal || 0);
  const shippingCharge = Number(body.shippingCharge || 0);
  const coupons = await readServerCoupons();
  const coupon = coupons.find((currentCoupon) => normalizeCouponCode(currentCoupon.code) === code);

  if (!coupon) {
    return NextResponse.json({ error: "Invalid coupon" }, { status: 404 });
  }

  return NextResponse.json({
    coupon,
    discountAmount: calculateCouponDiscount(coupon, subtotal, shippingCharge)
  });
}
