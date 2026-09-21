/**
 * Quick fix: rename Chinese demo data to English
 * Run: DATABASE_URL=... npx tsx scripts/fix-analysis-names.ts
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("❌ DATABASE_URL required"); process.exit(1); }
const sql = postgres(DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function main() {
  // Projection name
  const r1 = await sql`UPDATE financial_projections SET name = 'Biotech SaaS 5-Year Projection' WHERE name = 'Biotech SaaS 五年財務預測' RETURNING id`;
  console.log(`Projections renamed: ${r1.length}`);

  // Scenario names
  const updates = [
    ["Base Case — 穩健成長", "Base Case — Steady Growth", "Base scenario: Year1 NT$30M revenue, growth 150→40%, gross margin 72%. Reflects steady customer expansion with reasonable CAC."],
    ["Optimistic — 高速擴張", "Optimistic — Rapid Expansion", "Optimistic scenario: Year1 NT$35M revenue, growth 200→60%, gross margin 78%. Assumes early product-market fit and rapid enterprise adoption."],
    ["Conservative — 保守估計", "Conservative — Slow Start", "Conservative scenario: Year1 NT$20M revenue, growth 100→20%, gross margin 65%. Assumes slower market penetration and higher competitive pressure."],
  ];
  for (const [oldName, newName, desc] of updates) {
    const r = await sql`UPDATE projection_scenarios SET name = ${newName}, description = ${desc} WHERE name = ${oldName} RETURNING id`;
    console.log(`Scenario "${oldName}" → "${newName}": ${r.length} updated`);
  }

  // Comps group name
  const r2 = await sql`UPDATE comps_peers SET "groupName" = 'Taiwan Biotech' WHERE "groupName" = '台灣生技' RETURNING id`;
  console.log(`Comps group renamed: ${r2.length}`);

  console.log("\n✅ Done!");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
