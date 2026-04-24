/**
 * Export module — generates PDF and Excel files for cap table & share register.
 *
 * PDF: uses jsPDF + jspdf-autotable (already installed)
 * Excel: uses ExcelJS
 */

import { deriveCapTable, type CapTable } from "./capTable";
import { getDb } from "../db";
import { shareRegisterEntries, investors, fundingRounds, shareClasses, companies } from "../../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";

// ─── Cap Table PDF ──────────────────────────────────────────────────────────

export async function generateCapTablePdf(companyId: number): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const capTable = await deriveCapTable(companyId);
  const company = await getCompanyName(companyId);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Title
  doc.setFontSize(16);
  doc.text(`${company} — Cap Table`, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 14, 24);
  doc.text(`Total Shares: ${capTable.totalShares.toLocaleString()} (fully diluted)`, 14, 29);

  // Get all share class keys across all holdings
  const allClasses = new Set<string>();
  capTable.holdings.forEach(h => {
    Object.keys(h.byShareClass).forEach(k => allClasses.add(k));
  });
  const classColumns = Array.from(allClasses).sort();

  // Table headers
  const headers = ["Investor", "Status", ...classColumns.map(c => c.replace(/_/g, " ").toUpperCase()), "Total Shares", "Ownership %"];

  // Table rows
  const rows = capTable.holdings.map(h => [
    h.investorName,
    h.investorStatus,
    ...classColumns.map(c => h.byShareClass[c] ? h.byShareClass[c].toLocaleString() : "—"),
    h.totalShares.toLocaleString(),
    `${h.ownershipPct}%`,
  ]);

  // ESOP row
  if (capTable.esopPoolUnallocated > 0) {
    const esopPct = capTable.totalShares > 0
      ? ((capTable.esopPoolUnallocated / capTable.totalShares) * 100).toFixed(4)
      : "0";
    rows.push([
      "ESOP Pool (Unallocated)",
      "—",
      ...classColumns.map(() => "—"),
      capTable.esopPoolUnallocated.toLocaleString(),
      `${esopPct}%`,
    ]);
  }

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 45 },
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(
      `Caploom — Confidential | Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 6,
      { align: "center" },
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ─── Cap Table Excel ────────────────────────────────────────────────────────

export async function generateCapTableExcel(companyId: number): Promise<Buffer> {
  const ExcelJS = await import("exceljs");

  const capTable = await deriveCapTable(companyId);
  const company = await getCompanyName(companyId);

  // Get dynamic share class names
  const classMap = await getShareClassNames(companyId);

  const allClasses = new Set<string>();
  capTable.holdings.forEach(h => Object.keys(h.byShareClass).forEach(k => allClasses.add(k)));
  const classColumns = Array.from(allClasses).sort();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Caploom";
  wb.created = new Date();

  const ws = wb.addWorksheet("Cap Table", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Title rows
  ws.mergeCells("A1", `${colLetter(3 + classColumns.length + 1)}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = `${company} — Cap Table`;
  titleCell.font = { size: 14, bold: true };

  ws.mergeCells("A2", `${colLetter(3 + classColumns.length + 1)}2`);
  const subCell = ws.getCell("A2");
  subCell.value = `Generated: ${new Date().toLocaleDateString()} | Total Shares: ${capTable.totalShares.toLocaleString()} (fully diluted)`;
  subCell.font = { size: 9, color: { argb: "FF888888" } };

  // Headers
  const headerRow = ws.addRow([
    "Investor", "Entity Type", "Status",
    ...classColumns.map(c => classMap[c] ?? c.replace(/_/g, " ")),
    "Total Shares", "Ownership %",
  ]);
  headerRow.font = { bold: true, size: 10 };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1E1E" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.border = { bottom: { style: "thin" } };
  });

  // Data rows
  for (const h of capTable.holdings) {
    const row = ws.addRow([
      h.investorName,
      h.entityKind,
      h.investorStatus,
      ...classColumns.map(c => h.byShareClass[c] ?? 0),
      h.totalShares,
      Number(h.ownershipPct) / 100,
    ]);
    // Format number columns
    for (let i = 4; i <= 3 + classColumns.length + 1; i++) {
      row.getCell(i).numFmt = "#,##0";
    }
    row.getCell(3 + classColumns.length + 2).numFmt = "0.00%";
  }

  // ESOP row
  if (capTable.esopPoolUnallocated > 0) {
    const esopPct = capTable.totalShares > 0
      ? capTable.esopPoolUnallocated / capTable.totalShares
      : 0;
    const row = ws.addRow([
      "ESOP Pool (Unallocated)", "—", "—",
      ...classColumns.map(() => 0),
      capTable.esopPoolUnallocated,
      esopPct,
    ]);
    row.font = { italic: true };
    for (let i = 4; i <= 3 + classColumns.length + 1; i++) {
      row.getCell(i).numFmt = "#,##0";
    }
    row.getCell(3 + classColumns.length + 2).numFmt = "0.00%";
  }

  // Auto-fit column widths
  ws.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 35);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Share Register Excel ───────────────────────────────────────────────────

export async function generateRegisterExcel(companyId: number): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const company = await getCompanyName(companyId);
  const classMap = await getShareClassNames(companyId);

  const entries = await db.select().from(shareRegisterEntries)
    .where(eq(shareRegisterEntries.companyId, companyId))
    .orderBy(asc(shareRegisterEntries.effectiveDate), asc(shareRegisterEntries.id));

  const investorRows = await db.select().from(investors)
    .where(eq(investors.companyId, companyId));
  const investorMap = new Map(investorRows.map(i => [i.id, i.name]));

  const roundRows = await db.select().from(fundingRounds)
    .where(eq(fundingRounds.companyId, companyId));
  const roundMap = new Map(roundRows.map(r => [r.id, r.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Caploom";
  wb.created = new Date();

  const ws = wb.addWorksheet("Share Register", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Title
  ws.mergeCells("A1", "K1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${company} — Share Register`;
  titleCell.font = { size: 14, bold: true };

  ws.mergeCells("A2", "K2");
  const subCell = ws.getCell("A2");
  subCell.value = `Generated: ${new Date().toLocaleDateString()} | ${entries.length} entries`;
  subCell.font = { size: 9, color: { argb: "FF888888" } };

  // Headers
  const headers = [
    "ID", "Date", "Investor", "Event Type", "Share Class",
    "Shares", "Price/Share", "Currency", "Total Amount",
    "Funding Round", "Notes",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, size: 10 };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1E1E" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.border = { bottom: { style: "thin" } };
  });

  // Data
  for (const e of entries) {
    const row = ws.addRow([
      e.id,
      e.effectiveDate,
      investorMap.get(e.investorId) ?? `#${e.investorId}`,
      e.eventType.replace(/_/g, " "),
      classMap[e.shareClass] ?? e.shareClass.replace(/_/g, " "),
      Number(e.shares),
      e.pricePerShare ? Number(e.pricePerShare) : "",
      e.currency ?? "",
      e.totalAmount ? Number(e.totalAmount) : "",
      e.fundingRoundId ? (roundMap.get(e.fundingRoundId) ?? "") : "",
      e.notes ?? "",
    ]);
    row.getCell(6).numFmt = "#,##0";
    if (e.pricePerShare) row.getCell(7).numFmt = "#,##0.00";
    if (e.totalAmount) row.getCell(9).numFmt = "#,##0.00";
  }

  // Auto-fit
  ws.columns.forEach((col) => {
    let maxLen = 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 40);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getCompanyName(companyId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Company";
  const rows = await db.select({ name: companies.name, nameEn: companies.nameEn })
    .from(companies).where(eq(companies.id, companyId));
  return rows[0]?.nameEn || rows[0]?.name || "Company";
}

async function getShareClassNames(companyId: number): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({ slug: shareClasses.slug, name: shareClasses.name })
    .from(shareClasses).where(eq(shareClasses.companyId, companyId));
  return Object.fromEntries(rows.map(r => [r.slug, r.name]));
}

function colLetter(n: number): string {
  let result = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
