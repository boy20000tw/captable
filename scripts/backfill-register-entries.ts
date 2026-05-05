/**
 * Backfill Register Entries for Issued Allocations
 * ──────────────────────────────────────────────────
 * Run: source .env && npx tsx scripts/backfill-register-entries.ts
 *
 * Finds any allocations with status="issued" that don't have a corresponding
 * share_register_entries row (allocationId match), then creates the missing
 * register entries + snapshots.
 *
 * This handles the case where demo allocations were advanced via direct DB
 * status updates rather than through the UI advance flow (which auto-creates
 * register entries).
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required.");
  console.error("   Run: source .env && npx tsx scripts/backfill-register-entries.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🔍 Finding issued allocations without register entries...\n");

  // Find issued allocations that have no matching register entry
  const orphaned = await sql`
    SELECT a.id, a."companyId", a."investorId", a."fundingRoundId",
           a."shareClass", a."sharesAllocated", a."pricePerShare",
           a.currency, a."fxToNtd", a.amount,
           a."issuedAt",
           i.name AS investor_name,
           r.name AS round_name
    FROM allocations a
    JOIN investors i ON i.id = a."investorId"
    LEFT JOIN funding_rounds r ON r.id = a."fundingRoundId"
    WHERE a.status = 'issued'
      AND NOT EXISTS (
        SELECT 1 FROM share_register_entries sre
        WHERE sre."allocationId" = a.id
      )
    ORDER BY a.id
  `;

  if (orphaned.length === 0) {
    console.log("✅ All issued allocations already have register entries. Nothing to do.");
    return;
  }

  console.log(`Found ${orphaned.length} issued allocation(s) without register entries:\n`);
  for (const a of orphaned) {
    console.log(`  id=${a.id} | ${a.investor_name} | ${a.round_name} | NT$${Number(a.amount).toLocaleString()} | ${a.sharesAllocated?.toLocaleString()} shares`);
  }

  console.log("\n━━━ Creating register entries + snapshots ━━━\n");

  for (const a of orphaned) {
    const effectiveDate = a.issuedAt
      ? new Date(a.issuedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // 1. Insert register entry
    const [entry] = await sql`
      INSERT INTO share_register_entries (
        "companyId", "allocationId", "fundingRoundId",
        "investorId", "eventType", "shareClass",
        shares, "pricePerShare", currency, "fxToNtd", "totalAmount",
        "effectiveDate", notes
      ) VALUES (
        ${a.companyId}, ${a.id}, ${a.fundingRoundId},
        ${a.investorId}, 'issuance', ${a.shareClass},
        ${a.sharesAllocated}, ${a.pricePerShare}, ${a.currency}, ${a.fxToNtd}, ${a.amount},
        ${effectiveDate},
        ${"Auto-backfilled from issued allocation #" + a.id}
      )
      RETURNING id
    `;

    // 2. Build a snapshot of current cap table state for this company
    const holdings = await sql`
      SELECT "investorId", "shareClass",
             SUM(shares) AS total_shares
      FROM share_register_entries
      WHERE "companyId" = ${a.companyId}
      GROUP BY "investorId", "shareClass"
      HAVING SUM(shares) > 0
    `;

    const snapshotData = holdings.map((h: any) => ({
      investorId: h.investorId,
      shareClass: h.shareClass,
      shares: Number(h.total_shares),
    }));

    const totalSharesAll = snapshotData.reduce((s, h) => s + h.shares, 0);
    const totalInvestorsAll = new Set(snapshotData.map((h) => h.investorId)).size;

    const [snap] = await sql`
      INSERT INTO snapshots (
        "companyId", name, "triggerType", "registerEntryId",
        "capTableData", "totalShares", "totalInvestors"
      ) VALUES (
        ${a.companyId},
        ${"Backfill — " + a.investor_name + " issuance"},
        'register_write',
        ${entry.id},
        ${JSON.stringify(snapshotData)},
        ${totalSharesAll},
        ${totalInvestorsAll}
      )
      RETURNING id
    `;

    console.log(`  ✅ ${a.investor_name}: register entry #${entry.id} + snapshot #${snap.id} (${effectiveDate})`);
  }

  // Summary
  console.log("\n━━━ Verification ━━━");
  const totalEntries = await sql`
    SELECT count(*) as cnt FROM share_register_entries
    WHERE "companyId" = ${orphaned[0].companyId}
  `;
  const totalSnapshots = await sql`
    SELECT count(*) as cnt FROM snapshots
    WHERE "companyId" = ${orphaned[0].companyId}
  `;
  console.log(`  Register entries: ${totalEntries[0].cnt}`);
  console.log(`  Snapshots: ${totalSnapshots[0].cnt}`);
  console.log("\n🎉 Done! Refresh the browser to see register entries.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
