import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../lib/apiSecurity";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { calculateCouponDiscount, normalizeCouponCode } from "../../../../lib/coupons";
import { authErrorResponse } from "../../../../lib/serverAuth";

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
  try {
    await secureApiRequest(request, {
      route: "coupons.validate",
      rateLimit: { scope: "coupons.validate", limit: 30, windowMs: 60_000 }
    });
  } catch (error) {
    return authErrorResponse(error);
  }

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
