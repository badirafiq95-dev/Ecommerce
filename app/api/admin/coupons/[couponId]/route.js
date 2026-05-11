import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../../lib/serverAuth";

export async function DELETE(request, context) {
  try {
    await requireAdmin(request);
    const { couponId } = await context.params;
    await getAdminDb().collection("coupons").doc(couponId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
