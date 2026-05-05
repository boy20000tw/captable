/**
 * Cleanup Auto-Seeded Allocations & Register Entries
 * ───────────────────────────────────────────────────
 * Run: source .env && npx tsx scripts/cleanup-auto-seeded.ts
 *
 * Removes allocations created by the auto-seed function (identified by
 * notes starting with "Auto-seeded for") and their corresponding
 * register entries (notes starting with "Auto-synced from").
 *
 * Also removes snapshots tied to those register entries.
 *
 * This is safe to re-run — it only deletes rows matching the auto-seed
 * note patterns.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required.");
  console.error("   Run: source .env && npx tsx scripts/cleanup-auto-seeded.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🔍 Finding auto-seeded data...\n");

  // 1. Find auto-seeded allocations
  const autoAllocations = await sql`
    SELECT id, "fundingRoundId", "investorId", "shareClass", notes
    FROM allocations
    WHERE notes LIKE 'Auto-seeded for %'
    ORDER BY id
  `;
  console.log(`Found ${autoAllocations.length} auto-seeded allocation(s)`);
  for (const a of autoAllocations) {
    console.log(`  id=${a.id} | round=${a.fundingRoundId} | investor=${a.investorId} | ${a.shareClass} | ${a.notes}`);
  }

  // 2. Find auto-synced register entries
  const autoRegister = await sql`
    SELECT id, "investorId", "shareClass", shares, notes
    FROM share_register_entries
    WHERE notes LIKE 'Auto-synced from issued allocation%'
    ORDER BY id
  `;
  console.log(`\nFound ${autoRegister.length} auto-synced register entry(ies)`);
  for (const r of autoRegister) {
    console.log(`  id=${r.id} | investor=${r.investorId} | ${r.shareClass} | ${r.shares} shares | ${r.notes}`);
  }

  // 3. Find snapshots tied to auto-synced register entries
  const regIds = autoRegister.map((r: any) => r.id);
  let autoSnapshots: any[] = [];
  if (regIds.length > 0) {
    autoSnapshots = await sql`
      SELECT id, name, "registerEntryId"
      FROM snapshots
      WHERE "registerEntryId" = ANY(${regIds})
      ORDER BY id
    `;
    console.log(`\nFound ${autoSnapshots.length} snapshot(s) tied to auto-synced register entries`);
  }

  if (autoAllocations.length === 0 && autoRegister.length === 0) {
    console.log("\n✅ Nothing to clean up — no auto-seeded data found.");
    return;
  }

  // 4. Delete in order: snapshots → register entries → allocations
  console.log("\n━━━ Deleting... ━━━");

  if (autoSnapshots.length > 0) {
    const snapIds = autoSnapshots.map((s: any) => s.id);
    await sql`DELETE FROM snapshots WHERE id = ANY(${snapIds})`;
    console.log(`  🗑️  Deleted ${autoSnapshots.length} snapshot(s)`);
  }

  if (autoRegister.length > 0) {
    await sql`
      DELETE FROM share_register_entries
      WHERE notes LIKE 'Auto-synced from issued allocation%'
    `;
    console.log(`  🗑️  Deleted ${autoRegister.length} register entry(ies)`);
  }

  if (autoAllocations.length > 0) {
    await sql`
      DELETE FROM allocations
      WHERE notes LIKE 'Auto-seeded for %'
    `;
    console.log(`  🗑️  Deleted ${autoAllocations.length} allocation(s)`);
  }

  console.log("\n✅ Cleanup complete! Refresh browser to see the changes.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
