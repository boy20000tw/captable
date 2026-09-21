/**
 * Rate Limiter — self-hosted Redis (Zeabur Tokyo) via ioredis + rate-limiter-flexible
 *
 * v2.68: moved off Upstash. @upstash/ratelimit only speaks Upstash's REST API,
 * so a plain Redis needs a TCP client (ioredis) and a limiter that works with
 * it (rate-limiter-flexible). Falls through gracefully if REDIS_URL is not
 * set (dev environment).
 *
 * RESILIENCE (unchanged since v2.66): the limiter is a *protection*, never a
 * dependency. If Redis is slow, down, or misconfigured, `safeLimit()` FAILS
 * OPEN (allows the request) instead of turning every API call into a 500.
 * A rate limiter that can take the whole platform down is worse than no
 * rate limiter.
 */
import Redis from "ioredis";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";

/** Hard ceiling for one Redis round-trip before we give up and fail open. */
const RATELIMIT_TIMEOUT_MS = 1500;

let lastRedisErrorLog = 0;

function createRedis(url: string): Redis {
  const client = new Redis(url, {
    // Fail fast: the 1.5s race in safeLimit is the real guard, these just keep
    // ioredis from queueing/retrying for many seconds behind it.
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    // Keep reconnecting in the background with a capped backoff.
    retryStrategy: (times) => Math.min(times * 200, 2000),
    // TLS isn't available on the Zeabur port; use a rediss:// URL if it ever is.
    lazyConnect: false,
  });
  // Without a listener, connection errors are emitted as unhandled 'error'
  // events. Log at most once per 30s per instance.
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastRedisErrorLog > 30_000) {
      lastRedisErrorLog = now;
      console.error("[RateLimit] redis error:", err instanceof Error ? err.message : err);
    }
  });
  return client;
}

export const redis: Redis | null = process.env.REDIS_URL ? createRedis(process.env.REDIS_URL) : null;

/** General API limiter — 60 requests per 60 seconds per identifier. */
export const apiLimiter = redis
  ? new RateLimiterRedis({ storeClient: redis, keyPrefix: "rl:api", points: 60, duration: 60 })
  : null;

/** Strict limiter for auth-related operations — 10 per 60 seconds. */
export const authLimiter = redis
  ? new RateLimiterRedis({ storeClient: redis, keyPrefix: "rl:auth", points: 10, duration: 60 })
  : null;

export type SafeLimitResult = {
  success: boolean;
  remaining: number;
  /** Unix epoch ms when the current window resets */
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
  limiter: RateLimiterRedis | null,
  identifier: string,
): Promise<SafeLimitResult> {
  if (!limiter) return { success: true, remaining: -1, reset: 0, degraded: false };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`ratelimit timeout after ${RATELIMIT_TIMEOUT_MS}ms`)), RATELIMIT_TIMEOUT_MS);
  });

  try {
    const r = await Promise.race([limiter.consume(identifier, 1), timeout]);
    return { success: true, remaining: r.remainingPoints, reset: Date.now() + r.msBeforeNext, degraded: false };
  } catch (err) {
    // rate-limiter-flexible rejects with a RateLimiterRes when the limit is hit —
    // that's a real "no", not an outage.
    if (err instanceof RateLimiterRes) {
      return { success: false, remaining: 0, reset: Date.now() + err.msBeforeNext, degraded: false };
    }
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
