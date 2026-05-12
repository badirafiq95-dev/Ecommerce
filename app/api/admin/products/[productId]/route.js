import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "../../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../../lib/serverAuth";
import { normalizeProduct } from "../../../../../lib/productCatalogData";

export async function PATCH(request, context) {
  try {
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
    await requireAdmin(request);
    const { productId } = await context.params;
    await getAdminDb().collection("products").doc(productId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
