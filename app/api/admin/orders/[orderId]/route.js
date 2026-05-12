import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "../../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../../lib/serverAuth";

const ALLOWED_STATUSES = new Set(["Payment review", "Approved", "Rejected", "Cancelled"]);

export async function PATCH(request, context) {
  try {
    await requireAdmin(request);
    const { orderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status || "").trim();

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    }

    const orderRef = getAdminDb().collection("orders").doc(orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    const patch = {
      status,
      updatedAt,
      syncedAt: FieldValue.serverTimestamp()
    };

    await orderRef.set(patch, { merge: true });
    return NextResponse.json({
      order: {
        id: orderId,
        ...snapshot.data(),
        ...patch,
        syncedAt: updatedAt
      }
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
