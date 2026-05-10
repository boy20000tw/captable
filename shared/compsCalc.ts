/**
 * Comparable Companies Analysis (Comps)
 *
 * Calculates implied valuation from peer company multiples.
 * Supports EV/Revenue, EV/EBITDA, and P/E multiples.
 */

export type CompsPeer = {
  id?: number;
  name: string;
  ticker?: string;         // optional stock ticker
  revenue: number;          // TTM or LTM revenue
  ebitda: number;           // TTM or LTM EBITDA
  netIncome: number;        // TTM or LTM net income
  marketCap: number;        // current market cap
  netDebt: number;          // total debt - cash
  sharesOutstanding?: number;
};

export type CompsMultiples = {
  evRevenue: number | null;   // EV / Revenue
  evEbitda: number | null;    // EV / EBITDA
  pe: number | null;          // Market Cap / Net Income
};

export type PeerWithMultiples = CompsPeer & {
  enterpriseValue: number;
  multiples: CompsMultiples;
};

export type CompsStats = {
  metric: string;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
};

export type ImpliedValuation = {
  metric: string;
  peerMedian: number;
  peerMean: number;
  targetValue: number;     // target company's metric
  impliedEVMedian: number;
  impliedEVMean: number;
};

export type CompsResult = {
  peers: PeerWithMultiples[];
  stats: CompsStats[];
  impliedValuations: ImpliedValuation[];
  compositeEV: number;     // average of implied EVs
  compositeEquity: number; // compositeEV - target netDebt
};

// ─── Calculations ───────────────────────────────────────────────────────────

export function calculatePeerMultiples(peer: CompsPeer): PeerWithMultiples {
  const ev = peer.marketCap + peer.netDebt;
  return {
    ...peer,
    enterpriseValue: ev,
    multiples: {
      evRevenue: peer.revenue > 0 ? ev / peer.revenue : null,
      evEbitda: peer.ebitda > 0 ? ev / peer.ebitda : null,
      pe: peer.netIncome > 0 ? peer.marketCap / peer.netIncome : null,
    },
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeStats(label: string, values: number[]): CompsStats {
  if (values.length === 0) {
    return { metric: label, min: 0, q1: 0, median: 0, mean: 0, q3: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    metric: label,
    min: sorted[0],
    q1: percentile(sorted, 25),
    median: percentile(sorted, 50),
    mean,
    q3: percentile(sorted, 75),
    max: sorted[sorted.length - 1],
  };
}

/**
 * Run full comps analysis.
 *
 * @param peers - array of peer company data
 * @param targetRevenue - target company's revenue (for implied EV calc)
 * @param targetEbitda - target company's EBITDA
 * @param targetNetIncome - target company's net income
 * @param targetNetDebt - target company's net debt (for EV→Equity)
 */
export function runCompsAnalysis(args: {
  peers: CompsPeer[];
  targetRevenue: number;
  targetEbitda: number;
  targetNetIncome: number;
  targetNetDebt: number;
}): CompsResult {
  const { peers: rawPeers, targetRevenue, targetEbitda, targetNetIncome, targetNetDebt } = args;

  const peers = rawPeers.map(calculatePeerMultiples);

  // Extract valid multiples
  const evRevenues = peers.map(p => p.multiples.evRevenue).filter((v): v is number => v != null && v > 0);
  const evEbitdas = peers.map(p => p.multiples.evEbitda).filter((v): v is number => v != null && v > 0);
  const pes = peers.map(p => p.multiples.pe).filter((v): v is number => v != null && v > 0);

  const stats: CompsStats[] = [];
  const impliedValuations: ImpliedValuation[] = [];

  if (evRevenues.length > 0) {
    const s = computeStats("EV/Revenue", evRevenues);
    stats.push(s);
    impliedValuations.push({
      metric: "EV/Revenue",
      peerMedian: s.median,
      peerMean: s.mean,
      targetValue: targetRevenue,
      impliedEVMedian: s.median * targetRevenue,
      impliedEVMean: s.mean * targetRevenue,
    });
  }

  if (evEbitdas.length > 0) {
    const s = computeStats("EV/EBITDA", evEbitdas);
    stats.push(s);
    impliedValuations.push({
      metric: "EV/EBITDA",
      peerMedian: s.median,
      peerMean: s.mean,
      targetValue: targetEbitda,
      impliedEVMedian: s.median * targetEbitda,
      impliedEVMean: s.mean * targetEbitda,
    });
  }

  if (pes.length > 0) {
    const s = computeStats("P/E", pes);
    stats.push(s);
    // P/E implies Market Cap, convert to EV by adding net debt
    impliedValuations.push({
      metric: "P/E",
      peerMedian: s.median,
      peerMean: s.mean,
      targetValue: targetNetIncome,
      impliedEVMedian: s.median * targetNetIncome + targetNetDebt,
      impliedEVMean: s.mean * targetNetIncome + targetNetDebt,
    });
  }

  // Composite EV = average of all implied EVs (using median)
  const allImpliedMedians = impliedValuations.map(iv => iv.impliedEVMedian).filter(v => v > 0);
  const compositeEV = allImpliedMedians.length > 0
    ? allImpliedMedians.reduce((s, v) => s + v, 0) / allImpliedMedians.length
    : 0;
  const compositeEquity = compositeEV - targetNetDebt;

  return { peers, stats, impliedValuations, compositeEV, compositeEquity };
}
