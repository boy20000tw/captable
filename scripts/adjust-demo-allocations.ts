/**
 * Adjust Demo Allocation Amounts
 * ───────────────────────────────
 * Run: DATABASE_URL=... npx tsx scripts/adjust-demo-allocations.ts
 *   or: source .env && npx tsx scripts/adjust-demo-allocations.ts
 *
 * Updates the A Round allocations so that:
 *   - Total allocated = NT$60M (instead of ~NT$93M)
 *   - NT$40M remains unallocated (no interested buyers)
 *   - 8 investors with realistic, varied amounts
 *
 * New distribution (NT$60M total):
 *   TaiwanGrowth Ventures  — NT$15,000,000  (lead investor, was 30M)
 *   HealthTech Capital Asia — NT$10,000,000  (was 15M)
 *   BioMedex Partners       — NT$10,000,000  (was 15M)
 *   AsiaCare Fund I         — NT$8,000,000   (was 15M)
 *   王董家族辦公室           — NT$6,000,000   (was 8M)
 *   林總 (個人天使)          — NT$5,000,000   (was 5M)
 *   陳醫師 (個人天使)        — NT$4,000,000   (was 3M)
 *   Pacific Innovation Fund — NT$2,000,000   (unchanged)
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required.");
  console.error("   Run: source .env && npx tsx scripts/adjust-demo-allocations.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// investor name → new amount (NTD)
// Total: 15 + 10 + 10 + 8 + 6 + 5 + 4 + 2 = NT$60M
const newAmounts: Record<string, number> = {
  "TaiwanGrowth Ventures":  15_000_000,
  "HealthTech Capital Asia": 10_000_000,
  "BioMedex Partners":      10_000_000,
  "AsiaCare Fund I":         8_000_000,
  "王董家族辦公室":            6_000_000,
  "林總 (個人天使)":           5_000_000,
  "陳醫師 (個人天使)":         4_000_000,
  "Pacific Innovation Fund":  2_000_000,
};

async function main() {
  console.log("🔍 Fetching A Round allocations...\n");

  const allocations = await sql`
    SELECT a.id, a.amount, a."sharesAllocated", a."pricePerShare",
           i.name AS investor_name,
           r.name AS round_name
    FROM allocations a
    JOIN investors i ON i.id = a."investorId"
    JOIN funding_rounds r ON r.id = a."fundingRoundId"
    ORDER BY CAST(a.amount AS numeric) DESC
  `;

  if (allocations.length === 0) {
    console.error("❌ No allocations found.");
    process.exit(1);
  }

  console.log(`Found ${allocations.length} allocations:\n`);
  let oldTotal = 0;
  for (const a of allocations) {
    const amt = Number(a.amount);
    oldTotal += amt;
    console.log(`  id=${a.id} | ${a.investor_name} | ${a.round_name} | NT$${amt.toLocaleString()}`);
  }
  console.log(`\n  Old total: NT$${oldTotal.toLocaleString()}\n`);

  console.log("━━━ Updating amounts ━━━");
  let newTotal = 0;
  let updated = 0;

  for (const a of allocations) {
    const name: string = a.investor_name;
    const newAmount = newAmounts[name];

    if (newAmount === undefined) {
      console.log(`  ⚠️ ${name} — no mapping, skipped`);
      continue;
    }

    // Recalculate shares: amount / pricePerShare
    const pricePerShare = a.pricePerShare ? Number(a.pricePerShare) : null;
    const newShares = pricePerShare && pricePerShare > 0
      ? Math.floor(newAmount / pricePerShare)
      : a.sharesAllocated;

    await sql`
      UPDATE allocations
      SET amount = ${newAmount.toFixed(2)},
          "sharesAllocated" = ${newShares},
          "updatedAt" = NOW()
      WHERE id = ${a.id}
    `;

    const oldAmt = Number(a.amount);
    console.log(`  ✅ ${name}: NT$${oldAmt.toLocaleString()} → NT$${newAmount.toLocaleString()} (${newShares?.toLocaleString()} shares)`);
    newTotal += newAmount;
    updated++;
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Updated: ${updated}/${allocations.length} allocations`);
  console.log(`  Old total: NT$${oldTotal.toLocaleString()}`);
  console.log(`  New total: NT$${newTotal.toLocaleString()}`);
  console.log(`  Unallocated: NT$${(100_000_000 - newTotal).toLocaleString()}`);
  console.log("\n🎉 Done! Refresh the browser to see updated amounts.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
