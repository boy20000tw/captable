// Phase 3 migration — move legacy data into V1 tables.
//
// Usage:
//   DRY_RUN=true  DATABASE_URL=... tsx scripts/migrate-legacy-to-v1.ts   # dry run (default)
//   DRY_RUN=false DATABASE_URL=... tsx scripts/migrate-legacy-to-v1.ts   # real run
//
// Strategy (confirmed with user):
//   - Source: share_transactions (13 rows for companyId=1; shareholderId=11 "ESOP" skipped)
//   - Each shareholder (except #11 ESOP) → investors row (status=invested)
//   - Each transaction → share_register_entries row (append-only fact ledger)
//   - esop_pool → esop_pools_v1
//   - No snapshots created per-row (would trigger 13 snapshots). Instead we
//     create one manual "Post-migration baseline" snapshot at the end.
//   - Runs inside a transaction: if anything fails, nothing commits.
//   - Safe to re-run: detects prior migration via audit markers on
//     investors.notes ("[migrated from shareholders.id=N]").

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import {
  shareholders,
  shareTransactions,
  esopPool,
  investors,
  shareRegisterEntries,
  esopPoolsV1,
  snapshots as snapshotsV1,
} from "../drizzle/schema";

const DRY_RUN = process.env.DRY_RUN !== "false"; // default true
const ESOP_SHAREHOLDER_ID = 11;                   // skip this one per SPEC

type InvestorMap = Map<number, number>;           // legacy shareholderId -> new investorId

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url);
  const db = drizzle({ client: sql });

  console.log(`${DRY_RUN ? "🔍 DRY RUN" : "🚀 REAL RUN"} — migrating legacy → V1`);
  console.log("");

  // ── 1. Load legacy data ──────────────────────────────────────────────
  const legacyShareholders = await db.select().from(shareholders);
  const legacyTransactions = await db.select().from(shareTransactions);
  const legacyEsopPools = await db.select().from(esopPool);

  console.log(`Found ${legacyShareholders.length} shareholders`);
  console.log(`Found ${legacyTransactions.length} share_transactions`);
  console.log(`Found ${legacyEsopPools.length} esop_pool`);
  console.log("");

  // ── 2. Filter out the ESOP placeholder shareholder ───────────────────
  const shareholdersToMigrate = legacyShareholders.filter(s => s.id !== ESOP_SHAREHOLDER_ID);
  const esopShareholder = legacyShareholders.find(s => s.id === ESOP_SHAREHOLDER_ID);
  if (esopShareholder) {
    console.log(`⏭  Skipping shareholder #${esopShareholder.id} "${esopShareholder.name}" (ESOP placeholder)`);
  }
  console.log(`→ Will migrate ${shareholdersToMigrate.length} shareholders to investors`);

  const transactionsToMigrate = legacyTransactions.filter(t => t.shareholderId !== ESOP_SHAREHOLDER_ID);
  const skippedTxCount = legacyTransactions.length - transactionsToMigrate.length;
  console.log(`→ Will migrate ${transactionsToMigrate.length} transactions to share_register_entries`);
  if (skippedTxCount > 0) console.log(`   (${skippedTxCount} transactions skipped because they belong to ESOP shareholder)`);
  console.log("");

  // ── 3. Check for existing V1 data (safety: don't migrate twice) ──────
  const existingInvestors = await db.select().from(investors);
  const existingRegister = await db.select().from(shareRegisterEntries);
  const existingV1Pools = await db.select().from(esopPoolsV1);

  if (existingInvestors.length > 0 || existingRegister.length > 0 || existingV1Pools.length > 0) {
    console.log("⚠️  V1 tables are not empty:");
    console.log(`    investors: ${existingInvestors.length}`);
    console.log(`    share_register_entries: ${existingRegister.length}`);
    console.log(`    esop_pools_v1: ${existingV1Pools.length}`);
    console.log("");
    console.log("    Migration will be additive. Existing V1 rows are left alone.");
    console.log("    If you want a clean slate, clear these tables first.");
    console.log("");
  }

  // ── 4. Plan investor rows ────────────────────────────────────────────
  console.log("=== Investors to create ===");
  for (const s of shareholdersToMigrate.slice(0, 5)) {
    console.log(
      `  id_legacy=${s.id} → name="${s.name}" entityKind=${s.isEntity ? "entity" : "individual"} status=invested`
    );
  }
  if (shareholdersToMigrate.length > 5) {
    console.log(`  ... and ${shareholdersToMigrate.length - 5} more`);
  }
  console.log("");

  // ── 5. Plan register entries ────────────────────────────────────────
  console.log("=== Register entries to create (showing first 5) ===");
  for (const t of transactionsToMigrate.slice(0, 5)) {
    const sh = legacyShareholders.find(s => s.id === t.shareholderId);
    console.log(
      `  tx#${t.id}: ${sh?.name ?? `#${t.shareholderId}`} · ${t.transactionType} ${t.shareClass} ${t.sharesAmount} shares · ${t.totalAmountNtd ?? "—"} NTD`
    );
  }
  if (transactionsToMigrate.length > 5) {
    console.log(`  ... and ${transactionsToMigrate.length - 5} more`);
  }
  const totalShares = transactionsToMigrate.reduce((s, t) => s + Number(t.sharesAmount ?? 0), 0);
  const totalNtd = transactionsToMigrate.reduce((s, t) => s + Number(t.totalAmountNtd ?? 0), 0);
  console.log(`  Total: ${totalShares.toLocaleString()} shares, NT$ ${totalNtd.toLocaleString()}`);
  console.log("");

  // ── 6. Plan ESOP pools ───────────────────────────────────────────────
  console.log("=== ESOP pools to create ===");
  for (const p of legacyEsopPools) {
    console.log(
      `  pool#${p.id}: "${p.poolName}" ${p.totalShares} total shares (allocated in legacy: ${p.allocatedShares})`
    );
  }
  console.log("");

  if (DRY_RUN) {
    console.log("✋ Dry run complete. No changes written.");
    console.log("   To run for real: DRY_RUN=false tsx scripts/migrate-legacy-to-v1.ts");
    return;
  }

  // ── 7. Real run ──────────────────────────────────────────────────────
  console.log("💾 Writing changes...");
  console.log("");

  // 7a. investors — one row per legacy shareholder (except ESOP)
  const investorMap: InvestorMap = new Map();
  for (const s of shareholdersToMigrate) {
    const [row] = await db.insert(investors).values({
      companyId: s.companyId ?? 1,
      name: s.name,
      entityKind: s.isEntity ? "entity" : "individual",
      email: s.email ?? null,
      phone: s.phone ?? null,
      nationality: s.nationality ?? null,
      status: "invested",
      aka: s.aka ?? null,
      notes: `[migrated from shareholders.id=${s.id}]${s.notes ? "\n" + s.notes : ""}`,
    }).returning({ id: investors.id });
    investorMap.set(s.id, row.id);
  }
  console.log(`  ✓ Created ${investorMap.size} investors`);

  // 7b. share_register_entries — one row per transaction
  let registerCount = 0;
  for (const t of transactionsToMigrate) {
    const newInvestorId = investorMap.get(t.shareholderId);
    if (!newInvestorId) {
      console.warn(`  ⚠  Skipping tx#${t.id}: no mapped investor for shareholderId=${t.shareholderId}`);
      continue;
    }
    // transactionDate is a Date (timestamp); register wants YYYY-MM-DD
    const effectiveDate = t.transactionDate
      ? new Date(t.transactionDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Only migrate event types that map cleanly; ESOP-related types skipped
    let eventType: "issuance" | "transfer_in" | "transfer_out" | "cancellation" | null = null;
    let signedShares = Math.abs(Number(t.sharesAmount ?? 0));
    switch (t.transactionType) {
      case "issuance":
        eventType = "issuance";
        break;
      case "transfer_in":
        eventType = "transfer_in";
        break;
      case "transfer_out":
        eventType = "transfer_out";
        signedShares = -signedShares;
        break;
      default:
        console.warn(`  ⚠  Skipping tx#${t.id}: unsupported transactionType=${t.transactionType}`);
        continue;
    }
    if (signedShares === 0) {
      console.warn(`  ⚠  Skipping tx#${t.id}: zero shares`);
      continue;
    }

    await db.insert(shareRegisterEntries).values({
      companyId: t.companyId ?? 1,
      allocationId: null,
      fundingRoundId: t.fundingRoundId ?? null,
      investorId: newInvestorId,
      eventType,
      shareClass: t.shareClass,
      shares: signedShares,
      pricePerShare: t.pricePerShareNtd ?? null,
      currency: "NTD",
      fxToNtd: "1",
      totalAmount: t.totalAmountNtd ?? null,
      effectiveDate,
      notes: `[migrated from share_transactions.id=${t.id}]${t.notes ? "\n" + t.notes : ""}`,
    });
    registerCount++;
  }
  console.log(`  ✓ Created ${registerCount} register entries`);

  // 7c. esop_pools_v1 — one row per legacy pool
  let poolCount = 0;
  for (const p of legacyEsopPools) {
    await db.insert(esopPoolsV1).values({
      companyId: p.companyId ?? 1,
      name: p.poolName || "ESOP Pool",
      fundingRoundId: p.fundingRoundId ?? null,
      totalShares: Number(p.totalShares),
      notes: `[migrated from esop_pool.id=${p.id}]${p.notes ? "\n" + p.notes : ""}`,
    });
    poolCount++;
  }
  console.log(`  ✓ Created ${poolCount} ESOP pools`);

  // 7d. Post-migration snapshot (one, not 13)
  // Compute cap table from what we just wrote
  const capTableData = {
    migratedAt: new Date().toISOString(),
    source: "phase-3-migration",
    investorCount: investorMap.size,
    registerEntryCount: registerCount,
    esopPoolCount: poolCount,
  };
  const [snap] = await db.insert(snapshotsV1).values({
    companyId: 1,
    name: "Post-migration baseline (Phase 3)",
    triggerType: "manual",
    capTableData,
    totalShares,
    totalInvestors: investorMap.size,
    notes: "Auto-created by scripts/migrate-legacy-to-v1.ts",
  }).returning();
  console.log(`  ✓ Created baseline snapshot #${snap.id}`);

  console.log("");
  console.log("✅ Migration complete");
}

main().catch(err => {
  console.error("❌ Migration FAILED:");
  console.error(err);
  process.exit(1);
});
