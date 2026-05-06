/**
 * Three-Statement Model
 *
 * Builds Balance Sheet and Cash Flow Statement from P&L assumptions.
 * Cross-validates: Assets = Liabilities + Equity.
 *
 * Simplification: uses percentage-of-revenue drivers for BS items,
 * consistent with the existing projection engine's approach.
 */

import type { ProjectionAssumptions } from "./projectionTypes";
import { buildProjection, type YearlyPnL } from "./projectionCalc";

// ─── Balance Sheet ──────────────────────────────────────────────────────────

export type YearlyBalanceSheet = {
  year: number;

  // Assets
  cash: number;
  accountsReceivable: number;
  inventory: number;
  totalCurrentAssets: number;
  netPPE: number;             // Property, Plant & Equipment
  totalAssets: number;

  // Liabilities
  accountsPayable: number;
  shortTermDebt: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  totalLiabilities: number;

  // Equity
  commonStock: number;        // paid-in capital (opening equity)
  retainedEarnings: number;   // accumulated net income
  totalEquity: number;

  // Validation
  balanceCheck: number;        // should be 0 (Assets - Liab - Equity)
};

// ─── Cash Flow Statement ────────────────────────────────────────────────────

export type YearlyCashFlow = {
  year: number;

  // Operating
  netIncome: number;
  depreciation: number;       // add back
  changeInAR: number;         // (increase) = cash outflow
  changeInInventory: number;
  changeInAP: number;         // increase = cash inflow
  cashFromOperations: number;

  // Investing
  capex: number;
  cashFromInvesting: number;

  // Financing
  debtRepayment: number;
  cashFromFinancing: number;

  // Net
  netCashChange: number;
  endingCash: number;
};

// ─── BS Assumptions (% of Revenue) ──────────────────────────────────────────

export type BSAssumptions = {
  arDays: number;            // accounts receivable days (e.g. 45)
  inventoryDays: number;     // inventory days (e.g. 30)
  apDays: number;            // accounts payable days (e.g. 35)
  initialCash: number;       // starting cash balance
  initialDebt: number;       // initial long-term debt
  debtRepaymentPct: number;  // annual % of debt repaid (e.g. 0.10 = 10%)
  /**
   * Opening equity (paid-in capital) at year 0.
   * If omitted, defaults to `initialCash − initialDebt` so the BS balances
   * at the start of year 1: Assets (cash) = Liab (debt) + Equity (paid-in).
   */
  initialEquity?: number;
};

export const DEFAULT_BS_ASSUMPTIONS: BSAssumptions = {
  arDays: 45,
  inventoryDays: 30,
  apDays: 35,
  initialCash: 500_000,
  initialDebt: 0,
  debtRepaymentPct: 0.10,
};

// ─── Three-Statement Builder ────────────────────────────────────────────────

export type ThreeStatementResult = {
  pnl: YearlyPnL[];
  balanceSheet: YearlyBalanceSheet[];
  cashFlow: YearlyCashFlow[];
  isBalanced: boolean;       // all years balance check === 0
};

export function buildThreeStatements(
  startYear: number,
  years: number,
  pnlAssumptions: ProjectionAssumptions,
  bsAssumptions: BSAssumptions,
): ThreeStatementResult {
  const pnl = buildProjection(startYear, years, pnlAssumptions);
  const balanceSheet: YearlyBalanceSheet[] = [];
  const cashFlow: YearlyCashFlow[] = [];

  let prevCash = bsAssumptions.initialCash;
  let prevAR = 0;
  let prevInventory = 0;
  let prevAP = 0;
  let prevDebt = bsAssumptions.initialDebt;
  let retainedEarnings = 0;
  let cumPPE = 0;
  let cumDepreciation = 0;

  // Opening equity (paid-in capital). If not specified, derive from
  // accounting identity at t=0: Assets = Liabilities + Equity, where
  // Assets = initialCash and Liabilities = initialDebt, hence
  // commonStock = initialCash − initialDebt.
  const commonStock = bsAssumptions.initialEquity ?? (bsAssumptions.initialCash - bsAssumptions.initialDebt);

  for (let i = 0; i < years; i++) {
    const row = pnl[i];
    const rev = row.revenue;
    const cogs = row.cogs;

    // Balance Sheet items (working capital from days)
    const ar = (rev / 365) * bsAssumptions.arDays;
    const inventory = (cogs / 365) * bsAssumptions.inventoryDays;
    const ap = (cogs / 365) * bsAssumptions.apDays;

    // PP&E: cumulative capex minus cumulative depreciation. Clamp to >= 0
    // for mature companies where depreciation > capex over time.
    cumPPE += row.capex;
    cumDepreciation += row.depreciation;
    const netPPE = Math.max(0, cumPPE - cumDepreciation);

    // Debt
    const debtRepayment = prevDebt * bsAssumptions.debtRepaymentPct;
    const longTermDebt = prevDebt - debtRepayment;

    // Cash flow statement
    const changeInAR = ar - prevAR;
    const changeInInventory = inventory - prevInventory;
    const changeInAP = ap - prevAP;

    const cashFromOps = row.netIncome + row.depreciation - changeInAR - changeInInventory + changeInAP;
    const cashFromInvesting = -row.capex;
    const cashFromFinancing = -debtRepayment;
    const netCashChange = cashFromOps + cashFromInvesting + cashFromFinancing;
    const endingCash = prevCash + netCashChange;

    // Retained earnings accumulate net income
    retainedEarnings += row.netIncome;

    // Balance sheet
    const totalCurrentAssets = endingCash + ar + inventory;
    const totalAssets = totalCurrentAssets + netPPE;
    const totalCurrentLiabilities = ap;
    const totalLiabilities = totalCurrentLiabilities + longTermDebt;
    const totalEquity = commonStock + retainedEarnings;
    const balanceCheck = Math.round((totalAssets - totalLiabilities - totalEquity) * 100) / 100;

    balanceSheet.push({
      year: row.year,
      cash: endingCash,
      accountsReceivable: ar,
      inventory,
      totalCurrentAssets,
      netPPE,
      totalAssets,
      accountsPayable: ap,
      shortTermDebt: 0,
      totalCurrentLiabilities,
      longTermDebt,
      totalLiabilities,
      commonStock,
      retainedEarnings,
      totalEquity,
      balanceCheck,
    });

    cashFlow.push({
      year: row.year,
      netIncome: row.netIncome,
      depreciation: row.depreciation,
      changeInAR: -changeInAR,
      changeInInventory: -changeInInventory,
      changeInAP: changeInAP,
      cashFromOperations: cashFromOps,
      capex: -row.capex,
      cashFromInvesting,
      debtRepayment: -debtRepayment,
      cashFromFinancing,
      netCashChange,
      endingCash,
    });

    // Carry forward
    prevCash = endingCash;
    prevAR = ar;
    prevInventory = inventory;
    prevAP = ap;
    prevDebt = longTermDebt;
  }

  const isBalanced = balanceSheet.every((bs) => Math.abs(bs.balanceCheck) < 0.01);

  return { pnl, balanceSheet, cashFlow, isBalanced };
}
