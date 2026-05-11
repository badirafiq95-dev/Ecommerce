import { getAdminAuth } from "./firebaseAdmin";

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : "";
}

function getAllowedAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyFirebaseUser(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (error) {
    const nextError = new Error(
      error?.message?.includes("incorrect 'aud'")
        ? "Firebase project mismatch: frontend token and backend Admin SDK are using different Firebase projects."
        : error?.message || "Invalid Firebase ID token"
    );
    nextError.status = 401;
    throw nextError;
  }
}

export function isDecodedAdmin(decodedToken) {
  if (!decodedToken) return false;
  if (decodedToken.admin === true) return true;

  const email = String(decodedToken.email || "").trim().toLowerCase();
  return Boolean(email && getAllowedAdminEmails().includes(email));
}

export async function requireFirebaseUser(request) {
  const decodedToken = await verifyFirebaseUser(request);
  if (!decodedToken) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  return decodedToken;
}

export async function requireAdmin(request) {
  const decodedToken = await requireFirebaseUser(request);
  if (!isDecodedAdmin(decodedToken)) {
    const error = new Error("Admin access required");
    error.status = 403;
    throw error;
  }
  return decodedToken;
}

export function authErrorResponse(error) {
  return Response.json(
    { error: error?.message || "Unauthorized" },
    { status: error?.status || 500 }
  );
}
