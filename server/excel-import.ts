import * as XLSX from "xlsx";
import {
  createShareholder, createFundingRound, upsertShareHolding,
  createTransaction, createEsopPool, getAllShareholders,
  getAllFundingRounds, updateImportLog, createImportLog
} from "./db";

export interface ImportResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
}

// Map round name to type
function mapRoundToType(roundName: string): "founder" | "angel" | "seed" | "seed_plus" | "pre_a" | "bridge" | "series_a" | "pre_b" | "series_b" | "pre_c" | "series_c" | "esop" | "other" {
  const n = roundName.toLowerCase();
  if (n.includes("founder")) return "founder";
  if (n.includes("angel")) return "angel";
  if (n.includes("seed+") || n.includes("seed plus") || n.includes("seed_plus")) return "seed_plus";
  if (n.includes("seed")) return "seed";
  if (n.includes("pre-a") || n.includes("pre_a") || n.includes("prea")) return "pre_a";
  if (n.includes("bridge")) return "bridge";
  if (n.includes("series a") || n.includes("series_a") || n === "a") return "series_a";
  if (n.includes("pre-b") || n.includes("pre_b") || n.includes("preb")) return "pre_b";
  if (n.includes("series b") || n.includes("series_b") || n === "b") return "series_b";
  if (n.includes("pre-c") || n.includes("pre_c") || n.includes("prec")) return "pre_c";
  if (n.includes("series c") || n.includes("series_c") || n === "c") return "series_c";
  if (n.includes("esop")) return "esop";
  return "other";
}

// Parse the Register of Shareholders sheet
async function importRegisterSheet(
  ws: XLSX.WorkSheet,
  errors: string[],
  companyId: number,
): Promise<{ shareholderMap: Map<string, number>, count: number }> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const shareholderMap = new Map<string, number>(); // name -> db id
  let count = 0;

  // Find the header row - look for rows with shareholder data
  // Register sheet structure: rows 1-14 are shareholder list, rows 17+ are transaction details
  const existingShareholders = await getAllShareholders(companyId);
  for (const sh of existingShareholders) {
    shareholderMap.set(sh.name, sh.id);
    if (sh.aka) shareholderMap.set(sh.aka, sh.id);
  }

  // Parse shareholder rows (rows 1-13 in the sheet, 0-indexed)
  for (let i = 1; i <= 13; i++) {
    const row = data[i] as unknown[];
    if (!row || !row[1]) continue;
    const name = String(row[1]).trim();
    const aka = row[2] ? String(row[2]).trim() : undefined;
    if (!name || name === "Total") continue;

    if (!shareholderMap.has(name)) {
      try {
        const isEntity = name.includes("股份有限公司") || name.includes("國際") || name.includes("實業");
        await createShareholder({ companyId, name, aka, type: "other", isEntity });
        // Re-fetch to get ID
        const updated = await getAllShareholders(companyId);
        const found = updated.find(s => s.name === name);
        if (found) {
          shareholderMap.set(name, found.id);
          if (aka) shareholderMap.set(aka, found.id);
          count++;
        }
      } catch (e) {
        errors.push(`Failed to create shareholder ${name}: ${e}`);
      }
    }
  }

  // Parse transaction rows (rows 17+ in the sheet)
  const fundingRoundsDb = await getAllFundingRounds(companyId);
  const roundMap = new Map(fundingRoundsDb.map(r => [r.name, r.id]));
  void roundMap; // available for future use

  for (let i = 17; i < data.length; i++) {
    const row = data[i] as unknown[] | undefined;
    if (!row || !row[2]) continue;
    const name = String(row[2]).trim();
    const aka = row[3] ? String(row[3]).trim() : undefined;
    if (!name) continue;

    const sharesAmount = Number(row[4]) || 0;
    const paidIn = Number(row[5]) || 0;
    const lockUpRaw = row[7];
    const lockUpStr = lockUpRaw instanceof Date ? lockUpRaw.toISOString() : (lockUpRaw ? String(lockUpRaw) : null);
    const taxYear = row[9] ? Number(row[9]) : null;
    const taxAmount = row[10] ? Number(row[10]) : null;
    const taxCapStr = row[6] ? String(row[6]) : null;
    const taxQualified = taxCapStr ? !taxCapStr.includes("不適用") : false;

    let lockUpEndDate: string | undefined = undefined;
    if (lockUpStr) {
      try {
        const d = new Date(lockUpStr);
        if (!isNaN(d.getTime())) lockUpEndDate = d.toISOString().split('T')[0];
      } catch { /* ignore */ }
    }

    const shareholderId = shareholderMap.get(name) || shareholderMap.get(aka || "");
    if (!shareholderId || !sharesAmount) continue;

    try {
      const txData: any = {
        companyId,
        shareholderId,
        transactionType: "issuance",
        shareClass: "common",
        sharesAmount,
        totalAmountNtd: String(paidIn),
        taxQualified,
        taxDeductionYear: taxYear || undefined,
        taxDeductionAmountNtd: taxAmount ? String(taxAmount) : undefined,
      };
      if (lockUpEndDate) txData.lockUpEndDate = lockUpEndDate;
      await createTransaction(txData);
      count++;
    } catch (e) {
      errors.push(`Failed to create transaction for ${name}: ${e}`);
    }
  }

  return { shareholderMap, count };
}

// Parse Cap Table sheet (with or without ESOP)
async function importCapTableSheet(
  ws: XLSX.WorkSheet,
  withEsop: boolean,
  shareholderMap: Map<string, number>,
  errors: string[],
  companyId: number,
): Promise<number> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  let count = 0;

  // Row 0: round dates/names
  // Row 1: column headers
  // Row 3: price per share
  // Row 4: money raised
  // Row 5: post-money valuation
  // Rows 6+: shareholder data

  const headerRow = (data[0] as unknown[] | undefined) || [];
  const roundNames: string[] = [];
  const roundColIndices: number[] = [];

  // Find round columns (every 6 columns starting from col 3)
  for (let c = 3; c < (headerRow?.length || 0); c++) {
    const val = headerRow[c];
    if (val && String(val).match(/\d{4}\.\d{2}\.\d{2}/)) {
      roundNames.push(String(val));
      roundColIndices.push(c);
    }
  }

  // Ensure funding rounds exist in DB
  const existingRounds = await getAllFundingRounds(companyId);
  const roundDbMap = new Map(existingRounds.map(r => [r.name, r]));

  const roundLabelRow = (data[0] as unknown[] | undefined) || [];
  const priceRow = (data[3] as unknown[] | undefined) || [];
  const moneyRow = (data[4] as unknown[] | undefined) || [];
  const postMoneyRow = (data[5] as unknown[] | undefined) || [];

  // Create funding rounds if they don't exist
  const roundColToId = new Map<number, number>();
  for (let ri = 0; ri < roundColIndices.length; ri++) {
    const col = roundColIndices[ri];
    const rawName = String(roundLabelRow[col] || "");
    // Extract round label like "2023.7.31 - Angel"
    const parts = rawName.split(" - ");
    const roundLabel = parts.length > 1 ? parts[1] : rawName;
    const roundDate = parts[0] ? parts[0].replace(/\./g, "-") : null;

    const price = priceRow ? Number(priceRow[col + 1]) || null : null;
    const moneyRaised = moneyRow ? Number(moneyRow[col + 1]) || null : null;
    const postMoney = postMoneyRow ? Number(postMoneyRow[col + 1]) || null : null;

    if (!roundDbMap.has(roundLabel)) {
      try {
        await createFundingRound({
          companyId,
          name: roundLabel,
          roundDate: roundDate ?? undefined,
          pricePerShareNtd: price ? String(price) : undefined,
          moneyRaisedNtd: moneyRaised ? String(moneyRaised) : undefined,
          postMoneyValuationNtd: postMoney ? String(postMoney) : undefined,
          status: "completed",
          sortOrder: ri,
          exchangeRate: "0.0312793",
        });
        const updated = await getAllFundingRounds(companyId);
        const found = updated.find(r => r.name === roundLabel);
        if (found) { roundDbMap.set(roundLabel, found); roundColToId.set(col, found.id); count++; }
      } catch (e) {
        errors.push(`Failed to create round ${roundLabel}: ${e}`);
      }
    } else {
      const existing = roundDbMap.get(roundLabel)!;
      roundColToId.set(col, existing.id);
    }
  }

  // Parse shareholder rows (rows 6 to ~15)
  for (let i = 6; i < Math.min(data.length, 20); i++) {
    const row = (data[i] as unknown[] | undefined);
    if (!row || !row[1]) continue;
    const name = String(row[1]).trim();
    const aka = row[2] ? String(row[2]).trim() : undefined;
    if (!name || name === "Total" || name === "") continue;

    // Update shareholder type based on round column
    const roundTypeStr = row[0] ? String(row[0]).trim() : "";
    const shType = mapRoundToType(roundTypeStr || name);

    let shareholderId = shareholderMap.get(name) || shareholderMap.get(aka || "");
    if (!shareholderId) {
      try {
        const isEntity = name.includes("股份有限公司") || name.includes("國際") || name.includes("實業");
        await createShareholder({ companyId, name, aka, type: shType, isEntity });
        const updated = await getAllShareholders(companyId);
        const found = updated.find(s => s.name === name);
        if (found) {
          shareholderId = found.id;
          shareholderMap.set(name, found.id);
          if (aka) shareholderMap.set(aka, found.id);
        }
      } catch { /* already exists */ }
    }
    if (!shareholderId) continue;

    // For the last round column, record the holdings
    const lastRoundCol = roundColIndices[roundColIndices.length - 1];
    const lastRoundId = roundColToId.get(lastRoundCol);
    if (!lastRoundId) continue;

    const totalShares = Number(row[lastRoundCol + 2]) || 0;
    const ownershipPct = Number(row[lastRoundCol + 3]) || 0;
    const paidIn = Number(row[lastRoundCol + 1]) || 0;

    if (totalShares > 0) {
      try {
        await upsertShareHolding({
          companyId,
          shareholderId,
          fundingRoundId: lastRoundId,
          totalShares,
          ownershipPct: String(ownershipPct),
          paidInCapitalNtd: paidIn ? String(paidIn) : undefined,
          commonShares: Number(row[3]) || 0,
          seedShares: 0,
          seedPlusShares: 0,
          preAShares: 0,
          bridgeShares: 0,
          seriesAShares: 0,
          esopShares: name === "ESOP" ? totalShares : 0,
        });
        count++;
      } catch (e) {
        errors.push(`Failed to create holding for ${name}: ${e}`);
      }
    }
  }

  // Handle ESOP pool if present
  if (withEsop) {
    const esopRow = data.find(r => {
      const row = r as unknown[];
      return row && String(row[1] || "").includes("ESOP");
    }) as unknown[] | undefined;
    if (esopRow) {
      const lastRoundCol = roundColIndices[roundColIndices.length - 1];
      const esopShares = Number(esopRow[lastRoundCol + 2]) || 0;
      if (esopShares > 0) {
        try {
          const existingPools = await getAllFundingRounds(companyId);
          const lastRound = existingPools[existingPools.length - 1];
          await createEsopPool({
            companyId,
            totalShares: esopShares,
            allocatedShares: 0,
            poolName: "ESOP Pool",
            fundingRoundId: lastRound?.id,
          });
          count++;
        } catch { /* pool may already exist */ }
      }
    }
  }

  return count;
}

// Parse Projection sheet
async function importProjectionSheet(
  ws: XLSX.WorkSheet,
  errors: string[],
  companyId: number,
): Promise<number> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  let count = 0;

  // Look for Bridge and A round columns
  const headerRow = (data[0] as unknown[] | undefined) || [];
  for (let c = 0; c < (headerRow?.length || 0); c++) {
    const val = String(headerRow[c] || "");
    if (val.includes("Bridge") || val.includes("A (Target)") || val.includes("A round")) {
      const parts = val.split(" - ");
      const name = parts.length > 1 ? parts[1] : val;
      const dateStr = parts[0] ? parts[0].replace(/\./g, "-") : null;

      const priceRow = (data[3] as unknown[] | undefined) || [];
      const moneyRow = (data[4] as unknown[] | undefined) || [];
      const postMoneyRow = (data[5] as unknown[] | undefined) || [];

      const price = priceRow ? Number(priceRow[c + 1]) || null : null;
      const moneyRaised = moneyRow ? Number(moneyRow[c + 1]) || null : null;
      const postMoney = postMoneyRow ? Number(postMoneyRow[c + 1]) || null : null;

      if (price || moneyRaised) {
        try {
          const { createProjection } = await import("./db");
          await createProjection({
            companyId,
            name,
            projectionDate: dateStr ?? undefined,
            pricePerShareNtd: price ? String(price) : undefined,
            targetRaiseNtd: moneyRaised ? String(moneyRaised) : undefined,
            postMoneyValuationNtd: postMoney ? String(postMoney) : undefined,
            exchangeRate: "0.0312793",
            scenario: "base",
          });
          count++;
        } catch (e) {
          errors.push(`Failed to create projection ${name}: ${e}`);
        }
      }
    }
  }

  return count;
}

// Main import function
export async function importExcelFile(buffer: Buffer, fileName: string, companyId: number): Promise<ImportResult> {
  const errors: string[] = [];
  let totalImported = 0;

  // Create import log
  let logId: number | undefined;
  try {
    const result = await createImportLog({ companyId, fileName, status: "processing" });
    // createImportLog returns an array of { id }
    if (Array.isArray(result) && result[0]?.id != null) {
      logId = Number(result[0].id);
    }
  } catch { /* ignore */ }

  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // 1. Import Register of Shareholders
    const registerSheet = workbook.Sheets["Register of shareholders"];
    if (registerSheet) {
      const { shareholderMap, count } = await importRegisterSheet(registerSheet, errors, companyId);
      totalImported += count;

      // 2. Import Cap Table (without ESOP)
      const capTableSheet = workbook.Sheets["Cap Table"];
      if (capTableSheet) {
        const c = await importCapTableSheet(capTableSheet, false, shareholderMap, errors, companyId);
        totalImported += c;
      }

      // 3. Import Cap Table with ESOP
      const capTableEsopSheet = workbook.Sheets["Cap Table w ESOP"];
      if (capTableEsopSheet) {
        const c = await importCapTableSheet(capTableEsopSheet, true, shareholderMap, errors, companyId);
        totalImported += c;
      }

      // 4. Import Projections
      const projectionSheet = workbook.Sheets["Projection Bridge"];
      if (projectionSheet) {
        const c = await importProjectionSheet(projectionSheet, errors, companyId);
        totalImported += c;
      }
    }

    if (logId) {
      await updateImportLog(companyId, logId, { status: "completed", recordsImported: totalImported });
    }

    return { success: true, recordsImported: totalImported, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Import failed: ${msg}`);
    if (logId) {
      await updateImportLog(companyId, logId, { status: "failed", errorMessage: msg });
    }
    return { success: false, recordsImported: totalImported, errors };
  }
}
