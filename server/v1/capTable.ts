// Cap Table derivation (SPEC-mvp-split.md Phase 1 step 4)
//
// KEY INVARIANT (SPEC §0):
//   capTable = reduce(registerEntries)   — pure function, no independent data.
//
// Aggregates share_register_entries by (investorId, shareClass) to produce
// current holdings. Also rolls up ESOP pool allocation from esop_pool (V1
// reuses the legacy ESOP table per SPEC §9 scope limits). Founders /
// investors / ESOP / total ownership percentages are reported.
//
// This function is called from:
//   - writeRegisterEntry (to snapshot the cap table after every write)
//   - capTableRouter.summary (UI read path)
//   - any future scenario modeling (V2) that needs the base case
//
// Returns a plain JSON-serializable object so it can be stored as jsonb in
// the snapshots table.

import { and, eq } from "drizzle-orm";
import { getDb, resolveCompanyDek, decryptFinancialFields } from "../db";
import { decryptField } from "../encryption";
import {
  shareRegisterEntries,
  investors,
  esopPoolsV1,
  esopGrantsV1,
} from "../../drizzle/schema";

export type CapTableHolding = {
  investorId: number;
  investorName: string;
  investorStatus: string;
  entityKind: "individual" | "entity";
  totalShares: number;
  // Per share-class breakdown (only classes where the holding > 0)
  byShareClass: Record<string, number>;
  ownershipPct: string;         // "NN.NNNN" percent; string to avoid float drift
};

export type CapTable = {
  companyId: number;
  generatedAt: string;          // ISO timestamp
  totalShares: number;
  totalIssuedShares: number;    // = totalShares (kept for naming clarity)
  esopPoolTotal: number;
  esopPoolAllocated: number;
  esopPoolUnallocated: number;
  holdings: CapTableHolding[];
};

/**
 * Build the current cap table for a company by reducing share_register_entries.
 * `shares` column in the register is signed (+issuance/+transfer_in,
 * -transfer_out/-cancellation/-reversal) so SUM gives net holding directly.
 */
export async function deriveCapTable(companyId: number): Promise<CapTable> {
  const db = await getDb();
  if (!db) {
    return {
      companyId,
      generatedAt: new Date().toISOString(),
      totalShares: 0,
      totalIssuedShares: 0,
      esopPoolTotal: 0,
      esopPoolAllocated: 0,
      esopPoolUnallocated: 0,
      holdings: [],
    };
  }

  // ── Fetch all register entries and decrypt financial fields ──────────────
  // In-memory aggregation instead of SQL SUM — supports encrypted columns
  // and allows plaintext columns to be removed in the future.
  const rawEntries = await db.select().from(shareRegisterEntries)
    .where(eq(shareRegisterEntries.companyId, companyId));
  const entries = await Promise.all(
    rawEntries.map(e => decryptFinancialFields(e, companyId, ["shares", "pricePerShare", "fxToNtd", "totalAmount"]))
  );

  // ── Gather investor metadata ───────────────────────────────────────────
  const investorRows = rawEntries.length === 0
    ? []
    : await db.select().from(investors)
        .where(eq(investors.companyId, companyId));

  // Decrypt investor names from _enc columns
  try {
    const dek = await resolveCompanyDek(companyId);
    for (const inv of investorRows) {
      if (inv.nameEnc) (inv as any).name = decryptField(inv.nameEnc, dek);
    }
  } catch { /* encryption not configured */ }
  const investorMap = new Map(investorRows.map(i => [i.id, i]));

  // ── Roll up per-investor by (investorId, shareClass) ───────────────────
  const perInvestor = new Map<number, CapTableHolding>();
  for (const e of entries) {
    const shares = Number(e.shares ?? 0);
    if (shares === 0) continue;
    const inv = investorMap.get(e.investorId);
    const entry = perInvestor.get(e.investorId) ?? {
      investorId: e.investorId,
      investorName: inv?.name ?? `Investor #${e.investorId}`,
      investorStatus: inv?.status ?? "unknown",
      entityKind: (inv?.entityKind ?? "individual") as "individual" | "entity",
      totalShares: 0,
      byShareClass: {},
      ownershipPct: "0",
    };
    entry.totalShares += shares;
    entry.byShareClass[e.shareClass] = (entry.byShareClass[e.shareClass] ?? 0) + shares;
    perInvestor.set(e.investorId, entry);
  }

  // ── ESOP pool (V1 tables: pools + grants) ───────────────────────────────
  const pools = await db.select().from(esopPoolsV1)
    .where(eq(esopPoolsV1.companyId, companyId));
  const esopPoolTotal = pools.reduce((s, p) => s + p.totalShares, 0);

  // Allocated = sum of grants minus cancelled (a cancelled grant returns shares to the pool)
  const grants = await db.select().from(esopGrantsV1)
    .where(eq(esopGrantsV1.companyId, companyId));
  const esopPoolAllocated = grants.reduce((s, g) => s + g.sharesGranted - g.sharesCancelled, 0);
  const esopPoolUnallocated = esopPoolTotal - esopPoolAllocated;

  // ── Totals + ownership % ────────────────────────────────────────────────
  // Fully-diluted total = issued shares + unallocated ESOP pool
  const totalIssuedShares = Array.from(perInvestor.values())
    .reduce((s, h) => s + h.totalShares, 0);
  const fullyDiluted = totalIssuedShares + esopPoolUnallocated;

  const holdings: CapTableHolding[] = Array.from(perInvestor.values())
    .filter(h => h.totalShares > 0)
    .map(h => ({
      ...h,
      ownershipPct: fullyDiluted > 0
        ? ((h.totalShares / fullyDiluted) * 100).toFixed(4)
        : "0",
    }))
    .sort((a, b) => b.totalShares - a.totalShares);

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    totalShares: fullyDiluted,
    totalIssuedShares,
    esopPoolTotal,
    esopPoolAllocated,
    esopPoolUnallocated,
    holdings,
  };
}

/**
 * Convenience: sum of ownership percentages. Should always equal 100% (±tiny
 * rounding) when there are any holdings. Used as a sanity-check guard in
 * acceptance tests.
 */
export function sumOwnershipPct(capTable: CapTable): number {
  const sum = capTable.holdings.reduce((s, h) => s + Number(h.ownershipPct), 0);
  const esopSharePct = capTable.totalShares > 0
    ? (capTable.esopPoolUnallocated / capTable.totalShares) * 100
    : 0;
  return Number((sum + esopSharePct).toFixed(4));
}
