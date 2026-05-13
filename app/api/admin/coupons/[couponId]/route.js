import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../../lib/apiSecurity";
import { getAdminDb } from "../../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../../lib/serverAuth";

export async function DELETE(request, context) {
  try {
    await secureApiRequest(request, {
      route: "admin.coupons.delete",
      rateLimit: { scope: "admin.coupons.delete", limit: 30, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const { couponId } = await context.params;
    await getAdminDb().collection("coupons").doc(couponId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
