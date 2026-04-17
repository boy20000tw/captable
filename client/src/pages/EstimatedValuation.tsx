import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatValuation, formatDate, getRoundLabel, getRoundColor } from "@/lib/utils";
import { useState, useMemo } from "react";
import { TrendingUp, Calculator, Users, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function EstimatedValuationPage() {
  return (
    <DashboardLayout>
      <EstimatedValuationContent />
    </DashboardLayout>
  );
}

type ValuationMode = "pre-money" | "post-money";

export function EstimatedValuationContent() {
  const [currency, setCurrency] = useState<"NTD" | "USD">("NTD");
  const [valuationMode, setValuationMode] = useState<ValuationMode>("pre-money");
  const [newRoundName, setNewRoundName] = useState("Series A");
  // pre-money mode: user inputs pre-money valuation + raise amount
  const [preMoneyInput, setPreMoneyInput] = useState("");
  const [raiseAmountInput, setRaiseAmountInput] = useState("");
  // post-money mode: user inputs post-money valuation + raise amount
  const [postMoneyInput, setPostMoneyInput] = useState("");
  const [raiseAmountPostInput, setRaiseAmountPostInput] = useState("");
  const [showPerShareholder, setShowPerShareholder] = useState(true);
  const exchangeRate = 0.03128;

  const { data: rounds } = trpc.fundingRounds.list.useQuery();
  const { data: capTable } = trpc.v1.capTable.current.useQuery();

  const currentShares = capTable?.totalIssuedShares || 0;
  const esopPool = capTable?.esopPoolTotal || 0;
  const totalFullyDiluted = currentShares + (capTable?.esopPoolUnallocated || 0);

  // Latest funding round (sort by date desc)
  const latestRound = (rounds || []).slice().sort((a, b) => {
    const da = a.roundDate ? new Date(a.roundDate).getTime() : 0;
    const db = b.roundDate ? new Date(b.roundDate).getTime() : 0;
    return db - da;
  })[0];

  // Build chart data from existing rounds
  const historicalData = useMemo(() => {
    return (rounds || [])
      .filter(r => r.postMoneyValuationNtd && r.roundDate)
      .map(r => ({
        name: r.name,
        date: formatDate(r.roundDate),
        postMoney: parseFloat(r.postMoneyValuationNtd || "0"),
        preMoney: parseFloat(r.preMoneyValuationNtd || "0"),
        raised: parseFloat(r.moneyRaisedNtd || "0"),
        price: parseFloat(r.pricePerShareNtd || "0"),
        status: r.status,
      }));
  }, [rounds]);

  // Dilution simulation calculation
  const simulation = useMemo(() => {
    let preMoney = 0;
    let postMoney = 0;
    let raised = 0;

    if (valuationMode === "pre-money") {
      preMoney = parseFloat(preMoneyInput) || 0;
      raised = parseFloat(raiseAmountInput) || 0;
      postMoney = preMoney + raised;
    } else {
      postMoney = parseFloat(postMoneyInput) || 0;
      raised = parseFloat(raiseAmountPostInput) || 0;
      preMoney = postMoney - raised;
    }

    if (!preMoney || !raised || !postMoney || postMoney <= 0) return null;

    // Price per share = pre-money / current fully diluted shares
    const pricePerShare = totalFullyDiluted > 0 ? preMoney / totalFullyDiluted : 0;
    // New shares issued = raise / price per share
    const newShares = pricePerShare > 0 ? Math.round(raised / pricePerShare) : 0;
    const totalAfter = totalFullyDiluted + newShares;

    // New investor ownership
    const newInvestorPct = totalAfter > 0 ? newShares / totalAfter : 0;

    // Per-shareholder dilution
    const shareholderBreakdown = (capTable?.holdings || []).map(sh => {
      const currentPct = totalFullyDiluted > 0 ? sh.totalShares / totalFullyDiluted : 0;
      const afterPct = totalAfter > 0 ? sh.totalShares / totalAfter : 0;
      const dilutionDelta = currentPct - afterPct;
      const valueBeforeNtd = preMoney * currentPct;
      const valueAfterNtd = postMoney * afterPct;
      return {
        id: sh.investorId,
        name: sh.investorName,
        aka: null as string | null,
        type: sh.entityKind === "entity" ? "other" : "other",
        shares: sh.totalShares,
        currentPct,
        afterPct,
        dilutionDelta,
        valueBeforeNtd,
        valueAfterNtd,
        valueChangeNtd: valueAfterNtd - valueBeforeNtd,
      };
    }).sort((a, b) => b.shares - a.shares);

    return {
      name: newRoundName || "New Round",
      preMoney,
      postMoney,
      raised,
      pricePerShare,
      newShares,
      totalAfter,
      newInvestorPct,
      shareholderBreakdown,
    };
  }, [valuationMode, preMoneyInput, raiseAmountInput, postMoneyInput, raiseAmountPostInput, newRoundName, totalFullyDiluted, capTable]);

  const chartData = useMemo(() => {
    const data: { name: string; value: number; type: "actual" | "projected" }[] = historicalData.map(d => ({
      name: d.name,
      value: currency === "USD" ? d.postMoney * exchangeRate / 1_000_000 : d.postMoney / 1_000_000,
      type: "actual" as const,
    }));
    if (simulation) {
      data.push({
        name: simulation.name + " (proj.)",
        value: currency === "USD" ? simulation.postMoney * exchangeRate / 1_000_000 : simulation.postMoney / 1_000_000,
        type: "projected" as const,
      });
    }
    return data;
  }, [historicalData, simulation, currency, exchangeRate]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>
            Estimated Valuation
          </h1>
          <p className="text-sm text-muted-foreground">
            Per-round pre/post money valuation estimates based on funding rounds
          </p>
        </div>
        <div className="flex border border-border rounded-sm overflow-hidden">
          {(["NTD", "USD"] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Current State Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Issued Shares", value: formatShares(currentShares), sub: "current" },
          { label: "ESOP Pool", value: formatShares(esopPool), sub: "authorized" },
          { label: "Fully Diluted", value: formatShares(totalFullyDiluted), sub: "total" },
          {
            label: "Latest Valuation",
            value: formatValuation(latestRound?.postMoneyValuationNtd, currency, exchangeRate),
            sub: latestRound?.name || "—",
          },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-sm p-5 space-y-2">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{card.label}</p>
            <p className="text-xl font-bold tracking-tight tabular-nums" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Valuation Chart */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-4">
          <div className="space-y-0.5">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Valuation Trajectory</p>
            <h3 className="text-base font-semibold tracking-tight">
              Post-Money Valuation ({currency === "USD" ? "USD M" : "NT$ M"})
            </h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}M`} />
                <Tooltip
                  formatter={(v: number) => [`${currency === "USD" ? "USD" : "NT$"} ${v.toFixed(2)}M`, "Post-Money"]}
                  contentStyle={{ fontSize: "11px", border: "1px solid var(--border)", borderRadius: "2px" }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.type === "projected" ? "#b89a5a" : "var(--primary)"} fillOpacity={entry.type === "projected" ? 0.7 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dilution Simulator */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="text-base font-semibold tracking-tight">Round Modeler</h3>
              <p className="text-xs text-muted-foreground">Enter valuation parameters to simulate dilution</p>
            </div>
          </div>
          {/* Valuation Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Input mode:</span>
            <div className="flex border border-border rounded-sm overflow-hidden">
              {(["pre-money", "post-money"] as const).map(m => (
                <button key={m} onClick={() => setValuationMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${valuationMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "pre-money" ? "Pre-Money" : "Post-Money"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Round Name</label>
            <input type="text" value={newRoundName} onChange={e => setNewRoundName(e.target.value)}
              className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {valuationMode === "pre-money" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Pre-Money Valuation (NT$)
                </label>
                <input type="number" value={preMoneyInput} onChange={e => setPreMoneyInput(e.target.value)}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. 300000000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Capital Raise (NT$)
                </label>
                <input type="number" value={raiseAmountInput} onChange={e => setRaiseAmountInput(e.target.value)}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. 50000000" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Post-Money Valuation (NT$)
                </label>
                <input type="number" value={postMoneyInput} onChange={e => setPostMoneyInput(e.target.value)}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. 350000000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Capital Raise (NT$)
                </label>
                <input type="number" value={raiseAmountPostInput} onChange={e => setRaiseAmountPostInput(e.target.value)}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. 50000000" />
              </div>
            </>
          )}
        </div>

        {/* Simulation Results */}
        {simulation && (
          <div className="space-y-5 border-t border-border pt-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Pre-Money", value: formatValuation(simulation.preMoney, currency, exchangeRate) },
                { label: "Capital Raised", value: formatValuation(simulation.raised, currency, exchangeRate) },
                { label: "Post-Money", value: formatValuation(simulation.postMoney, currency, exchangeRate) },
                { label: "Price / Share", value: `NT$ ${simulation.pricePerShare.toFixed(2)}` },
                { label: "New Shares", value: formatShares(simulation.newShares) },
              ].map(item => (
                <div key={item.label} className="bg-secondary/40 rounded-sm p-3 space-y-1">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{item.label}</p>
                  <p className="text-sm font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Ownership Bar */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Post-Round Ownership Structure</p>
              <div className="flex h-5 rounded-sm overflow-hidden gap-px">
                {simulation.shareholderBreakdown.map((sh, i) => (
                  <div key={sh.id}
                    style={{
                      width: `${sh.afterPct * 100 * (1 - simulation.newInvestorPct)}%`,
                      background: getRoundColor(sh.type || "other"),
                      minWidth: sh.afterPct > 0.01 ? "2px" : "0",
                    }}
                    title={`${sh.name}: ${(sh.afterPct * 100).toFixed(2)}%`}
                  />
                ))}
                <div
                  style={{ width: `${simulation.newInvestorPct * 100}%`, background: "#b89a5a" }}
                  title={`New investors: ${(simulation.newInvestorPct * 100).toFixed(2)}%`}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                <span>Existing: {((1 - simulation.newInvestorPct) * 100).toFixed(1)}%</span>
                <span className="text-amber-600 font-medium">New investors: {(simulation.newInvestorPct * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Per-Shareholder Breakdown */}
            <div>
              <button
                onClick={() => setShowPerShareholder(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold tracking-tight mb-3 hover:text-muted-foreground transition-colors"
              >
                <Users className="h-4 w-4" />
                Per-Shareholder Dilution Analysis
                {showPerShareholder ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showPerShareholder && (
                <div className="border border-border rounded-sm overflow-hidden">
                  <table className="cap-table w-full">
                    <thead>
                      <tr>
                        <th>Shareholder</th>
                        <th>Type</th>
                        <th className="text-right">Shares</th>
                        <th className="text-right">Before</th>
                        <th className="text-right">After</th>
                        <th className="text-right">Dilution</th>
                        <th className="text-right">Value Before</th>
                        <th className="text-right">Value After</th>
                        <th className="text-right">Value Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.shareholderBreakdown.map(sh => (
                        <tr key={sh.id}>
                          <td>
                            <div>
                              <p className="font-medium">{sh.name}</p>
                              {sh.aka && <p className="text-xs text-muted-foreground">{sh.aka}</p>}
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${sh.type || "other"} text-xs px-2 py-0.5 rounded-full font-medium`}>
                              {getRoundLabel(sh.type || "other")}
                            </span>
                          </td>
                          <td className="text-right tabular-nums">{formatShares(sh.shares)}</td>
                          <td className="text-right tabular-nums font-medium">{(sh.currentPct * 100).toFixed(3)}%</td>
                          <td className="text-right tabular-nums font-medium text-primary">{(sh.afterPct * 100).toFixed(3)}%</td>
                          <td className="text-right tabular-nums text-destructive">
                            −{(sh.dilutionDelta * 100).toFixed(3)}%
                          </td>
                          <td className="text-right tabular-nums text-muted-foreground text-xs">
                            {formatValuation(sh.valueBeforeNtd, currency, exchangeRate)}
                          </td>
                          <td className="text-right tabular-nums text-xs font-medium">
                            {formatValuation(sh.valueAfterNtd, currency, exchangeRate)}
                          </td>
                          <td className={`text-right tabular-nums text-xs font-medium ${sh.valueChangeNtd >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {sh.valueChangeNtd >= 0 ? "+" : ""}{formatValuation(sh.valueChangeNtd, currency, exchangeRate)}
                          </td>
                        </tr>
                      ))}
                      {/* New Investors Row */}
                      <tr className="bg-amber-50/50">
                        <td><p className="font-medium text-amber-700">New Investors ({simulation.name})</p></td>
                        <td><span className="badge text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">New</span></td>
                        <td className="text-right tabular-nums">{formatShares(simulation.newShares)}</td>
                        <td className="text-right tabular-nums text-muted-foreground">—</td>
                        <td className="text-right tabular-nums font-medium text-amber-700">{(simulation.newInvestorPct * 100).toFixed(3)}%</td>
                        <td className="text-right text-muted-foreground">—</td>
                        <td className="text-right text-muted-foreground">—</td>
                        <td className="text-right tabular-nums text-xs font-medium text-amber-700">
                          {formatValuation(simulation.raised, currency, exchangeRate)}
                        </td>
                        <td className="text-right text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan={2} className="font-semibold">Total (Post-Round)</td>
                        <td className="text-right tabular-nums font-semibold">{formatShares(simulation.totalAfter)}</td>
                        <td className="text-right tabular-nums font-semibold">100.000%</td>
                        <td className="text-right tabular-nums font-semibold">100.000%</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-sm p-3">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Price per share is calculated as <strong>Pre-Money Valuation ÷ Fully Diluted Shares</strong> ({formatShares(totalFullyDiluted)} shares).
                New shares issued = Capital Raise ÷ Price per Share. This model assumes standard dilution without anti-dilution adjustments.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Historical Rounds Detail */}
      {historicalData.length > 0 && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold tracking-tight">Historical Round Details</h3>
          </div>
          <table className="cap-table w-full">
            <thead>
              <tr>
                <th>Round</th>
                <th>Date</th>
                <th className="text-right">Price / Share</th>
                <th className="text-right">Raised</th>
                <th className="text-right">Pre-Money</th>
                <th className="text-right">Post-Money</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historicalData.map((r, i) => (
                <tr key={`hist-${i}-${r.name}`}>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-muted-foreground">{r.date}</td>
                  <td className="text-right tabular-nums">
                    {r.price > 0
                      ? currency === "USD"
                        ? `$${(r.price * exchangeRate).toFixed(2)}`
                        : `NT$ ${r.price.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums">{formatValuation(r.raised, currency, exchangeRate)}</td>
                  <td className="text-right tabular-nums">{formatValuation(r.preMoney, currency, exchangeRate)}</td>
                  <td className="text-right tabular-nums font-medium">{formatValuation(r.postMoney, currency, exchangeRate)}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "completed" ? "bg-green-100 text-green-700" :
                      r.status === "bridge" ? "bg-orange-100 text-orange-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
