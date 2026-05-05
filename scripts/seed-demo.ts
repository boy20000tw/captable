/**
 * Demo Data Seed Script
 * ─────────────────────
 * Run: npx tsx scripts/seed-demo.ts
 *
 * Three operations:
 *   1. Update 10 existing investors with contact info (email, phone, nationality)
 *   2. Create 3 employee investors + ESOP grants (CTO, Engineer, Designer)
 *   3. Create 1 SAFE instrument
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required. Run with: DATABASE_URL=... npx tsx scripts/seed-demo.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── Investor contact info mapping (name → contact) ─────────────────────────
// Names come from the existing 10 investors observed on the live site.
const investorContactMap: Record<string, { email: string; phone: string; nationality: string; entityKind?: string }> = {
  "戴XX":       { email: "emily.dai@example.com",       phone: "+886-912-345-001", nationality: "TW" },
  "高XX":       { email: "kevin.gao@example.com",       phone: "+886-912-345-002", nationality: "TW" },
  "劉XX":       { email: "jason.liu@example.com",       phone: "+886-912-345-003", nationality: "TW" },
  "蔡XX":       { email: "linda.tsai@example.com",      phone: "+886-912-345-004", nationality: "TW" },
  "汪XX":       { email: "david.wang@example.com",      phone: "+886-912-345-005", nationality: "TW" },
  "沈XX":       { email: "grace.shen@example.com",      phone: "+886-912-345-006", nationality: "TW" },
};

// English-name investors
const investorContactMapEn: Record<string, { email: string; phone: string; nationality: string }> = {
  "Su":   { email: "alex.su@example.com",       phone: "+886-912-345-007", nationality: "TW" },
  "Ong":  { email: "michael.ong@example.com",   phone: "+65-9123-4508",   nationality: "SG" },
};

// Entity investors (法人)
const entityContactMap: Record<string, { email: string; phone: string; nationality: string }> = {
  "股份有限公司": { email: "ir@company-example.com", phone: "+886-2-2345-6789", nationality: "TW" },
};

// ─── ESOP Employee profiles ─────────────────────────────────────────────────
const employees = [
  {
    name: "陳技術長",
    email: "cto@caploom-demo.com",
    phone: "+886-912-888-001",
    nationality: "TW",
    role: "CTO",
    grantType: "option" as const,
    sharesGranted: 200000,
    exercisePrice: "10.00",
    vestingStartDate: "2024-06-01",
    grantDate: "2024-06-01",
    expiryDate: "2034-06-01",
    notes: "Co-founder CTO, 4-year vesting with 1-year cliff",
  },
  {
    name: "林資深工程師",
    email: "engineer@caploom-demo.com",
    phone: "+886-912-888-002",
    nationality: "TW",
    role: "Senior Engineer",
    grantType: "option" as const,
    sharesGranted: 50000,
    exercisePrice: "10.00",
    vestingStartDate: "2025-01-15",
    grantDate: "2025-01-15",
    expiryDate: "2035-01-15",
    notes: "Senior engineer, joined at Series Seed",
  },
  {
    name: "張設計師",
    email: "designer@caploom-demo.com",
    phone: "+886-912-888-003",
    nationality: "TW",
    role: "Lead Designer",
    grantType: "rsu" as const,
    sharesGranted: 30000,
    exercisePrice: null,
    fairMarketValue: "15.00",
    vestingStartDate: "2025-03-01",
    grantDate: "2025-03-01",
    expiryDate: null,
    notes: "Lead designer, RSU grant at Series A valuation",
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Querying existing data...\n");

  // Get existing investors
  const existingInvestors = await sql`
    SELECT id, name, email, phone, nationality, "entityKind", "companyId"
    FROM investors ORDER BY id
  `;
  console.log(`Found ${existingInvestors.length} investors`);

  // Get company ID from first investor
  if (existingInvestors.length === 0) {
    console.error("❌ No investors found. Please create at least one investor first.");
    process.exit(1);
  }
  const companyId = existingInvestors[0].companyId;
  console.log(`Using companyId = ${companyId}\n`);

  // Get ESOP pool
  const pools = await sql`SELECT id, name, "totalShares" FROM esop_pools_v1 WHERE "companyId" = ${companyId}`;
  if (pools.length === 0) {
    console.error("❌ No ESOP pool found. Please create one first.");
    process.exit(1);
  }
  const poolId = pools[0].id;
  console.log(`Using ESOP pool: "${pools[0].name}" (id=${poolId}, ${pools[0].totalShares} shares)\n`);

  // Get funding rounds (for SAFE linkage)
  const rounds = await sql`SELECT id, name FROM funding_rounds WHERE "companyId" = ${companyId} ORDER BY id`;
  console.log(`Found ${rounds.length} funding rounds`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Update existing investors with contact info
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 1: Updating investor contact info ━━━");
  let updated = 0;

  for (const inv of existingInvestors) {
    let contact: { email: string; phone: string; nationality: string } | null = null;

    // Match by Chinese name (exact)
    if (investorContactMap[inv.name]) {
      contact = investorContactMap[inv.name];
    }
    // Match English-name investors (partial match on last name)
    else {
      for (const [key, val] of Object.entries(investorContactMapEn)) {
        if (inv.name.includes(key)) {
          contact = val;
          break;
        }
      }
    }
    // Match entity investors (partial match)
    if (!contact) {
      for (const [key, val] of Object.entries(entityContactMap)) {
        if (inv.name.includes(key)) {
          contact = val;
          break;
        }
      }
    }

    if (contact) {
      await sql`
        UPDATE investors
        SET email = ${contact.email},
            phone = ${contact.phone},
            nationality = ${contact.nationality},
            "updatedAt" = NOW()
        WHERE id = ${inv.id}
      `;
      console.log(`  ✅ ${inv.name} → ${contact.email} / ${contact.phone} / ${contact.nationality}`);
      updated++;
    } else {
      console.log(`  ⚠️ ${inv.name} — no contact mapping, skipped`);
    }
  }
  console.log(`Updated ${updated}/${existingInvestors.length} investors\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Create employee investors + ESOP grants
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Step 2: Creating ESOP grants ━━━");

  for (const emp of employees) {
    // Check if employee already exists
    const existing = await sql`
      SELECT id FROM investors WHERE name = ${emp.name} AND "companyId" = ${companyId}
    `;

    let investorId: number;
    if (existing.length > 0) {
      investorId = existing[0].id;
      console.log(`  ℹ️ ${emp.name} already exists (id=${investorId})`);
    } else {
      const [newInv] = await sql`
        INSERT INTO investors ("companyId", name, "entityKind", email, phone, nationality, status)
        VALUES (${companyId}, ${emp.name}, 'individual', ${emp.email}, ${emp.phone}, ${emp.nationality}, 'invested')
        RETURNING id
      `;
      investorId = newInv.id;
      console.log(`  ✅ Created investor: ${emp.name} (id=${investorId})`);
    }

    // Check if grant already exists for this employee in this pool
    const existingGrant = await sql`
      SELECT id FROM esop_grants_v1
      WHERE "investorId" = ${investorId} AND "poolId" = ${poolId}
    `;

    if (existingGrant.length > 0) {
      console.log(`  ℹ️ Grant already exists for ${emp.name}, skipping`);
      continue;
    }

    // Create the grant
    const [grant] = await sql`
      INSERT INTO esop_grants_v1 (
        "companyId", "poolId", "investorId", "grantType",
        "grantDate", "sharesGranted", "sharesVested", "sharesExercised", "sharesSettled", "sharesCancelled",
        "exercisePrice", "fairMarketValue", currency,
        "vestingStartDate", "vestingCliffMonths", "vestingTotalMonths",
        status, "expiryDate", notes
      ) VALUES (
        ${companyId}, ${poolId}, ${investorId}, ${emp.grantType},
        ${emp.grantDate}, ${emp.sharesGranted}, 0, 0, 0, 0,
        ${emp.exercisePrice}, ${(emp as any).fairMarketValue ?? null}, 'NTD',
        ${emp.vestingStartDate}, 12, 48,
        'active', ${emp.expiryDate}, ${emp.notes}
      )
      RETURNING id
    `;
    console.log(`  ✅ Created ${emp.grantType.toUpperCase()} grant for ${emp.name}: ${emp.sharesGranted.toLocaleString()} shares (id=${grant.id})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Create SAFE instrument
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Step 3: Creating SAFE instrument ━━━");

  // Check if a SAFE already exists
  const existingSafe = await sql`
    SELECT id, name FROM instruments WHERE "companyId" = ${companyId} AND type = 'safe'
  `;
  if (existingSafe.length > 0) {
    console.log(`  ℹ️ SAFE already exists: "${existingSafe[0].name}" (id=${existingSafe[0].id}), skipping`);
  } else {
    // Pick an investor for the SAFE — use one of the entity investors if available,
    // otherwise pick the first individual investor
    const entityInvestor = existingInvestors.find((i: any) => i.entityKind === "entity");
    const safeInvestorId = entityInvestor ? entityInvestor.id : existingInvestors[0].id;
    const safeInvestorName = entityInvestor ? entityInvestor.name : existingInvestors[0].name;

    // Link to earliest funding round if available
    const seedRoundId = rounds.length > 0 ? rounds[0].id : null;

    const [safe] = await sql`
      INSERT INTO instruments (
        "companyId", name, type, status,
        "investorId", "fundingRoundId",
        "investmentAmountNtd", "investmentAmountUsd",
        "valuationCapNtd", "valuationCapUsd",
        "discountRate", "safeType",
        notes, "boardApprovalDate"
      ) VALUES (
        ${companyId},
        ${"Pre-Seed SAFE — " + safeInvestorName},
        'safe', 'active',
        ${safeInvestorId}, ${seedRoundId},
        '5000000.00', '160000.00',
        '500000000.00', '16000000.00',
        '0.2000', 'post_money',
        'Post-money SAFE, NT$5M investment at NT$500M cap. Standard YC SAFE terms.',
        '2024-03-15'
      )
      RETURNING id
    `;
    console.log(`  ✅ Created SAFE: "Pre-Seed SAFE — ${safeInvestorName}" (id=${safe.id})`);
    console.log(`     NT$5,000,000 投資額 / NT$500,000,000 估值上限 / 20% 折扣`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n━━━ Verification ━━━");
  const finalInvestors = await sql`SELECT count(*) as cnt FROM investors WHERE "companyId" = ${companyId}`;
  const finalGrants = await sql`SELECT count(*) as cnt FROM esop_grants_v1 WHERE "companyId" = ${companyId}`;
  const finalInstruments = await sql`SELECT count(*) as cnt FROM instruments WHERE "companyId" = ${companyId}`;

  console.log(`  Investors: ${finalInvestors[0].cnt}`);
  console.log(`  ESOP Grants: ${finalGrants[0].cnt}`);
  console.log(`  Instruments: ${finalInstruments[0].cnt}`);
  console.log("\n🎉 Demo data seeding complete!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
