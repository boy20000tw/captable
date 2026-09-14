/**
 * Demo Room date refresh (v2.67)
 * ──────────────────────────────
 * The demo company's investor pipeline was seeded with fixed calendar dates,
 * so after a few weeks every "upcoming" follow-up on the dashboard reads as
 * overdue. This module slides the demo company's *live pipeline* forward so
 * that the earliest pending follow-up is always due today — some items look
 * ongoing, the rest sit in the future — while historical closed rounds keep
 * their real dates.
 *
 * What moves (by the same delta, so the story stays internally consistent):
 *   - investor_activities.dueDate / completedAt          (all rows)
 *   - allocations.* stage timestamps of PROJECTED rounds  (the open round's funnel)
 *   - investors.firstContactAt / lastContactAt           (only if after the last closed round)
 *   - share_register_entries.effectiveDate               (only if after the last closed round)
 *   - projected funding_rounds.roundDate is pushed out by whole quarters so it
 *     always stays ≥ MIN_ROUND_LEAD_DAYS ahead.
 *
 * Deliberately uses the thin neon client and plain SQL (like api/health.ts) so
 * the cron function stays tiny and independent of the app's Drizzle layer.
 *
 * Idempotent: running it twice on the same day is a no-op.
 */
import { neon } from "@neondatabase/serverless";

export const DEMO_TZ = "Asia/Taipei";
/** Projected rounds are kept at least this many days in the future. */
export const MIN_ROUND_LEAD_DAYS = 75;

export type DemoRefreshResult = {
  companyId: number;
  today: string;
  anchor: string | null;
  deltaDays: number;
  activities: number;
  allocations: number;
  investors: number;
  registerEntries: number;
  roundsPushed: number;
  skipped?: string;
};

/** Company IDs that are treated as demo rooms. Env override: DEMO_COMPANY_IDS="1,8". */
export function getDemoCompanyIds(): number[] {
  const raw = process.env.DEMO_COMPANY_IDS ?? "1";
  return raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
}

export async function refreshDemoCompany(databaseUrl: string, companyId: number): Promise<DemoRefreshResult> {
  const sql = neon(databaseUrl);

  const [{ today }] = await sql`SELECT (NOW() AT TIME ZONE ${DEMO_TZ})::date::text AS today` as { today: string }[];

  // Anchor = earliest pending follow-up. Fallback: latest completed one + 3 days
  // (so a fully-completed pipeline still keeps its history recent).
  const [anchorRow] = await sql`
    SELECT COALESCE(
      (SELECT MIN("dueDate")::date FROM investor_activities WHERE "companyId" = ${companyId} AND status = 'pending' AND "dueDate" IS NOT NULL),
      (SELECT (MAX(COALESCE("completedAt", "dueDate")) + INTERVAL '3 days')::date FROM investor_activities WHERE "companyId" = ${companyId})
    )::text AS anchor
  ` as { anchor: string | null }[];
  const anchor = anchorRow?.anchor ?? null;

  const base: DemoRefreshResult = {
    companyId, today, anchor, deltaDays: 0,
    activities: 0, allocations: 0, investors: 0, registerEntries: 0, roundsPushed: 0,
  };
  if (!anchor) return { ...base, skipped: "no activities" };

  const [{ delta }] = await sql`SELECT (${today}::date - ${anchor}::date)::int AS delta` as { delta: number }[];

  // Last closed round date = boundary between "history" (frozen) and "live pipeline" (slides).
  const [{ cutoff }] = await sql`
    SELECT COALESCE(MAX("roundDate"), '1970-01-01')::text AS cutoff
    FROM funding_rounds WHERE "companyId" = ${companyId} AND status = 'completed'
  ` as { cutoff: string }[];

  const result = { ...base, deltaDays: delta };

  if (delta > 0) {
    const shift = `${delta} days`;

    const a = await sql`
      UPDATE investor_activities
      SET "dueDate" = "dueDate" + ${shift}::interval,
          "completedAt" = "completedAt" + ${shift}::interval,
          "updatedAt" = NOW()
      WHERE "companyId" = ${companyId}
      RETURNING id`;
    result.activities = a.length;

    const al = await sql`
      UPDATE allocations
      SET "plannedAt"   = "plannedAt"   + ${shift}::interval,
          "committedAt" = "committedAt" + ${shift}::interval,
          "signedAt"    = "signedAt"    + ${shift}::interval,
          "fundedAt"    = "fundedAt"    + ${shift}::interval,
          "issuedAt"    = "issuedAt"    + ${shift}::interval,
          "updatedAt"   = NOW()
      WHERE "companyId" = ${companyId}
        AND "fundingRoundId" IN (SELECT id FROM funding_rounds WHERE "companyId" = ${companyId} AND status = 'projected')
      RETURNING id`;
    result.allocations = al.length;

    const inv = await sql`
      UPDATE investors
      SET "firstContactAt" = CASE WHEN "firstContactAt" > ${cutoff}::date THEN "firstContactAt" + ${shift}::interval ELSE "firstContactAt" END,
          "lastContactAt"  = CASE WHEN "lastContactAt"  > ${cutoff}::date THEN "lastContactAt"  + ${shift}::interval ELSE "lastContactAt"  END,
          "updatedAt" = NOW()
      WHERE "companyId" = ${companyId}
        AND ("firstContactAt" > ${cutoff}::date OR "lastContactAt" > ${cutoff}::date)
      RETURNING id`;
    result.investors = inv.length;

    const reg = await sql`
      UPDATE share_register_entries
      SET "effectiveDate" = "effectiveDate" + ${shift}::interval
      WHERE "companyId" = ${companyId} AND "effectiveDate" > ${cutoff}::date
      RETURNING id`;
    result.registerEntries = reg.length;
  }

  // Keep projected rounds comfortably in the future (push by whole quarters).
  const rounds = await sql`
    SELECT id, "roundDate"::text AS d FROM funding_rounds
    WHERE "companyId" = ${companyId} AND status = 'projected' AND "roundDate" IS NOT NULL
  ` as { id: number; d: string }[];
  for (const r of rounds) {
    const [{ q }] = await sql`
      SELECT CEIL(GREATEST(0, (${today}::date + ${MIN_ROUND_LEAD_DAYS}::int - ${r.d}::date)) / 91.0)::int AS q
    ` as { q: number }[];
    if (q > 0) {
      await sql`UPDATE funding_rounds SET "roundDate" = ("roundDate" + (${q}::int * INTERVAL '3 months'))::date, "updatedAt" = NOW() WHERE id = ${r.id}`;
      result.roundsPushed++;
    }
  }

  return result;
}

export async function refreshAllDemoCompanies(databaseUrl: string): Promise<DemoRefreshResult[]> {
  const out: DemoRefreshResult[] = [];
  for (const id of getDemoCompanyIds()) out.push(await refreshDemoCompany(databaseUrl, id));
  return out;
}
