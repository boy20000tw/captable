/**
 * WACC Calculator via CAPM
 *
 * Cost of Equity = Risk-Free Rate + Beta × Equity Risk Premium
 * WACC = (Ke × E/(D+E)) + (Kd × (1-t) × D/(D+E))
 */

export type WACCInputs = {
  riskFreeRate: number;       // e.g. 0.04 = 4%
  beta: number;               // company/industry beta
  equityRiskPremium: number;  // e.g. 0.06 = 6%
  costOfDebt: number;         // pre-tax cost of debt, e.g. 0.05
  taxRate: number;            // marginal tax rate, e.g. 0.20
  debtWeight: number;         // D/(D+E), e.g. 0.30
};

export type WACCResult = {
  costOfEquity: number;       // Ke via CAPM
  afterTaxCostOfDebt: number; // Kd × (1-t)
  equityWeight: number;       // 1 - debtWeight
  debtWeight: number;
  wacc: number;               // blended WACC
};

export const DEFAULT_WACC_INPUTS: WACCInputs = {
  riskFreeRate: 0.0425,       // 10-yr Treasury ~4.25%
  beta: 1.2,
  equityRiskPremium: 0.06,    // Damodaran long-term ERP
  costOfDebt: 0.055,
  taxRate: 0.20,
  debtWeight: 0.20,
};

export function calculateWACC(inputs: WACCInputs): WACCResult {
  const { riskFreeRate, beta, equityRiskPremium, costOfDebt, taxRate, debtWeight } = inputs;

  const costOfEquity = riskFreeRate + beta * equityRiskPremium;
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);
  const equityWeight = 1 - debtWeight;

  const wacc = costOfEquity * equityWeight + afterTaxCostOfDebt * debtWeight;

  return {
    costOfEquity,
    afterTaxCostOfDebt,
    equityWeight,
    debtWeight,
    wacc,
  };
}
