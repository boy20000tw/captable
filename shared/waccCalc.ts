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

/**
 * Clamp a WACC input to a sensible range and warn (in dev) if out of bounds.
 * Returns the clamped value. Used so a bad input never produces a negative
 * or absurd WACC that breaks downstream DCF (Gordon Growth requires r > g).
 */
function clamp(value: number, min: number, max: number, label: string): number {
  if (Number.isNaN(value)) return min;
  if (value < min || value > max) {
    if (typeof console !== "undefined") {
      console.warn(`[WACC] ${label}=${value} out of range [${min}, ${max}], clamping`);
    }
  }
  return Math.min(max, Math.max(min, value));
}

export function calculateWACC(inputs: WACCInputs): WACCResult {
  // Validate / clamp inputs to plausible ranges. Negative rates and beta < 0
  // are theoretically possible but extremely rare; treat as input errors.
  const riskFreeRate = clamp(inputs.riskFreeRate, 0, 0.20, "riskFreeRate");
  const beta = clamp(inputs.beta, 0, 5, "beta");
  const equityRiskPremium = clamp(inputs.equityRiskPremium, 0, 0.20, "equityRiskPremium");
  const costOfDebt = clamp(inputs.costOfDebt, 0, 0.50, "costOfDebt");
  const taxRate = clamp(inputs.taxRate, 0, 1, "taxRate");
  const debtWeight = clamp(inputs.debtWeight, 0, 1, "debtWeight");

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
