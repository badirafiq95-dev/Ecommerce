import { NextResponse } from "next/server";
import { secureApiRequest } from "../../../../lib/apiSecurity";
import { authErrorResponse, requireAdmin } from "../../../../lib/serverAuth";

export async function GET(request) {
  try {
    await secureApiRequest(request, {
      route: "admin.session",
      rateLimit: { scope: "admin.session", limit: 20, windowMs: 60_000 }
    });
    const decodedToken = await requireAdmin(request);
    return NextResponse.json({
      ok: true,
      admin: true,
      uid: decodedToken.uid,
      email: decodedToken.email || ""
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
