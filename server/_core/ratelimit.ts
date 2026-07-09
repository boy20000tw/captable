/**
 * Rate Limiter — Upstash Redis + @upstash/ratelimit
 * Uses sliding window algorithm. Falls through gracefully
 * if Upstash env vars are not set (dev environment).
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/** General API limiter — 60 requests per 60 seconds per identifier. */
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "60 s"),
      prefix: "rl:api",
      analytics: true,
    })
  : null;

/** Strict limiter for auth-related operations — 10 per 60 seconds. */
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "rl:auth",
      analytics: true,
    })
  : null;

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
