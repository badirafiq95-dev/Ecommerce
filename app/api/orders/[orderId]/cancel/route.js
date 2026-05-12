import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "../../../../../lib/firebaseAdmin";
import { authErrorResponse, requireFirebaseUser } from "../../../../../lib/serverAuth";

export async function PATCH(request, context) {
  try {
    const decodedToken = await requireFirebaseUser(request);
    const { orderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const cancelReason = String(body.cancelReason || "").trim();

    if (!cancelReason) {
      return NextResponse.json({ error: "Cancellation reason required" }, { status: 400 });
    }

    const orderRef = getAdminDb().collection("orders").doc(orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = snapshot.data();
    if (order.userId !== decodedToken.uid) {
      return NextResponse.json({ error: "Order does not belong to this user" }, { status: 403 });
    }

    const patch = {
      status: "Cancel requested",
      cancelReason,
      cancelRequestedAt: new Date().toISOString(),
      syncedAt: FieldValue.serverTimestamp()
    };
    await orderRef.set(patch, { merge: true });
    return NextResponse.json({ order: { id: orderId, ...order, ...patch } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
