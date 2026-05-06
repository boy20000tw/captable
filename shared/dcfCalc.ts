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
  netDebt: number;              // debt − cash (conventional definition)
  minorityInterest: number;     // subtracted from EV
  preferredEquity: number;      // subtracted from EV
  /**
   * @deprecated Cash is already netted in `netDebt`. Field retained for
   * backwards compatibility but no longer used in the EV→Equity bridge.
   */
  cash?: number;
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
  lessNetDebt: number;          // netDebt = debt − cash
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
  /** Legacy callers: cash is no longer added separately (netDebt already nets it). */
  cash?: number;
  targetRaise?: number | null;
  targetPreMoney?: number | null;
};

// ─── Core DCF Engine ────────────────────────────────────────────────────────

export function runDCF(args: DCFInputs): DCFResult;
export function runDCF(args: DCFArgs): DCFResult;
export function runDCF(args: DCFInputs | DCFArgs): DCFResult {
  // Normalize legacy callers
  const inputs: DCFInputs = "terminalValueMethod" in args
    ? args
    : {
        fcfs: args.fcfs,
        discountRate: args.discountRate,
        terminalGrowth: args.terminalGrowth,
        netDebt: args.netDebt,
        exitMultiple: 10,
        lastYearEBITDA: 0,
        terminalValueMethod: "gordon" as TerminalValueMethod,
        midYearConvention: false,
        minorityInterest: 0,
        preferredEquity: 0,
        targetRaise: args.targetRaise,
        targetPreMoney: args.targetPreMoney,
      };

  const {
    fcfs, discountRate: r, terminalGrowth: g,
    exitMultiple, lastYearEBITDA, terminalValueMethod,
    midYearConvention, netDebt,
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

  // PV of terminal value.
  // Mid-year convention: TV is treated as occurring at the same point as the
  // final FCF (year n − 0.5), since both come from the same cash flow stream.
  // End-of-year convention: TV occurs at year n.
  const tvDiscountPeriod = midYearConvention ? n - 0.5 : n;
  const pvOfTerminal = terminalValue / Math.pow(1 + r, tvDiscountPeriod);

  // Enterprise value
  const enterpriseValue = sumPVFCF + pvOfTerminal;
  const tvAsPercentOfEV = enterpriseValue > 0 ? pvOfTerminal / enterpriseValue : 0;

  // EV → Equity bridge.
  // netDebt is debt − cash by definition, so cash is NOT added back here.
  const equityValue = enterpriseValue - netDebt - minorityInterest - preferredEquity;

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

  // Exhaustive label resolution — narrows the union and surfaces an obvious
  // string if a new param is added without updating this switch.
  const labelForParam = (param: typeof rowParam | typeof colParam): string => {
    switch (param) {
      case "discountRate": return "WACC";
      case "exitMultiple": return "Exit Multiple";
      case "terminalGrowth": return "Terminal Growth";
      default: {
        const _exhaustive: never = param;
        return _exhaustive;
      }
    }
  };
  const rowHeader = labelForParam(rowParam);
  const colHeader = labelForParam(colParam);

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

  // Generate 5 values centered on the base.
  // Floor WACC at baseGrowth + 0.5% so Gordon Growth (r > g) never breaks.
  const waccFloor = baseGrowth + 0.005;
  const waccValues = [-0.02, -0.01, 0, 0.01, 0.02].map(d => Math.max(waccFloor, baseWACC + d));
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
