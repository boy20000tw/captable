/**
 * GET /api/cron/refresh-demo — daily Vercel Cron (see vercel.json "crons").
 *
 * Slides the demo company's investor pipeline forward so the Demo Room always
 * shows a mix of ongoing + upcoming follow-ups instead of a wall of overdue
 * items. Logic lives in server/demo-refresh.ts; this file is only transport.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
 * when the CRON_SECRET env var is set. Manual runs can pass the same header.
 * Without CRON_SECRET configured the endpoint refuses to run (503) — never
 * expose a write endpoint unauthenticated by accident.
 *
 * Like /api/health this imports only the thin neon client, so it can't be
 * broken by (and can't break) the main tRPC bundle.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { refreshAllDemoCompanies } from "../../server/demo-refresh";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.statusCode = 503;
    res.end(JSON.stringify({ ok: false, error: "CRON_SECRET not configured" }));
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  const token = Array.isArray(auth) ? auth[0] : auth;
  if (!timingSafeEqual(token, `Bearer ${secret}`)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    return;
  }
  if (!process.env.DATABASE_URL) {
    res.statusCode = 503;
    res.end(JSON.stringify({ ok: false, error: "DATABASE_URL not set" }));
    return;
  }

  const startedAt = Date.now();
  try {
    const results = await refreshAllDemoCompanies(process.env.DATABASE_URL);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, totalMs: Date.now() - startedAt, results }));
  } catch (e) {
    console.error("[cron/refresh-demo] failed:", e);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) }));
  }
}
