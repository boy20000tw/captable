/**
 * GET /api/health — dependency health check (v2.66)
 *
 * Returns 200 when the platform can actually serve requests, 503 otherwise.
 * Point the uptime monitor (Better Stack) at THIS endpoint, not the static
 * landing page — the landing page stays "up" while the API is dead.
 *
 * Checks (each with its own timeout so one slow dependency can't mask another):
 *   - db:    Postgres (Zeabur Tokyo, postgres-js)  `SELECT 1`  (critical → 503 if down)
 *   - redis: Redis    (Zeabur Tokyo, ioredis)      `PING`      (non-critical: limiter fails open)
 *   - env:   required secrets present          (critical)
 *
 * Deliberately imports only thin SDK clients — no server/ modules — so a
 * bug elsewhere in the app can never take the health check down with it.
 */
import type { IncomingMessage, ServerResponse } from "http";
import postgres from "postgres";
import Redis from "ioredis";

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
  const url = process.env.DATABASE_URL;
  if (!url) return { status: "down", error: "DATABASE_URL not set" };
  const t0 = Date.now();
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 1,
    ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
    onnotice: () => {},
  });
  try {
    await withTimeout(sql`SELECT 1`, 5500, "db");
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: "down", latencyMs: Date.now() - t0, error: errMsg(e) };
  } finally {
    sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.REDIS_URL;
  if (!url) return { status: "skipped" };
  const t0 = Date.now();
  const redis = new Redis(url, {
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // one attempt only — this is a probe
    lazyConnect: true,
  });
  redis.on("error", () => {}); // surfaced via the rejected promise below
  try {
    await withTimeout(redis.connect().then(() => redis.ping()), 2500, "redis");
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: "down", latencyMs: Date.now() - t0, error: errMsg(e) };
  } finally {
    redis.disconnect();
  }
}

function checkEnv(): CheckResult {
  const required = ["DATABASE_URL", "BETTER_AUTH_SECRET"];
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
