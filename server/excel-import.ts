import * as XLSX from "xlsx";
import { eq, and } from "drizzle-orm";
import {
  // Legacy (kept for any remaining consumers — writes are harmless)
  createShareholder, createFundingRound, upsertShareHolding,
  createTransaction, getAllShareholders,
  getAllFundingRounds, updateImportLog, createImportLog,
  createProjection,
  // V1 (what Cap Table / Dashboard actually read)
  createInvestor, getAllInvestors,
  createEsopPoolV1,
  getDb, resolveCompanyDek,
} from "./db";
import { encryptField } from "./encryption";
import {
  shareRegisterEntries,
  snapshots as snapshotsV1,
} from "../drizzle/schema";
import { deriveCapTable } from "./v1/capTable";

export interface ImportResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
}

// Map round name to type (legacy shareholder_type enum)
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

// Entity-name heuristic shared across sheets
function looksLikeEntity(name: string): boolean {
  return name.includes("股份有限公司") || name.includes("國際") || name.includes("實業")
    || /\b(Inc|Ltd|LLC|Corp|Co\.?|Company)\b/i.test(name);
}

// ─── Import helpers for V1 investors ────────────────────────────────────────

type NameMap = Map<string, number>;                       // name / aka → V1 investors.id

async function ensureV1Investor(
  companyId: number,
  name: string,
  aka: string | undefined,
  investorMap: NameMap,
): Promise<number | null> {
  // IMPORTANT: we key the map by **name only**. Several distinct shareholders
  // can legitimately share the same aka (e.g. two "XX股份有限公司" entities
  // both abbreviated "XX"), so aka-based lookup would merge them.
  const hit = investorMap.get(name);
  if (hit) return hit;

  try {
    const created = await createInvestor({
      companyId,
      name,
      aka: aka ?? null,
      entityKind: looksLikeEntity(name) ? "entity" : "individual",
      status: "invested",
    });
    investorMap.set(name, created.id);
    return created.id;
  } catch {
    // Fallback: re-scan after a (possibly concurrent) create
    const all = await getAllInvestors(companyId);
    const found = all.find(i => i.name === name);
    if (found) {
      investorMap.set(name, found.id);
      return found.id;
    }
    return null;
  }
}

async function seedV1InvestorMap(companyId: number): Promise<NameMap> {
  const existing = await getAllInvestors(companyId);
  const m: NameMap = new Map();
  for (const inv of existing) m.set(inv.name, inv.id);
  return m;
}

// ─── Register sheet — directory pass ────────────────────────────────────────
// Creates V1 investors + legacy shareholders from rows 1-13. Does NOT write
// register entries — those are written in a separate pass after funding
// rounds exist (so entries can be linked to the right round).
async function seedDirectoryFromRegisterSheet(
  ws: XLSX.WorkSheet,
  errors: string[],
  companyId: number,
): Promise<{ shareholderMap: Map<string, number>, investorMap: NameMap, count: number }> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const shareholderMap = new Map<string, number>();
  const investorMap = await seedV1InvestorMap(companyId);
  let count = 0;

  const existingShareholders = await getAllShareholders(companyId);
  for (const sh of existingShareholders) {
    shareholderMap.set(sh.name, sh.id);
  }

  for (let i = 1; i <= 13; i++) {
    const row = data[i] as unknown[] | undefined;
    if (!row || !row[1]) continue;
    const name = String(row[1]).trim();
    const aka = row[2] ? String(row[2]).trim() : undefined;
    if (!name || name === "Total") continue;

    await ensureV1Investor(companyId, name, aka, investorMap);

    if (!shareholderMap.has(name)) {
      try {
        const isEntity = looksLikeEntity(name);
        await createShareholder({ companyId, name, aka, type: "other", isEntity });
        const updated = await getAllShareholders(companyId);
        const found = updated.find(s => s.name === name);
        if (found) {
          shareholderMap.set(name, found.id);
          count++;
        }
      } catch (e) {
        errors.push(`Failed to create shareholder ${name}: ${e}`);
      }
    }
  }

  return { shareholderMap, investorMap, count };
}

// ─── Register sheet — transaction pass ──────────────────────────────────────
// Reads rows 17+ and writes one V1 share_register_entries row per transaction.
// Links each entry to its funding round (looked up by col-1 name). Also writes
// a legacy share_transactions row for backwards compat.
async function writeRegisterEntriesFromSheet(
  ws: XLSX.WorkSheet,
  errors: string[],
  companyId: number,
  investorMap: NameMap,
  shareholderMap: Map<string, number>,
): Promise<number> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  let count = 0;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Build round lookup by normalized name
  const rounds = await getAllFundingRounds(companyId);
  const normalizeRoundName = (s: string) => s.toLowerCase().trim().replace(/[\s-_]+/g, "");
  const roundLookup = new Map<string, { id: number; roundDate: string | null }>();
  for (const r of rounds) {
    roundLookup.set(normalizeRoundName(r.name), { id: r.id, roundDate: r.roundDate ?? null });
  }

  for (let i = 17; i < data.length; i++) {
    const row = data[i] as unknown[] | undefined;
    if (!row || !row[2]) continue;
    const name = String(row[2]).trim();
    const aka = row[3] ? String(row[3]).trim() : undefined;
    if (!name) continue;

    const roundLabelRaw = row[1] ? String(row[1]).trim() : "";
    const sharesAmount = Number(row[4]) || 0;
    const paidIn = Number(row[5]) || 0;
    const lockUpRaw = row[7];
    const lockUpStr = lockUpRaw instanceof Date
      ? lockUpRaw.toISOString()
      : (lockUpRaw ? String(lockUpRaw) : null);
    const taxYear = row[9] ? Number(row[9]) : null;
    const taxAmount = row[10] ? Number(row[10]) : null;
    const taxCapStr = row[6] ? String(row[6]) : null;
    const taxQualified = taxCapStr ? !taxCapStr.includes("不適用") : false;

    let lockUpEndDate: string | undefined;
    if (lockUpStr) {
      try {
        const d = new Date(lockUpStr);
        if (!isNaN(d.getTime())) lockUpEndDate = d.toISOString().split("T")[0];
      } catch { /* ignore */ }
    }

    // Investors created in the directory pass may be missing for transactions
    // that reference a grantee not listed in rows 1-13; create on the fly.
    const investorId = await ensureV1Investor(companyId, name, aka, investorMap);
    if (!investorId || !sharesAmount) continue;

    // Match round by name (case-/whitespace-insensitive). Fallback = null.
    const roundMatch = roundLabelRaw
      ? roundLookup.get(normalizeRoundName(roundLabelRaw))
      : undefined;
    const effectiveDate = roundMatch?.roundDate
      ?? new Date().toISOString().slice(0, 10);

    // ── V1: share_register_entries ─────────────────────────────────────
    try {
      const pricePerShare = sharesAmount > 0 && paidIn > 0
        ? (paidIn / sharesAmount).toFixed(6)
        : null;
      const regValues: Record<string, any> = {
        companyId,
        investorId,
        eventType: "issuance",
        shareClass: "common",
        shares: sharesAmount,
        pricePerShare,
        currency: "NTD",
        fxToNtd: "1",
        totalAmount: paidIn > 0 ? String(paidIn) : null,
        effectiveDate,
        allocationId: null,
        fundingRoundId: roundMatch?.id ?? null,
        reversedEntryId: null,
        notes: `[imported from Excel Register sheet row ${i + 1}${roundLabelRaw ? " · " + roundLabelRaw : ""}]`,
      };
      // Phase 3 dual-write
      try {
        const dek = await resolveCompanyDek(companyId);
        for (const f of ["shares", "pricePerShare", "fxToNtd", "totalAmount"]) {
          if (regValues[f] != null) regValues[`${f}Enc`] = encryptField(String(regValues[f]), dek);
        }
      } catch { /* skip */ }
      await db.insert(shareRegisterEntries).values(regValues as any);
      count++;
    } catch (e) {
      errors.push(`Failed to write register entry for ${name}: ${e}`);
    }

    // ── Legacy: share_transactions (backwards compat, harmless) ────────
    const legacyShareholderId = shareholderMap.get(name);
    if (legacyShareholderId) {
      try {
        const txData: any = {
          companyId,
          shareholderId: legacyShareholderId,
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
      } catch { /* silent */ }
    }
  }

  return count;
}

// ─── Cap Table sheet (with or without ESOP) ────────────────────────────────
// This sheet is used to seed funding_rounds and to build the ESOP pool. We no
// longer write upsertShareHolding (legacy) because V1 reads from register
// entries. But we still create rounds + any missing investors/shareholders so
// the rest of the app (Rounds page, legacy tables) stays consistent.
async function importCapTableSheet(
  ws: XLSX.WorkSheet,
  withEsop: boolean,
  shareholderMap: Map<string, number>,
  investorMap: NameMap,
  errors: string[],
  companyId: number,
): Promise<number> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  let count = 0;

  const headerRow = (data[0] as unknown[] | undefined) || [];
  const roundNames: string[] = [];
  const roundColIndices: number[] = [];

  for (let c = 3; c < (headerRow?.length || 0); c++) {
    const val = headerRow[c];
    if (val && String(val).match(/\d{4}\.\d{2}\.\d{2}/)) {
      roundNames.push(String(val));
      roundColIndices.push(c);
    }
  }

  const existingRounds = await getAllFundingRounds(companyId);
  const roundDbMap = new Map(existingRounds.map(r => [r.name, r]));

  const roundLabelRow = (data[0] as unknown[] | undefined) || [];
  const priceRow = (data[3] as unknown[] | undefined) || [];
  const moneyRow = (data[4] as unknown[] | undefined) || [];
  const postMoneyRow = (data[5] as unknown[] | undefined) || [];

  // Create funding rounds if they don't exist (shared table — kept)
  const roundColToId = new Map<number, number>();
  for (let ri = 0; ri < roundColIndices.length; ri++) {
    const col = roundColIndices[ri];
    const rawName = String(roundLabelRow[col] || "");
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
        if (found) {
          roundDbMap.set(roundLabel, found);
          roundColToId.set(col, found.id);
          count++;
        }
      } catch (e) {
        errors.push(`Failed to create round ${roundLabel}: ${e}`);
      }
    } else {
      const existing = roundDbMap.get(roundLabel)!;
      roundColToId.set(col, existing.id);
    }
  }

  // Shareholder/investor rows: make sure they exist in BOTH legacy + V1.
  // NOTE: intentionally no upsertShareHolding anymore — the V1 register
  // entries (written in importRegisterSheet) are the single source of truth
  // for holdings. This sheet is for rounds/ESOP metadata only.
  for (let i = 6; i < Math.min(data.length, 20); i++) {
    const row = data[i] as unknown[] | undefined;
    if (!row || !row[1]) continue;
    const name = String(row[1]).trim();
    const aka = row[2] ? String(row[2]).trim() : undefined;
    if (!name || name === "Total" || name === "") continue;

    const roundTypeStr = row[0] ? String(row[0]).trim() : "";
    const shType = mapRoundToType(roundTypeStr || name);

    // V1
    await ensureV1Investor(companyId, name, aka, investorMap);

    // Legacy shareholders (kept for backwards compat)
    if (!shareholderMap.has(name)) {
      try {
        const isEntity = looksLikeEntity(name);
        await createShareholder({ companyId, name, aka, type: shType, isEntity });
        const updated = await getAllShareholders(companyId);
        const found = updated.find(s => s.name === name);
        if (found) shareholderMap.set(name, found.id);
      } catch { /* already exists */ }
    }
  }

  // ── ESOP pool → esop_pools_v1 (V1 table used by Cap Table + ESOP pages) ──
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
          const rounds = await getAllFundingRounds(companyId);
          const lastRound = rounds[rounds.length - 1];
          await createEsopPoolV1({
            companyId,
            name: "ESOP Pool",
            totalShares: esopShares,
            fundingRoundId: lastRound?.id ?? null,
          });
          count++;
        } catch {
          /* pool may already exist — V1 table allows multiple, so this is rare */
        }
      }
    }
  }

  return count;
}

// ─── Projection sheet ──────────────────────────────────────────────────────
// Writes to the legacy valuation_projections table. Kept because createProjection
// still exists in db.ts (not yet migrated to V1 financial_projections).
async function importProjectionSheet(
  ws: XLSX.WorkSheet,
  errors: string[],
  companyId: number,
): Promise<number> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  let count = 0;

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

// ─── Main entry ────────────────────────────────────────────────────────────
export async function importExcelFile(buffer: Buffer, fileName: string, companyId: number): Promise<ImportResult> {
  const errors: string[] = [];
  let totalImported = 0;

  let logId: number | undefined;
  try {
    const result = await createImportLog({ companyId, fileName, status: "processing" });
    if (Array.isArray(result) && result[0]?.id != null) {
      logId = Number(result[0].id);
    }
  } catch { /* ignore */ }

  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    let investorMap: NameMap = new Map();
    let shareholderMap = new Map<string, number>();

    // Pass 1: build the shareholder / investor directory (rows 1-13 of Register)
    const registerSheet = workbook.Sheets["Register of shareholders"];
    if (registerSheet) {
      const r = await seedDirectoryFromRegisterSheet(registerSheet, errors, companyId);
      shareholderMap = r.shareholderMap;
      investorMap = r.investorMap;
      totalImported += r.count;
    }

    // Pass 2: create funding rounds + any extra investors from Cap Table sheet.
    // This MUST happen before register entries so entries can link to their round.
    const capTableSheet = workbook.Sheets["Cap Table"];
    if (capTableSheet) {
      totalImported += await importCapTableSheet(capTableSheet, false, shareholderMap, investorMap, errors, companyId);
    }

    // Pass 3: Cap Table with ESOP — seeds the V1 ESOP pool + remaining investors
    const capTableEsopSheet = workbook.Sheets["Cap Table w ESOP"];
    if (capTableEsopSheet) {
      totalImported += await importCapTableSheet(capTableEsopSheet, true, shareholderMap, investorMap, errors, companyId);
    }

    // Pass 4: write V1 register entries (rows 17+) now that rounds exist
    if (registerSheet) {
      totalImported += await writeRegisterEntriesFromSheet(
        registerSheet, errors, companyId, investorMap, shareholderMap,
      );
    }

    // Pass 5: Projections
    const projectionSheet = workbook.Sheets["Projection Bridge"];
    if (projectionSheet) {
      totalImported += await importProjectionSheet(projectionSheet, errors, companyId);
    }

    // 5. Final snapshot (one, not per-register-entry) — captures post-import cap table
    try {
      const db = await getDb();
      if (db && totalImported > 0) {
        const capTable = await deriveCapTable(companyId);
        await db.insert(snapshotsV1).values({
          companyId,
          name: `Post-import baseline — ${fileName}`,
          triggerType: "manual",
          registerEntryId: null,
          capTableData: capTable as unknown as Record<string, unknown>,
          totalShares: capTable.totalShares,
          totalInvestors: capTable.holdings.length,
          notes: `Auto-created by excel-import. ${totalImported} records imported from "${fileName}".`,
        });
      }
    } catch (e) {
      // Snapshot is a courtesy — don't fail the import if it fails.
      errors.push(`Post-import snapshot skipped: ${e}`);
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

// Internal import to prevent "and/eq unused" TS warnings if later refactors
// trim the db helpers; these are available for direct-query fallbacks.
void and; void eq;
