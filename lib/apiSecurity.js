import { enforceRateLimit } from "./rateLimit";
import { requireAppCheck } from "./serverAppCheck";

export async function secureApiRequest(request, options = {}) {
  const route = options.route || "api";

  if (options.appCheck !== false) {
    await requireAppCheck(request, {
      route,
      required: options.appCheckRequired
    });
  }

  if (options.rateLimit) {
    await enforceRateLimit(request, {
      scope: options.rateLimit.scope || route,
      limit: options.rateLimit.limit,
      windowMs: options.rateLimit.windowMs,
      identity: options.rateLimit.identity
    });
  }
}
