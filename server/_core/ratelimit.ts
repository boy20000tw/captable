/**
 * Rate Limiter — Upstash Redis + @upstash/ratelimit
 * Uses sliding window algorithm. Falls through gracefully
 * if Upstash env vars are not set (dev environment).
 *
 * RESILIENCE (v2.66): the limiter is a *protection*, never a dependency.
 * If Upstash is slow, over quota, paused, or misconfigured, `safeLimit()`
 * FAILS OPEN (allows the request) instead of turning every API call into
 * a 500. A rate limiter that can take the whole platform down is worse
 * than no rate limiter.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Hard ceiling for one Redis round-trip before we give up and fail open. */
const RATELIMIT_TIMEOUT_MS = 1500;

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        // Default client retries 5× with exponential backoff (>10s worst case).
        // We want fast failure — the timeout below is the real guard.
        retry: { retries: 1, backoff: () => 200 },
      })
    : null;

/**
 * NOTE: `analytics` is intentionally OFF. It doubles the Redis command count
 * per request, which on the Upstash free tier (10k commands/day) is exactly
 * how a small app exhausts its quota and starts erroring.
 */

/** General API limiter — 60 requests per 60 seconds per identifier. */
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "60 s"),
      prefix: "rl:api",
      analytics: false,
      ephemeralCache: new Map(),
    })
  : null;

/** Strict limiter for auth-related operations — 10 per 60 seconds. */
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "rl:auth",
      analytics: false,
      ephemeralCache: new Map(),
    })
  : null;

export type SafeLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
  /** true when the limiter was skipped because Redis was unavailable/slow */
  degraded: boolean;
};

let lastDegradedLog = 0;

/**
 * Run a limiter with a timeout and fail-open semantics.
 * Never throws.
 */
export async function safeLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<SafeLimitResult> {
  if (!limiter) return { success: true, remaining: -1, reset: 0, degraded: false };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`ratelimit timeout after ${RATELIMIT_TIMEOUT_MS}ms`)), RATELIMIT_TIMEOUT_MS);
  });

  try {
    const r = await Promise.race([limiter.limit(identifier), timeout]);
    return { success: r.success, remaining: r.remaining, reset: r.reset, degraded: false };
  } catch (err) {
    // Log at most once per 30s per lambda instance to avoid log floods.
    const now = Date.now();
    if (now - lastDegradedLog > 30_000) {
      lastDegradedLog = now;
      console.error("[RateLimit] DEGRADED — failing open:", err instanceof Error ? err.message : err);
    }
    return { success: true, remaining: -1, reset: 0, degraded: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Get client identifier: userId if authenticated, else IP. */
export function getIdentifier(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const auth = (req as any).auth;
  if (auth?.userId) return `user:${auth.userId}`;

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return `ip:${ip.trim()}`;
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) return `ip:${Array.isArray(realIp) ? realIp[0] : realIp}`;

  return "ip:unknown";
}
