import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../lib/apiSecurity";
import { FieldValue, getAdminDb } from "../../../../lib/firebaseAdmin";
import { authErrorResponse, requireAdmin } from "../../../../lib/serverAuth";
import { normalizeProduct, normalizeProducts } from "../../../../lib/productCatalogData";

export async function GET(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.products",
      rateLimit: { scope: "admin.products", limit: 120, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const snapshot = await getAdminDb().collection("products").orderBy("name").get();
    const products = snapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }));
    return NextResponse.json({ products: normalizeProducts(products) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.products.update",
      rateLimit: { scope: "admin.products.update", limit: 60, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const products = normalizeProducts(body.products);
    const db = getAdminDb();
    const existing = await db.collection("products").get();
    const nextIds = new Set(products.map((product) => product.id));
    const batch = db.batch();

    products.forEach((product) => {
      batch.set(
        db.collection("products").doc(product.id),
        {
          ...product,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });

    existing.docs.forEach((productDoc) => {
      if (!nextIds.has(productDoc.id)) {
        batch.delete(productDoc.ref);
      }
    });

    await batch.commit();
    return NextResponse.json({ products });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.products.create",
      rateLimit: { scope: "admin.products.create", limit: 30, windowMs: 60_000 }
    });
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const product = normalizeProduct({ id: `product-${Date.now()}`, ...body.product });
    await getAdminDb().collection("products").doc(product.id).set({
      ...product,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return NextResponse.json({ product });
  } catch (error) {
    return authErrorResponse(error);
  }
}
