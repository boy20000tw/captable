/**
 * Analysis Demo Data Seed Script
 * ───────────────────────────────
 * Run: DATABASE_URL=... npx tsx scripts/seed-analysis-demo.ts
 *
 * Seeds demo data for Analysis pages + Compliance:
 *   1. Financial Projections (Biotech SaaS assumptions)
 *   2. Projection Scenarios (Base / Optimistic / Conservative)
 *   3. Comps Peers (5 Taiwan-listed biotech companies)
 *   4. Liquidation Preferences (per funding round)
 *   5. Anti-Dilution Provisions (BBWA + Full Ratchet)
 *   6. Angel Tax Deductions (產創條例 §23-2, 13 records)
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
    groupName: "Taiwan Biotech",
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
    groupName: "Taiwan Biotech",
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
    groupName: "Taiwan Biotech",
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
    groupName: "Taiwan Biotech",
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
    groupName: "Taiwan Biotech",
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
        'Biotech SaaS 5-Year Projection',
        2025,
        5,
        ${JSON.stringify(baseAssumptions)}
      )
      RETURNING id
    `;
    projectionId = proj.id;
    console.log(`  ✅ Created projection: "Biotech SaaS 5-Year Projection" (id=${projectionId})`);
    console.log(`     Year1 NT$30M / GM 72% / Growth 150→40%`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Projection Scenarios (Base / Optimistic / Conservative)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 2: Projection Scenarios ━━━");

  const scenarios = [
    {
      name: "Base Case — Steady Growth",
      description: "Base scenario: Year1 NT$30M revenue, growth 150→40%, gross margin 72%. Reflects steady customer expansion with reasonable CAC.",
      assumptions: baseAssumptions,
      isBaseline: true,
    },
    {
      name: "Optimistic — Rapid Expansion",
      description: "Optimistic scenario: Year1 NT$35M revenue, growth 200→60%, gross margin 78%. Assumes early product-market fit and rapid enterprise adoption.",
      assumptions: optimisticAssumptions,
      isBaseline: false,
    },
    {
      name: "Conservative — Slow Start",
      description: "Conservative scenario: Year1 NT$20M revenue, growth 100→20%, gross margin 65%. Assumes slower market penetration and higher competitive pressure.",
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
  // STEP 6: Angel Tax Deductions (產創條例 §23-2)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 6: Angel Tax Deductions ━━━");

  // 13 records from shareholder register:
  // 8 eligible individuals, 5 not eligible (founders / entities / foreign)
  const angelTaxRecords = [
    // ── Eligible investors ──
    {
      investorName: "Tsai XX",
      roundName: "Seed",
      investmentDate: "2023-11-10",
      investmentAmountNtd: "4500000.00",
      sharesAcquired: 450000,
      pricePerShareNtd: "10.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 2,
      lockupEndDate: "2025-11-10",
      taxFilingYear: 2026,
      maxDeductionNtd: "2250000.00",
      status: "eligible",
      notes: "Pre-2025 investment, 2-year lock-up. Eligible to file in 2026 tax season.",
    },
    {
      investorName: "Liu XX",
      roundName: "Seed+",
      investmentDate: "2024-01-30",
      investmentAmountNtd: "4480000.00",
      sharesAcquired: 448000,
      pricePerShareNtd: "10.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 2,
      lockupEndDate: "2026-01-30",
      taxFilingYear: 2027,
      maxDeductionNtd: "2240000.00",
      status: "pending",
      notes: "Pre-2025 investment, 2-year lock-up. Lock-up ends Jan 2026.",
    },
    {
      investorName: "Shen XX",
      roundName: "Pre-A",
      investmentDate: "2024-09-02",
      investmentAmountNtd: "4910000.00",
      sharesAcquired: 245500,
      pricePerShareNtd: "20.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 2,
      lockupEndDate: "2026-09-02",
      taxFilingYear: 2027,
      maxDeductionNtd: "2455000.00",
      status: "pending",
      notes: "Pre-2025 investment, 2-year lock-up. Lock-up ends Sep 2026.",
    },
    {
      investorName: "Wang XX",
      roundName: "Pre-A",
      investmentDate: "2025-01-03",
      investmentAmountNtd: "8190000.00",
      sharesAcquired: 409500,
      pricePerShareNtd: "20.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 3,
      lockupEndDate: "2028-01-03",
      taxFilingYear: 2029,
      maxDeductionNtd: "4095000.00",
      status: "pending",
      notes: "Post-2025 investment, 3-year lock-up.",
    },
    {
      investorName: "Dai XX (1)",
      roundName: "Pre-A",
      investmentDate: "2025-03-15",
      investmentAmountNtd: "9830000.00",
      sharesAcquired: 491500,
      pricePerShareNtd: "20.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 3,
      lockupEndDate: "2028-03-15",
      taxFilingYear: 2029,
      maxDeductionNtd: "4915000.00",
      status: "pending",
      notes: "Post-2025 investment, 3-year lock-up. Same investor, tranche 1.",
    },
    {
      investorName: "Dai XX (2)",
      roundName: "Pre-A",
      investmentDate: "2025-06-20",
      investmentAmountNtd: "3100000.00",
      sharesAcquired: 155000,
      pricePerShareNtd: "20.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 3,
      lockupEndDate: "2028-06-20",
      taxFilingYear: 2029,
      maxDeductionNtd: "1550000.00",
      status: "pending",
      notes: "Post-2025 investment, 3-year lock-up. Same investor, tranche 2.",
    },
    {
      investorName: "Liu XX (Pre-A)",
      roundName: "Pre-A",
      investmentDate: "2026-02-24",
      investmentAmountNtd: "3080000.00",
      sharesAcquired: 154000,
      pricePerShareNtd: "20.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 3,
      lockupEndDate: "2029-02-24",
      taxFilingYear: 2030,
      maxDeductionNtd: "1540000.00",
      status: "pending",
      notes: "Post-2025 investment, 3-year lock-up.",
    },
    {
      investorName: "XX Su",
      roundName: "Pre-A",
      investmentDate: "2026-04-10",
      investmentAmountNtd: "9240000.00",
      sharesAcquired: 462000,
      pricePerShareNtd: "20.000000",
      isEligible: true,
      ineligibleReason: null,
      lockupYears: 3,
      lockupEndDate: "2029-04-10",
      taxFilingYear: 2030,
      maxDeductionNtd: "4620000.00",
      status: "pending",
      notes: "Post-2025 investment, 3-year lock-up.",
    },
    // ── Not eligible ──
    {
      investorName: "Dai XX (Founder)",
      roundName: "Founder",
      investmentDate: "2023-06-01",
      investmentAmountNtd: "5000000.00",
      sharesAcquired: 5000000,
      pricePerShareNtd: "1.000000",
      isEligible: false,
      ineligibleReason: "founder",
      lockupYears: null,
      lockupEndDate: null,
      taxFilingYear: null,
      maxDeductionNtd: null,
      status: "not_applicable",
      notes: "Founder — not eligible for angel investor tax deduction.",
    },
    {
      investorName: "Kao XX (Founder)",
      roundName: "Founder",
      investmentDate: "2023-06-01",
      investmentAmountNtd: "5000000.00",
      sharesAcquired: 5000000,
      pricePerShareNtd: "1.000000",
      isEligible: false,
      ineligibleReason: "founder",
      lockupYears: null,
      lockupEndDate: null,
      taxFilingYear: null,
      maxDeductionNtd: null,
      status: "not_applicable",
      notes: "Founder — not eligible for angel investor tax deduction.",
    },
    {
      investorName: "XX Corp. Ltd.",
      roundName: "Pre-A",
      investmentDate: "2025-02-15",
      investmentAmountNtd: "15000000.00",
      sharesAcquired: 750000,
      pricePerShareNtd: "20.000000",
      isEligible: false,
      ineligibleReason: "entity",
      lockupYears: null,
      lockupEndDate: null,
      taxFilingYear: null,
      maxDeductionNtd: null,
      status: "not_applicable",
      notes: "Corporate entity (法人) — not eligible per §23-2.",
    },
    {
      investorName: "XX Holdings Co.",
      roundName: "Pre-A",
      investmentDate: "2025-04-10",
      investmentAmountNtd: "10000000.00",
      sharesAcquired: 500000,
      pricePerShareNtd: "20.000000",
      isEligible: false,
      ineligibleReason: "entity",
      lockupYears: null,
      lockupEndDate: null,
      taxFilingYear: null,
      maxDeductionNtd: null,
      status: "not_applicable",
      notes: "Corporate entity (法人) — not eligible per §23-2.",
    },
    {
      investorName: "XX Ong",
      roundName: "Pre-A",
      investmentDate: "2025-05-20",
      investmentAmountNtd: "6000000.00",
      sharesAcquired: 300000,
      pricePerShareNtd: "20.000000",
      isEligible: false,
      ineligibleReason: "foreign",
      lockupYears: null,
      lockupEndDate: null,
      taxFilingYear: null,
      maxDeductionNtd: null,
      status: "not_applicable",
      notes: "Foreign national — not eligible per §23-2.",
    },
  ];

  for (const rec of angelTaxRecords) {
    const existing = await sql`
      SELECT id FROM angel_tax_deductions
      WHERE "companyId" = ${companyId} AND "investorName" = ${rec.investorName}
        AND "roundName" = ${rec.roundName}
    `;
    if (existing.length > 0) {
      console.log(`  ℹ️ ${rec.investorName} (${rec.roundName}) already exists, skipping`);
      continue;
    }

    const [created] = await sql`
      INSERT INTO angel_tax_deductions (
        "companyId", "investorName", "roundName",
        "investmentDate", "investmentAmountNtd", "sharesAcquired", "pricePerShareNtd",
        "isEligible", "ineligibleReason",
        "lockupYears", "lockupEndDate", "taxFilingYear",
        "deductionRate", "maxDeductionNtd",
        status, notes
      ) VALUES (
        ${companyId}, ${rec.investorName}, ${rec.roundName},
        ${rec.investmentDate}, ${rec.investmentAmountNtd}, ${rec.sharesAcquired}, ${rec.pricePerShareNtd},
        ${rec.isEligible}, ${rec.ineligibleReason},
        ${rec.lockupYears}, ${rec.lockupEndDate}, ${rec.taxFilingYear},
        '0.50', ${rec.maxDeductionNtd},
        ${rec.status}, ${rec.notes}
      )
      RETURNING id
    `;
    const label = rec.isEligible
      ? `✅ ${rec.investorName} (${rec.roundName}) — NT$${(parseFloat(rec.investmentAmountNtd) / 1e6).toFixed(1)}M, lockup→${rec.lockupEndDate}, tax year ${rec.taxFilingYear}`
      : `⬚ ${rec.investorName} (${rec.roundName}) — N/A (${rec.ineligibleReason})`;
    console.log(`  ${label} (id=${created.id})`);
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
  const finalAngelTax = await sql`SELECT count(*) as cnt FROM angel_tax_deductions WHERE "companyId" = ${companyId}`;

  console.log(`  Financial Projections: ${finalProjections[0].cnt}`);
  console.log(`  Projection Scenarios: ${finalScenarios[0].cnt}`);
  console.log(`  Comps Peers: ${finalComps[0].cnt}`);
  console.log(`  Liquidation Preferences: ${finalLiqPrefs[0].cnt}`);
  console.log(`  Anti-Dilution Provisions: ${finalAntiDil[0].cnt}`);
  console.log(`  Angel Tax Deductions: ${finalAngelTax[0].cnt}`);
  console.log("\n🎉 Analysis demo data seeding complete!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
