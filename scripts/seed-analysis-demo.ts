/**
 * Analysis Demo Data Seed Script
 * ───────────────────────────────
 * Run: DATABASE_URL=... npx tsx scripts/seed-analysis-demo.ts
 *
 * Seeds demo data for the 5 Analysis pages:
 *   1. Financial Projections (Biotech SaaS assumptions)
 *   2. Projection Scenarios (Base / Optimistic / Conservative)
 *   3. Comps Peers (5 Taiwan-listed biotech companies)
 *   4. Liquidation Preferences (per funding round)
 *   5. Anti-Dilution Provisions (BBWA + Full Ratchet)
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required. Run with: DATABASE_URL=... npx tsx scripts/seed-analysis-demo.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── Projection Assumptions ─────────────────────────────────────────────────
// Biotech SaaS — Year1 NT$30M, 72% GM, growth ramp 150%→40%
const baseAssumptions = {
  revenueYear1: 30_000_000,
  revenueGrowth: [1.5, 1.0, 0.7, 0.4],   // Y2 +150%, Y3 +100%, Y4 +70%, Y5 +40%
  grossMargin: 0.72,
  salesMarketing: 0.28,
  rnd: 0.30,
  gAndA: 0.12,
  depreciation: 0.02,
  capex: 0.04,
  workingCapital: 0.08,
  taxRate: 0.20,
};

const optimisticAssumptions = {
  ...baseAssumptions,
  revenueYear1: 35_000_000,
  revenueGrowth: [2.0, 1.5, 1.0, 0.6],
  grossMargin: 0.78,
  salesMarketing: 0.25,
  rnd: 0.28,
};

const conservativeAssumptions = {
  ...baseAssumptions,
  revenueYear1: 20_000_000,
  revenueGrowth: [1.0, 0.6, 0.4, 0.2],
  grossMargin: 0.65,
  salesMarketing: 0.32,
  rnd: 0.35,
};

// ─── Comps Peers — 5 Taiwan Biotech Companies (public financials) ───────────
const compsPeerData = [
  {
    name: "合一生技",
    ticker: "4743.TW",
    groupName: "台灣生技",
    revenue: 2_800_000_000,     // NT$28億
    ebitda: 1_200_000_000,      // NT$12億
    netIncome: 980_000_000,     // NT$9.8億
    marketCap: 45_000_000_000,  // NT$450億
    netDebt: -3_500_000_000,    // 淨現金 NT$35億
    sharesOutstanding: 350_000_000,
  },
  {
    name: "藥華藥",
    ticker: "6446.TW",
    groupName: "台灣生技",
    revenue: 5_200_000_000,     // NT$52億
    ebitda: 1_800_000_000,      // NT$18億
    netIncome: 1_500_000_000,   // NT$15億
    marketCap: 85_000_000_000,  // NT$850億
    netDebt: -8_000_000_000,    // 淨現金 NT$80億
    sharesOutstanding: 280_000_000,
  },
  {
    name: "智擎生技",
    ticker: "4162.TW",
    groupName: "台灣生技",
    revenue: 1_500_000_000,     // NT$15億
    ebitda: 450_000_000,        // NT$4.5億
    netIncome: 350_000_000,     // NT$3.5億
    marketCap: 18_000_000_000,  // NT$180億
    netDebt: -1_200_000_000,    // 淨現金 NT$12億
    sharesOutstanding: 180_000_000,
  },
  {
    name: "保瑞藥業",
    ticker: "6472.TW",
    groupName: "台灣生技",
    revenue: 12_000_000_000,    // NT$120億
    ebitda: 2_400_000_000,      // NT$24億
    netIncome: 1_800_000_000,   // NT$18億
    marketCap: 55_000_000_000,  // NT$550億
    netDebt: 5_000_000_000,     // 淨負債 NT$50億 (收購融資)
    sharesOutstanding: 150_000_000,
  },
  {
    name: "晟德大藥廠",
    ticker: "4123.TW",
    groupName: "台灣生技",
    revenue: 3_800_000_000,     // NT$38億
    ebitda: 600_000_000,        // NT$6億
    netIncome: 400_000_000,     // NT$4億
    marketCap: 22_000_000_000,  // NT$220億
    netDebt: 2_000_000_000,     // 淨負債 NT$20億
    sharesOutstanding: 420_000_000,
  },
];

// ─── Liquidation Preferences per round ──────────────────────────────────────
// Maps round name pattern → preference config
const liquidationPrefsConfig = [
  {
    roundMatch: "Pre-Seed",
    preferenceType: "non_participating",
    liquidationMultiple: "1.00",
    participationCap: null,
    seniorityRank: 1,
    notes: "Pre-Seed: 1x Non-Participating preferred. Standard early-stage terms.",
  },
  {
    roundMatch: "Seed",
    preferenceType: "non_participating",
    liquidationMultiple: "1.00",
    participationCap: null,
    seniorityRank: 2,
    notes: "Seed: 1x Non-Participating preferred. Pari passu with Pre-Seed on conversion.",
  },
  {
    roundMatch: "Series A",
    preferenceType: "participating",
    liquidationMultiple: "1.00",
    participationCap: "3.00",
    seniorityRank: 3,
    notes: "Series A: 1x Participating preferred with 3x cap. Senior to Seed/Pre-Seed.",
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Querying existing data...\n");

  // Get company ID from investors table (same pattern as seed-demo.ts)
  const existingInvestors = await sql`
    SELECT id, name, "entityKind", "companyId"
    FROM investors ORDER BY id
  `;
  if (existingInvestors.length === 0) {
    console.error("❌ No investors found. Run seed-demo.ts first.");
    process.exit(1);
  }
  const companyId = existingInvestors[0].companyId;
  console.log(`Using companyId = ${companyId}`);

  // Get funding rounds
  const rounds = await sql`
    SELECT id, name FROM funding_rounds
    WHERE "companyId" = ${companyId}
    ORDER BY id
  `;
  console.log(`Found ${rounds.length} funding rounds: ${rounds.map((r: any) => r.name).join(", ")}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Financial Projections
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Step 1: Financial Projections ━━━");

  const existingProjections = await sql`
    SELECT id, name FROM financial_projections
    WHERE "companyId" = ${companyId}
  `;

  let projectionId: number;
  if (existingProjections.length > 0) {
    projectionId = existingProjections[0].id;
    console.log(`  ℹ️ Projection already exists: "${existingProjections[0].name}" (id=${projectionId}), skipping`);
  } else {
    const [proj] = await sql`
      INSERT INTO financial_projections ("companyId", name, "startYear", years, assumptions)
      VALUES (
        ${companyId},
        'Biotech SaaS 五年財務預測',
        2025,
        5,
        ${JSON.stringify(baseAssumptions)}
      )
      RETURNING id
    `;
    projectionId = proj.id;
    console.log(`  ✅ Created projection: "Biotech SaaS 五年財務預測" (id=${projectionId})`);
    console.log(`     Year1 NT$30M / GM 72% / Growth 150→40%`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Projection Scenarios (Base / Optimistic / Conservative)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 2: Projection Scenarios ━━━");

  const scenarios = [
    {
      name: "Base Case — 穩健成長",
      description: "基礎情境：Year1 NT$30M 營收，逐年成長 150→40%，毛利率 72%。反映穩定客戶擴展與合理獲客成本。",
      assumptions: baseAssumptions,
      isBaseline: true,
    },
    {
      name: "Optimistic — 高速擴張",
      description: "樂觀情境：Year1 NT$35M 營收，成長 200→60%，毛利率 78%。假設產品-市場契合提早達成、企業客戶快速採用。",
      assumptions: optimisticAssumptions,
      isBaseline: false,
    },
    {
      name: "Conservative — 保守估計",
      description: "保守情境：Year1 NT$20M 營收，成長 100→20%，毛利率 65%。假設市場進入速度較慢、競爭壓力較大。",
      assumptions: conservativeAssumptions,
      isBaseline: false,
    },
  ];

  for (const s of scenarios) {
    const existing = await sql`
      SELECT id FROM projection_scenarios
      WHERE "projectionId" = ${projectionId} AND name = ${s.name}
    `;
    if (existing.length > 0) {
      console.log(`  ℹ️ Scenario "${s.name}" already exists, skipping`);
      continue;
    }

    const [created] = await sql`
      INSERT INTO projection_scenarios (
        "projectionId", "companyId", name, description,
        assumptions, "isBaseline"
      ) VALUES (
        ${projectionId}, ${companyId}, ${s.name}, ${s.description},
        ${JSON.stringify(s.assumptions)}, ${s.isBaseline}
      )
      RETURNING id
    `;
    console.log(`  ✅ Created scenario: "${s.name}" (id=${created.id})${s.isBaseline ? " [baseline]" : ""}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Comps Peers — 5 Taiwan Biotech Companies
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 3: Comps Peers ━━━");

  for (const peer of compsPeerData) {
    const existing = await sql`
      SELECT id FROM comps_peers
      WHERE "companyId" = ${companyId} AND ticker = ${peer.ticker}
    `;
    if (existing.length > 0) {
      console.log(`  ℹ️ ${peer.name} (${peer.ticker}) already exists, skipping`);
      continue;
    }

    const [created] = await sql`
      INSERT INTO comps_peers (
        "companyId", "groupName", name, ticker,
        revenue, ebitda, "netIncome", "marketCap", "netDebt",
        "sharesOutstanding"
      ) VALUES (
        ${companyId}, ${peer.groupName}, ${peer.name}, ${peer.ticker},
        ${peer.revenue.toString()}, ${peer.ebitda.toString()},
        ${peer.netIncome.toString()}, ${peer.marketCap.toString()},
        ${peer.netDebt.toString()}, ${peer.sharesOutstanding.toString()}
      )
      RETURNING id
    `;
    console.log(`  ✅ ${peer.name} (${peer.ticker}) — 市值 NT$${(peer.marketCap / 1e8).toFixed(0)}億 (id=${created.id})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Liquidation Preferences
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 4: Liquidation Preferences ━━━");

  if (rounds.length === 0) {
    console.log("  ⚠️ No funding rounds found, skipping liquidation preferences");
  } else {
    for (const config of liquidationPrefsConfig) {
      // Find matching round by name pattern
      const matchingRound = rounds.find((r: any) =>
        r.name.includes(config.roundMatch)
      );

      if (!matchingRound) {
        console.log(`  ⚠️ No round matching "${config.roundMatch}" found, skipping`);
        continue;
      }

      // Check if already exists (fundingRoundId is unique)
      const existing = await sql`
        SELECT id FROM liquidation_preferences
        WHERE "fundingRoundId" = ${matchingRound.id}
      `;
      if (existing.length > 0) {
        console.log(`  ℹ️ Liquidation pref for "${matchingRound.name}" already exists, skipping`);
        continue;
      }

      const [created] = await sql`
        INSERT INTO liquidation_preferences (
          "companyId", "fundingRoundId", "preferenceType",
          "liquidationMultiple", "participationCap", "seniorityRank", notes
        ) VALUES (
          ${companyId}, ${matchingRound.id}, ${config.preferenceType},
          ${config.liquidationMultiple}, ${config.participationCap},
          ${config.seniorityRank}, ${config.notes}
        )
        RETURNING id
      `;
      console.log(`  ✅ ${matchingRound.name}: ${config.liquidationMultiple}x ${config.preferenceType}${config.participationCap ? ` (cap ${config.participationCap}x)` : ""} (id=${created.id})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Anti-Dilution Provisions
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 5: Anti-Dilution Provisions ━━━");

  // Find Series A round
  const seriesARound = rounds.find((r: any) => r.name.includes("Series A"));
  if (!seriesARound) {
    console.log("  ⚠️ No Series A round found, skipping anti-dilution provisions");
  } else {
    // Pick 2 investors for anti-dilution provisions
    // Use entity investor (法人) for BBWA, individual for Full Ratchet
    const entityInvestor = existingInvestors.find((i: any) => i.entityKind === "entity");
    const individualInvestor = existingInvestors.find((i: any) => i.entityKind === "individual");

    const antiDilutionConfigs = [
      {
        investorId: entityInvestor?.id || existingInvestors[0].id,
        investorName: entityInvestor?.name || existingInvestors[0].name,
        provisionType: "broad_based_wa",
        originalPriceNtd: "50.000000",  // Series A price
        originalShares: 1_000_000,
        notes: "Broad-based weighted average anti-dilution. Standard Series A protection for institutional investor.",
      },
      {
        investorId: individualInvestor?.id || existingInvestors[1]?.id || existingInvestors[0].id,
        investorName: individualInvestor?.name || existingInvestors[1]?.name || existingInvestors[0].name,
        provisionType: "full_ratchet",
        originalPriceNtd: "50.000000",  // Series A price
        originalShares: 500_000,
        notes: "Full ratchet anti-dilution. Negotiated by lead Series A investor as downside protection.",
      },
    ];

    for (const config of antiDilutionConfigs) {
      // Check existence by shareholderId + fundingRoundId
      const existing = await sql`
        SELECT id FROM anti_dilution_provisions
        WHERE "shareholderId" = ${config.investorId}
          AND "fundingRoundId" = ${seriesARound.id}
      `;
      if (existing.length > 0) {
        console.log(`  ℹ️ Anti-dilution for ${config.investorName} already exists, skipping`);
        continue;
      }

      const [created] = await sql`
        INSERT INTO anti_dilution_provisions (
          "companyId", "shareholderId", "fundingRoundId",
          "provisionType", "originalPriceNtd", "originalShares",
          status, notes
        ) VALUES (
          ${companyId}, ${config.investorId}, ${seriesARound.id},
          ${config.provisionType}, ${config.originalPriceNtd},
          ${config.originalShares}, 'active', ${config.notes}
        )
        RETURNING id
      `;
      console.log(`  ✅ ${config.investorName}: ${config.provisionType} — ${config.originalShares.toLocaleString()} shares @ NT$50 (id=${created.id})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Verification ━━━");
  const finalProjections = await sql`SELECT count(*) as cnt FROM financial_projections WHERE "companyId" = ${companyId}`;
  const finalScenarios = await sql`SELECT count(*) as cnt FROM projection_scenarios WHERE "companyId" = ${companyId}`;
  const finalComps = await sql`SELECT count(*) as cnt FROM comps_peers WHERE "companyId" = ${companyId}`;
  const finalLiqPrefs = await sql`SELECT count(*) as cnt FROM liquidation_preferences WHERE "companyId" = ${companyId}`;
  const finalAntiDil = await sql`SELECT count(*) as cnt FROM anti_dilution_provisions WHERE "companyId" = ${companyId}`;

  console.log(`  Financial Projections: ${finalProjections[0].cnt}`);
  console.log(`  Projection Scenarios: ${finalScenarios[0].cnt}`);
  console.log(`  Comps Peers: ${finalComps[0].cnt}`);
  console.log(`  Liquidation Preferences: ${finalLiqPrefs[0].cnt}`);
  console.log(`  Anti-Dilution Provisions: ${finalAntiDil[0].cnt}`);
  console.log("\n🎉 Analysis demo data seeding complete!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
