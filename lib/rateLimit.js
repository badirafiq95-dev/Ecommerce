import crypto from "node:crypto";
import { FieldValue, getAdminDb } from "./firebaseAdmin";
import { getRequestIp, hashForLogs, logSecurityEvent } from "./serverLogging";

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

function hashKey(value) {
  return crypto
    .createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT || "freaking-collectibles"}:${value}`)
    .digest("hex");
}

function rateLimitError(retryAfter) {
  const error = new Error("Too many requests. Please try again shortly.");
  error.status = 429;
  error.retryAfter = retryAfter;
  return error;
}

export async function enforceRateLimit(request, options = {}) {
  const scope = options.scope || "api";
  const limit = Number(options.limit || DEFAULT_LIMIT);
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  const ip = getRequestIp(request);
  const identity = options.identity || ip;
  const now = Date.now();
  const expiresAtMs = now + windowMs;
  const key = hashKey(`${scope}:${identity}`);

  try {
    const db = getAdminDb();
    const docRef = db.collection("rateLimits").doc(key);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const current = snapshot.exists ? snapshot.data() : null;
      const currentResetAt =
        typeof current?.resetAt === "number"
          ? current.resetAt
          : current?.resetAt?.toMillis?.() || 0;
      const expired = !current || currentResetAt <= now;
      const nextCount = expired ? 1 : Number(current.count || 0) + 1;
      const resetAt = expired ? expiresAtMs : currentResetAt;

      transaction.set(
        docRef,
        {
          scope,
          keyHash: key,
          identityHash: hashForLogs(identity),
          count: nextCount,
          limit,
          resetAt,
          expiresAt: new Date(resetAt + 60_000),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        allowed: nextCount <= limit,
        remaining: Math.max(0, limit - nextCount),
        retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000))
      };
    });

    if (!result.allowed) {
      await logSecurityEvent("rate_limit_blocked", {
        scope,
        identityHash: hashForLogs(identity),
        retryAfter: result.retryAfter
      });
      throw rateLimitError(result.retryAfter);
    }

    return result;
  } catch (error) {
    if (error?.status === 429) throw error;

    await logSecurityEvent("rate_limit_error", {
      scope,
      identityHash: hashForLogs(identity),
      reason: error?.message || "Rate limit failed"
    });

    if (process.env.RATE_LIMIT_FAIL_OPEN === "true" || process.env.NODE_ENV !== "production") {
      return { allowed: true, remaining: limit, retryAfter: 0, degraded: true };
    }

    const nextError = new Error("Request protection is temporarily unavailable");
    nextError.status = 503;
    throw nextError;
  }
}
