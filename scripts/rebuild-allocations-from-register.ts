/**
 * Rebuild Allocations from Share Register
 * ────────────────────────────────────────
 * Run: source .env && npx tsx scripts/rebuild-allocations-from-register.ts
 *
 * Reads all issuance entries from share_register_entries and creates
 * the corresponding allocations for each (investorId, fundingRoundId)
 * pair. Skips any pair that already has an allocation.
 *
 * This ensures the Funding Round detail pages correctly show each
 * investor's allocation with the right shares and amounts, matching
 * exactly what the Share Register already records.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required.");
  console.error("   Run: source .env && npx tsx scripts/rebuild-allocations-from-register.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🔍 Reading Share Register entries...\n");

  // 1. Get all issuance register entries that have a fundingRoundId
  const entries = await sql`
    SELECT
      sre.id,
      sre."companyId",
      sre."investorId",
      sre."fundingRoundId",
      sre."shareClass",
      sre.shares,
      sre."pricePerShare",
      sre.currency,
      sre."fxToNtd",
      sre."totalAmount",
      sre."effectiveDate",
      i.name as "investorName"
    FROM share_register_entries sre
    LEFT JOIN investors i ON i.id = sre."investorId"
    WHERE sre."eventType" = 'issuance'
      AND sre."fundingRoundId" IS NOT NULL
    ORDER BY sre."fundingRoundId", sre."investorId"
  `;

  if (entries.length === 0) {
    console.log("❌ No issuance register entries with fundingRoundId found.");
    return;
  }

  console.log(`Found ${entries.length} issuance register entry(ies)\n`);

  // 2. Get funding round info for display
  const rounds = await sql`
    SELECT id, name, status, "roundDate"
    FROM funding_rounds
    ORDER BY id
  `;
  const roundMap = new Map<number, any>();
  for (const r of rounds) roundMap.set(r.id, r);

  // 3. Get existing allocations to avoid duplicates
  const existingAllocs = await sql`
    SELECT "fundingRoundId", "investorId"
    FROM allocations
  `;
  const existingSet = new Set<string>();
  for (const a of existingAllocs) {
    existingSet.add(`${a.fundingRoundId}-${a.investorId}`);
  }
  console.log(`Existing allocations: ${existingAllocs.length} (will skip duplicates)\n`);

  // 4. Group register entries by (fundingRoundId, investorId)
  //    In case there are multiple issuance entries for the same pair,
  //    sum the shares and amounts.
  const grouped = new Map<string, {
    companyId: number;
    investorId: number;
    fundingRoundId: number;
    shareClass: string;
    shares: number;
    pricePerShare: string | null;
    currency: string;
    fxToNtd: string;
    totalAmount: number;
    effectiveDate: string;
    investorName: string;
  }>();

  for (const e of entries) {
    const key = `${e.fundingRoundId}-${e.investorId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.shares += Number(e.shares);
      existing.totalAmount += Number(e.totalAmount ?? 0);
    } else {
      grouped.set(key, {
        companyId: e.companyId,
        investorId: e.investorId,
        fundingRoundId: e.fundingRoundId,
        shareClass: e.shareClass,
        shares: Number(e.shares),
        pricePerShare: e.pricePerShare,
        currency: e.currency ?? "NTD",
        fxToNtd: e.fxToNtd ?? "1",
        totalAmount: Number(e.totalAmount ?? 0),
        effectiveDate: e.effectiveDate,
        investorName: e.investorName ?? `Investor #${e.investorId}`,
      });
    }
  }

  console.log(`Grouped into ${grouped.size} unique (round, investor) pair(s)\n`);

  // 5. Create allocations
  let created = 0;
  let skipped = 0;

  for (const [key, data] of grouped) {
    // Skip if allocation already exists
    if (existingSet.has(key)) {
      const round = roundMap.get(data.fundingRoundId);
      console.log(`  ⏭️  ${round?.name ?? `Round #${data.fundingRoundId}`} / ${data.investorName} — already exists`);
      skipped++;
      continue;
    }

    const round = roundMap.get(data.fundingRoundId);
    const roundName = round?.name ?? `Round #${data.fundingRoundId}`;

    // Calculate amount: if totalAmount is 0 but we have shares + pricePerShare, compute it
    let amount = data.totalAmount;
    if (amount === 0 && data.pricePerShare) {
      amount = data.shares * Number(data.pricePerShare);
    }

    // Use effectiveDate for all timestamps (this was an issued allocation)
    const issuedDate = data.effectiveDate;

    await sql`
      INSERT INTO allocations (
        "companyId", "fundingRoundId", "investorId", "shareClass",
        amount, currency, "fxToNtd", "sharesAllocated", "pricePerShare",
        status,
        "plannedAt", "committedAt", "signedAt", "fundedAt", "issuedAt",
        notes,
        "createdAt", "updatedAt"
      ) VALUES (
        ${data.companyId}, ${data.fundingRoundId}, ${data.investorId}, ${data.shareClass},
        ${String(amount)}, ${data.currency}, ${data.fxToNtd}, ${data.shares}, ${data.pricePerShare},
        'issued',
        ${issuedDate}::date, ${issuedDate}::date, ${issuedDate}::date, ${issuedDate}::date, ${issuedDate}::date,
        ${`Rebuilt from Share Register for ${roundName}`},
        NOW(), NOW()
      )
    `;

    console.log(`  ✅ ${roundName} / ${data.investorName} — ${data.shares.toLocaleString()} shares, NT$${amount.toLocaleString()}`);
    created++;
  }

  // 6. Summary
  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Created: ${created} allocation(s)`);
  console.log(`  Skipped: ${skipped} (already existed)`);

  // Show per-round breakdown
  console.log(`\n━━━ Per-Round Breakdown ━━━`);
  const finalAllocs = await sql`
    SELECT a."fundingRoundId", COUNT(*) as cnt,
           SUM(a."sharesAllocated")::bigint as "totalShares",
           SUM(a.amount::numeric)::numeric as "totalAmount"
    FROM allocations a
    GROUP BY a."fundingRoundId"
    ORDER BY a."fundingRoundId"
  `;
  for (const row of finalAllocs) {
    const round = roundMap.get(row.fundingRoundId);
    console.log(`  ${round?.name ?? `Round #${row.fundingRoundId}`}: ${row.cnt} alloc(s), ${Number(row.totalShares).toLocaleString()} shares, NT$${Number(row.totalAmount).toLocaleString()}`);
  }

  console.log("\n🎉 Done! Refresh browser to see the allocations in Funding Round pages.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
