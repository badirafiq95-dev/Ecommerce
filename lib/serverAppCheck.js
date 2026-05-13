import { getAppCheck } from "firebase-admin/app-check";
import { getAdminApp } from "./firebaseAdmin";
import { getRequestIp, hashForLogs, logSecurityEvent } from "./serverLogging";

export function isAppCheckEnforced() {
  return process.env.FIREBASE_APPCHECK_ENFORCE === "true";
}

function appCheckError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function requireAppCheck(request, options = {}) {
  const route = options.route || "api";
  const required = options.required ?? isAppCheckEnforced();

  if (!required) {
    return { enforced: false };
  }

  const token = request.headers.get("x-firebase-appcheck");
  if (!token) {
    await logSecurityEvent("app_check_missing", {
      route,
      ipHash: hashForLogs(getRequestIp(request))
    });
    throw appCheckError("App Check token required");
  }

  try {
    const claims = await getAppCheck(getAdminApp()).verifyToken(token);
    return { enforced: true, claims };
  } catch (error) {
    await logSecurityEvent("app_check_invalid", {
      route,
      ipHash: hashForLogs(getRequestIp(request)),
      reason: error?.message || "Invalid App Check token"
    });
    throw appCheckError("Invalid App Check token");
  }
}
