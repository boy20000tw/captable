import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatPercent, formatValuation, formatDate, getRoundLabel, ROUND_CHART_COLORS } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function CapTablePage() {
  return (
    <DashboardLayout>
      <CapTableContent />
    </DashboardLayout>
  );
}

function CapTableContent() {
  const [currency, setCurrency] = useState<"NTD" | "USD">("NTD");
  const [sortBy, setSortBy] = useState<"shares" | "name" | "type">("shares");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedRoundId, setSelectedRoundId] = useState<number | null | "all">(null);

  const { data: summary, isLoading } = trpc.capTable.summary.useQuery();
  const { data: allHoldings } = trpc.holdings.all.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();
  const { data: shareholders } = trpc.shareholders.list.useQuery();

  const exchangeRate = 0.03128;

  // Determine which round to show: null = default to latest, "all" = aggregate all, number = specific round
  const activeRoundId: number | null = selectedRoundId === "all"
    ? null
    : (selectedRoundId ?? summary?.latestRound?.id ?? null);
  const isAllRounds = selectedRoundId === "all";

  const holdingsForRound = useMemo(() => {
    if (!allHoldings || !shareholders) return [];

    type HoldingRow = NonNullable<typeof allHoldings>[number];
    type ShareholderRow = NonNullable<typeof shareholders>[number];
    type AggRow = HoldingRow & { shareholder: ShareholderRow | undefined };

    // Helper: aggregate holdings per shareholder from a filtered set
    function aggregateHoldings(filtered: HoldingRow[]): AggRow[] {
      const map = new Map<number, AggRow>();
      for (const h of filtered) {
        if (!map.has(h.shareholderId)) {
          map.set(h.shareholderId, { ...h, shareholder: shareholders!.find(s => s.id === h.shareholderId) });
        } else {
          const existing = map.get(h.shareholderId)!;
          map.set(h.shareholderId, {
            ...existing,
            totalShares: existing.totalShares + h.totalShares,
            commonShares: (existing.commonShares || 0) + (h.commonShares || 0),
            seedShares: (existing.seedShares || 0) + (h.seedShares || 0),
            seedPlusShares: (existing.seedPlusShares || 0) + (h.seedPlusShares || 0),
            preAShares: (existing.preAShares || 0) + (h.preAShares || 0),
            bridgeShares: (existing.bridgeShares || 0) + (h.bridgeShares || 0),
            seriesAShares: (existing.seriesAShares || 0) + (h.seriesAShares || 0),
            esopShares: (existing.esopShares || 0) + (h.esopShares || 0),
            paidInCapitalNtd: String(
              parseFloat(existing.paidInCapitalNtd || "0") + parseFloat(h.paidInCapitalNtd || "0")
            ),
          });
        }
      }
      return Array.from(map.values()).filter(h => h.totalShares > 0);
    }

    if (activeRoundId && rounds) {
      // Specific round: aggregate holdings for this round AND all prior rounds (cumulative cap table)
      // rounds are ordered by date asc, so find index of selected round
      const roundIdx = rounds.findIndex(r => r.id === activeRoundId);
      const eligibleRoundIds = new Set(
        rounds.slice(0, roundIdx + 1).map(r => r.id)
      );
      const filtered = allHoldings.filter(h => h.fundingRoundId != null && eligibleRoundIds.has(h.fundingRoundId));
      return aggregateHoldings(filtered);
    }

    // All rounds (or no rounds data): aggregate all holdings per shareholder
    return aggregateHoldings(allHoldings);
  }, [allHoldings, shareholders, activeRoundId, rounds]);

  const sorted = useMemo(() => {
    return [...holdingsForRound].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "shares") cmp = a.totalShares - b.totalShares;
      else if (sortBy === "name") cmp = (a.shareholder?.name || "").localeCompare(b.shareholder?.name || "");
      else if (sortBy === "type") cmp = (a.shareholder?.type || "").localeCompare(b.shareholder?.type || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [holdingsForRound, sortBy, sortDir]);

  const totalShares = sorted.reduce((s, h) => s + h.totalShares, 0);

  const pieData = useMemo(() => {
    return sorted.slice(0, 10).map(h => ({
      id: h.shareholderId,
      name: h.shareholder?.name || "Unknown",
      value: h.totalShares,
      type: h.shareholder?.type || "other",
    }));
  }, [sorted]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-muted-foreground/30">↕</span>;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronUp className="h-3 w-3 inline" />;
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Cap Table
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalShares > 0 ? `${formatShares(totalShares)} total shares · ${sorted.length} shareholders` : "No data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex border border-border rounded-sm overflow-hidden">
            {(["NTD", "USD"] as const).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-sm px-3 py-1.5 transition-colors">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  const roundName = rounds?.find(r => r.id === activeRoundId)?.name || "All Rounds";
                  const headers = ["Shareholder", "Type", "Shares", "Ownership %", "Paid-In Capital (NTD)"];
                  const rows = sorted.map(h => {
                    const pct = totalShares > 0 ? h.totalShares / totalShares : 0;
                    const paidIn = h.paidInCapitalNtd ? parseFloat(h.paidInCapitalNtd) : null;
                    return [
                      h.shareholder?.name || "",
                      h.shareholder?.type?.replace(/_/g, " ") || "",
                      h.totalShares,
                      (pct * 100).toFixed(4) + "%",
                      paidIn ? paidIn.toLocaleString() : "",
                    ];
                  });
                  rows.push(["TOTAL", "", totalShares, "100%", sorted.reduce((s, h) => s + (h.paidInCapitalNtd ? parseFloat(h.paidInCapitalNtd) : 0), 0).toLocaleString()]);
                  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `cap-table-${roundName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Exported as CSV");
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const roundName = rounds?.find(r => r.id === activeRoundId)?.name || "All Rounds";
                  const rows = sorted.map(h => {
                    const pct = totalShares > 0 ? h.totalShares / totalShares : 0;
                    const paidIn = h.paidInCapitalNtd ? parseFloat(h.paidInCapitalNtd) : null;
                    return `<tr><td>${h.shareholder?.name || ""}</td><td>${h.shareholder?.type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || ""}</td><td style="text-align:right">${h.totalShares.toLocaleString()}</td><td style="text-align:right">${(pct * 100).toFixed(4)}%</td><td style="text-align:right">${paidIn ? "NT$" + (paidIn / 10000).toFixed(0) + "萬" : "—"}</td></tr>`;
                  }).join("");
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cap Table - ${roundName}</title><style>body{font-family:Georgia,serif;margin:40px;color:#1a1a1a}h1{font-size:28px;margin-bottom:4px}.sub{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#888;margin-bottom:30px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;border-bottom:2px solid #1a1a1a;padding:8px 12px;font-size:10px;letter-spacing:.1em;text-transform:uppercase}td{padding:8px 12px;border-bottom:1px solid #e5e5e5}.total td{border-top:2px solid #1a1a1a;font-weight:bold}.footer{margin-top:20px;font-size:10px;color:#888}@media print{body{margin:20px}}</style></head><body><h1>Cap Table</h1><p class="sub">${roundName} &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Shareholder</th><th>Type</th><th style="text-align:right">Shares</th><th style="text-align:right">Ownership</th><th style="text-align:right">Paid-In Capital</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><td><strong>Total</strong></td><td></td><td style="text-align:right"><strong>${totalShares.toLocaleString()}</strong></td><td style="text-align:right"><strong>100%</strong></td><td></td></tr></tfoot></table><p class="footer">Confidential — for internal use only.</p></body></html>`;
                  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const w = window.open(url, "_blank");
                  if (w) { setTimeout(() => { w.print(); }, 500); }
                  URL.revokeObjectURL(url);
                  toast.success("Print dialog opened — save as PDF");
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print / PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Round Selector */}
      {rounds && rounds.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            key="all"
            onClick={() => setSelectedRoundId("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              isAllRounds
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            All Rounds
          </button>
          {rounds.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRoundId(r.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                !isAllRounds && activeRoundId === r.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-16 text-center">
          <p className="text-muted-foreground">No cap table data for this round.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table */}
          <div className="lg:col-span-2 bg-card border border-border rounded-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold tracking-tight">Shareholder Register</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rounds?.find(r => r.id === activeRoundId)?.name || "Latest"} Round
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="cap-table w-full">
                <thead>
                  <tr>
                    <th className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      Shareholder <SortIcon col="name" />
                    </th>
                    <th className="cursor-pointer select-none" onClick={() => toggleSort("type")}>
                      Type <SortIcon col="type" />
                    </th>
                    <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("shares")}>
                      Shares <SortIcon col="shares" />
                    </th>
                    <th className="text-right">Ownership %</th>
                    <th className="text-right">Paid-In Capital</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, i) => {
                    const pct = totalShares > 0 ? h.totalShares / totalShares : 0;
                    const paidIn = h.paidInCapitalNtd ? parseFloat(h.paidInCapitalNtd) : null;
                    const paidInDisplay = paidIn
                      ? currency === "USD"
                        ? `$${((paidIn * exchangeRate) / 1_000_000).toFixed(2)}M`
                        : `NT$${(paidIn / 10_000).toFixed(0)}萬`
                      : "—";

                    return (
                      <tr key={h.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length] }}
                            />
                            <div>
                              <p className="font-medium text-sm">{h.shareholder?.name || "—"}</p>
                              {h.shareholder?.aka && (
                                <p className="text-xs text-muted-foreground">{h.shareholder.aka}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${h.shareholder?.type || "other"}`}>
                            {getRoundLabel(h.shareholder?.type || "other")}
                          </span>
                        </td>
                        <td className="text-right tabular-nums font-medium">{formatShares(h.totalShares)}</td>
                        <td className="text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(pct * 100, 100)}%`,
                                  background: ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length],
                                }}
                              />
                            </div>
                            <span>{(pct * 100).toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">{paidInDisplay}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={2} className="font-semibold">Total</td>
                    <td className="text-right tabular-nums font-semibold">{formatShares(totalShares)}</td>
                    <td className="text-right font-semibold">100.00%</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {(() => {
                        const total = sorted.reduce((s, h) => s + (h.paidInCapitalNtd ? parseFloat(h.paidInCapitalNtd) : 0), 0);
                        return total > 0
                          ? currency === "USD"
                            ? `$${((total * exchangeRate) / 1_000_000).toFixed(2)}M`
                            : `NT$${(total / 10_000).toFixed(0)}萬`
                          : "—";
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Pie Chart + Summary */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold tracking-tight">Ownership Distribution</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={ROUND_CHART_COLORS[index % ROUND_CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [
                        `${formatShares(v)} (${totalShares > 0 ? ((v / totalShares) * 100).toFixed(1) : 0}%)`,
                        "Shares",
                      ]}
                      contentStyle={{ fontSize: "11px", border: "1px solid var(--border)", borderRadius: "2px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-1.5">
                {pieData.slice(0, 6).map((entry, i) => (
                  <div key={`pie-${entry.id ?? i}`} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length] }} />
                      <span className="truncate max-w-[110px]">{entry.name}</span>
                    </div>
                    <span className="text-muted-foreground tabular-nums">
                      {totalShares > 0 ? ((entry.value / totalShares) * 100).toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Round Summary Card */}
            {rounds?.find(r => r.id === activeRoundId) && (() => {
              const r = rounds.find(r => r.id === activeRoundId)!;
              return (
                <div className="bg-card border border-border rounded-sm p-5 space-y-3">
                  <h3 className="text-sm font-semibold tracking-tight">{r.name} Round</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{formatDate(r.roundDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price / Share</span>
                      <span className="tabular-nums">
                        {r.pricePerShareNtd ? `NT$ ${parseFloat(r.pricePerShareNtd).toLocaleString()}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Raised</span>
                      <span className="tabular-nums">{formatValuation(r.moneyRaisedNtd, currency, exchangeRate)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-medium">
                      <span className="text-muted-foreground">Post-Money</span>
                      <span className="tabular-nums">{formatValuation(r.postMoneyValuationNtd, currency, exchangeRate)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
