import type { ProjectionAssumptions } from "./projectionTypes";

export type YearlyPnL = {
  year: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  salesMarketing: number;
  rnd: number;
  gAndA: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  tax: number;
  netIncome: number;
  capex: number;
  changeInNWC: number;
  freeCashFlow: number;
};

export function buildProjection(
  startYear: number,
  years: number,
  a: ProjectionAssumptions
): YearlyPnL[] {
  const rows: YearlyPnL[] = [];
  let prevNWC = 0;

  for (let i = 0; i < years; i++) {
    const year = startYear + i;
    const revenue = i === 0
      ? a.revenueYear1
      : rows[i - 1].revenue * (1 + (a.revenueGrowth[i - 1] ?? 0));

    const cogs = revenue * (1 - a.grossMargin);
    const grossProfit = revenue - cogs;
    const sm = revenue * a.salesMarketing;
    const rnd = revenue * a.rnd;
    const ga = revenue * a.gAndA;
    const ebitda = grossProfit - sm - rnd - ga;
    const dep = revenue * a.depreciation;
    const ebit = ebitda - dep;
    const tax = Math.max(0, ebit * a.taxRate);
    const netIncome = ebit - tax;

    const capex = revenue * a.capex;
    const nwc = revenue * a.workingCapital;
    const dNWC = nwc - prevNWC;
    const fcf = ebit * (1 - a.taxRate) + dep - capex - dNWC;

    rows.push({
      year, revenue, cogs, grossProfit,
      salesMarketing: sm, rnd, gAndA: ga,
      ebitda, depreciation: dep, ebit, tax, netIncome,
      capex, changeInNWC: dNWC, freeCashFlow: fcf,
    });

    prevNWC = nwc;
  }
  return rows;
}
