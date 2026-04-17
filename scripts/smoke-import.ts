// Phase-3 import smoke — tests that excel-import.ts writes V1-compatible data.
//
// Usage:
//   DATABASE_URL=... tsx scripts/smoke-import.ts
//
// Cleans up after itself by creating and deleting a test company.

import * as fs from "fs";
import * as path from "path";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  companies,
  investors,
  shareRegisterEntries,
  snapshots as snapshotsV1,
  esopPoolsV1,
  esopGrantsV1,
  fundingRounds,
  shareholders,
  shareTransactions,
  shareHoldings,
  valuationProjections,
  importLogs,
  capTableSnapshots,
} from "../drizzle/schema";
import { importExcelFile } from "../server/excel-import";
import { deriveCapTable } from "../server/v1/capTable";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url);
  const db = drizzle({ client: sql });

  const TEST_COMPANY_NAME = "SMOKE-TEST-IMPORT-V1";

  // Cleanup any prior run
  const prior = await db.select().from(companies).where(eq(companies.name, TEST_COMPANY_NAME));
  for (const c of prior) {
    await db.delete(snapshotsV1).where(eq(snapshotsV1.companyId, c.id));
    await db.delete(shareRegisterEntries).where(eq(shareRegisterEntries.companyId, c.id));
    await db.delete(esopGrantsV1).where(eq(esopGrantsV1.companyId, c.id));
    await db.delete(esopPoolsV1).where(eq(esopPoolsV1.companyId, c.id));
    await db.delete(investors).where(eq(investors.companyId, c.id));
    await db.delete(shareTransactions).where(eq(shareTransactions.companyId, c.id));
    await db.delete(shareHoldings).where(eq(shareHoldings.companyId, c.id));
    await db.delete(shareholders).where(eq(shareholders.companyId, c.id));
    await db.delete(fundingRounds).where(eq(fundingRounds.companyId, c.id));
    await db.delete(valuationProjections).where(eq(valuationProjections.companyId, c.id));
    await db.delete(importLogs).where(eq(importLogs.companyId, c.id));
    await db.delete(capTableSnapshots).where(eq(capTableSnapshots.companyId, c.id));
    await db.delete(companies).where(eq(companies.id, c.id));
  }

  // 1. Create test company
  console.log("▸ 1. Creating test company…");
  const [company] = await db.insert(companies).values({
    name: TEST_COMPANY_NAME,
    slug: `smoke-import-${Date.now()}`,
  }).returning();
  console.log(`   ✓ company id=${company.id}`);

  // 2. Run the importer against the bundled template
  console.log("▸ 2. Reading captable_template.xlsx…");
  const templatePath = path.join(process.cwd(), "client/public/templates/captable_template.xlsx");
  const buffer = fs.readFileSync(templatePath);
  console.log(`   ✓ ${buffer.length} bytes`);

  console.log("▸ 3. Importing…");
  const result = await importExcelFile(buffer, "captable_template.xlsx", company.id);
  console.log(`   success=${result.success} recordsImported=${result.recordsImported}`);
  if (result.errors.length > 0) {
    console.log("   errors:");
    for (const e of result.errors) console.log(`     - ${e}`);
  }

  // 3. Count rows in V1 tables
  console.log("▸ 4. V1 data populated?");
  const invCount = (await db.select().from(investors).where(eq(investors.companyId, company.id))).length;
  const regCount = (await db.select().from(shareRegisterEntries).where(eq(shareRegisterEntries.companyId, company.id))).length;
  const roundCount = (await db.select().from(fundingRounds).where(eq(fundingRounds.companyId, company.id))).length;
  const poolCount = (await db.select().from(esopPoolsV1).where(eq(esopPoolsV1.companyId, company.id))).length;
  const snapCount = (await db.select().from(snapshotsV1).where(eq(snapshotsV1.companyId, company.id))).length;
  console.log(`   investors:             ${invCount}`);
  console.log(`   share_register_entries: ${regCount}`);
  console.log(`   funding_rounds:        ${roundCount}`);
  console.log(`   esop_pools_v1:         ${poolCount}`);
  console.log(`   snapshots_v1:          ${snapCount}`);

  // 4. Derive cap table and check totals
  console.log("▸ 5. Deriving cap table…");
  const capTable = await deriveCapTable(company.id);
  console.log(`   holdings=${capTable.holdings.length}`);
  console.log(`   totalShares (fully diluted)=${capTable.totalShares.toLocaleString()}`);
  console.log(`   issued=${capTable.totalIssuedShares.toLocaleString()}`);
  console.log(`   ESOP pool total=${capTable.esopPoolTotal.toLocaleString()} / unallocated=${capTable.esopPoolUnallocated.toLocaleString()}`);
  const pctSum = capTable.holdings.reduce((s, h) => s + Number(h.ownershipPct), 0);
  const esopPct = capTable.totalShares > 0
    ? (capTable.esopPoolUnallocated / capTable.totalShares) * 100
    : 0;
  const grandTotal = Number((pctSum + esopPct).toFixed(4));
  console.log(`   ownership% sum (investors) = ${pctSum.toFixed(4)}`);
  console.log(`   ESOP% (unallocated)        = ${esopPct.toFixed(4)}`);
  console.log(`   GRAND TOTAL                = ${grandTotal}`);

  console.log("");
  console.log("Top holdings:");
  for (const h of capTable.holdings.slice(0, 15)) {
    console.log(`   ${h.investorName.padEnd(30)} ${String(h.totalShares).padStart(12)}  ${h.ownershipPct}%`);
  }

  // Acceptance — V1 excludes the ESOP placeholder from investors table.
  // The template has 11 directory rows, 1 of which is "ESOP" (migrates to the
  // esop_pools_v1 table, NOT the investors table). So Cap Table shows:
  //   10 investor holdings + 1 ESOP pool row = 11 line items.
  const expectedHoldings = 10;
  const expectedEsopPools = 1;
  const tolerance = 0.01; // %
  let allPassed = true;
  if (capTable.holdings.length !== expectedHoldings) {
    console.log(`   ❌ expected ${expectedHoldings} investor holdings, got ${capTable.holdings.length}`);
    allPassed = false;
  } else {
    console.log(`   ✓ ${capTable.holdings.length} investor holdings (+ 1 ESOP pool row)`);
  }
  if (poolCount !== expectedEsopPools) {
    console.log(`   ❌ expected ${expectedEsopPools} ESOP pool, got ${poolCount}`);
    allPassed = false;
  }
  if (Math.abs(grandTotal - 100) > tolerance) {
    console.log(`   ❌ ownership total ${grandTotal}% != 100% (tolerance ±${tolerance}%)`);
    allPassed = false;
  } else {
    console.log(`   ✓ ownership total = 100% (±${tolerance}%)`);
  }
  if (roundCount < 4) {
    console.log(`   ❌ expected >= 4 funding rounds, got ${roundCount}`);
    allPassed = false;
  } else {
    console.log(`   ✓ ${roundCount} funding rounds`);
  }

  console.log("");
  if (allPassed) {
    console.log("✅ IMPORT SMOKE PASSED");
  } else {
    console.log("❌ IMPORT SMOKE FAILED");
  }

  // Cleanup
  console.log("");
  console.log("▸ Cleanup…");
  await db.delete(snapshotsV1).where(eq(snapshotsV1.companyId, company.id));
  await db.delete(shareRegisterEntries).where(eq(shareRegisterEntries.companyId, company.id));
  await db.delete(esopGrantsV1).where(eq(esopGrantsV1.companyId, company.id));
  await db.delete(esopPoolsV1).where(eq(esopPoolsV1.companyId, company.id));
  await db.delete(investors).where(eq(investors.companyId, company.id));
  await db.delete(shareTransactions).where(eq(shareTransactions.companyId, company.id));
  await db.delete(shareHoldings).where(eq(shareHoldings.companyId, company.id));
  await db.delete(shareholders).where(eq(shareholders.companyId, company.id));
  await db.delete(fundingRounds).where(eq(fundingRounds.companyId, company.id));
  await db.delete(valuationProjections).where(eq(valuationProjections.companyId, company.id));
  await db.delete(importLogs).where(eq(importLogs.companyId, company.id));
  await db.delete(capTableSnapshots).where(eq(capTableSnapshots.companyId, company.id));
  await db.delete(companies).where(eq(companies.id, company.id));
  console.log("   ✓ cleaned");

  if (!allPassed) process.exit(1);
}

main().catch(e => {
  console.error("❌ SMOKE FAILED:");
  console.error(e);
  process.exit(1);
});
