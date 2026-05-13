import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../lib/apiSecurity";
import { FieldValue, getAdminDb } from "../../../../lib/firebaseAdmin";
import { normalizeCouponCode } from "../../../../lib/coupons";
import { authErrorResponse, requireAdmin } from "../../../../lib/serverAuth";

function normalizeCoupon(coupon) {
  const code = normalizeCouponCode(coupon?.code);
  return {
    id: String(coupon?.id || `coupon-${code || Date.now()}`),
    code,
    type: coupon?.type === "fixed" ? "fixed" : "percent",
    value: Math.max(0, Number(coupon?.value) || 0)
  };
}

async function readCouponsFromDb() {
  const snapshot = await getAdminDb().collection("coupons").get();
  const coupons = snapshot.docs.map((couponDoc) => ({ id: couponDoc.id, ...couponDoc.data() }));
  return coupons.map(normalizeCoupon);
}

export async function GET(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.coupons",
      rateLimit: { scope: "admin.coupons", limit: 120, windowMs: 60_000 }
    });
    await requireAdmin(request);
    return NextResponse.json({ coupons: await readCouponsFromDb() });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.coupons.update",
      rateLimit: { scope: "admin.coupons.update", limit: 60, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const coupons = Array.isArray(body.coupons) ? body.coupons.map(normalizeCoupon).filter((coupon) => coupon.code) : [];
    const db = getAdminDb();
    const existing = await db.collection("coupons").get();
    const nextIds = new Set(coupons.map((coupon) => coupon.id));
    const batch = db.batch();

    coupons.forEach((coupon) => {
      batch.set(db.collection("coupons").doc(coupon.id), {
        ...coupon,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    existing.docs.forEach((couponDoc) => {
      if (!nextIds.has(couponDoc.id)) batch.delete(couponDoc.ref);
    });

    await batch.commit();
    return NextResponse.json({ coupons });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.coupons.create",
      rateLimit: { scope: "admin.coupons.create", limit: 30, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const coupon = normalizeCoupon(body.coupon);
    if (!coupon.code || coupon.value <= 0) {
      return NextResponse.json({ error: "Coupon code and discount value are required" }, { status: 400 });
    }
    await getAdminDb().collection("coupons").doc(coupon.id).set({
      ...coupon,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return NextResponse.json({ coupon });
  } catch (error) {
    return authErrorResponse(error);
  }
}
