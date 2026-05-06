/**
 * Professional DCF Engine
 *
 * Features:
 * - Mid-year discounting convention
 * - Dual terminal value methods: Gordon Growth Model + Exit Multiple
 * - 5×5 sensitivity table generator
 * - EV → Equity bridge with detailed breakdown
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type TerminalValueMethod = "gordon" | "exitMultiple";

export type DCFInputs = {
  fcfs: number[];
  discountRate: number;         // WACC
  terminalGrowth: number;       // g for Gordon Growth
  exitMultiple: number;         // EV/EBITDA for exit multiple method
  lastYearEBITDA: number;       // needed for exit multiple TV
  terminalValueMethod: TerminalValueMethod;
  midYearConvention: boolean;   // true = discount at mid-year
  netDebt: number;
  cash: number;
  minorityInterest: number;     // subtracted from EV
  preferredEquity: number;      // subtracted from EV
  targetRaise?: number | null;
  targetPreMoney?: number | null;
};

export type DCFResult = {
  // Per-year details
  pvOfFCF: number[];
  discountFactors: number[];

  // Totals
  sumPVFCF: number;

  // Terminal value
  terminalValue: number;
  pvOfTerminal: number;
  terminalValueMethod: TerminalValueMethod;
  tvAsPercentOfEV: number;      // TV's contribution to EV

  // EV → Equity bridge
  enterpriseValue: number;
  lessNetDebt: number;
  lessCash: number;             // added (positive = cash on hand)
  lessMinorityInterest: number;
  lessPreferredEquity: number;
  equityValue: number;

  // Funding round context
  impliedPreMoney: number;
  impliedPostMoney: number;
  impliedDilution: number;
  valuationGap: number | null;
};

export type SensitivityCell = {
  rowLabel: string;
  colLabel: string;
  value: number;
};

export type SensitivityTable = {
  rowHeader: string;     // e.g. "WACC"
  colHeader: string;     // e.g. "Terminal Growth" or "Exit Multiple"
  rowLabels: string[];
  colLabels: string[];
  values: number[][];    // [row][col] = enterprise or equity value
};

// ─── Backwards-compatible type alias ────────────────────────────────────────

/** @deprecated — use DCFInputs directly */
export type DCFArgs = {
  fcfs: number[];
  discountRate: number;
  terminalGrowth: number;
  netDebt: number;
  cash: number;
  targetRaise?: number | null;
  targetPreMoney?: number | null;
};

// ─── Core DCF Engine ────────────────────────────────────────────────────────

export function runDCF(args: DCFInputs): DCFResult;
export function runDCF(args: DCFArgs): DCFResult;
export function runDCF(args: DCFInputs | DCFArgs): DCFResult {
  // Normalize legacy callers
  const inputs: DCFInputs = "terminalValueMethod" in args
    ? args as DCFInputs
    : {
        ...args,
        exitMultiple: 10,
        lastYearEBITDA: 0,
        terminalValueMethod: "gordon" as TerminalValueMethod,
        midYearConvention: false,
        minorityInterest: 0,
        preferredEquity: 0,
      };

  const {
    fcfs, discountRate: r, terminalGrowth: g,
    exitMultiple, lastYearEBITDA, terminalValueMethod,
    midYearConvention, netDebt, cash,
    minorityInterest, preferredEquity,
  } = inputs;

  const n = fcfs.length;

  // Discount factors & PV of FCFs
  const discountFactors: number[] = [];
  const pvOfFCF: number[] = [];

  for (let i = 0; i < n; i++) {
    const t = midYearConvention ? i + 0.5 : i + 1;
    const df = 1 / Math.pow(1 + r, t);
    discountFactors.push(df);
    pvOfFCF.push(fcfs[i] * df);
  }

  const sumPVFCF = pvOfFCF.reduce((s, v) => s + v, 0);

  // Terminal value
  let terminalValue: number;
  if (terminalValueMethod === "exitMultiple") {
    terminalValue = lastYearEBITDA * exitMultiple;
  } else {
    // Gordon Growth Model — guard r > g
    const lastFCF = fcfs[n - 1];
    terminalValue = r > g ? (lastFCF * (1 + g)) / (r - g) : 0;
  }

  // PV of terminal value
  const tvDiscountPeriod = midYearConvention ? n : n;
  const pvOfTerminal = terminalValue / Math.pow(1 + r, tvDiscountPeriod);

  // Enterprise value
  const enterpriseValue = sumPVFCF + pvOfTerminal;
  const tvAsPercentOfEV = enterpriseValue > 0 ? pvOfTerminal / enterpriseValue : 0;

  // EV → Equity bridge
  const equityValue = enterpriseValue - netDebt + cash - minorityInterest - preferredEquity;

  // Funding round context
  const impliedPreMoney = equityValue;
  const raise = inputs.targetRaise ?? 0;
  const impliedPostMoney = impliedPreMoney + raise;
  const impliedDilution = impliedPostMoney > 0 && raise > 0 ? raise / impliedPostMoney : 0;

  const valuationGap = inputs.targetPreMoney != null
    ? impliedPreMoney - inputs.targetPreMoney
    : null;

  return {
    pvOfFCF,
    discountFactors,
    sumPVFCF,
    terminalValue,
    pvOfTerminal,
    terminalValueMethod,
    tvAsPercentOfEV,
    enterpriseValue,
    lessNetDebt: netDebt,
    lessCash: cash,
    lessMinorityInterest: minorityInterest,
    lessPreferredEquity: preferredEquity,
    equityValue,
    impliedPreMoney,
    impliedPostMoney,
    impliedDilution,
    valuationGap,
  };
}

// ─── Sensitivity Table Generator ────────────────────────────────────────────

/**
 * Generate a 5×5 sensitivity table varying two parameters.
 * Typically WACC (rows) × Terminal Growth or Exit Multiple (cols).
 */
export function generateSensitivityTable(args: {
  baseInputs: DCFInputs;
  rowParam: "discountRate" | "exitMultiple";
  colParam: "terminalGrowth" | "exitMultiple" | "discountRate";
  rowValues: number[];
  colValues: number[];
  outputMetric: "enterpriseValue" | "equityValue" | "impliedPreMoney";
}): SensitivityTable {
  const { baseInputs, rowParam, colParam, rowValues, colValues, outputMetric } = args;

  const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const formatMultiple = (v: number) => `${v.toFixed(1)}x`;

  const formatLabel = (param: string, v: number) =>
    param === "exitMultiple" ? formatMultiple(v) : formatPct(v);

  const rowLabels = rowValues.map(v => formatLabel(rowParam, v));
  const colLabels = colValues.map(v => formatLabel(colParam, v));

  const values: number[][] = [];

  for (const rv of rowValues) {
    const row: number[] = [];
    for (const cv of colValues) {
      const inputs: DCFInputs = {
        ...baseInputs,
        [rowParam]: rv,
        [colParam]: cv,
      };
      const result = runDCF(inputs);
      row.push(result[outputMetric]);
    }
    values.push(row);
  }

  const rowHeader = rowParam === "discountRate" ? "WACC"
    : rowParam === "exitMultiple" ? "Exit Multiple" : rowParam;
  const colHeader = colParam === "terminalGrowth" ? "Terminal Growth"
    : colParam === "exitMultiple" ? "Exit Multiple"
    : colParam === "discountRate" ? "WACC" : colParam;

  return { rowHeader, colHeader, rowLabels, colLabels, values };
}

/**
 * Convenience: generate default 5×5 WACC × Terminal Growth table.
 */
export function defaultSensitivityTable(
  baseInputs: DCFInputs,
  outputMetric: "enterpriseValue" | "equityValue" = "enterpriseValue"
): SensitivityTable {
  const baseWACC = baseInputs.discountRate;
  const baseGrowth = baseInputs.terminalGrowth;

  // Generate 5 values centered on the base
  const waccValues = [-0.02, -0.01, 0, 0.01, 0.02].map(d => baseWACC + d);
  const growthValues = [-0.01, -0.005, 0, 0.005, 0.01].map(d => baseGrowth + d);

  return generateSensitivityTable({
    baseInputs,
    rowParam: "discountRate",
    colParam: "terminalGrowth",
    rowValues: waccValues,
    colValues: growthValues,
    outputMetric,
  });
}

/**
 * Convenience: generate 5×5 WACC × Exit Multiple table.
 */
export function exitMultipleSensitivityTable(
  baseInputs: DCFInputs,
  outputMetric: "enterpriseValue" | "equityValue" = "enterpriseValue"
): SensitivityTable {
  const baseWACC = baseInputs.discountRate;
  const baseMultiple = baseInputs.exitMultiple;

  const waccValues = [-0.02, -0.01, 0, 0.01, 0.02].map(d => baseWACC + d);
  const multipleValues = [-4, -2, 0, 2, 4].map(d => baseMultiple + d);

  return generateSensitivityTable({
    baseInputs,
    rowParam: "discountRate",
    colParam: "exitMultiple",
    rowValues: waccValues,
    colValues: multipleValues,
    outputMetric,
  });
}
