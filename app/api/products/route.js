import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../lib/apiSecurity";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { getDefaultProducts, normalizeProducts } from "../../../lib/productCatalogData";
import { authErrorResponse } from "../../../lib/serverAuth";

export async function GET(request) {
  try {
    await secureApiRequest(request, {
      route: "products.public",
      appCheck: false,
      rateLimit: { scope: "products.public", limit: 180, windowMs: 60_000 }
    });
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const snapshot = await getAdminDb().collection("products").orderBy("name").get();
    const products = snapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }));
    return NextResponse.json({ products: products.length ? normalizeProducts(products) : getDefaultProducts() });
  } catch (error) {
    return NextResponse.json({ products: getDefaultProducts(), warning: error?.message || "Product fallback used" });
  }
}
