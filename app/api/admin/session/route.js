import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "../../../../lib/serverAuth";

export async function GET(request) {
  try {
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
