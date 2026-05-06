/**
 * Analysis Export Utility
 *
 * Professional PDF & Excel export functions for:
 * - DCF valuation analysis
 * - Comparable companies analysis
 * - Three-statement financial models
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Workbook } from "exceljs";
import type { DCFResult, SensitivityTable } from "@shared/dcfCalc";
import type { CompsResult, CompsPeer } from "@shared/compsCalc";
import type { YearlyBalanceSheet, YearlyCashFlow } from "@shared/threeStatementCalc";
import type { YearlyPnL } from "@shared/projectionCalc";

// ─── Helper: Format currency for display ──────────────────────────────────

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `NT$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `NT$${(value / 1_000).toFixed(1)}K`;
  return `NT$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatMultiple(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}x`;
}

// ─── DCF PDF Export ──────────────────────────────────────────────────────

export function exportDcfPdf(
  dcfResult: DCFResult,
  sensitivityData: SensitivityTable,
  projectionRows: YearlyPnL[],
  companyName: string = "Company"
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Helper: Add page number footer
  const addFooter = () => {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${doc.internal.pages.length - 1}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: "right" }
    );
  };

  // Helper: Check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      addFooter();
      doc.addPage();
      yPos = margin;
    }
  };

  // ── PAGE 1: Executive Summary ──
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text("DCF Valuation Report", margin, yPos);
  yPos += 15;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Company: ${companyName}`, margin, yPos);
  yPos += 6;
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 12;

  // Key metrics box
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, contentWidth, 50);
  yPos += 4;

  const keyMetrics = [
    ["Enterprise Value", formatCurrency(dcfResult.enterpriseValue)],
    ["Less: Net Debt", formatCurrency(dcfResult.lessNetDebt)],
    ["Equity Value", formatCurrency(dcfResult.equityValue)],
  ];

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  let metricYPos = yPos;
  keyMetrics.forEach(([label, value]) => {
    doc.text(label, margin + 5, metricYPos, { maxWidth: contentWidth / 2 - 5 });
    doc.text(value, margin + contentWidth / 2, metricYPos, { align: "right" });
    metricYPos += 10;
  });
  yPos += 54;

  // Summary text
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const summaryText = `Terminal Value represents ${(dcfResult.tvAsPercentOfEV * 100).toFixed(1)}% of Enterprise Value using ${dcfResult.terminalValueMethod === "gordon" ? "Gordon Growth Model" : "Exit Multiple"} method.`;
  doc.text(summaryText, margin, yPos, { maxWidth: contentWidth, align: "left" });
  yPos += 15;

  // ── PAGE 2: WACC & Assumptions ──
  checkNewPage(80);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Valuation Assumptions", margin, yPos);
  yPos += 12;

  const assumptionsTable: string[][] = [
    ["Metric", "Value"],
    ["Discount Rate (WACC)", formatPercent(dcfResult.discountFactors[0] ? 1 / dcfResult.discountFactors[0] - 1 : 0.12)],
    ["Terminal Growth Rate", formatPercent(0.03)],
    ["Mid-Year Convention", "Applied"],
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [assumptionsTable[0]],
    body: assumptionsTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: 0 },
    columnStyles: { 0: { cellWidth: contentWidth * 0.6 } },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ── PAGE 3: FCF Projections Table ──
  checkNewPage(100);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Free Cash Flow Projections", margin, yPos);
  yPos += 10;

  const fcfTable: string[][] = [
    ["Year", "FCF (NTD)", "Discount Factor", "PV of FCF (NTD)"],
    ...projectionRows.map((row, i) => [
      String(row.year),
      formatCurrency(row.freeCashFlow),
      (dcfResult.discountFactors[i] ?? 0).toFixed(4),
      formatCurrency(dcfResult.pvOfFCF[i] ?? 0),
    ]),
    ["Terminal Value", formatCurrency(dcfResult.terminalValue), "", ""],
    ["PV of Terminal Value", "", "", formatCurrency(dcfResult.pvOfTerminal)],
    ["Enterprise Value", "", "", formatCurrency(dcfResult.enterpriseValue)],
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [fcfTable[0]],
    body: fcfTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: 0 },
    didDrawPage: addFooter,
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ── PAGE 4: Sensitivity Table ──
  checkNewPage(120);
  doc.addPage();
  yPos = margin;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Sensitivity Analysis: WACC vs Terminal Growth", margin, yPos);
  yPos += 10;

  const sensTable: string[][] = [
    ["WACC / Growth", ...sensitivityData.colLabels],
    ...sensitivityData.rowLabels.map((label, ri) => [
      label,
      ...sensitivityData.values[ri].map((v) => formatCurrency(v)),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [sensTable[0]],
    body: sensTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: 0 },
    didDrawPage: addFooter,
  });

  addFooter();
  return doc;
}

// ─── DCF Excel Export ────────────────────────────────────────────────────

export async function exportDcfExcel(
  dcfResult: DCFResult,
  sensitivityData: SensitivityTable,
  projectionRows: YearlyPnL[],
  companyName: string = "Company"
) {
  const workbook = new Workbook();

  // ── Sheet 1: Summary ──
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 20 },
  ];

  const summaryData = [
    { metric: "Company Name", value: companyName },
    { metric: "Report Date", value: new Date().toLocaleDateString() },
    { metric: "Enterprise Value (NTD)", value: dcfResult.enterpriseValue },
    { metric: "Less: Net Debt (NTD)", value: dcfResult.lessNetDebt },
    { metric: "Equity Value (NTD)", value: dcfResult.equityValue },
    { metric: "Terminal Value as % of EV", value: dcfResult.tvAsPercentOfEV },
    { metric: "Terminal Value Method", value: dcfResult.terminalValueMethod },
  ];

  summarySheet.addRows(summaryData);

  // Style header
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };

  // Format numbers
  summarySheet.getColumn("value").numFmt = '"NT$"#,##0.00';

  // ── Sheet 2: FCF Projections ──
  const fcfSheet = workbook.addWorksheet("FCF Projections");
  fcfSheet.columns = [
    { header: "Year", key: "year", width: 12 },
    { header: "FCF (NTD)", key: "fcf", width: 18 },
    { header: "Discount Factor", key: "df", width: 18 },
    { header: "PV of FCF (NTD)", key: "pvFcf", width: 18 },
  ];

  const fcfData = projectionRows.map((row, i) => ({
    year: row.year,
    fcf: row.freeCashFlow,
    df: dcfResult.discountFactors[i] ?? 0,
    pvFcf: dcfResult.pvOfFCF[i] ?? 0,
  }));

  fcfSheet.addRows(fcfData);

  // Add summary rows
  fcfSheet.addRow({ year: "Terminal Value", fcf: dcfResult.terminalValue, df: "", pvFcf: "" });
  fcfSheet.addRow({ year: "PV Terminal", fcf: "", df: "", pvFcf: dcfResult.pvOfTerminal });
  fcfSheet.addRow({ year: "Enterprise Value", fcf: "", df: "", pvFcf: dcfResult.enterpriseValue });

  // Style header
  fcfSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  fcfSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };

  // Format numbers
  fcfSheet.getColumn("fcf").numFmt = '"NT$"#,##0.00';
  fcfSheet.getColumn("pvFcf").numFmt = '"NT$"#,##0.00';
  fcfSheet.getColumn("df").numFmt = "0.0000";

  // ── Sheet 3: Sensitivity ──
  const sensSheet = workbook.addWorksheet("Sensitivity");
  const sensCols = [
    { header: "WACC / Growth", key: "label", width: 15 },
    ...sensitivityData.colLabels.map((label) => ({
      header: label,
      key: label,
      width: 18,
    })),
  ];
  sensSheet.columns = sensCols;

  const sensRows = sensitivityData.rowLabels.map((label, ri) => ({
    label,
    ...Object.fromEntries(
      sensitivityData.colLabels.map((col, ci) => [col, sensitivityData.values[ri][ci]])
    ),
  }));

  sensSheet.addRows(sensRows);

  // Style header
  sensSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sensSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };

  // Format numbers and apply conditional formatting
  for (let colIdx = 2; colIdx <= sensitivityData.colLabels.length + 1; colIdx++) {
    const col = sensSheet.getColumn(colIdx);
    col.numFmt = '"NT$"#,##0.00';
  }

  await workbook.xlsx.writeBuffer();
  return workbook;
}

// ─── Comps PDF Export ────────────────────────────────────────────────────

export function exportCompsPdf(
  result: CompsResult,
  companyName: string = "Company"
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text("Comparable Companies Analysis", margin, yPos);
  yPos += 12;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Target: ${companyName} | Date: ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 15;

  // ── Peer Companies Table ──
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Peer Companies & Multiples", margin, yPos);
  yPos += 10;

  const peersTable: string[][] = [
    ["Company", "Ticker", "Revenue (NTD)", "EV/Revenue", "EV/EBITDA", "P/E"],
    ...result.peers.map((p) => [
      p.name,
      p.ticker || "—",
      formatCurrency(p.revenue),
      formatMultiple(p.multiples.evRevenue),
      formatMultiple(p.multiples.evEbitda),
      formatMultiple(p.multiples.pe),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [peersTable[0]],
    body: peersTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: 0 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ── Multiple Statistics ──
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Multiple Statistics", margin, yPos);
  yPos += 10;

  const statsTable: string[][] = [
    ["Metric", "Min", "Q1", "Median", "Mean", "Q3", "Max"],
    ...result.stats.map((s) => [
      s.metric,
      s.min.toFixed(1),
      s.q1.toFixed(1),
      s.median.toFixed(1),
      s.mean.toFixed(1),
      s.q3.toFixed(1),
      s.max.toFixed(1),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [statsTable[0]],
    body: statsTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: 0 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ── Implied Valuations ──
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Implied Valuation (Composite)", margin, yPos);
  yPos += 10;

  const valuationText = `
Composite Enterprise Value: ${formatCurrency(result.compositeEV)}
Composite Equity Value: ${formatCurrency(result.compositeEquity)}
  `;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(valuationText, margin, yPos, { maxWidth: contentWidth });

  return doc;
}

// ─── Comps Excel Export ──────────────────────────────────────────────────

export async function exportCompsExcel(
  result: CompsResult,
  companyName: string = "Company"
) {
  const workbook = new Workbook();

  // ── Sheet 1: Peer Companies ──
  const peersSheet = workbook.addWorksheet("Peer Companies");
  peersSheet.columns = [
    { header: "Company", key: "name", width: 20 },
    { header: "Ticker", key: "ticker", width: 12 },
    { header: "Revenue (NTD)", key: "revenue", width: 18 },
    { header: "EBITDA (NTD)", key: "ebitda", width: 18 },
    { header: "Net Income (NTD)", key: "netIncome", width: 18 },
    { header: "Market Cap (NTD)", key: "marketCap", width: 18 },
    { header: "Net Debt (NTD)", key: "netDebt", width: 18 },
    { header: "Enterprise Value (NTD)", key: "ev", width: 20 },
    { header: "EV/Revenue", key: "evRev", width: 12 },
    { header: "EV/EBITDA", key: "evEbitda", width: 12 },
    { header: "P/E", key: "pe", width: 12 },
  ];

  const peersData = result.peers.map((p) => ({
    name: p.name,
    ticker: p.ticker || "",
    revenue: p.revenue,
    ebitda: p.ebitda,
    netIncome: p.netIncome,
    marketCap: p.marketCap,
    netDebt: p.netDebt,
    ev: p.enterpriseValue,
    evRev: p.multiples.evRevenue ?? null,
    evEbitda: p.multiples.evEbitda ?? null,
    pe: p.multiples.pe ?? null,
  }));

  peersSheet.addRows(peersData);

  // Style header
  peersSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  peersSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };

  // Format numbers
  for (let col of [2, 3, 4, 5, 6, 7, 8]) {
    peersSheet.getColumn(col).numFmt = '"NT$"#,##0.00';
  }
  for (let col of [9, 10, 11]) {
    peersSheet.getColumn(col).numFmt = "0.0";
  }

  // ── Sheet 2: Statistics ──
  const statsSheet = workbook.addWorksheet("Statistics");
  statsSheet.columns = [
    { header: "Metric", key: "metric", width: 20 },
    { header: "Min", key: "min", width: 12 },
    { header: "Q1", key: "q1", width: 12 },
    { header: "Median", key: "median", width: 12 },
    { header: "Mean", key: "mean", width: 12 },
    { header: "Q3", key: "q3", width: 12 },
    { header: "Max", key: "max", width: 12 },
  ];

  const statsData = result.stats.map((s) => ({
    metric: s.metric,
    min: s.min,
    q1: s.q1,
    median: s.median,
    mean: s.mean,
    q3: s.q3,
    max: s.max,
  }));

  statsSheet.addRows(statsData);

  // Style header
  statsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  statsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };

  // Format numbers
  for (let col of [2, 3, 4, 5, 6, 7]) {
    statsSheet.getColumn(col).numFmt = "0.0";
  }

  // ── Sheet 3: Implied Valuations ──
  const valuationSheet = workbook.addWorksheet("Implied Valuations");
  valuationSheet.columns = [
    { header: "Metric", key: "metric", width: 25 },
    { header: "Implied EV - Median (NTD)", key: "evMedian", width: 25 },
    { header: "Implied EV - Mean (NTD)", key: "evMean", width: 25 },
  ];

  const valuationData = result.impliedValuations.map((iv) => ({
    metric: iv.metric,
    evMedian: iv.impliedEVMedian,
    evMean: iv.impliedEVMean,
  }));

  valuationSheet.addRows(valuationData);
  valuationSheet.addRow({
    metric: "Composite Enterprise Value",
    evMedian: result.compositeEV,
    evMean: result.compositeEquity,
  });

  // Style header
  valuationSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  valuationSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };

  // Format numbers
  valuationSheet.getColumn(2).numFmt = '"NT$"#,##0.00';
  valuationSheet.getColumn(3).numFmt = '"NT$"#,##0.00';

  return workbook;
}

// ─── Three-Statement PDF Export ──────────────────────────────────────────

export function exportThreeStatementPdf(
  balanceSheet: YearlyBalanceSheet[],
  cashFlow: YearlyCashFlow[],
  pnl: YearlyPnL[],
  companyName: string = "Company"
) {
  const doc = new jsPDF("l"); // landscape
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text("Three-Statement Financial Model", margin, yPos);
  yPos += 12;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`${companyName} | Date: ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 15;

  // ── Income Statement ──
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Income Statement", margin, yPos);
  yPos += 10;

  const pnlTable: string[][] = [
    ["Line Item", ...pnl.map((p) => String(p.year))],
    ["Revenue", ...pnl.map((p) => formatCurrency(p.revenue))],
    ["COGS", ...pnl.map((p) => formatCurrency(p.cogs))],
    ["Gross Profit", ...pnl.map((p) => formatCurrency(p.grossProfit))],
    ["S&M", ...pnl.map((p) => formatCurrency(p.salesMarketing))],
    ["R&D", ...pnl.map((p) => formatCurrency(p.rnd))],
    ["G&A", ...pnl.map((p) => formatCurrency(p.gAndA))],
    ["EBITDA", ...pnl.map((p) => formatCurrency(p.ebitda))],
    ["D&A", ...pnl.map((p) => formatCurrency(p.depreciation))],
    ["EBIT", ...pnl.map((p) => formatCurrency(p.ebit))],
    ["Tax", ...pnl.map((p) => formatCurrency(p.tax))],
    ["Net Income", ...pnl.map((p) => formatCurrency(p.netIncome))],
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [pnlTable[0]],
    body: pnlTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: 0 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ── Balance Sheet ──
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Balance Sheet", margin, yPos);
  yPos += 10;

  const bsTable: string[][] = [
    ["Line Item", ...balanceSheet.map((bs) => String(bs.year))],
    ["Cash", ...balanceSheet.map((bs) => formatCurrency(bs.cash))],
    ["A/R", ...balanceSheet.map((bs) => formatCurrency(bs.accountsReceivable))],
    ["Inventory", ...balanceSheet.map((bs) => formatCurrency(bs.inventory))],
    ["Current Assets", ...balanceSheet.map((bs) => formatCurrency(bs.totalCurrentAssets))],
    ["PP&E", ...balanceSheet.map((bs) => formatCurrency(bs.netPPE))],
    ["Total Assets", ...balanceSheet.map((bs) => formatCurrency(bs.totalAssets))],
    ["A/P", ...balanceSheet.map((bs) => formatCurrency(bs.accountsPayable))],
    ["Current Liabilities", ...balanceSheet.map((bs) => formatCurrency(bs.totalCurrentLiabilities))],
    ["LT Debt", ...balanceSheet.map((bs) => formatCurrency(bs.longTermDebt))],
    ["Total Liabilities", ...balanceSheet.map((bs) => formatCurrency(bs.totalLiabilities))],
    ["Common Stock", ...balanceSheet.map((bs) => formatCurrency(bs.commonStock))],
    ["Retained Earnings", ...balanceSheet.map((bs) => formatCurrency(bs.retainedEarnings))],
    ["Total Equity", ...balanceSheet.map((bs) => formatCurrency(bs.totalEquity))],
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [bsTable[0]],
    body: bsTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: 0 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ── Cash Flow ──
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Cash Flow Statement", margin, yPos);
  yPos += 10;

  const cfTable: string[][] = [
    ["Line Item", ...cashFlow.map((cf) => String(cf.year))],
    ["Operating", ...cashFlow.map((cf) => formatCurrency(cf.cashFromOperations))],
    ["Investing", ...cashFlow.map((cf) => formatCurrency(cf.cashFromInvesting))],
    ["Financing", ...cashFlow.map((cf) => formatCurrency(cf.cashFromFinancing))],
    ["Net Change", ...cashFlow.map((cf) => formatCurrency(cf.netCashChange))],
    ["Ending Cash", ...cashFlow.map((cf) => formatCurrency(cf.endingCash))],
  ];

  autoTable(doc, {
    startY: yPos,
    margin: margin,
    head: [cfTable[0]],
    body: cfTable.slice(1),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: 0 },
  });

  return doc;
}

// ─── Three-Statement Excel Export ────────────────────────────────────────

export async function exportThreeStatementExcel(
  balanceSheet: YearlyBalanceSheet[],
  cashFlow: YearlyCashFlow[],
  pnl: YearlyPnL[],
  companyName: string = "Company"
) {
  const workbook = new Workbook();

  // ── Sheet 1: P&L ──
  const pnlSheet = workbook.addWorksheet("Income Statement");
  pnlSheet.columns = [
    { header: "Line Item", key: "item", width: 25 },
    ...pnl.map((p) => ({ header: String(p.year), key: `year${p.year}`, width: 18 })),
  ];

  const pnlData = [
    { item: "Revenue", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.revenue])) },
    { item: "COGS", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.cogs])) },
    { item: "Gross Profit", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.grossProfit])) },
    { item: "S&M", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.salesMarketing])) },
    { item: "R&D", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.rnd])) },
    { item: "G&A", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.gAndA])) },
    { item: "EBITDA", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.ebitda])) },
    { item: "D&A", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.depreciation])) },
    { item: "EBIT", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.ebit])) },
    { item: "Tax", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.tax])) },
    { item: "Net Income", ...Object.fromEntries(pnl.map((p) => [`year${p.year}`, p.netIncome])) },
  ];

  pnlSheet.addRows(pnlData as any);
  pnlSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  pnlSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
  for (let col = 2; col <= pnl.length + 1; col++) {
    pnlSheet.getColumn(col).numFmt = '"NT$"#,##0.00';
  }

  // ── Sheet 2: Balance Sheet ──
  const bsSheet = workbook.addWorksheet("Balance Sheet");
  bsSheet.columns = [
    { header: "Line Item", key: "item", width: 25 },
    ...balanceSheet.map((bs) => ({ header: String(bs.year), key: `year${bs.year}`, width: 18 })),
  ];

  const bsData = [
    { item: "Cash", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.cash])) },
    { item: "A/R", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.accountsReceivable])) },
    { item: "Inventory", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.inventory])) },
    { item: "Current Assets", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.totalCurrentAssets])) },
    { item: "PP&E", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.netPPE])) },
    { item: "Total Assets", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.totalAssets])) },
    { item: "A/P", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.accountsPayable])) },
    { item: "Current Liabilities", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.totalCurrentLiabilities])) },
    { item: "LT Debt", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.longTermDebt])) },
    { item: "Total Liabilities", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.totalLiabilities])) },
    { item: "Common Stock", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.commonStock])) },
    { item: "Retained Earnings", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.retainedEarnings])) },
    { item: "Total Equity", ...Object.fromEntries(balanceSheet.map((bs) => [`year${bs.year}`, bs.totalEquity])) },
  ];

  bsSheet.addRows(bsData as any);
  bsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  bsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
  for (let col = 2; col <= balanceSheet.length + 1; col++) {
    bsSheet.getColumn(col).numFmt = '"NT$"#,##0.00';
  }

  // ── Sheet 3: Cash Flow ──
  const cfSheet = workbook.addWorksheet("Cash Flow");
  cfSheet.columns = [
    { header: "Line Item", key: "item", width: 25 },
    ...cashFlow.map((cf) => ({ header: String(cf.year), key: `year${cf.year}`, width: 18 })),
  ];

  const cfData = [
    { item: "Operating Activities", ...Object.fromEntries(cashFlow.map((cf) => [`year${cf.year}`, cf.cashFromOperations])) },
    { item: "Investing Activities", ...Object.fromEntries(cashFlow.map((cf) => [`year${cf.year}`, cf.cashFromInvesting])) },
    { item: "Financing Activities", ...Object.fromEntries(cashFlow.map((cf) => [`year${cf.year}`, cf.cashFromFinancing])) },
    { item: "Net Change in Cash", ...Object.fromEntries(cashFlow.map((cf) => [`year${cf.year}`, cf.netCashChange])) },
    { item: "Ending Cash Balance", ...Object.fromEntries(cashFlow.map((cf) => [`year${cf.year}`, cf.endingCash])) },
  ];

  cfSheet.addRows(cfData as any);
  cfSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  cfSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
  for (let col = 2; col <= cashFlow.length + 1; col++) {
    cfSheet.getColumn(col).numFmt = '"NT$"#,##0.00';
  }

  return workbook;
}
