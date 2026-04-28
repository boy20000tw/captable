import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Droplets, TrendingUp, Settings, AlertCircle, Info } from "lucide-react";

import { toast } from "sonner";

const formatNTD = (v: number) => formatCurrency(v, "NTD");
const formatUSD = (v: number) => formatCurrency(v, "USD");

// Moved into component to use t()

const ROUND_COLORS = [
  "#1a1a1a", "#8b7355", "#6b8e6b", "#5b7fa6", "#9b6b9b",
  "#c4956a", "#6b9b8e", "#a67b5b", "#7b8ea6", "#8e7b6b",
];

export default function Waterfall() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("analysis");
  const [exitValueInput, setExitValueInput] = useState("500000000");
  const [exitValueNtd, setExitValueNtd] = useState(500_000_000);
  const [showSettings, setShowSettings] = useState(false);

  const { data: rounds = [] } = trpc.fundingRounds.list.useQuery();
  const { data: prefs = [], refetch: refetchPrefs } = trpc.waterfall.getLiquidationPreferences.useQuery();
  const { data: waterfallData, isLoading, refetch } = trpc.waterfall.compute.useQuery(
    { exitValueNtd },
    { enabled: exitValueNtd > 0 }
  );

  const upsertPref = trpc.waterfall.upsertLiquidationPreference.useMutation({
    onSuccess: () => { refetchPrefs(); refetch(); toast.success("Preference updated"); },
  });

  const prefMap = useMemo(() => new Map(prefs.map(p => [p.fundingRoundId, p])), [prefs]);

  const PREFERENCE_LABELS: Record<string, string> = {
    non_participating: t("waterfall.1xNonPart"),
    participating: t("waterfall.1xPart"),
    capped_participating: "Capped Participating",
  };

  const handleCompute = () => {
    const val = parseFloat(exitValueInput.replace(/,/g, ""));
    if (isNaN(val) || val <= 0) { toast.error("Please enter a valid exit value"); return; }
    setExitValueNtd(val);
  };

  // Build chart data from waterfall result
  const chartData = useMemo(() => {
    if (!waterfallData) return [];
    const data: Array<{ name: string; amount: number; type: string; color: string }> = [];
    waterfallData.tranches.forEach((t, i) => {
      data.push({
        name: t.roundName,
        amount: Math.round(t.distributed),
        type: "Preference",
        color: ROUND_COLORS[i % ROUND_COLORS.length],
      });
    });
    const commonTotal = waterfallData.common.reduce((s, c) => s + c.amount, 0);
    if (commonTotal > 0) {
      data.push({ name: "Common / Participating", amount: Math.round(commonTotal), type: "Common", color: "#d4af7a" });
    }
    return data;
  }, [waterfallData]);

  // Aggregate per-shareholder totals
  const shareholderTotals = useMemo(() => {
    if (!waterfallData) return [];
    const map = new Map<string, number>();
    waterfallData.tranches.forEach(t => {
      t.shareholders.forEach(s => {
        map.set(s.name, (map.get(s.name) || 0) + s.amount);
      });
    });
    waterfallData.common.forEach(c => {
      map.set(c.name, (map.get(c.name) || 0) + c.amount);
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, pct: exitValueNtd > 0 ? amount / exitValueNtd : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [waterfallData, exitValueNtd]);

  return (
    <DashboardLayout>
      <FeatureGate feature="analysis.waterfall">
        <div className="px-8 py-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b border-stone-200 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.2em] text-stone-400 uppercase mb-2">Financial Analysis</p>
              <h1 className="font-display text-4xl font-bold text-stone-900">{tPages("waterfall.title")}</h1>
              <p className="text-stone-500 mt-2 text-sm">{tPages("waterfall.desc")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="gap-2">
              <Settings className="w-4 h-4" />
              {t("waterfall.configurePrefs")}
            </Button>
          </div>
        </div>

        {/* Exit Value Input */}
        <Card className="mb-8 border-stone-200">
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label className="text-xs tracking-widest uppercase text-stone-500 mb-2 block">{t("waterfall.exitValue")}</Label>
                <Input
                  value={exitValueInput}
                  onChange={e => setExitValueInput(e.target.value)}
                  placeholder="e.g. 500000000"
                  className="font-mono"
                />
              </div>
              <Button onClick={handleCompute} className="bg-stone-900 text-white hover:bg-stone-700">
                <TrendingUp className="w-4 h-4 mr-2" />
                {t("waterfall.runAnalysis")}
              </Button>
              <div className="text-sm text-stone-500">
                <span className="font-medium">{formatNTD(exitValueNtd)}</span>
                <span className="ml-2 text-stone-400">≈ {formatUSD(exitValueNtd / 32)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liquidation Preferences Settings */}
        {showSettings && (
          <Card className="mb-8 border-stone-200 bg-stone-50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-widest uppercase text-stone-600">
                {t("waterfall.prefsDialog")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rounds.length === 0 ? (
                <p className="text-stone-400 text-sm">{t("waterfall.emptyState")}</p>
              ) : (
                <div className="space-y-3">
                  {rounds.map((round, i) => {
                    const pref = prefMap.get(round.id);
                    return (
                      <div key={round.id} className="flex items-center gap-4 p-3 bg-white rounded border border-stone-200">
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: ROUND_COLORS[i % ROUND_COLORS.length] }} />
                        <span className="font-medium text-sm w-32 flex-shrink-0">{round.name}</span>
                        <Select
                          value={pref?.preferenceType || "non_participating"}
                          onValueChange={val => upsertPref.mutate({
                            fundingRoundId: round.id,
                            preferenceType: val as "non_participating" | "participating" | "capped_participating",
                            liquidationMultiple: String(pref?.liquidationMultiple || "1.00"),
                            seniorityRank: pref?.seniorityRank || (i + 1),
                          })}
                        >
                          <SelectTrigger className="w-48 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non_participating">{t("waterfall.1xNonPart")}</SelectItem>
                            <SelectItem value="participating">{t("waterfall.1xPart")}</SelectItem>
                            <SelectItem value="capped_participating">Capped Participating</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-500">{t("waterfall.multiple")}:</span>
                          <Input
                            className="w-20 h-8 text-xs font-mono"
                            defaultValue={String(pref?.liquidationMultiple || "1.00")}
                            onBlur={e => upsertPref.mutate({
                              fundingRoundId: round.id,
                              preferenceType: (pref?.preferenceType as "non_participating" | "participating" | "capped_participating") || "non_participating",
                              liquidationMultiple: e.target.value,
                              seniorityRank: pref?.seniorityRank || (i + 1),
                            })}
                          />
                          <span className="text-xs text-stone-400">x</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-500">{t("waterfall.seniority")}:</span>
                          <Input
                            className="w-16 h-8 text-xs font-mono"
                            type="number"
                            min={1}
                            defaultValue={pref?.seniorityRank || (i + 1)}
                            onBlur={e => upsertPref.mutate({
                              fundingRoundId: round.id,
                              preferenceType: (pref?.preferenceType as "non_participating" | "participating" | "capped_participating") || "non_participating",
                              liquidationMultiple: String(pref?.liquidationMultiple || "1.00"),
                              seniorityRank: parseInt(e.target.value) || (i + 1),
                            })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="text-center py-20 text-stone-400">Computing waterfall</div>
        )}

        {waterfallData && !isLoading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="border-stone-200">
                <CardContent className="pt-6">
                  <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">{t("waterfall.exitValue")}</p>
                  <p className="text-2xl font-bold text-stone-900">{formatNTD(exitValueNtd)}</p>
                  <p className="text-xs text-stone-400 mt-1">≈ {formatUSD(exitValueNtd / 32)}</p>
                </CardContent>
              </Card>
              <Card className="border-stone-200">
                <CardContent className="pt-6">
                  <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Preference Tranches (hardcoded - no i18n key)</p>
                  <p className="text-2xl font-bold text-stone-900">{waterfallData.tranches.length}</p>
                  <p className="text-xs text-stone-400 mt-1">
                    {formatNTD(waterfallData.tranches.reduce((s, t) => s + t.distributed, 0))} total
                  </p>
                </CardContent>
              </Card>
              <Card className="border-stone-200">
                <CardContent className="pt-6">
                  <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Remaining for Common (hardcoded - no i18n key)</p>
                  <p className="text-2xl font-bold text-stone-900">{formatNTD((waterfallData.remainingForCommon ?? 0))}</p>
                  <p className="text-xs text-stone-400 mt-1">
                    {formatPercent((waterfallData.remainingForCommon ?? 0) / exitValueNtd)} of exit
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Waterfall Bar Chart */}
            <Card className="mb-8 border-stone-200">
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-widest uppercase text-stone-600">
                  Distribution by Tranche (hardcoded - no i18n key)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="flex items-center gap-2 text-stone-400 text-sm py-8 justify-center">
                    <Info className="w-4 h-4" />
                    {t("waterfall.emptyDesc")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} />
                      <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11, fill: "#78716c" }} />
                      <Tooltip
                        formatter={(value: number) => [formatNTD(value), "Amount"]}
                        contentStyle={{ fontSize: 12, border: "1px solid #e7e5e4" }}
                      />
                      <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Tranche Details */}
            {waterfallData.tranches.length > 0 && (
              <Card className="mb-8 border-stone-200">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold tracking-widest uppercase text-stone-600">
                    Preference Tranche Details (hardcoded - no i18n key)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {waterfallData.tranches.map((tranche, i) => (
                      <div key={tranche.roundId} className="border border-stone-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-stone-50">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ROUND_COLORS[i % ROUND_COLORS.length] }} />
                            <span className="font-semibold text-sm">{tranche.roundName}</span>
                            <Badge variant="outline" className="text-xs">
                              {PREFERENCE_LABELS[tranche.preferenceType]}
                            </Badge>
                            <span className="text-xs text-stone-500">{tranche.liquidationMultiple}x</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{formatNTD(tranche.distributed)}</p>
                            <p className="text-xs text-stone-400">
                              {formatPercent(exitValueNtd > 0 ? tranche.distributed / exitValueNtd : 0)} of exit
                            </p>
                          </div>
                        </div>
                        {tranche.shareholders.length > 0 && (
                          <div className="overflow-x-auto">
                          <table className="w-full text-xs min-w-[640px]">
                            <thead>
                              <tr className="border-b border-stone-100">
                                <th className="text-left px-4 py-2 text-stone-400 font-normal">Shareholder</th>
                                <th className="text-right px-4 py-2 text-stone-400 font-normal">Shares</th>
                                <th className="text-right px-4 py-2 text-stone-400 font-normal">Amount</th>
                                <th className="text-right px-4 py-2 text-stone-400 font-normal">% of Exit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tranche.shareholders.map((sh, j) => (
                                <tr key={j} className="border-b border-stone-50 hover:bg-stone-50">
                                  <td className="px-4 py-2 font-medium">{sh.name}</td>
                                  <td className="px-4 py-2 text-right font-mono">{sh.shares.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right font-mono">{formatNTD(sh.amount)}</td>
                                  <td className="px-4 py-2 text-right text-stone-500">
                                    {formatPercent(exitValueNtd > 0 ? sh.amount / exitValueNtd : 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shareholder Summary */}
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-widest uppercase text-stone-600">
                  Total Distribution per Shareholder (hardcoded - no i18n key)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shareholderTotals.length === 0 ? (
                  <div className="flex items-center gap-2 text-stone-400 text-sm py-8 justify-center">
                    <AlertCircle className="w-4 h-4" />
                    No shareholder data available. Import cap table data first. (hardcoded - no i18n key)
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-3 text-xs tracking-widest uppercase text-stone-400 font-normal">Shareholder</th>
                        <th className="text-right py-3 text-xs tracking-widest uppercase text-stone-400 font-normal">Total Proceeds</th>
                        <th className="text-right py-3 text-xs tracking-widest uppercase text-stone-400 font-normal">% of Exit</th>
                        <th className="text-right py-3 text-xs tracking-widest uppercase text-stone-400 font-normal">USD Equivalent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shareholderTotals.map((sh, i) => (
                        <tr key={i} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                          <td className="py-3 font-medium">{sh.name}</td>
                          <td className="py-3 text-right font-mono">{formatNTD(sh.amount)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-stone-100 rounded-full h-1.5">
                                <div
                                  className="bg-stone-700 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(sh.pct * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-stone-600 w-12 text-right">{formatPercent(sh.pct)}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right text-stone-500 font-mono">{formatUSD(sh.amount / 32)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-stone-300">
                        <td className="py-3 font-bold text-xs tracking-widest uppercase">Total</td>
                        <td className="py-3 text-right font-bold font-mono">{formatNTD(exitValueNtd)}</td>
                        <td className="py-3 text-right font-bold">100.0%</td>
                        <td className="py-3 text-right font-bold font-mono text-stone-500">{formatUSD(exitValueNtd / 32)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!waterfallData && !isLoading && (
          <div className="text-center py-20">
            <Droplets className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400">Enter an exit value and click Run Analysis to compute the waterfall distribution. (hardcoded - no i18n key)</p>
          </div>
        )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
