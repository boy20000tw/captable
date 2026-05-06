import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { runCompsAnalysis, type CompsResult, type CompsPeer } from "@shared/compsCalc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { BarChart3, FileSpreadsheet, FileText, Plus, Trash2, TrendingUp } from "lucide-react";
import { exportCompsPdf, exportCompsExcel } from "@/utils/analysisExport";

type DbCompsPeer = inferRouterOutputs<AppRouter>["comps"]["list"][number];

export default function CompsAnalysisPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="analysis.projections">
        <CompsContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

function fmtCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtMultiple(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}x`;
}

function CompsContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("analysis");
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  // ── Peers CRUD ──
  const { data: rawPeers = [], isLoading } = trpc.comps.list.useQuery();
  const createPeer = trpc.comps.create.useMutation({
    onSuccess: () => { utils.comps.list.invalidate(); toast.success(t("comps.peerAdded")); },
    onError: (e) => toast.error(e.message),
  });
  const deletePeer = trpc.comps.delete.useMutation({
    onSuccess: () => { utils.comps.list.invalidate(); toast.success(t("comps.peerDeleted")); },
    onError: (e) => toast.error(e.message),
  });

  // ── Add peer form state ──
  const [peerForm, setPeerForm] = useState({
    name: "", ticker: "", revenue: "", ebitda: "", netIncome: "", marketCap: "", netDebt: "",
  });

  // ── Target company inputs ──
  const [targetRevenue, setTargetRevenue] = useState(1_000_000);
  const [targetEbitda, setTargetEbitda] = useState(200_000);
  const [targetNetIncome, setTargetNetIncome] = useState(100_000);
  const [targetNetDebt, setTargetNetDebt] = useState(0);

  // Convert DB peers to calc format
  const peers: CompsPeer[] = (rawPeers as DbCompsPeer[]).map((p) => ({
    id: p.id,
    name: p.name,
    ticker: p.ticker ?? undefined,
    revenue: parseFloat(p.revenue ?? "0"),
    ebitda: parseFloat(p.ebitda ?? "0"),
    netIncome: parseFloat(p.netIncome ?? "0"),
    marketCap: parseFloat(p.marketCap ?? "0"),
    netDebt: parseFloat(p.netDebt ?? "0"),
  }));

  // Run analysis
  const result: CompsResult | null = useMemo(() => {
    if (peers.length === 0) return null;
    return runCompsAnalysis({
      peers,
      targetRevenue,
      targetEbitda,
      targetNetIncome,
      targetNetDebt,
    });
  }, [peers, targetRevenue, targetEbitda, targetNetIncome, targetNetDebt]);

  function handleAddPeer() {
    if (!peerForm.name) return;
    createPeer.mutate({
      name: peerForm.name,
      ticker: peerForm.ticker || undefined,
      revenue: Number(peerForm.revenue) || 0,
      ebitda: Number(peerForm.ebitda) || 0,
      netIncome: Number(peerForm.netIncome) || 0,
      marketCap: Number(peerForm.marketCap) || 0,
      netDebt: Number(peerForm.netDebt) || 0,
    });
    setPeerForm({ name: "", ticker: "", revenue: "", ebitda: "", netIncome: "", marketCap: "", netDebt: "" });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tPages("comps.title")}</h1>
          <p className="text-muted-foreground mt-1">{tPages("comps.desc")}</p>
        </div>
        {result && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                try {
                  exportCompsPdf(result);
                  toast.success(t("export.exportSuccess"));
                } catch { toast.error(t("export.exportError")); }
              }}
            >
              <FileText className="h-4 w-4" /> {t("export.compsPdf")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                try {
                  await exportCompsExcel(result);
                  toast.success(t("export.exportSuccess"));
                } catch { toast.error(t("export.exportError")); }
              }}
            >
              <FileSpreadsheet className="h-4 w-4" /> {t("export.compsExcel")}
            </Button>
          </div>
        )}
      </div>

      {/* ── Target Company Inputs ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("comps.targetCompany")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">{t("comps.targetRevenue")}</Label>
              <Input type="number" value={targetRevenue} onChange={(e) => setTargetRevenue(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">{t("comps.targetEbitda")}</Label>
              <Input type="number" value={targetEbitda} onChange={(e) => setTargetEbitda(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">{t("comps.targetNetIncome")}</Label>
              <Input type="number" value={targetNetIncome} onChange={(e) => setTargetNetIncome(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">{t("comps.targetNetDebt")}</Label>
              <Input type="number" value={targetNetDebt} onChange={(e) => setTargetNetDebt(Number(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Peer Companies Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{t("comps.peerCompanies")} ({peers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add peer row */}
          {canEdit && (
            <div className="grid grid-cols-8 gap-2 items-end">
              <div>
                <Label className="text-xs">{t("comps.name")}</Label>
                <Input value={peerForm.name} onChange={(e) => setPeerForm({ ...peerForm, name: e.target.value })} placeholder="e.g. Veeva" />
              </div>
              <div>
                <Label className="text-xs">{t("comps.ticker")}</Label>
                <Input value={peerForm.ticker} onChange={(e) => setPeerForm({ ...peerForm, ticker: e.target.value })} placeholder="VEEV" />
              </div>
              <div>
                <Label className="text-xs">{t("comps.revenue")}</Label>
                <Input type="number" value={peerForm.revenue} onChange={(e) => setPeerForm({ ...peerForm, revenue: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">EBITDA</Label>
                <Input type="number" value={peerForm.ebitda} onChange={(e) => setPeerForm({ ...peerForm, ebitda: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t("comps.netIncomeLabel")}</Label>
                <Input type="number" value={peerForm.netIncome} onChange={(e) => setPeerForm({ ...peerForm, netIncome: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t("comps.marketCap")}</Label>
                <Input type="number" value={peerForm.marketCap} onChange={(e) => setPeerForm({ ...peerForm, marketCap: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t("comps.netDebtLabel")}</Label>
                <Input type="number" value={peerForm.netDebt} onChange={(e) => setPeerForm({ ...peerForm, netDebt: e.target.value })} />
              </div>
              <Button onClick={handleAddPeer} disabled={!peerForm.name || createPeer.isPending} className="gap-1">
                <Plus className="h-4 w-4" /> {t("comps.add")}
              </Button>
            </div>
          )}

          {/* Peer table */}
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("comps.loading")}
            </div>
          ) : peers.length === 0 ? (
            <div className="py-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">{t("comps.emptyState")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("comps.emptyDesc")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border">
                    {[t("comps.name"), t("comps.ticker"), t("comps.revenue"), "EBITDA", t("comps.netIncomeLabel"), t("comps.marketCap"), t("comps.netDebtLabel"), "EV", "EV/Rev", "EV/EBITDA", "P/E", ""].map((h, i) => (
                      <th key={i} className="text-left px-2 py-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result?.peers ?? []).map((p) => (
                    <tr key={p.id ?? p.name} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium">{p.name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{p.ticker || "—"}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtCurrency(p.revenue)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtCurrency(p.ebitda)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtCurrency(p.netIncome)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtCurrency(p.marketCap)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtCurrency(p.netDebt)}</td>
                      <td className="px-2 py-1.5 tabular-nums font-semibold">{fmtCurrency(p.enterpriseValue)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtMultiple(p.multiples.evRevenue)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtMultiple(p.multiples.evEbitda)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtMultiple(p.multiples.pe)}</td>
                      <td className="px-2 py-1.5">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => p.id && deletePeer.mutate({ id: p.id })}
                            aria-label={t("comps.deletePeer")}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Analysis Results ── */}
      {result && result.peers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Multiple Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("comps.multipleStats")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t("comps.metric"), "Min", "Q1", t("comps.median"), t("comps.mean"), "Q3", "Max"].map((h) => (
                      <th key={h} className="text-right px-2 py-1.5 font-medium text-muted-foreground text-xs first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.stats.map((s) => (
                    <tr key={s.metric} className="border-b border-border/50">
                      <td className="px-2 py-1.5 font-medium">{s.metric}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.min.toFixed(1)}x</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.q1.toFixed(1)}x</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{s.median.toFixed(1)}x</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.mean.toFixed(1)}x</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.q3.toFixed(1)}x</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.max.toFixed(1)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Implied Valuations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> {t("comps.impliedValuation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.impliedValuations.map((iv) => (
                  <div key={iv.metric} className="border-b border-border/50 pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{iv.metric}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("comps.median")}: {fmtMultiple(iv.peerMedian)} × {fmtCurrency(iv.targetValue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground">{t("comps.impliedEVMedian")}</span>
                      <span className="text-sm font-semibold tabular-nums">{fmtCurrency(iv.impliedEVMedian)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{t("comps.impliedEVMean")}</span>
                      <span className="text-sm tabular-nums">{fmtCurrency(iv.impliedEVMean)}</span>
                    </div>
                  </div>
                ))}

                {/* Composite */}
                <div className="border-t-2 border-border pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">{t("comps.compositeEV")}</span>
                    <span className="text-lg font-bold tabular-nums">{fmtCurrency(result.compositeEV)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-semibold">{t("comps.compositeEquity")}</span>
                    <span className="text-base font-bold tabular-nums text-primary">{fmtCurrency(result.compositeEquity)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
