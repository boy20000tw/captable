// Phase 1 smoke test (SPEC-mvp-split.md §8 V1 Phase 1 acceptance).
//
// Runs against whatever DB `DATABASE_URL` points at. CLEANS UP after itself
// using a clearly-marked test companyId that we delete at the end.
//
// Usage:
//   DATABASE_URL=... tsx scripts/smoke-phase1.ts

import { eq, and } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  companies,
  investors,
  fundingRounds,
  allocations,
  shareRegisterEntries,
  snapshots,
} from "../drizzle/schema";
import {
  advanceAllocation,
  type AllocationStatus,
} from "../shared/allocationLifecycle";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const sql = neon(url);
  const db = drizzle({ client: sql });

  const TEST_COMPANY_NAME = "SMOKE-TEST-PHASE1";

  // ── cleanup any prior runs ──────────────────────────────────────────────
  console.log("▸ Cleaning previous smoke-test data…");
  const prior = await db.select().from(companies)
    .where(eq(companies.name, TEST_COMPANY_NAME));
  for (const c of prior) {
    await db.delete(snapshots).where(eq(snapshots.companyId, c.id));
    await db.delete(shareRegisterEntries).where(eq(shareRegisterEntries.companyId, c.id));
    await db.delete(allocations).where(eq(allocations.companyId, c.id));
    await db.delete(investors).where(eq(investors.companyId, c.id));
    await db.delete(fundingRounds).where(eq(fundingRounds.companyId, c.id));
    await db.delete(companies).where(eq(companies.id, c.id));
  }

  // ── 1. Create test company ─────────────────────────────────────────────
  console.log("▸ 1. Creating test company…");
  const [company] = await db.insert(companies).values({
    name: TEST_COMPANY_NAME,
    slug: `smoke-${Date.now()}`,
  }).returning();
  console.log(`   ✓ company id=${company.id}`);

  // ── 2. Create 1 investor ────────────────────────────────────────────────
  console.log("▸ 2. Creating investor…");
  const [inv] = await db.insert(investors).values({
    companyId: company.id,
    name: "Smoke Test Angel",
    entityKind: "individual",
    status: "term_sheet",
  }).returning();
  console.log(`   ✓ investor id=${inv.id}`);

  // ── 3. Create 1 funding round ──────────────────────────────────────────
  console.log("▸ 3. Creating funding round…");
  const [round] = await db.insert(fundingRounds).values({
    companyId: company.id,
    name: "Smoke Seed",
    status: "completed",
    pricePerShareNtd: "10.000000",
  }).returning();
  console.log(`   ✓ round id=${round.id}`);

  // ── 4. Create allocation in Planned state ──────────────────────────────
  console.log("▸ 4. Creating allocation (Planned)…");
  const [alloc] = await db.insert(allocations).values({
    companyId: company.id,
    fundingRoundId: round.id,
    investorId: inv.id,
    shareClass: "seed",
    amount: "1000000",
    currency: "NTD",
    fxToNtd: "1",
    sharesAllocated: 100000,
    pricePerShare: "10.000000",
    status: "planned",
    termSheetUrl: "https://example.com/termsheet.pdf",
    agreementUrl: "https://example.com/agreement.pdf",
  }).returning();
  console.log(`   ✓ allocation id=${alloc.id} status=${alloc.status}`);

  // ── 5. Advance through lifecycle: planned → committed → signed → funded → issued ──
  console.log("▸ 5. Advancing lifecycle…");
  let current: AllocationStatus = "planned";
  const transitions: AllocationStatus[] = ["committed", "signed", "funded", "issued"];
  for (const _ of transitions) {
    const snapshot = {
      status: current,
      termSheetUrl: alloc.termSheetUrl,
      agreementUrl: alloc.agreementUrl,
      amount: alloc.amount,
      sharesAllocated: alloc.sharesAllocated,
      pricePerShare: alloc.pricePerShare,
    };
    const r = advanceAllocation(snapshot);
    if (!r.ok) throw new Error(`Transition from ${current} failed: ${r.errors.join("; ")}`);
    current = r.newStatus;
    const setObj: Record<string, unknown> = { status: r.newStatus, [r.timestampField]: new Date() };
    await db.update(allocations).set(setObj).where(eq(allocations.id, alloc.id));
    console.log(`   ✓ ${snapshot.status} → ${r.newStatus}`);
  }

  // ── 6. When allocation hits issued: write register entry ───────────────
  // In production this happens inside the router via writeRegisterEntry().
  // We inline-write here to keep the script self-contained (not using the
  // helper because it depends on the full server/db.ts module).
  console.log("▸ 6. Writing register entry (issuance)…");
  const [entry] = await db.insert(shareRegisterEntries).values({
    companyId: company.id,
    allocationId: alloc.id,
    fundingRoundId: round.id,
    investorId: inv.id,
    eventType: "issuance",
    shareClass: "seed",
    shares: alloc.sharesAllocated!,
    pricePerShare: alloc.pricePerShare,
    currency: "NTD",
    fxToNtd: "1",
    totalAmount: alloc.amount,
    effectiveDate: new Date().toISOString().slice(0, 10),
  }).returning();
  console.log(`   ✓ register entry id=${entry.id} shares=${entry.shares}`);

  // ── 7. Verify register has exactly 1 entry for this company ───────────
  const registerRows = await db.select().from(shareRegisterEntries)
    .where(eq(shareRegisterEntries.companyId, company.id));
  if (registerRows.length !== 1) {
    throw new Error(`Expected 1 register entry, got ${registerRows.length}`);
  }
  console.log(`   ✓ register has exactly 1 entry`);

  // ── 8. Create snapshot manually (in production this happens in writeRegisterEntry) ─
  console.log("▸ 7. Creating snapshot…");
  const [snap] = await db.insert(snapshots).values({
    companyId: company.id,
    name: `Smoke test snapshot`,
    triggerType: "register_write",
    registerEntryId: entry.id,
    capTableData: { test: true },
    totalShares: 100000,
    totalInvestors: 1,
  }).returning();
  console.log(`   ✓ snapshot id=${snap.id}`);

  // ── 9. Test Cap Table derivation via raw SQL (simulates deriveCapTable) ──
  console.log("▸ 8. Deriving cap table via SQL aggregation…");
  const agg = await sql(
    `SELECT "investorId", "shareClass", SUM(shares)::bigint AS total
     FROM share_register_entries
     WHERE "companyId" = $1
     GROUP BY "investorId", "shareClass"`,
    [company.id]
  );
  console.log(`   ✓ cap table rows: ${JSON.stringify(agg)}`);
  const totalShares = (agg as any[]).reduce((s, r) => s + Number(r.total), 0);
  if (totalShares !== 100000) {
    throw new Error(`Expected total 100000 shares, got ${totalShares}`);
  }
  // Since there's exactly 1 investor with all shares, ownership = 100%
  const onlyInvShares = Number((agg as any[])[0].total);
  const pct = (onlyInvShares / totalShares) * 100;
  console.log(`   ✓ ${TEST_COMPANY_NAME}: ${totalShares.toLocaleString()} shares, investor=${pct.toFixed(2)}%`);
  if (pct !== 100) {
    throw new Error(`Expected 100%, got ${pct}%`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("");
  console.log("✅ Phase 1 smoke test passed:");
  console.log(`   • investor + round + allocation created`);
  console.log(`   • allocation advanced planned → committed → signed → funded → issued`);
  console.log(`   • register entry written (1 row)`);
  console.log(`   • snapshot created`);
  console.log(`   • cap table aggregates to 100% for single-investor case`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  console.log("");
  console.log("▸ Cleaning up test data…");
  await db.delete(snapshots).where(eq(snapshots.companyId, company.id));
  await db.delete(shareRegisterEntries).where(eq(shareRegisterEntries.companyId, company.id));
  await db.delete(allocations).where(eq(allocations.companyId, company.id));
  await db.delete(investors).where(eq(investors.companyId, company.id));
  await db.delete(fundingRounds).where(eq(fundingRounds.companyId, company.id));
  await db.delete(companies).where(eq(companies.id, company.id));
  console.log("   ✓ cleaned.");
}

main().catch((err) => {
  console.error("❌ Smoke test FAILED:");
  console.error(err);
  process.exit(1);
});
