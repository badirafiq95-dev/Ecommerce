import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../lib/apiSecurity";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../lib/serverAuth";

export async function GET(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.orders",
      rateLimit: { scope: "admin.orders", limit: 120, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const snapshot = await getAdminDb().collection("orders").orderBy("createdAt", "desc").get();
    const orders = snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }));
    return NextResponse.json({ orders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
