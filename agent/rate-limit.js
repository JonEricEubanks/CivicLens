/**
 * Shared rate-limit circuit breaker for GitHub Models API.
 * When a 429 is detected, all agents immediately fall back to offline mode
 * instead of waiting for LangChain retries (which take ~77s each).
 */

let rateLimitedUntil = 0;

export function isRateLimited() {
  return Date.now() < rateLimitedUntil;
}

export function markRateLimited(retryAfterSeconds = 300) {
  rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
  console.warn(`[rate-limit] GitHub Models rate limited — fallback mode for ${retryAfterSeconds}s`);
}

export function clearRateLimit() {
  rateLimitedUntil = 0;
}
