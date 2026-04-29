/**
 * Migrate company_plan enum: add new values + backfill existing rows.
 *
 * Old enum:  free | paid | custom
 * New enum:  free | paid | custom | starter | standard | plus | enterprise
 * Backfill:  free → starter, paid → standard, custom → enterprise
 *
 * Run: node scripts/migrate-plan-enum.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log("=== Plan Enum Migration ===\n");

  // 1. Check current enum values
  const before = await sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'company_plan')
    ORDER BY enumsortorder`;
  const existing = before.map(e => e.enumlabel);
  console.log("Current enum values:", existing);

  // 2. Add missing new values (ALTER TYPE ADD VALUE can't use parameters)
  const needed = ["starter", "standard", "plus", "enterprise"];
  for (const val of needed) {
    if (!existing.includes(val)) {
      // Must use raw SQL — ADD VALUE doesn't support parameterized queries
      await sql(`ALTER TYPE company_plan ADD VALUE IF NOT EXISTS '${val}'`);
      console.log(`  Added: '${val}'`);
    } else {
      console.log(`  Already exists: '${val}'`);
    }
  }

  // 3. Verify enum values after adding
  const afterEnum = await sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'company_plan')
    ORDER BY enumsortorder`;
  console.log("\nEnum values after migration:", afterEnum.map(e => e.enumlabel));

  // 4. Backfill: free→starter, paid→standard, custom→enterprise
  const mapping = [
    ["free", "starter"],
    ["paid", "standard"],
    ["custom", "enterprise"],
  ];
  for (const [oldVal, newVal] of mapping) {
    const result = await sql`UPDATE companies SET plan = ${newVal} WHERE plan = ${oldVal}`;
    console.log(`  Backfill '${oldVal}' → '${newVal}'`);
  }

  // 5. Verify companies
  const after = await sql`SELECT id, name, plan FROM companies ORDER BY id`;
  console.log("\nCompanies after migration:");
  for (const row of after) {
    console.log(`  #${row.id} ${row.name}: plan=${row.plan}`);
  }

  console.log("\n✅ Done! You can now update plans via Admin Panel.");
}

migrate().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
