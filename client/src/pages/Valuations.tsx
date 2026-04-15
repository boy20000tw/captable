import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Trash2, Edit2, TrendingUp, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const METHOD_LABELS: Record<string, string> = {
  dcf: "DCF",
  market_comparable: "Market Comparable",
  asset_based: "Asset Based",
  "409a_safe_harbor": "FMV Safe Harbor",
  other: "Other",
};

type ValuationForm = {
  valuationDate: string;
  fmvPerShareNtd: string;
  fmvPerShareUsd: string;
  commonStockValueNtd: string;
  preferredStockValueNtd: string;
  totalCompanyValueNtd: string;
  valuationFirm: string;
  reportUrl: string;
  method: string;
  relatedRoundId: string;
  notes: string;
};

const emptyForm: ValuationForm = {
  valuationDate: "",
  fmvPerShareNtd: "",
  fmvPerShareUsd: "",
  commonStockValueNtd: "",
  preferredStockValueNtd: "",
  totalCompanyValueNtd: "",
  valuationFirm: "",
  reportUrl: "",
  method: "dcf",
  relatedRoundId: "",
  notes: "",
};

export default function Valuations() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ValuationForm>(emptyForm);
  const { canEdit, canDelete } = usePermissions();

  const { data: valuations = [], refetch } = trpc.valuations409a.list.useQuery();
  const { data: rounds = [] } = trpc.fundingRounds.list.useQuery();

  const createMutation = trpc.valuations409a.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); setForm(emptyForm); toast.success("Valuation added"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.valuations409a.update.useMutation({
    onSuccess: () => { refetch(); setOpen(false); setEditId(null); setForm(emptyForm); toast.success("Valuation updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.valuations409a.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Valuation deleted"); },
  });

  const handleSubmit = () => {
    if (!form.valuationDate) { toast.error("Valuation date is required"); return; }
    const payload = {
      valuationDate: form.valuationDate,
      fmvPerShareNtd: form.fmvPerShareNtd || undefined,
      fmvPerShareUsd: form.fmvPerShareUsd || undefined,
      commonStockValueNtd: form.commonStockValueNtd || undefined,
      preferredStockValueNtd: form.preferredStockValueNtd || undefined,
      totalCompanyValueNtd: form.totalCompanyValueNtd || undefined,
      valuationFirm: form.valuationFirm || undefined,
      reportUrl: form.reportUrl || undefined,
      method: (form.method as "dcf" | "market_comparable" | "asset_based" | "409a_safe_harbor" | "other") || undefined,
      relatedRoundId: form.relatedRoundId ? parseInt(form.relatedRoundId) : undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (v: typeof valuations[0]) => {
    setEditId(v.id);
    setForm({
      valuationDate: v.valuationDate ? String(v.valuationDate).split("T")[0] : "",
      fmvPerShareNtd: v.fmvPerShareNtd || "",
      fmvPerShareUsd: v.fmvPerShareUsd || "",
      commonStockValueNtd: v.commonStockValueNtd || "",
      preferredStockValueNtd: v.preferredStockValueNtd || "",
      totalCompanyValueNtd: v.totalCompanyValueNtd || "",
      valuationFirm: v.valuationFirm || "",
      reportUrl: v.reportUrl || "",
      method: v.method || "dcf",
      relatedRoundId: v.relatedRoundId ? String(v.relatedRoundId) : "",
      notes: v.notes || "",
    });
    setOpen(true);
  };

  // Chart data: FMV per share over time
  const chartData = valuations
    .filter(v => v.fmvPerShareNtd && v.valuationDate)
    .map(v => ({
      date: String(v.valuationDate).split("T")[0],
      fmv: parseFloat(v.fmvPerShareNtd || "0"),
      totalValue: parseFloat(v.totalCompanyValueNtd || "0"),
    }));

  // Sort valuations desc by date for summary
  const sortedByDate = [...valuations]
    .filter(v => v.valuationDate)
    .sort((a, b) => (String(b.valuationDate) > String(a.valuationDate) ? 1 : -1));
  const latestValuation = sortedByDate[0];
  const latestFmv = latestValuation?.fmvPerShareNtd ? parseFloat(latestValuation.fmvPerShareNtd) : null;
  const latestCompanyValue = latestValuation?.totalCompanyValueNtd ? parseFloat(latestValuation.totalCompanyValueNtd) : null;
  const daysSinceLatest = latestValuation?.valuationDate
    ? Math.floor((Date.now() - new Date(latestValuation.valuationDate as any).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysUntilStale = daysSinceLatest !== null ? 365 - daysSinceLatest : null;

  return (
    <DashboardLayout>
      <div className="px-8 py-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b border-stone-200 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-stone-400 uppercase mb-2">Financial Analysis</p>
              <h1 className="font-display text-4xl font-bold text-stone-900">FMV Valuations</h1>
              <p className="text-stone-500 mt-2 text-sm">Track independent FMV valuations for ESOP pricing and compliance</p>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
              {canEdit && (
                <DialogTrigger asChild>
                  <Button className="bg-stone-900 text-white hover:bg-stone-700 gap-2">
                    <Plus className="w-4 h-4" />
                    Add Valuation
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editId ? "Edit Valuation" : "Add FMV Valuation"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Valuation Date *</Label>
                      <Input type="date" value={form.valuationDate} onChange={e => setForm(f => ({ ...f, valuationDate: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Method</Label>
                      <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">FMV per Share (NTD)</Label>
                      <Input type="number" value={form.fmvPerShareNtd} onChange={e => setForm(f => ({ ...f, fmvPerShareNtd: e.target.value }))} className="mt-1 font-mono" placeholder="e.g. 15.00" />
                    </div>
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">FMV per Share (USD)</Label>
                      <Input type="number" value={form.fmvPerShareUsd} onChange={e => setForm(f => ({ ...f, fmvPerShareUsd: e.target.value }))} className="mt-1 font-mono" placeholder="e.g. 0.47" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Common Value (NTD)</Label>
                      <Input type="number" value={form.commonStockValueNtd} onChange={e => setForm(f => ({ ...f, commonStockValueNtd: e.target.value }))} className="mt-1 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Preferred Value (NTD)</Label>
                      <Input type="number" value={form.preferredStockValueNtd} onChange={e => setForm(f => ({ ...f, preferredStockValueNtd: e.target.value }))} className="mt-1 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Total Company (NTD)</Label>
                      <Input type="number" value={form.totalCompanyValueNtd} onChange={e => setForm(f => ({ ...f, totalCompanyValueNtd: e.target.value }))} className="mt-1 font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Valuation Firm</Label>
                      <Input value={form.valuationFirm} onChange={e => setForm(f => ({ ...f, valuationFirm: e.target.value }))} className="mt-1" placeholder="e.g. Big4 CPA Firm" />
                    </div>
                    <div>
                      <Label className="text-xs tracking-widest uppercase text-stone-500">Related Round</Label>
                      <Select value={form.relatedRoundId} onValueChange={v => setForm(f => ({ ...f, relatedRoundId: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {rounds.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs tracking-widest uppercase text-stone-500">Report URL</Label>
                    <Input value={form.reportUrl} onChange={e => setForm(f => ({ ...f, reportUrl: e.target.value }))} className="mt-1" placeholder="https://..." />
                  </div>
                  <div>
                    <Label className="text-xs tracking-widest uppercase text-stone-500">Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setOpen(false); setEditId(null); setForm(emptyForm); }}>Cancel</Button>
                    <Button onClick={handleSubmit} className="bg-stone-900 text-white hover:bg-stone-700">
                      {editId ? "Update" : "Add Valuation"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Summary Cards */}
        {valuations.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-card border border-stone-200 rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-stone-400 font-medium">Latest FMV / Share</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {latestFmv !== null ? `NT$${latestFmv.toFixed(2)}` : "—"}
              </p>
              <p className="text-xs text-stone-500">
                {latestValuation?.valuationDate ? formatDate(latestValuation.valuationDate as any) : "No data"}
              </p>
            </div>
            <div className="bg-card border border-stone-200 rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-stone-400 font-medium">Company Value</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {latestCompanyValue !== null
                  ? `NT$${(latestCompanyValue / 100_000_000).toFixed(2)}億`
                  : "—"}
              </p>
              <p className="text-xs text-stone-500">latest valuation</p>
            </div>
            <div className="bg-card border border-stone-200 rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-stone-400 font-medium">Total Records</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {valuations.length}
              </p>
              <p className="text-xs text-stone-500">valuations on file</p>
            </div>
            <div className="bg-card border border-stone-200 rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-stone-400 font-medium">Days Since Last</p>
              <p className={`text-2xl font-bold tracking-tight tabular-nums ${
                daysSinceLatest !== null && daysSinceLatest > 365 ? "text-amber-600" : ""
              }`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {daysSinceLatest !== null ? daysSinceLatest : "—"}
              </p>
              <p className="text-xs text-stone-500">
                {daysUntilStale !== null
                  ? (daysUntilStale > 0
                      ? `${daysUntilStale} days to 12-mo mark`
                      : `${-daysUntilStale} days overdue`)
                  : "no reference"}
              </p>
            </div>
          </div>
        )}

        {/* FMV Chart */}
        {chartData.length > 1 && (
          <Card className="mb-8 border-stone-200">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-widest uppercase text-stone-600">
                FMV per Share Trend (NTD)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} />
                  <YAxis tickFormatter={v => `NT$${v}`} tick={{ fontSize: 11, fill: "#78716c" }} />
                  <Tooltip
                    formatter={(value: number) => [`NT$${value.toFixed(4)}`, "FMV per Share"]}
                    contentStyle={{ fontSize: 12, border: "1px solid #e7e5e4" }}
                  />
                  <Line type="monotone" dataKey="fmv" stroke="#1a1a1a" strokeWidth={2} dot={{ r: 4, fill: "#1a1a1a" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Valuation Records */}
        {valuations.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 text-sm">No FMV valuations recorded yet.</p>
            <p className="text-stone-400 text-xs mt-1">Add your first valuation to track FMV history for ESOP pricing.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {valuations.map((v) => {
              const relatedRound = rounds.find(r => r.id === v.relatedRoundId);
              return (
                <Card key={v.id} className="border-stone-200 hover:border-stone-300 transition-colors">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-6">
                        <div>
                          <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">Date</p>
                          <p className="font-bold text-stone-900">{formatDate(v.valuationDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">FMV / Share</p>
                          <p className="font-bold text-stone-900 font-mono">
                            {v.fmvPerShareNtd ? `NT$${parseFloat(v.fmvPerShareNtd).toFixed(4)}` : "—"}
                          </p>
                          {v.fmvPerShareUsd && (
                            <p className="text-xs text-stone-400 font-mono">${parseFloat(v.fmvPerShareUsd).toFixed(6)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">Total Company Value</p>
                          <p className="font-bold text-stone-900">
                            {v.totalCompanyValueNtd ? formatCurrency(parseFloat(v.totalCompanyValueNtd), "NTD") : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">Method</p>
                          <Badge variant="outline" className="text-xs">{METHOD_LABELS[v.method || "dcf"] || v.method}</Badge>
                        </div>
                        {v.valuationFirm && (
                          <div>
                            <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">Firm</p>
                            <p className="text-sm text-stone-700">{v.valuationFirm}</p>
                          </div>
                        )}
                        {relatedRound && (
                          <div>
                            <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">Round</p>
                            <Badge variant="secondary" className="text-xs">{relatedRound.name}</Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {v.reportUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={v.reportUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(v)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => { if (confirm("Delete this valuation?")) deleteMutation.mutate({ id: v.id }); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {v.notes && (
                      <p className="text-xs text-stone-500 mt-3 pt-3 border-t border-stone-100">{v.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
