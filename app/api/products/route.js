import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { getDefaultProducts, normalizeProducts } from "../../../lib/productCatalogData";

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection("products").orderBy("name").get();
    const products = snapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }));
    return NextResponse.json({ products: products.length ? normalizeProducts(products) : getDefaultProducts() });
  } catch (error) {
    return NextResponse.json({ products: getDefaultProducts(), warning: error?.message || "Product fallback used" });
  }
}
