import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../../lib/apiSecurity";
import { FieldValue, getAdminDb } from "../../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../../lib/serverAuth";
import { normalizeProduct } from "../../../../../lib/productCatalogData";

export async function PATCH(request, context) {
  try {
    await secureApiRequest(request, {
      route: "admin.products.patch",
      rateLimit: { scope: "admin.products.patch", limit: 60, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const { productId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const product = normalizeProduct({ id: productId, ...body.product });
    await getAdminDb().collection("products").doc(productId).set({
      ...product,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return NextResponse.json({ product });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request, context) {
  try {
    await secureApiRequest(request, {
      route: "admin.products.delete",
      rateLimit: { scope: "admin.products.delete", limit: 30, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const { productId } = await context.params;
    await getAdminDb().collection("products").doc(productId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
