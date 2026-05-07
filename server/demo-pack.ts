/**
 * Demo Data Pack — Export & Import
 * ────────────────────────────────
 * Exports ALL business data for a company into a multi-sheet Excel workbook.
 * Imports the same workbook into any company (new or existing), rebuilding
 * all FK relationships via ID mapping.
 *
 * Sheet order follows FK dependency (parents before children):
 *   1. investors
 *   2. funding_rounds
 *   3. share_classes
 *   4. shareholders (legacy)
 *   5. allocations
 *   6. share_register_entries
 *   7. esop_pools_v1
 *   8. esop_grants_v1
 *   9. instruments
 *  10. investor_activities
 *  11. share_transfers
 *  12. liquidation_preferences
 *  13. anti_dilution_provisions
 *  14. valuations_409a
 *  15. elections_83b
 *  16. financial_projections
 *  17. projection_scenarios
 *  18. dcf_scenarios
 *  19. comps_peers
 *  20. angel_tax_deductions
 *  21. tech_share_tax_records
 *  22. closed_company_provisions
 *  23. closed_company_share_rights
 *  24. notifications
 *  25. company_info (metadata sheet)
 */

import { eq, asc } from "drizzle-orm";
import { getDb } from "./db";
import {
  companies,
  investors, fundingRounds, shareClasses, shareholders,
  allocations, shareRegisterEntries,
  esopPoolsV1, esopGrantsV1,
  instruments, investorActivities,
  shareTransfers, liquidationPreferences, antiDilutionProvisions,
  valuations409a, elections83b,
  financialProjections, projectionScenarios, dcfScenarios,
  compsPeers, angelTaxDeductions, techShareTaxRecords,
  closedCompanyProvisions, closedCompanyShareRights,
  notifications,
  // Legacy
  shareHoldings, shareTransactions, esopPool, esopGrants,
  valuationProjections, capTableSnapshots, shareholderDocuments,
} from "../drizzle/schema";

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/** Table spec: sheet name → drizzle table + companyId column */
type TableSpec = {
  sheet: string;
  table: any;
  companyIdCol: any;
  orderBy?: any;
};

const EXPORT_TABLES: TableSpec[] = [
  { sheet: "investors", table: investors, companyIdCol: investors.companyId, orderBy: asc(investors.id) },
  { sheet: "funding_rounds", table: fundingRounds, companyIdCol: fundingRounds.companyId, orderBy: asc(fundingRounds.sortOrder) },
  { sheet: "share_classes", table: shareClasses, companyIdCol: shareClasses.companyId, orderBy: asc(shareClasses.sortOrder) },
  { sheet: "shareholders", table: shareholders, companyIdCol: shareholders.companyId, orderBy: asc(shareholders.id) },
  { sheet: "allocations", table: allocations, companyIdCol: allocations.companyId, orderBy: asc(allocations.id) },
  { sheet: "share_register", table: shareRegisterEntries, companyIdCol: shareRegisterEntries.companyId, orderBy: asc(shareRegisterEntries.id) },
  { sheet: "esop_pools_v1", table: esopPoolsV1, companyIdCol: esopPoolsV1.companyId, orderBy: asc(esopPoolsV1.id) },
  { sheet: "esop_grants_v1", table: esopGrantsV1, companyIdCol: esopGrantsV1.companyId, orderBy: asc(esopGrantsV1.id) },
  { sheet: "instruments", table: instruments, companyIdCol: instruments.companyId, orderBy: asc(instruments.id) },
  { sheet: "investor_activities", table: investorActivities, companyIdCol: investorActivities.companyId, orderBy: asc(investorActivities.id) },
  { sheet: "share_transfers", table: shareTransfers, companyIdCol: shareTransfers.companyId, orderBy: asc(shareTransfers.id) },
  { sheet: "liq_preferences", table: liquidationPreferences, companyIdCol: liquidationPreferences.companyId, orderBy: asc(liquidationPreferences.id) },
  { sheet: "anti_dilution", table: antiDilutionProvisions, companyIdCol: antiDilutionProvisions.companyId, orderBy: asc(antiDilutionProvisions.id) },
  { sheet: "valuations_409a", table: valuations409a, companyIdCol: valuations409a.companyId, orderBy: asc(valuations409a.id) },
  { sheet: "elections_83b", table: elections83b, companyIdCol: elections83b.companyId, orderBy: asc(elections83b.id) },
  { sheet: "fin_projections", table: financialProjections, companyIdCol: financialProjections.companyId, orderBy: asc(financialProjections.id) },
  { sheet: "proj_scenarios", table: projectionScenarios, companyIdCol: projectionScenarios.companyId, orderBy: asc(projectionScenarios.id) },
  { sheet: "dcf_scenarios", table: dcfScenarios, companyIdCol: dcfScenarios.companyId, orderBy: asc(dcfScenarios.id) },
  { sheet: "comps_peers", table: compsPeers, companyIdCol: compsPeers.companyId, orderBy: asc(compsPeers.id) },
  { sheet: "angel_tax", table: angelTaxDeductions, companyIdCol: angelTaxDeductions.companyId, orderBy: asc(angelTaxDeductions.id) },
  { sheet: "tech_share_tax", table: techShareTaxRecords, companyIdCol: techShareTaxRecords.companyId, orderBy: asc(techShareTaxRecords.id) },
  { sheet: "closed_co_provs", table: closedCompanyProvisions, companyIdCol: closedCompanyProvisions.companyId, orderBy: asc(closedCompanyProvisions.id) },
  { sheet: "closed_co_rights", table: closedCompanyShareRights, companyIdCol: closedCompanyShareRights.companyId, orderBy: asc(closedCompanyShareRights.id) },
  { sheet: "notifications", table: notifications, companyIdCol: notifications.companyId, orderBy: asc(notifications.id) },
  // Legacy tables
  { sheet: "legacy_holdings", table: shareHoldings, companyIdCol: shareHoldings.companyId },
  { sheet: "legacy_txns", table: shareTransactions, companyIdCol: shareTransactions.companyId },
  { sheet: "legacy_esop_pool", table: esopPool, companyIdCol: esopPool.companyId },
  { sheet: "legacy_esop_grants", table: esopGrants, companyIdCol: esopGrants.companyId },
  { sheet: "legacy_val_proj", table: valuationProjections, companyIdCol: valuationProjections.companyId },
  { sheet: "legacy_snapshots", table: capTableSnapshots, companyIdCol: capTableSnapshots.companyId },
  { sheet: "legacy_docs", table: shareholderDocuments, companyIdCol: shareholderDocuments.companyId },
];

// Columns to skip on export (encryption dual-write fields + system-generated)
const SKIP_COLS = new Set([
  "nameEnc", "name_enc", "emailEnc", "email_enc", "emailBi", "email_bi",
  "phoneEnc", "phone_enc", "contactEmailEnc", "contact_email_enc",
  "contactEmailBi", "contact_email_bi", "representativeNameEnc", "representative_name_enc",
  "amountEnc", "amount_enc", "sharesAllocatedEnc", "shares_allocated_enc",
  "pricePerShareEnc", "price_per_share_enc", "fxToNtdEnc", "fx_to_ntd_enc",
  "sharesEnc", "shares_enc", "totalAmountEnc", "total_amount_enc",
  "investmentAmountNtdEnc", "investment_amount_ntd_enc",
  "investmentAmountUsdEnc", "investment_amount_usd_enc",
  "pricePerShareNtdEnc", "price_per_share_ntd_enc",
  "sharesIssuedEnc", "shares_issued_enc",
  "valuationCapNtdEnc", "valuation_cap_ntd_enc",
  "valuationCapUsdEnc", "valuation_cap_usd_enc",
  "discountRateEnc", "discount_rate_enc",
  "interestRateEnc", "interest_rate_enc",
  "accruedInterestNtdEnc", "accrued_interest_ntd_enc",
  "conversionPriceNtdEnc", "conversion_price_ntd_enc",
  "conversionSharesEnc", "conversion_shares_enc",
  "totalPriceEnc", "total_price_enc",
]);

export async function exportDemoPack(companyId: number): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Company info sheet
  const companyRows = await db.select().from(companies).where(eq(companies.id, companyId));
  if (companyRows.length === 0) throw new Error("Company not found");
  const company = companyRows[0];

  const infoSheet = wb.addWorksheet("_info");
  infoSheet.addRow(["key", "value"]);
  infoSheet.addRow(["companyName", company.name]);
  infoSheet.addRow(["companySlug", company.slug]);
  infoSheet.addRow(["exportDate", new Date().toISOString()]);
  infoSheet.addRow(["exportVersion", "1.0"]);
  infoSheet.addRow(["defaultCurrency", company.defaultCurrency]);
  infoSheet.addRow(["plan", company.plan]);

  // Export each table
  for (const spec of EXPORT_TABLES) {
    const query = db.select().from(spec.table).where(eq(spec.companyIdCol, companyId));
    const rows: any[] = spec.orderBy ? await (query as any).orderBy(spec.orderBy) : await query;

    if (rows.length === 0) continue; // skip empty tables

    const ws = wb.addWorksheet(spec.sheet);

    // Get columns from first row, filter out encrypted columns
    const allKeys = Object.keys(rows[0]);
    const keys = allKeys.filter(k => !SKIP_COLS.has(k));

    // Header row
    ws.addRow(keys);

    // Data rows
    for (const row of rows) {
      ws.addRow(keys.map(k => {
        const v = row[k];
        if (v === null || v === undefined) return "";
        if (v instanceof Date) return v.toISOString();
        if (typeof v === "object") return JSON.stringify(v);
        return v;
      }));
    }

    // Auto-width columns
    ws.columns?.forEach(col => {
      if (col.values) {
        let maxLen = 10;
        col.values.forEach(v => {
          if (v && String(v).length > maxLen) maxLen = Math.min(String(v).length, 50);
        });
        col.width = maxLen + 2;
      }
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer) as Buffer;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════════════════════

type IdMap = Map<number, number>; // oldId → newId

function mapId(map: IdMap, oldId: any): number | null {
  if (oldId === null || oldId === undefined || oldId === "" || oldId === 0) return null;
  const n = typeof oldId === "number" ? oldId : parseInt(String(oldId), 10);
  if (isNaN(n)) return null;
  return map.get(n) ?? null;
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseStr(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function parseBool(v: any): boolean {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}

function parseDate(v: any): Date | string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  const s = String(v);
  // Date-only string (YYYY-MM-DD) — return as string for date columns
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO timestamp
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseJson(v: any): any {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return null; }
}

/** Read a worksheet into an array of row objects keyed by header row */
function readSheet(ws: any): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const headers: string[] = [];

  ws.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) {
      row.eachCell((cell: any, colNumber: number) => {
        headers[colNumber] = String(cell.value || "").trim();
      });
      return;
    }
    const obj: Record<string, any> = {};
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      const key = headers[colNumber];
      if (key) obj[key] = cell.value;
    });
    rows.push(obj);
  });

  return rows;
}

export interface ImportPackResult {
  success: boolean;
  sheetsImported: string[];
  totalRecords: number;
  errors: string[];
}

export async function importDemoPack(
  companyId: number,
  userId: number,
  fileBuffer: Buffer,
): Promise<ImportPackResult> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(fileBuffer as any);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result: ImportPackResult = {
    success: true,
    sheetsImported: [],
    totalRecords: 0,
    errors: [],
  };

  // ID mapping tables
  const investorMap: IdMap = new Map();
  const roundMap: IdMap = new Map();
  const classMap: IdMap = new Map();
  const shareholderMap: IdMap = new Map();
  const allocationMap: IdMap = new Map();
  const registerMap: IdMap = new Map();
  const poolMap: IdMap = new Map();
  const grantMap: IdMap = new Map();
  const projectionMap: IdMap = new Map();

  // Helper: import a sheet
  function getSheetRows(name: string): Record<string, any>[] {
    const ws = wb.getWorksheet(name);
    if (!ws) return [];
    return readSheet(ws);
  }

  try {
    // ── 1. Investors ────────────────────────────────────────────────────
    const invRows = getSheetRows("investors");
    for (const r of invRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(investors).values({
        companyId,
        name: parseStr(r.name) || "Unknown",
        entityKind: r.entityKind || "individual",
        email: parseStr(r.email),
        phone: parseStr(r.phone),
        nationality: parseStr(r.nationality),
        status: r.status || "prospect",
        aka: parseStr(r.aka),
        website: parseStr(r.website),
        linkedinUrl: parseStr(r.linkedinUrl),
        firstContactAt: parseDate(r.firstContactAt) as any,
        lastContactAt: parseDate(r.lastContactAt) as any,
        notes: parseStr(r.notes),
      }).returning();
      if (oldId) investorMap.set(oldId, created.id);
    }
    if (invRows.length) { result.sheetsImported.push("investors"); result.totalRecords += invRows.length; }

    // ── 2. Funding Rounds ───────────────────────────────────────────────
    const roundRows = getSheetRows("funding_rounds");
    for (const r of roundRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(fundingRounds).values({
        companyId,
        name: parseStr(r.name) || "Unknown Round",
        roundDate: parseDate(r.roundDate) as any,
        pricePerShareNtd: parseStr(r.pricePerShareNtd),
        moneyRaisedNtd: parseStr(r.moneyRaisedNtd),
        preMoneyValuationNtd: parseStr(r.preMoneyValuationNtd),
        postMoneyValuationNtd: parseStr(r.postMoneyValuationNtd),
        exchangeRate: parseStr(r.exchangeRate),
        status: r.status || "completed",
        notes: parseStr(r.notes),
        sortOrder: parseNum(r.sortOrder) ?? 0,
      }).returning();
      if (oldId) roundMap.set(oldId, created.id);
    }
    if (roundRows.length) { result.sheetsImported.push("funding_rounds"); result.totalRecords += roundRows.length; }

    // ── 3. Share Classes ────────────────────────────────────────────────
    const classRows = getSheetRows("share_classes");
    for (const r of classRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(shareClasses).values({
        companyId,
        name: parseStr(r.name) || "Unknown",
        slug: parseStr(r.slug) || "unknown",
        classType: r.classType || "common",
        authorizedShares: parseNum(r.authorizedShares),
        parValue: parseStr(r.parValue),
        pricePerShare: parseStr(r.pricePerShare),
        currency: parseStr(r.currency) || "USD",
        liquidationMultiple: parseStr(r.liquidationMultiple),
        participationType: r.participationType || "non_participating",
        participationCap: parseStr(r.participationCap),
        seniorityRank: parseNum(r.seniorityRank) ?? 1,
        antiDilutionType: r.antiDilutionType || "none",
        isConvertible: parseBool(r.isConvertible),
        conversionRatio: parseStr(r.conversionRatio),
        dividendType: r.dividendType || "none",
        dividendRate: parseStr(r.dividendRate),
        votingMultiplier: parseStr(r.votingMultiplier),
        boardSeats: parseNum(r.boardSeats) ?? 0,
        protectiveProvisions: parseStr(r.protectiveProvisions),
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        notes: parseStr(r.notes),
        sortOrder: parseNum(r.sortOrder) ?? 0,
      }).returning();
      if (oldId) classMap.set(oldId, created.id);
    }
    if (classRows.length) { result.sheetsImported.push("share_classes"); result.totalRecords += classRows.length; }

    // ── 4. Shareholders (legacy) ────────────────────────────────────────
    const shRows = getSheetRows("shareholders");
    for (const r of shRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(shareholders).values({
        companyId,
        name: parseStr(r.name) || "Unknown",
        aka: parseStr(r.aka),
        type: r.type || "other",
        email: parseStr(r.email),
        phone: parseStr(r.phone),
        nationality: parseStr(r.nationality),
        isEntity: parseBool(r.isEntity),
        notes: parseStr(r.notes),
        lockupPeriod: parseStr(r.lockupPeriod),
        taxBenefits: parseStr(r.taxBenefits),
      }).returning();
      if (oldId) shareholderMap.set(oldId, created.id);
    }
    if (shRows.length) { result.sheetsImported.push("shareholders"); result.totalRecords += shRows.length; }

    // ── 5. Allocations ──────────────────────────────────────────────────
    const allocRows = getSheetRows("allocations");
    for (const r of allocRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(allocations).values({
        companyId,
        fundingRoundId: mapId(roundMap, r.fundingRoundId) || 0,
        investorId: mapId(investorMap, r.investorId) || 0,
        shareClass: r.shareClass || "common",
        shareClassId: mapId(classMap, r.shareClassId),
        amount: parseStr(r.amount),
        currency: parseStr(r.currency) || "NTD",
        fxToNtd: parseStr(r.fxToNtd) || "1",
        sharesAllocated: parseNum(r.sharesAllocated),
        pricePerShare: parseStr(r.pricePerShare),
        status: r.status || "planned",
        plannedAt: parseDate(r.plannedAt) as any,
        committedAt: parseDate(r.committedAt) as any,
        signedAt: parseDate(r.signedAt) as any,
        fundedAt: parseDate(r.fundedAt) as any,
        issuedAt: parseDate(r.issuedAt) as any,
        termSheetUrl: parseStr(r.termSheetUrl),
        skipTermSheet: parseBool(r.skipTermSheet),
        agreementUrl: parseStr(r.agreementUrl),
        notes: parseStr(r.notes),
      }).returning();
      if (oldId) allocationMap.set(oldId, created.id);
    }
    if (allocRows.length) { result.sheetsImported.push("allocations"); result.totalRecords += allocRows.length; }

    // ── 6. Share Register Entries ────────────────────────────────────────
    const regRows = getSheetRows("share_register");
    for (const r of regRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(shareRegisterEntries).values({
        companyId,
        allocationId: mapId(allocationMap, r.allocationId),
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        investorId: mapId(investorMap, r.investorId) || 0,
        eventType: r.eventType || "issuance",
        shareClass: r.shareClass || "common",
        shareClassId: mapId(classMap, r.shareClassId),
        shares: parseNum(r.shares) || 0,
        pricePerShare: parseStr(r.pricePerShare),
        currency: parseStr(r.currency) || "NTD",
        fxToNtd: parseStr(r.fxToNtd) || "1",
        totalAmount: parseStr(r.totalAmount),
        effectiveDate: (parseDate(r.effectiveDate) as string) || new Date().toISOString().slice(0, 10),
        reversedEntryId: mapId(registerMap, r.reversedEntryId),
        notes: parseStr(r.notes),
      }).returning();
      if (oldId) registerMap.set(oldId, created.id);
    }
    if (regRows.length) { result.sheetsImported.push("share_register"); result.totalRecords += regRows.length; }

    // ── 7. ESOP Pools V1 ────────────────────────────────────────────────
    const poolRows = getSheetRows("esop_pools_v1");
    for (const r of poolRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(esopPoolsV1).values({
        companyId,
        name: parseStr(r.name) || "ESOP Pool",
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        totalShares: parseNum(r.totalShares) || 0,
        notes: parseStr(r.notes),
      }).returning();
      if (oldId) poolMap.set(oldId, created.id);
    }
    if (poolRows.length) { result.sheetsImported.push("esop_pools_v1"); result.totalRecords += poolRows.length; }

    // ── 8. ESOP Grants V1 ───────────────────────────────────────────────
    const grantRows = getSheetRows("esop_grants_v1");
    for (const r of grantRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(esopGrantsV1).values({
        companyId,
        poolId: mapId(poolMap, r.poolId) || 0,
        investorId: mapId(investorMap, r.investorId) || 0,
        grantType: r.grantType || "option",
        grantDate: (parseDate(r.grantDate) as string) || new Date().toISOString().slice(0, 10),
        sharesGranted: parseNum(r.sharesGranted) || 0,
        sharesVested: parseNum(r.sharesVested) ?? 0,
        sharesExercised: parseNum(r.sharesExercised) ?? 0,
        sharesSettled: parseNum(r.sharesSettled) ?? 0,
        sharesCancelled: parseNum(r.sharesCancelled) ?? 0,
        exercisePrice: parseStr(r.exercisePrice),
        fairMarketValue: parseStr(r.fairMarketValue),
        currency: parseStr(r.currency) || "NTD",
        vestingStartDate: parseDate(r.vestingStartDate) as any,
        vestingCliffMonths: parseNum(r.vestingCliffMonths) ?? 12,
        vestingTotalMonths: parseNum(r.vestingTotalMonths) ?? 48,
        status: r.status || "active",
        expiryDate: parseDate(r.expiryDate) as any,
        notes: parseStr(r.notes),
      }).returning();
      if (oldId) grantMap.set(oldId, created.id);
    }
    if (grantRows.length) { result.sheetsImported.push("esop_grants_v1"); result.totalRecords += grantRows.length; }

    // ── 9. Instruments ──────────────────────────────────────────────────
    const instRows = getSheetRows("instruments");
    for (const r of instRows) {
      await db.insert(instruments).values({
        companyId,
        name: parseStr(r.name) || "Instrument",
        type: r.type || "safe",
        status: r.status || "active",
        investorId: mapId(investorMap, r.investorId) || 0,
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        investmentAmountNtd: parseStr(r.investmentAmountNtd) || "0",
        investmentAmountUsd: parseStr(r.investmentAmountUsd),
        pricePerShareNtd: parseStr(r.pricePerShareNtd),
        sharesIssued: parseNum(r.sharesIssued),
        valuationCapNtd: parseStr(r.valuationCapNtd),
        valuationCapUsd: parseStr(r.valuationCapUsd),
        discountRate: parseStr(r.discountRate),
        safeType: r.safeType || null,
        interestRate: parseStr(r.interestRate),
        maturityDate: parseDate(r.maturityDate) as any,
        accruedInterestNtd: parseStr(r.accruedInterestNtd),
        conversionRoundId: mapId(roundMap, r.conversionRoundId),
        conversionDate: parseDate(r.conversionDate) as any,
        conversionPriceNtd: parseStr(r.conversionPriceNtd),
        conversionShares: parseNum(r.conversionShares),
        notes: parseStr(r.notes),
        boardApprovalDate: parseDate(r.boardApprovalDate) as any,
        documentUrl: parseStr(r.documentUrl),
      });
    }
    if (instRows.length) { result.sheetsImported.push("instruments"); result.totalRecords += instRows.length; }

    // ── 10. Investor Activities ──────────────────────────────────────────
    const actRows = getSheetRows("investor_activities");
    for (const r of actRows) {
      await db.insert(investorActivities).values({
        companyId,
        investorId: mapId(investorMap, r.investorId) || 0,
        userId,
        type: r.type || "note",
        title: parseStr(r.title) || "Activity",
        description: parseStr(r.description),
        dueDate: parseDate(r.dueDate) as any,
        status: r.status || "pending",
        priority: r.priority || "medium",
        completedAt: parseDate(r.completedAt) as any,
        metadata: parseStr(r.metadata),
      });
    }
    if (actRows.length) { result.sheetsImported.push("investor_activities"); result.totalRecords += actRows.length; }

    // ── 11. Share Transfers ──────────────────────────────────────────────
    const stRows = getSheetRows("share_transfers");
    for (const r of stRows) {
      await db.insert(shareTransfers).values({
        companyId,
        sellerInvestorId: mapId(investorMap, r.sellerInvestorId) || mapId(investorMap, r.seller_investor_id) || 0,
        buyerInvestorId: mapId(investorMap, r.buyerInvestorId) || mapId(investorMap, r.buyer_investor_id),
        buyerName: parseStr(r.buyerName) || parseStr(r.buyer_name),
        buyerEmail: parseStr(r.buyerEmail) || parseStr(r.buyer_email),
        shareClass: parseStr(r.shareClass) || parseStr(r.share_class) || "common",
        shares: parseNum(r.shares) || 0,
        pricePerShare: parseStr(r.pricePerShare) || parseStr(r.price_per_share),
        totalPrice: parseStr(r.totalPrice) || parseStr(r.total_price),
        currency: parseStr(r.currency) || "USD",
        transferDate: (parseDate(r.transferDate) || parseDate(r.transfer_date) || new Date().toISOString().slice(0, 10)) as any,
        status: r.status || "pending",
        hasRofr: parseBool(r.hasRofr || r.has_rofr),
        rofrDeadline: (parseDate(r.rofrDeadline) || parseDate(r.rofr_deadline)) as any,
        boardApprovalDate: (parseDate(r.boardApprovalDate) || parseDate(r.board_approval_date)) as any,
        registerEntryId: mapId(registerMap, r.registerEntryId || r.register_entry_id),
        notes: parseStr(r.notes),
      });
    }
    if (stRows.length) { result.sheetsImported.push("share_transfers"); result.totalRecords += stRows.length; }

    // ── 12. Liquidation Preferences ─────────────────────────────────────
    const lpRows = getSheetRows("liq_preferences");
    for (const r of lpRows) {
      const roundId = mapId(roundMap, r.fundingRoundId);
      if (!roundId) continue;
      await db.insert(liquidationPreferences).values({
        companyId,
        fundingRoundId: roundId,
        preferenceType: r.preferenceType || "non_participating",
        liquidationMultiple: parseStr(r.liquidationMultiple) || "1.00",
        participationCap: parseStr(r.participationCap),
        seniorityRank: parseNum(r.seniorityRank) ?? 1,
        notes: parseStr(r.notes),
      });
    }
    if (lpRows.length) { result.sheetsImported.push("liq_preferences"); result.totalRecords += lpRows.length; }

    // ── 13. Anti-Dilution Provisions ────────────────────────────────────
    const adRows = getSheetRows("anti_dilution");
    for (const r of adRows) {
      await db.insert(antiDilutionProvisions).values({
        companyId,
        shareholderId: mapId(shareholderMap, r.shareholderId) || 0,
        fundingRoundId: mapId(roundMap, r.fundingRoundId) || 0,
        provisionType: r.provisionType || "broad_based_wa",
        originalPriceNtd: parseStr(r.originalPriceNtd) || "0",
        adjustedPriceNtd: parseStr(r.adjustedPriceNtd),
        originalShares: parseNum(r.originalShares) || 0,
        adjustedShares: parseNum(r.adjustedShares),
        triggerRoundId: mapId(roundMap, r.triggerRoundId),
        status: r.status || "active",
        notes: parseStr(r.notes),
      });
    }
    if (adRows.length) { result.sheetsImported.push("anti_dilution"); result.totalRecords += adRows.length; }

    // ── 14. 409A Valuations ─────────────────────────────────────────────
    const v409Rows = getSheetRows("valuations_409a");
    for (const r of v409Rows) {
      await db.insert(valuations409a).values({
        companyId,
        valuationDate: (parseDate(r.valuationDate) as string) || new Date().toISOString().slice(0, 10),
        expiryDate: parseDate(r.expiryDate) as any,
        status: r.status || "active",
        fmvPerShare: parseStr(r.fmvPerShare),
        currency: parseStr(r.currency) || "USD",
        fmvPerShareNtd: parseStr(r.fmvPerShareNtd),
        fmvPerShareUsd: parseStr(r.fmvPerShareUsd),
        commonStockValueNtd: parseStr(r.commonStockValueNtd),
        preferredStockValueNtd: parseStr(r.preferredStockValueNtd),
        totalCompanyValueNtd: parseStr(r.totalCompanyValueNtd),
        valuationFirm: parseStr(r.valuationFirm),
        reportUrl: parseStr(r.reportUrl),
        method: r.method || "dcf",
        relatedRoundId: mapId(roundMap, r.relatedRoundId),
        notes: parseStr(r.notes),
      });
    }
    if (v409Rows.length) { result.sheetsImported.push("valuations_409a"); result.totalRecords += v409Rows.length; }

    // ── 15. 83(b) Elections ─────────────────────────────────────────────
    const e83Rows = getSheetRows("elections_83b");
    for (const r of e83Rows) {
      await db.insert(elections83b).values({
        companyId,
        grantId: mapId(grantMap, r.grantId),
        recipientName: parseStr(r.recipientName) || "Unknown",
        recipientEmail: parseStr(r.recipientEmail),
        grantDate: (parseDate(r.grantDate) as string) || new Date().toISOString().slice(0, 10),
        filingDeadline: (parseDate(r.filingDeadline) as string) || new Date().toISOString().slice(0, 10),
        sharesSubject: parseNum(r.sharesSubject) || 0,
        fmvPerShare: parseStr(r.fmvPerShare),
        amountPaid: parseStr(r.amountPaid),
        currency: parseStr(r.currency) || "USD",
        propertyDescription: parseStr(r.propertyDescription),
        status: r.status || "pending",
        filedDate: parseDate(r.filedDate) as any,
        irsConfirmationDate: parseDate(r.irsConfirmationDate) as any,
        employerCopyDate: parseDate(r.employerCopyDate) as any,
        notes: parseStr(r.notes),
      });
    }
    if (e83Rows.length) { result.sheetsImported.push("elections_83b"); result.totalRecords += e83Rows.length; }

    // ── 16. Financial Projections ────────────────────────────────────────
    const fpRows = getSheetRows("fin_projections");
    for (const r of fpRows) {
      const oldId = parseNum(r.id);
      const [created] = await db.insert(financialProjections).values({
        companyId,
        name: parseStr(r.name) || "Projection",
        startYear: parseNum(r.startYear) || new Date().getFullYear(),
        years: parseNum(r.years) || 5,
        assumptions: parseJson(r.assumptions) || {},
      }).returning();
      if (oldId) projectionMap.set(oldId, created.id);
    }
    if (fpRows.length) { result.sheetsImported.push("fin_projections"); result.totalRecords += fpRows.length; }

    // ── 17. Projection Scenarios ─────────────────────────────────────────
    const psRows = getSheetRows("proj_scenarios");
    for (const r of psRows) {
      const projId = mapId(projectionMap, r.projectionId);
      if (!projId) continue;
      await db.insert(projectionScenarios).values({
        projectionId: projId,
        companyId,
        name: parseStr(r.name) || "Scenario",
        description: parseStr(r.description),
        assumptions: parseJson(r.assumptions) || {},
        isBaseline: parseBool(r.isBaseline),
      });
    }
    if (psRows.length) { result.sheetsImported.push("proj_scenarios"); result.totalRecords += psRows.length; }

    // ── 18. DCF Scenarios ────────────────────────────────────────────────
    const dcfRows = getSheetRows("dcf_scenarios");
    for (const r of dcfRows) {
      const projId = mapId(projectionMap, r.projectionId);
      if (!projId) continue;
      await db.insert(dcfScenarios).values({
        projectionId: projId,
        companyId,
        name: parseStr(r.name) || "DCF",
        discountRate: parseStr(r.discountRate) || "0.10",
        terminalGrowth: parseStr(r.terminalGrowth) || "0.02",
        netDebt: parseStr(r.netDebt) || "0",
        cash: parseStr(r.cash) || "0",
        targetRaise: parseStr(r.targetRaise),
        targetPreMoney: parseStr(r.targetPreMoney),
      });
    }
    if (dcfRows.length) { result.sheetsImported.push("dcf_scenarios"); result.totalRecords += dcfRows.length; }

    // ── 19. Comps Peers ──────────────────────────────────────────────────
    const cpRows = getSheetRows("comps_peers");
    for (const r of cpRows) {
      await db.insert(compsPeers).values({
        companyId,
        groupName: parseStr(r.groupName) || "Default",
        name: parseStr(r.name) || "Peer",
        ticker: parseStr(r.ticker),
        revenue: parseStr(r.revenue) || "0",
        ebitda: parseStr(r.ebitda) || "0",
        netIncome: parseStr(r.netIncome) || "0",
        marketCap: parseStr(r.marketCap) || "0",
        netDebt: parseStr(r.netDebt) || "0",
        sharesOutstanding: parseStr(r.sharesOutstanding),
      });
    }
    if (cpRows.length) { result.sheetsImported.push("comps_peers"); result.totalRecords += cpRows.length; }

    // ── 20. Angel Tax Deductions ─────────────────────────────────────────
    const atRows = getSheetRows("angel_tax");
    for (const r of atRows) {
      await db.insert(angelTaxDeductions).values({
        companyId,
        investorId: mapId(investorMap, r.investorId),
        investorName: parseStr(r.investorName) || "Unknown",
        roundName: parseStr(r.roundName),
        investmentDate: (parseDate(r.investmentDate) as string) || new Date().toISOString().slice(0, 10),
        investmentAmountNtd: parseStr(r.investmentAmountNtd) || "0",
        sharesAcquired: parseNum(r.sharesAcquired) || 0,
        pricePerShareNtd: parseStr(r.pricePerShareNtd),
        isEligible: parseBool(r.isEligible),
        ineligibleReason: r.ineligibleReason || null,
        lockupYears: parseNum(r.lockupYears) ?? 2,
        lockupEndDate: parseDate(r.lockupEndDate) as any,
        taxFilingYear: parseNum(r.taxFilingYear),
        deductionRate: parseStr(r.deductionRate) || "0.50",
        maxDeductionNtd: parseStr(r.maxDeductionNtd),
        status: r.status || "pending",
        filingDate: parseDate(r.filingDate) as any,
        filingReference: parseStr(r.filingReference),
        notes: parseStr(r.notes),
      });
    }
    if (atRows.length) { result.sheetsImported.push("angel_tax"); result.totalRecords += atRows.length; }

    // ── 21. Tech Share Tax Records ───────────────────────────────────────
    const tsRows = getSheetRows("tech_share_tax");
    for (const r of tsRows) {
      await db.insert(techShareTaxRecords).values({
        companyId,
        grantId: parseNum(r.grantId),
        holderName: parseStr(r.holderName) || parseStr(r.holder_name) || "Unknown",
        shareType: r.shareType || r.share_type || "tech_share",
        acquisitionDate: (parseDate(r.acquisitionDate) || parseDate(r.acquisition_date) || new Date().toISOString().slice(0, 10)) as any,
        sharesAcquired: parseNum(r.sharesAcquired) || parseNum(r.shares_acquired) || 0,
        acquisitionFmv: parseStr(r.acquisitionFmv) || parseStr(r.acquisition_fmv),
        paidAmount: parseStr(r.paidAmount) || parseStr(r.paid_amount),
        isDeferralEligible: parseBool(r.isDeferralEligible || r.is_deferral_eligible),
        deferralStartDate: (parseDate(r.deferralStartDate) || parseDate(r.deferral_start_date)) as any,
        deferralExpiryDate: (parseDate(r.deferralExpiryDate) || parseDate(r.deferral_expiry_date)) as any,
        holdingPeriodMet: parseBool(r.holdingPeriodMet || r.holding_period_met),
        vestingDate: (parseDate(r.vestingDate) || parseDate(r.vesting_date)) as any,
        vestingFmv: parseStr(r.vestingFmv) || parseStr(r.vesting_fmv),
        dispositionDate: (parseDate(r.dispositionDate) || parseDate(r.disposition_date)) as any,
        dispositionFmv: parseStr(r.dispositionFmv) || parseStr(r.disposition_fmv),
        dispositionType: r.dispositionType || r.disposition_type || null,
        taxableIncome: parseStr(r.taxableIncome) || parseStr(r.taxable_income),
        estimatedTax: parseStr(r.estimatedTax) || parseStr(r.estimated_tax),
        taxStatus: r.taxStatus || r.tax_status || "deferred",
        filingDeadline: (parseDate(r.filingDeadline) || parseDate(r.filing_deadline)) as any,
        filingDate: (parseDate(r.filingDate) || parseDate(r.filing_date)) as any,
        filingReference: parseStr(r.filingReference) || parseStr(r.filing_reference),
        notes: parseStr(r.notes),
      });
    }
    if (tsRows.length) { result.sheetsImported.push("tech_share_tax"); result.totalRecords += tsRows.length; }

    // ── 22. Closed Company Provisions ────────────────────────────────────
    const ccpRows = getSheetRows("closed_co_provs");
    for (const r of ccpRows) {
      await db.insert(closedCompanyProvisions).values({
        companyId,
        isClosedCompany: parseBool(r.isClosedCompany || r.is_closed_company),
        parValueType: r.parValueType || r.par_value_type || "par",
        transferRestriction: r.transferRestriction || r.transfer_restriction || "none",
        transferDescription: parseStr(r.transferDescription) || parseStr(r.transfer_description),
        articlesUrl: parseStr(r.articlesUrl) || parseStr(r.articles_url),
        effectiveDate: (parseDate(r.effectiveDate) || parseDate(r.effective_date)) as any,
        notes: parseStr(r.notes),
      });
    }
    if (ccpRows.length) { result.sheetsImported.push("closed_co_provs"); result.totalRecords += ccpRows.length; }

    // ── 23. Closed Company Share Rights ──────────────────────────────────
    const ccrRows = getSheetRows("closed_co_rights");
    for (const r of ccrRows) {
      await db.insert(closedCompanyShareRights).values({
        companyId,
        shareClassId: mapId(classMap, r.shareClassId) || mapId(classMap, r.share_class_id),
        shareClassName: parseStr(r.shareClassName) || parseStr(r.share_class_name) || "Unknown",
        votesPerShare: parseStr(r.votesPerShare) || parseStr(r.votes_per_share) || "1.00",
        hasVetoRight: parseBool(r.hasVetoRight || r.has_veto_right),
        vetoMatters: parseStr(r.vetoMatters) || parseStr(r.veto_matters),
        guaranteedBoardSeats: parseNum(r.guaranteedBoardSeats) || parseNum(r.guaranteed_board_seats) || 0,
        boardObserverRights: parseBool(r.boardObserverRights || r.board_observer_rights),
        dividendPriority: r.dividendPriority || r.dividend_priority || "none",
        dividendRate: parseStr(r.dividendRate) || parseStr(r.dividend_rate),
        liquidationPriority: parseNum(r.liquidationPriority) || parseNum(r.liquidation_priority) || 1,
        liquidationMultiple: parseStr(r.liquidationMultiple) || parseStr(r.liquidation_multiple) || "1.00",
        isConvertible: parseBool(r.isConvertible || r.is_convertible),
        conversionRatio: parseStr(r.conversionRatio) || parseStr(r.conversion_ratio),
        conversionTrigger: parseStr(r.conversionTrigger) || parseStr(r.conversion_trigger),
        customProvisions: parseStr(r.customProvisions) || parseStr(r.custom_provisions),
        notes: parseStr(r.notes),
      });
    }
    if (ccrRows.length) { result.sheetsImported.push("closed_co_rights"); result.totalRecords += ccrRows.length; }

    // ── 24. Notifications ────────────────────────────────────────────────
    const notifRows = getSheetRows("notifications");
    for (const r of notifRows) {
      await db.insert(notifications).values({
        companyId,
        userId,
        type: r.type || "general",
        title: parseStr(r.title) || "Notification",
        message: parseStr(r.message),
        channel: r.channel || "both",
        isRead: parseBool(r.isRead || r.is_read),
        emailSent: parseBool(r.emailSent || r.email_sent),
        linkUrl: parseStr(r.linkUrl) || parseStr(r.link_url),
        metadata: parseStr(r.metadata),
      });
    }
    if (notifRows.length) { result.sheetsImported.push("notifications"); result.totalRecords += notifRows.length; }

    // ── Legacy Tables ────────────────────────────────────────────────────
    // Holdings
    const lhRows = getSheetRows("legacy_holdings");
    for (const r of lhRows) {
      await db.insert(shareHoldings).values({
        companyId,
        shareholderId: mapId(shareholderMap, r.shareholderId) || 0,
        fundingRoundId: mapId(roundMap, r.fundingRoundId) || 0,
        commonShares: parseNum(r.commonShares) ?? 0,
        seedShares: parseNum(r.seedShares) ?? 0,
        seedPlusShares: parseNum(r.seedPlusShares) ?? 0,
        preAShares: parseNum(r.preAShares) ?? 0,
        bridgeShares: parseNum(r.bridgeShares) ?? 0,
        seriesAShares: parseNum(r.seriesAShares) ?? 0,
        esopShares: parseNum(r.esopShares) ?? 0,
        totalShares: parseNum(r.totalShares) ?? 0,
        ownershipPct: parseStr(r.ownershipPct),
        paidInCapitalNtd: parseStr(r.paidInCapitalNtd),
        investmentDate: parseDate(r.investmentDate) as any,
      });
    }
    if (lhRows.length) { result.sheetsImported.push("legacy_holdings"); result.totalRecords += lhRows.length; }

    // Transactions
    const ltRows = getSheetRows("legacy_txns");
    for (const r of ltRows) {
      await db.insert(shareTransactions).values({
        companyId,
        shareholderId: mapId(shareholderMap, r.shareholderId) || 0,
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        transactionType: r.transactionType || "issuance",
        shareClass: r.shareClass || "common",
        sharesAmount: parseNum(r.sharesAmount) || 0,
        pricePerShareNtd: parseStr(r.pricePerShareNtd),
        totalAmountNtd: parseStr(r.totalAmountNtd),
        taxQualified: parseBool(r.taxQualified),
        taxCapNtd: parseStr(r.taxCapNtd),
        lockUpEndDate: parseDate(r.lockUpEndDate) as any,
        taxDeductionYear: parseNum(r.taxDeductionYear),
        taxDeductionAmountNtd: parseStr(r.taxDeductionAmountNtd),
        notes: parseStr(r.notes),
      });
    }
    if (ltRows.length) { result.sheetsImported.push("legacy_txns"); result.totalRecords += ltRows.length; }

    // Legacy ESOP Pool
    const lepRows = getSheetRows("legacy_esop_pool");
    for (const r of lepRows) {
      await db.insert(esopPool).values({
        companyId,
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        poolName: parseStr(r.poolName) || "ESOP Pool",
        totalShares: parseNum(r.totalShares) || 0,
        allocatedShares: parseNum(r.allocatedShares) ?? 0,
        vestedShares: parseNum(r.vestedShares) ?? 0,
        exercisedShares: parseNum(r.exercisedShares) ?? 0,
        cancelledShares: parseNum(r.cancelledShares) ?? 0,
        notes: parseStr(r.notes),
      });
    }
    if (lepRows.length) { result.sheetsImported.push("legacy_esop_pool"); result.totalRecords += lepRows.length; }

    // Legacy ESOP Grants
    const legRows = getSheetRows("legacy_esop_grants");
    for (const r of legRows) {
      await db.insert(esopGrants).values({
        companyId,
        esopPoolId: parseNum(r.esopPoolId) || 0,
        shareholderId: mapId(shareholderMap, r.shareholderId),
        granteeName: parseStr(r.granteeName),
        grantDate: parseDate(r.grantDate) as any,
        sharesGranted: parseNum(r.sharesGranted) || 0,
        sharesVested: parseNum(r.sharesVested) ?? 0,
        sharesExercised: parseNum(r.sharesExercised) ?? 0,
        sharesCancelled: parseNum(r.sharesCancelled) ?? 0,
        exercisePriceNtd: parseStr(r.exercisePriceNtd),
        vestingStartDate: parseDate(r.vestingStartDate) as any,
        vestingCliffMonths: parseNum(r.vestingCliffMonths) ?? 12,
        vestingTotalMonths: parseNum(r.vestingTotalMonths) ?? 48,
        status: r.status || "active",
        expiryDate: parseDate(r.expiryDate) as any,
        notes: parseStr(r.notes),
      });
    }
    if (legRows.length) { result.sheetsImported.push("legacy_esop_grants"); result.totalRecords += legRows.length; }

    // Legacy Valuation Projections
    const lvpRows = getSheetRows("legacy_val_proj");
    for (const r of lvpRows) {
      await db.insert(valuationProjections).values({
        companyId,
        name: parseStr(r.name) || "Projection",
        projectionDate: parseDate(r.projectionDate) as any,
        pricePerShareNtd: parseStr(r.pricePerShareNtd),
        targetRaiseNtd: parseStr(r.targetRaiseNtd),
        preMoneyValuationNtd: parseStr(r.preMoneyValuationNtd),
        postMoneyValuationNtd: parseStr(r.postMoneyValuationNtd),
        newSharesIssued: parseNum(r.newSharesIssued),
        exchangeRate: parseStr(r.exchangeRate),
        scenario: r.scenario || "base",
        notes: parseStr(r.notes),
      });
    }
    if (lvpRows.length) { result.sheetsImported.push("legacy_val_proj"); result.totalRecords += lvpRows.length; }

    // Legacy Snapshots
    const lsRows = getSheetRows("legacy_snapshots");
    for (const r of lsRows) {
      await db.insert(capTableSnapshots).values({
        companyId,
        name: parseStr(r.name) || "Snapshot",
        description: parseStr(r.description),
        snapshotDate: parseDate(r.snapshotDate) as any || new Date(),
        triggerEvent: parseStr(r.triggerEvent),
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        totalShares: parseNum(r.totalShares) ?? 0,
        totalShareholders: parseNum(r.totalShareholders) ?? 0,
        esopPoolTotal: parseNum(r.esopPoolTotal) ?? 0,
        esopAllocated: parseNum(r.esopAllocated) ?? 0,
        postMoneyValuationNtd: parseStr(r.postMoneyValuationNtd),
        snapshotData: parseStr(r.snapshotData),
      });
    }
    if (lsRows.length) { result.sheetsImported.push("legacy_snapshots"); result.totalRecords += lsRows.length; }

    // Legacy Shareholder Documents
    const ldRows = getSheetRows("legacy_docs");
    for (const r of ldRows) {
      await db.insert(shareholderDocuments).values({
        companyId,
        shareholderId: mapId(shareholderMap, r.shareholderId) || 0,
        documentType: r.documentType || "other",
        documentName: parseStr(r.documentName) || "Document",
        status: r.status || "pending",
        signedDate: parseDate(r.signedDate) as any,
        expiryDate: parseDate(r.expiryDate) as any,
        fundingRoundId: mapId(roundMap, r.fundingRoundId),
        fileUrl: parseStr(r.fileUrl),
        notes: parseStr(r.notes),
      });
    }
    if (ldRows.length) { result.sheetsImported.push("legacy_docs"); result.totalRecords += ldRows.length; }

  } catch (err: any) {
    result.success = false;
    result.errors.push(err.message || String(err));
  }

  return result;
}
