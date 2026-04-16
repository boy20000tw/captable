export type DCFResult = {
  pvOfFCF: number[];
  sumPVFCF: number;
  terminalValue: number;
  pvOfTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  impliedPreMoney: number;
  impliedPostMoney: number;
  impliedDilution: number;
  valuationGap: number | null;   // implied - target (null if no target)
};

export function runDCF(args: {
  fcfs: number[];
  discountRate: number;
  terminalGrowth: number;
  netDebt: number;
  cash: number;
  targetRaise?: number | null;
  targetPreMoney?: number | null;
}): DCFResult {
  const { fcfs, discountRate: r, terminalGrowth: g, netDebt, cash } = args;

  const pvOfFCF = fcfs.map((fcf, i) => fcf / Math.pow(1 + r, i + 1));
  const sumPVFCF = pvOfFCF.reduce((s, v) => s + v, 0);

  const lastFCF = fcfs[fcfs.length - 1];
  // Gordon growth — guard r>g
  const terminalValue = r > g ? (lastFCF * (1 + g)) / (r - g) : 0;
  const pvOfTerminal = terminalValue / Math.pow(1 + r, fcfs.length);

  const enterpriseValue = sumPVFCF + pvOfTerminal;
  const equityValue = enterpriseValue - netDebt + cash;

  const impliedPreMoney = equityValue;
  const raise = args.targetRaise ?? 0;
  const impliedPostMoney = impliedPreMoney + raise;
  const impliedDilution = impliedPostMoney > 0 && raise > 0 ? raise / impliedPostMoney : 0;

  const valuationGap = args.targetPreMoney != null
    ? impliedPreMoney - args.targetPreMoney
    : null;

  return {
    pvOfFCF, sumPVFCF, terminalValue, pvOfTerminal,
    enterpriseValue, equityValue,
    impliedPreMoney, impliedPostMoney, impliedDilution, valuationGap,
  };
}
