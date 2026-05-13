import crypto from "node:crypto";
import { FieldValue, getAdminDb } from "./firebaseAdmin";

const MAX_DETAIL_LENGTH = 500;

function safeValue(value) {
  if (value === undefined || value === null) return value;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}...` : text;
}

export function hashForLogs(value) {
  return crypto
    .createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT || "freaking-collectibles"}:${value || "unknown"}`)
    .digest("hex")
    .slice(0, 24);
}

export function getRequestIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

export async function logSecurityEvent(type, details = {}) {
  const payload = Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => !/token|password|secret|private/i.test(key))
      .map(([key, value]) => [key, safeValue(value)])
  );

  console.warn(`[security] ${type}`, payload);

  if (process.env.SECURITY_LOG_TO_FIRESTORE !== "true") return;

  try {
    await getAdminDb().collection("securityEvents").add({
      type,
      details: payload,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[security] log write failed", error?.message || error);
    }
  }
}
