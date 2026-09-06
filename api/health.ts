/**
 * GET /api/health — dependency health check (v2.66)
 *
 * Returns 200 when the platform can actually serve requests, 503 otherwise.
 * Point the uptime monitor (Better Stack) at THIS endpoint, not the static
 * landing page — the landing page stays "up" while the API is dead.
 *
 * Checks (each with its own timeout so one slow dependency can't mask another):
 *   - db:    Neon Postgres  `SELECT 1`         (critical → 503 if down)
 *   - redis: Upstash        `PING`             (non-critical: limiter fails open)
 *   - env:   required secrets present          (critical)
 *
 * Deliberately imports only thin SDK clients — no server/ modules — so a
 * bug elsewhere in the app can never take the health check down with it.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { neon, neonConfig } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";

type CheckResult = { status: "ok" | "down" | "skipped"; latencyMs?: number; error?: string };

const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

async function checkDb(): Promise<CheckResult> {
  if (!process.env.DATABASE_URL) return { status: "down", error: "DATABASE_URL not set" };
  const t0 = Date.now();
  try {
    neonConfig.fetchFunction = (input: any, init?: any) =>
      fetch(input, { ...(init ?? {}), signal: AbortSignal.timeout(5000) });
    const sql = neon(process.env.DATABASE_URL);
    await withTimeout(sql`SELECT 1`, 5500, "db");
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: "down", latencyMs: Date.now() - t0, error: errMsg(e) };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { status: "skipped" };
  const t0 = Date.now();
  try {
    const redis = new Redis({ url, token, retry: { retries: 0, backoff: () => 0 } });
    await withTimeout(redis.ping(), 2000, "redis");
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: "down", latencyMs: Date.now() - t0, error: errMsg(e) };
  }
}

function checkEnv(): CheckResult {
  const required = ["DATABASE_URL", "CLERK_SECRET_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  return missing.length ? { status: "down", error: `missing: ${missing.join(", ")}` } : { status: "ok" };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const startedAt = Date.now();
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const env = checkEnv();

  const healthy = db.status === "ok" && env.status === "ok";
  const body = {
    status: healthy ? "ok" : "degraded",
    healthy,
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? null,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    checks: { db, redis, env },
    totalMs: Date.now() - startedAt,
  };

  res.statusCode = healthy ? 200 : 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
}
