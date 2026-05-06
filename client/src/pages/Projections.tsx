import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { buildProjection, type YearlyPnL } from "@shared/projectionCalc";
import { runDCF, type DCFResult } from "@shared/dcfCalc";
import { DEFAULT_ASSUMPTIONS, type ProjectionAssumptions } from "@shared/projectionTypes";
import { BarChart3, Calculator, CheckCircle2, DollarSign, Download, FileSpreadsheet, Plus, TrendingUp, XCircle } from "lucide-react";
import { calculateWACC, DEFAULT_WACC_INPUTS, type WACCInputs } from "@shared/waccCalc";
import {
  buildThreeStatements, DEFAULT_BS_ASSUMPTIONS, type BSAssumptions,
  type YearlyBalanceSheet, type YearlyCashFlow,
} from "@shared/threeStatementCalc";
import {
  type DCFInputs, type TerminalValueMethod,
  defaultSensitivityTable, exitMultipleSensitivityTable,
  type SensitivityTable,
} from "@shared/dcfCalc";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";

export default function ProjectionsPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="analysis.projections">
        <ProjectionsContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtCurrencyCompact(v: number): string {
  if (v >= 1_000_000) return `NT$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `NT$${(v / 1_000).toFixed(0)}K`;
  return `NT$${v.toFixed(0)}`;
}

// ─── Main Content ───────────────────────────────────────────────────────────

function ProjectionsContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("analysis");
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  // ── Projections CRUD ────────────────────────────────────────────────────
  const { data: projections = [], isLoading } = trpc.financialProjections.list.useQuery();

  const [selectedProjectionId, setSelectedProjectionId] = useState<number | null>(null);

  // Auto-select first projection when data arrives
  const activeProjectionId = selectedProjectionId ?? projections[0]?.id ?? null;
  const activeProjection = projections.find((p) => p.id === activeProjectionId) ?? null;

  const createProjection = trpc.financialProjections.create.useMutation({
    onSuccess: (created) => {
      utils.financialProjections.list.invalidate();
      if (created && typeof created === "object" && "id" in created) {
        setSelectedProjectionId(Number(created.id));
      }
      toast.success(t("projections.projectionCreated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProjection = trpc.financialProjections.update.useMutation({
    onSuccess: () => {
      utils.financialProjections.list.invalidate();
      toast.success(t("projections.projectionUpdated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProjection = trpc.financialProjections.delete.useMutation({
    onSuccess: () => {
      utils.financialProjections.list.invalidate();
      setSelectedProjectionId(null);
      toast.success(t("projections.projectionDeleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreateDefault() {
    const now = new Date();
    createProjection.mutate({
      name: t("projections.newProjection"),
      startYear: now.getFullYear(),
      years: 5,
      assumptions: DEFAULT_ASSUMPTIONS,
    });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{tPages("projections.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {tPages("projections.desc")}
        </p>
      </div>

      <Tabs defaultValue="projection" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projection" className="gap-2">
            <BarChart3 className="h-4 w-4" /> {t("projections.fiveYearProjection")}
          </TabsTrigger>
          <TabsTrigger value="dcf" className="gap-2">
            <DollarSign className="h-4 w-4" /> {t("projections.dcfValuation")}
          </TabsTrigger>
          <TabsTrigger value="three-statement" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> {t("projections.threeStatement")}
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1: 5-Year Projection
           ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="projection" className="space-y-6">
          {/* Projection selector + New button */}
          <div className="flex items-center gap-4">
            {projections.length > 0 && (
              <Select
                value={activeProjectionId != null ? String(activeProjectionId) : ""}
                onValueChange={(v) => setSelectedProjectionId(Number(v))}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select projection" />
                </SelectTrigger>
                <SelectContent>
                  {projections.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canEdit && (
              <Button
                onClick={handleCreateDefault}
                disabled={createProjection.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> {t("projections.newProjection")}
              </Button>
            )}
          </div>

          {/* Empty state */}
          {!isLoading && projections.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground mb-4">{t("projections.emptyState")}</p>
                {canEdit && (
                  <Button onClick={handleCreateDefault} disabled={createProjection.isPending}>
                    {t("projections.createProjection")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assumptions + Table */}
          {activeProjection && (
            <ProjectionDetail
              projection={activeProjection}
              canEdit={canEdit}
              onUpdate={(data) =>
                updateProjection.mutate({ id: activeProjection.id, data })
              }
              onDelete={() => {
                if (confirm(`Delete "${activeProjection.name}"?`))
                  deleteProjection.mutate({ id: activeProjection.id });
              }}
              isPending={updateProjection.isPending}
            />
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2: DCF Valuation
           ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dcf" className="space-y-6">
          <DCFTab projections={projections} canEdit={canEdit} />
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3: Three-Statement Model
           ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="three-statement" className="space-y-6">
          <ThreeStatementTab projections={projections} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Projection Detail (Assumptions + Table) ────────────────────────────────

type ProjectionDetailProps = {
  projection: {
    id: number;
    name: string;
    startYear: number;
    years: number;
    assumptions: unknown;
  };
  canEdit: boolean;
  onUpdate: (data: { name?: string; assumptions?: ProjectionAssumptions }) => void;
  onDelete: () => void;
  isPending: boolean;
};

function ProjectionDetail({ projection, canEdit, onUpdate, onDelete, isPending }: ProjectionDetailProps) {
  const { t } = useTranslation("analysis");
  const raw = projection.assumptions as ProjectionAssumptions | string;
  const parsed: ProjectionAssumptions =
    typeof raw === "string" ? JSON.parse(raw) : raw ?? DEFAULT_ASSUMPTIONS;

  const [assumptions, setAssumptions] = useState<ProjectionAssumptions>(parsed);
  const [projName, setProjName] = useState(projection.name);

  // Recompute when projection changes
  useMemo(() => {
    const a = typeof projection.assumptions === "string"
      ? JSON.parse(projection.assumptions as string)
      : projection.assumptions ?? DEFAULT_ASSUMPTIONS;
    setAssumptions(a);
    setProjName(projection.name);
  }, [projection.id, projection.assumptions, projection.name]);

  const rows: YearlyPnL[] = useMemo(
    () => buildProjection(projection.startYear, projection.years, assumptions),
    [projection.startYear, projection.years, assumptions]
  );

  function handleSave() {
    onUpdate({ name: projName, assumptions });
  }

  function exportCSV() {
    const headers = [
      "Year", "Revenue", "COGS", "Gross Profit",
      "S&M", "R&D", "G&A", "EBITDA", "D&A", "EBIT",
      "Tax", "Net Income", "CapEx", "Change NWC", "Free Cash Flow",
    ];
    const csvRows = rows.map((r) => [
      r.year, r.revenue, r.cogs, r.grossProfit,
      r.salesMarketing, r.rnd, r.gAndA, r.ebitda, r.depreciation, r.ebit,
      r.tax, r.netIncome, r.capex, r.changeInNWC, r.freeCashFlow,
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((c) => `"${String(c)}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projection-${projName}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("projections.csvExported"));
  }

  return (
    <div className="space-y-6">
      {/* Name + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {canEdit ? (
            <Input
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className="text-lg font-semibold w-60"
            />
          ) : (
            <h2 className="text-lg font-semibold">{projName}</h2>
          )}
          <span className="text-sm text-muted-foreground">
            {projection.startYear} - {projection.startYear + projection.years - 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> {t("projections.exportCsv")}
          </Button>
          {canEdit && (
            <>
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                {t("projections.saveChanges")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
              >
                {t("projections.deleteProjection")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Assumptions Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("projections.assumptions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AssumptionsPanel
            assumptions={assumptions}
            years={projection.years}
            onChange={setAssumptions}
            disabled={!canEdit}
          />
        </CardContent>
      </Card>

      {/* Projection Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("projections.pnlProjection")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ProjectionTable rows={rows} />
        </CardContent>
      </Card>

      {/* Revenue & Profitability Chart */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("projections.chart.revenueProfit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis yAxisId="left" tickFormatter={(v) => fmtCurrencyCompact(v)} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmtCurrencyCompact(v)} />
                <Tooltip formatter={(v) => fmtCurrencyCompact(v as number)} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name={t("projections.chart.revenue")} />
                <Line yAxisId="right" type="monotone" dataKey="netIncome" stroke="#10b981" name={t("projections.chart.netIncome")} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="ebitda" stroke="#f97316" name={t("projections.chart.ebitda")} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Assumptions Panel ──────────────────────────────────────────────────────

function AssumptionsPanel({
  assumptions,
  years,
  onChange,
  disabled,
}: {
  assumptions: ProjectionAssumptions;
  years: number;
  onChange: (a: ProjectionAssumptions) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("analysis");
  function set<K extends keyof ProjectionAssumptions>(key: K, value: ProjectionAssumptions[K]) {
    onChange({ ...assumptions, [key]: value });
  }

  function setGrowth(idx: number, val: number) {
    const next = [...assumptions.revenueGrowth];
    next[idx] = val;
    onChange({ ...assumptions, revenueGrowth: next });
  }

  return (
    <div className="space-y-4">
      {/* Revenue */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <Label className="text-xs">Revenue Y1 ($)</Label>
          <Input
            type="number"
            disabled={disabled}
            value={assumptions.revenueYear1}
            onChange={(e) => set("revenueYear1", Number(e.target.value) || 0)}
          />
        </div>
        {Array.from({ length: years - 1 }).map((_, i) => (
          <div key={i}>
            <Label className="text-xs">Growth Y{i + 2} (%)</Label>
            <Input
              type="number"
              disabled={disabled}
              value={((assumptions.revenueGrowth[i] ?? 0) * 100).toFixed(0)}
              onChange={(e) => setGrowth(i, (Number(e.target.value) || 0) / 100)}
            />
          </div>
        ))}
      </div>

      {/* Margins & OpEx */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {([
          ["grossMargin", t("projections.grossMargin")],
          ["salesMarketing", t("projections.salesMarketing")],
          ["rnd", t("projections.rnd")],
          ["gAndA", t("projections.gAndA")],
          ["depreciation", t("projections.depreciation")],
          ["capex", t("projections.capex")],
          ["workingCapital", t("projections.workingCapital")],
          ["taxRate", t("projections.taxRate")],
        ] as const).map(([key, label]) => (
          <div key={key}>
            <Label className="text-xs">{label}</Label>
            <Input
              type="number"
              disabled={disabled}
              value={((assumptions[key] ?? 0) * 100).toFixed(1)}
              onChange={(e) => set(key, (Number(e.target.value) || 0) / 100)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Projection Table ───────────────────────────────────────────────────────

// ROW_DEFS moved into ProjectionTable to use t()
function getRowDefs(t: (key: string) => string): { key: keyof YearlyPnL; label: string; bold?: boolean }[] {
  return [
    { key: "revenue", label: t("projections.revenue") },
    { key: "cogs", label: t("projections.cogs") },
    { key: "grossProfit", label: t("projections.grossProfit"), bold: true },
    { key: "salesMarketing", label: t("projections.sm") },
    { key: "rnd", label: t("projections.rd") },
    { key: "gAndA", label: t("projections.ga") },
    { key: "ebitda", label: t("projections.ebitda"), bold: true },
    { key: "depreciation", label: t("projections.da") },
    { key: "ebit", label: t("projections.ebit"), bold: true },
    { key: "tax", label: t("projections.tax") },
    { key: "netIncome", label: t("projections.netIncome"), bold: true },
    { key: "capex", label: t("projections.capexLabel") },
    { key: "changeInNWC", label: t("projections.changeNWC") },
    { key: "freeCashFlow", label: t("projections.freeCashFlow"), bold: true },
  ];
}

function ProjectionTable({ rows }: { rows: YearlyPnL[] }) {
  const { t } = useTranslation("analysis");
  const ROW_DEFS = getRowDefs(t);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {t("projections.lineItem")}
            </th>
            {rows.map((r) => (
              <th
                key={r.year}
                className="text-right px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
              >
                {t("projections.year")} {r.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_DEFS.map((def) => (
            <tr
              key={def.key}
              className={`border-b border-border/50 ${def.bold ? "bg-secondary/20" : ""}`}
            >
              <td className={`px-3 py-2 ${def.bold ? "font-semibold" : ""}`}>
                {def.label}
              </td>
              {rows.map((r) => (
                <td
                  key={r.year}
                  className={`text-right px-3 py-2 tabular-nums ${def.bold ? "font-semibold" : ""}`}
                >
                  {fmtCurrency(r[def.key] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DCF Tab (Professional) ─────────────────────────────────────────────────

type DCFTabProps = {
  projections: { id: number; name: string; startYear: number; years: number; assumptions: unknown }[];
  canEdit: boolean;
};

function DCFTab({ projections, canEdit }: DCFTabProps) {
  const { t } = useTranslation("analysis");
  const utils = trpc.useUtils();
  const [selectedProjId, setSelectedProjId] = useState<number | null>(null);
  const activeProjId = selectedProjId ?? projections[0]?.id ?? null;
  const activeProj = projections.find((p) => p.id === activeProjId) ?? null;

  const { data: scenarios = [] } = trpc.dcf.listByProjection.useQuery(
    { projectionId: activeProjId! },
    { enabled: activeProjId != null }
  );

  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) ?? scenarios[0] ?? null;

  // ── WACC inputs ──
  const [waccInputs, setWaccInputs] = useState<WACCInputs>(DEFAULT_WACC_INPUTS);
  const [useManualWACC, setUseManualWACC] = useState(false);
  const [manualWACC, setManualWACC] = useState(0.12);

  const waccResult = useMemo(() => calculateWACC(waccInputs), [waccInputs]);
  const effectiveWACC = useManualWACC ? manualWACC : waccResult.wacc;

  // ── DCF inputs ──
  const [terminalGrowth, setTerminalGrowth] = useState(0.03);
  const [tvMethod, setTvMethod] = useState<TerminalValueMethod>("gordon");
  const [exitMultiple, setExitMultiple] = useState(10);
  const [midYearConvention, setMidYearConvention] = useState(true);
  const [netDebt, setNetDebt] = useState(0);
  const [cash, setCash] = useState(0);
  const [minorityInterest, setMinorityInterest] = useState(0);
  const [preferredEquity, setPreferredEquity] = useState(0);
  const [targetRaise, setTargetRaise] = useState<string>("");
  const [targetPreMoney, setTargetPreMoney] = useState<string>("");

  // Load scenario values when selection changes
  useMemo(() => {
    if (activeScenario) {
      const dr = parseFloat(activeScenario.discountRate ?? "0.12") || 0.12;
      setManualWACC(dr);
      setTerminalGrowth(parseFloat(activeScenario.terminalGrowth ?? "0.03") || 0.03);
      setNetDebt(parseFloat(activeScenario.netDebt ?? "0") || 0);
      setCash(parseFloat(activeScenario.cash ?? "0") || 0);
      setTargetRaise(activeScenario.targetRaise ?? "");
      setTargetPreMoney(activeScenario.targetPreMoney ?? "");
    }
  }, [activeScenario?.id]);

  const createScenario = trpc.dcf.create.useMutation({
    onSuccess: (created) => {
      utils.dcf.listByProjection.invalidate({ projectionId: activeProjId! });
      if (created && typeof created === "object" && "id" in created) {
        setSelectedScenarioId(Number(created.id));
      }
      toast.success(t("projections.dcfScenarioCreated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateScenario = trpc.dcf.update.useMutation({
    onSuccess: () => {
      utils.dcf.listByProjection.invalidate({ projectionId: activeProjId! });
      toast.success(t("projections.dcfScenarioSaved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteScenario = trpc.dcf.delete.useMutation({
    onSuccess: () => {
      utils.dcf.listByProjection.invalidate({ projectionId: activeProjId! });
      setSelectedScenarioId(null);
      toast.success(t("projections.dcfScenarioDeleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  // Build projection rows to get FCFs
  const projectionRows = useMemo(() => {
    if (!activeProj) return [];
    const a: ProjectionAssumptions =
      typeof activeProj.assumptions === "string"
        ? JSON.parse(activeProj.assumptions as string)
        : (activeProj.assumptions as ProjectionAssumptions) ?? DEFAULT_ASSUMPTIONS;
    return buildProjection(activeProj.startYear, activeProj.years, a);
  }, [activeProj]);

  // Build DCF inputs object
  const dcfInputs: DCFInputs | null = useMemo(() => {
    if (projectionRows.length === 0) return null;
    return {
      fcfs: projectionRows.map((r) => r.freeCashFlow),
      discountRate: effectiveWACC,
      terminalGrowth,
      exitMultiple,
      lastYearEBITDA: projectionRows[projectionRows.length - 1]?.ebitda ?? 0,
      terminalValueMethod: tvMethod,
      midYearConvention,
      netDebt,
      minorityInterest,
      preferredEquity,
      targetRaise: targetRaise ? Number(targetRaise) : null,
      targetPreMoney: targetPreMoney ? Number(targetPreMoney) : null,
    };
  }, [projectionRows, effectiveWACC, terminalGrowth, exitMultiple, tvMethod, midYearConvention, netDebt, minorityInterest, preferredEquity, targetRaise, targetPreMoney]);

  // Run DCF
  const dcfResult = useMemo(() => {
    if (!dcfInputs) return null;
    return runDCF(dcfInputs);
  }, [dcfInputs]);

  // Sensitivity table
  const sensitivityData: SensitivityTable | null = useMemo(() => {
    if (!dcfInputs) return null;
    return tvMethod === "exitMultiple"
      ? exitMultipleSensitivityTable(dcfInputs, "enterpriseValue")
      : defaultSensitivityTable(dcfInputs, "enterpriseValue");
  }, [dcfInputs, tvMethod]);

  function handleCreateScenario() {
    if (!activeProjId) return;
    createScenario.mutate({
      projectionId: activeProjId,
      name: "Base DCF",
      discountRate: effectiveWACC,
      terminalGrowth,
      netDebt,
      cash,
      targetRaise: targetRaise ? Number(targetRaise) : null,
      targetPreMoney: targetPreMoney ? Number(targetPreMoney) : null,
    });
  }

  function handleSaveScenario() {
    if (!activeScenario) return;
    updateScenario.mutate({
      id: activeScenario.id,
      data: {
        discountRate: effectiveWACC,
        terminalGrowth,
        netDebt,
        cash,
        targetRaise: targetRaise ? Number(targetRaise) : null,
        targetPreMoney: targetPreMoney ? Number(targetPreMoney) : null,
      },
    });
  }

  if (projections.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {t("projections.createProjectionFirst")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source projection + scenario selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <Label className="text-xs mb-1 block">{t("projections.sourceProjection")}</Label>
          <Select
            value={activeProjId != null ? String(activeProjId) : ""}
            onValueChange={(v) => {
              setSelectedProjId(Number(v));
              setSelectedScenarioId(null);
            }}
          >
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Select projection" />
            </SelectTrigger>
            <SelectContent>
              {projections.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scenarios.length > 0 && (
          <div>
            <Label className="text-xs mb-1 block">{t("projections.dcfScenario")}</Label>
            <Select
              value={activeScenario ? String(activeScenario.id) : ""}
              onValueChange={(v) => setSelectedScenarioId(Number(v))}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {canEdit && (
          <div className="flex items-end gap-2">
            <Button
              onClick={handleCreateScenario}
              disabled={createScenario.isPending || !activeProjId}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> {t("projections.newScenario")}
            </Button>
            {activeScenario && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSaveScenario}
                  disabled={updateScenario.isPending}
                >
                  {t("projections.saveChanges")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete scenario "${activeScenario.name}"?`))
                      deleteScenario.mutate({ id: activeScenario.id });
                  }}
                >
                  {t("projections.deleteProjection")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── WACC Calculator Panel ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" /> {t("projections.waccCalculator")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual vs CAPM toggle */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={!useManualWACC}
                onChange={() => setUseManualWACC(false)}
                className="accent-primary"
              />
              {t("projections.waccCAPM")}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={useManualWACC}
                onChange={() => setUseManualWACC(true)}
                className="accent-primary"
              />
              {t("projections.waccManual")}
            </label>
          </div>

          {useManualWACC ? (
            <div className="max-w-xs">
              <Label className="text-xs">{t("projections.discountRate")} (%)</Label>
              <Input
                type="number"
                value={(manualWACC * 100).toFixed(1)}
                onChange={(e) => setManualWACC((Number(e.target.value) || 0) / 100)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <Label className="text-xs">{t("projections.riskFreeRate")} (%)</Label>
                  <Input
                    type="number"
                    value={(waccInputs.riskFreeRate * 100).toFixed(2)}
                    onChange={(e) => setWaccInputs({ ...waccInputs, riskFreeRate: (Number(e.target.value) || 0) / 100 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("projections.beta")}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={waccInputs.beta.toFixed(2)}
                    onChange={(e) => setWaccInputs({ ...waccInputs, beta: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("projections.equityRiskPremium")} (%)</Label>
                  <Input
                    type="number"
                    value={(waccInputs.equityRiskPremium * 100).toFixed(2)}
                    onChange={(e) => setWaccInputs({ ...waccInputs, equityRiskPremium: (Number(e.target.value) || 0) / 100 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("projections.costOfDebt")} (%)</Label>
                  <Input
                    type="number"
                    value={(waccInputs.costOfDebt * 100).toFixed(2)}
                    onChange={(e) => setWaccInputs({ ...waccInputs, costOfDebt: (Number(e.target.value) || 0) / 100 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("projections.debtWeight")} (%)</Label>
                  <Input
                    type="number"
                    value={(waccInputs.debtWeight * 100).toFixed(1)}
                    onChange={(e) => setWaccInputs({ ...waccInputs, debtWeight: (Number(e.target.value) || 0) / 100 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("projections.taxRateWACC")} (%)</Label>
                  <Input
                    type="number"
                    value={(waccInputs.taxRate * 100).toFixed(1)}
                    onChange={(e) => setWaccInputs({ ...waccInputs, taxRate: (Number(e.target.value) || 0) / 100 })}
                  />
                </div>
              </div>

              {/* WACC breakdown */}
              <div className="bg-secondary/30 rounded-lg p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-muted-foreground">{t("projections.costOfEquity")}: </span>
                  <span className="font-semibold">{(waccResult.costOfEquity * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("projections.afterTaxCostOfDebt")}: </span>
                  <span className="font-semibold">{(waccResult.afterTaxCostOfDebt * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("projections.equityWeight")}: </span>
                  <span className="font-semibold">{(waccResult.equityWeight * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">WACC: </span>
                  <span className="font-bold text-primary">{(waccResult.wacc * 100).toFixed(2)}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("projections.capmFormula")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── DCF Parameters ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("projections.dcfInputs")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Terminal Value method + Convention */}
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <Label className="text-xs mb-1 block">{t("projections.tvMethod")}</Label>
              <Select value={tvMethod} onValueChange={(v) => setTvMethod(v as TerminalValueMethod)}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gordon">{t("projections.gordonGrowth")}</SelectItem>
                  <SelectItem value="exitMultiple">{t("projections.exitMultipleMethod")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={midYearConvention}
                onChange={(e) => setMidYearConvention(e.target.checked)}
                className="accent-primary"
              />
              {t("projections.midYearConvention")}
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tvMethod === "gordon" ? (
              <div>
                <Label className="text-xs">{t("projections.terminalGrowth")}</Label>
                <Input
                  type="number"
                  value={(terminalGrowth * 100).toFixed(1)}
                  onChange={(e) => setTerminalGrowth((Number(e.target.value) || 0) / 100)}
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs">{t("projections.exitMultipleLabel")} (EV/EBITDA)</Label>
                <Input
                  type="number"
                  value={exitMultiple}
                  onChange={(e) => setExitMultiple(Number(e.target.value) || 0)}
                />
              </div>
            )}
            <div>
              <Label className="text-xs">{t("projections.netDebt")}</Label>
              <Input
                type="number"
                value={netDebt}
                onChange={(e) => setNetDebt(Number(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("projections.netDebtHint")}
              </p>
            </div>
            <div>
              <Label className="text-xs">{t("projections.minorityInterest")}</Label>
              <Input
                type="number"
                value={minorityInterest}
                onChange={(e) => setMinorityInterest(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("projections.preferredEquity")}</Label>
              <Input
                type="number"
                value={preferredEquity}
                onChange={(e) => setPreferredEquity(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("projections.targetRaise")}</Label>
              <Input
                type="number"
                value={targetRaise}
                onChange={(e) => setTargetRaise(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label className="text-xs">{t("projections.targetPreMoney")}</Label>
              <Input
                type="number"
                value={targetPreMoney}
                onChange={(e) => setTargetPreMoney(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── DCF Results ── */}
      {dcfResult && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EV → Equity Bridge */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> {t("projections.evEquityBridge")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {([
                    [t("projections.sumPVFCF"), dcfResult.sumPVFCF, false],
                    [t("projections.pvOfTerminal"), dcfResult.pvOfTerminal, false],
                    [t("projections.enterpriseValue"), dcfResult.enterpriseValue, true],
                    [t("projections.lessNetDebt"), -dcfResult.lessNetDebt, false],
                    ...(dcfResult.lessMinorityInterest ? [[t("projections.lessMinority"), -dcfResult.lessMinorityInterest, false] as const] : []),
                    ...(dcfResult.lessPreferredEquity ? [[t("projections.lessPreferred"), -dcfResult.lessPreferredEquity, false] as const] : []),
                    [t("projections.equityValueLabel"), dcfResult.equityValue, true],
                  ] as [string, number, boolean][]).map(([label, val, bold], idx) => (
                    <div key={idx} className={`flex justify-between items-center py-1 ${bold ? "border-t border-border font-semibold pt-2" : "border-b border-border/30"}`}>
                      <span className={`text-sm ${bold ? "" : "text-muted-foreground"}`}>{label}</span>
                      <span className={`text-sm tabular-nums ${bold ? "font-bold" : "font-semibold"}`}>{fmtCurrency(val)}</span>
                    </div>
                  ))}
                </div>

                {/* TV composition note */}
                <div className="mt-3 text-xs text-muted-foreground bg-secondary/30 p-2 rounded">
                  {t("projections.tvContribution")}: {(dcfResult.tvAsPercentOfEV * 100).toFixed(1)}% &bull;{" "}
                  {t("projections.tvMethodUsed")}: {tvMethod === "gordon" ? t("projections.gordonGrowth") : t("projections.exitMultipleMethod")}
                  {midYearConvention && ` • ${t("projections.midYearApplied")}`}
                </div>
              </CardContent>
            </Card>

            {/* Terminal Value Composition Donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("projections.chart.tvPct")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Terminal Value", value: dcfResult.pvOfTerminal },
                        { name: "PV(FCF)", value: dcfResult.sumPVFCF },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#f97316" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Valuation Gap Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> {t("projections.valuationGap")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dcfResult.valuationGap !== null ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-muted-foreground">{t("projections.impliedPreMoney")}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {fmtCurrency(dcfResult.impliedPreMoney)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-muted-foreground">{t("projections.targetPreMoneyLabel")}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {fmtCurrency(Number(targetPreMoney) || 0)}
                      </span>
                    </div>
                    {dcfResult.impliedDilution > 0 && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">{t("projections.impliedDilution")}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {(dcfResult.impliedDilution * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">{t("projections.gap")}</span>
                        <span
                          className={`text-lg font-bold tabular-nums ${
                            dcfResult.valuationGap >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {dcfResult.valuationGap >= 0 ? "+" : ""}
                          {fmtCurrency(dcfResult.valuationGap)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dcfResult.valuationGap >= 0
                          ? t("projections.impliedValueExceeds")
                          : t("projections.impliedValueBelow")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t("projections.enterTargetPreMoney")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Sensitivity Table ── */}
          {sensitivityData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("projections.sensitivityAnalysis")}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("projections.sensitivityDesc")}
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <SensitivityHeatMap data={sensitivityData} baseEV={dcfResult.enterpriseValue} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sensitivity Heat Map ─────────────────────────────────────────────────────

function SensitivityHeatMap({ data, baseEV }: { data: SensitivityTable; baseEV: number }) {
  const { t } = useTranslation("analysis");

  function getCellColor(value: number): string {
    if (baseEV === 0) return "";
    const pctDiff = (value - baseEV) / Math.abs(baseEV);
    if (pctDiff > 0.15) return "bg-green-100 dark:bg-green-900/30";
    if (pctDiff > 0.05) return "bg-green-50 dark:bg-green-900/20";
    if (pctDiff < -0.15) return "bg-red-100 dark:bg-red-900/30";
    if (pctDiff < -0.05) return "bg-red-50 dark:bg-red-900/20";
    return "bg-yellow-50 dark:bg-yellow-900/20";
  }

  const midRow = Math.floor(data.rowLabels.length / 2);
  const midCol = Math.floor(data.colLabels.length / 2);

  return (
    <table className="w-full text-xs min-w-[600px]">
      <thead>
        <tr>
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
            {data.rowHeader} ↓ / {data.colHeader} →
          </th>
          {data.colLabels.map((cl, ci) => (
            <th
              key={ci}
              className={`px-2 py-1.5 text-right font-medium ${ci === midCol ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              {cl}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rowLabels.map((rl, ri) => (
          <tr key={ri}>
            <td className={`px-2 py-1.5 font-medium ${ri === midRow ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              {rl}
            </td>
            {data.values[ri].map((val, ci) => (
              <td
                key={ci}
                className={`px-2 py-1.5 text-right tabular-nums font-semibold ${getCellColor(val)} ${ri === midRow && ci === midCol ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                {fmtCurrency(val)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Three-Statement Tab ──────────────────────────────────────────────────────

type ThreeStatementTabProps = {
  projections: { id: number; name: string; startYear: number; years: number; assumptions: unknown }[];
};

function ThreeStatementTab({ projections }: ThreeStatementTabProps) {
  const { t } = useTranslation("analysis");
  const [selectedProjId, setSelectedProjId] = useState<number | null>(null);
  const activeProjId = selectedProjId ?? projections[0]?.id ?? null;
  const activeProj = projections.find((p) => p.id === activeProjId) ?? null;

  // BS assumptions (local state, not persisted)
  const [bsAssumptions, setBsAssumptions] = useState<BSAssumptions>(DEFAULT_BS_ASSUMPTIONS);

  // Build three statements
  const result = useMemo(() => {
    if (!activeProj) return null;
    const a: ProjectionAssumptions =
      typeof activeProj.assumptions === "string"
        ? JSON.parse(activeProj.assumptions as string)
        : (activeProj.assumptions as ProjectionAssumptions) ?? DEFAULT_ASSUMPTIONS;
    return buildThreeStatements(activeProj.startYear, activeProj.years, a, bsAssumptions);
  }, [activeProj, bsAssumptions]);

  if (projections.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">{t("projections.createProjectionFirst")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Projection selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <Label className="text-xs mb-1 block">{t("projections.sourceProjection")}</Label>
          <Select
            value={activeProjId != null ? String(activeProjId) : ""}
            onValueChange={(v) => setSelectedProjId(Number(v))}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projections.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Balance check indicator */}
        {result && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${result.isBalanced ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {result.isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.isBalanced ? t("threeStatement.balanced") : t("threeStatement.unbalanced")}
          </div>
        )}
      </div>

      {/* BS Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("threeStatement.bsAssumptions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs">{t("threeStatement.arDays")}</Label>
              <Input type="number" value={bsAssumptions.arDays} onChange={(e) => setBsAssumptions({ ...bsAssumptions, arDays: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">{t("threeStatement.inventoryDays")}</Label>
              <Input type="number" value={bsAssumptions.inventoryDays} onChange={(e) => setBsAssumptions({ ...bsAssumptions, inventoryDays: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">{t("threeStatement.apDays")}</Label>
              <Input type="number" value={bsAssumptions.apDays} onChange={(e) => setBsAssumptions({ ...bsAssumptions, apDays: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">{t("threeStatement.initialCash")}</Label>
              <Input type="number" value={bsAssumptions.initialCash} onChange={(e) => setBsAssumptions({ ...bsAssumptions, initialCash: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">{t("threeStatement.initialDebt")}</Label>
              <Input type="number" value={bsAssumptions.initialDebt} onChange={(e) => setBsAssumptions({ ...bsAssumptions, initialDebt: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">{t("threeStatement.debtRepayment")} (%)</Label>
              <Input type="number" value={(bsAssumptions.debtRepaymentPct * 100).toFixed(0)} onChange={(e) => setBsAssumptions({ ...bsAssumptions, debtRepaymentPct: (Number(e.target.value) || 0) / 100 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Balance Sheet Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("threeStatement.balanceSheet")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <StatementTable
                years={result.balanceSheet.map(r => r.year)}
                sections={[
                  {
                    title: t("threeStatement.assets"),
                    rows: [
                      { label: t("threeStatement.cashBS"), key: "cash" },
                      { label: t("threeStatement.ar"), key: "accountsReceivable" },
                      { label: t("threeStatement.inventory"), key: "inventory" },
                      { label: t("threeStatement.totalCurrentAssets"), key: "totalCurrentAssets", bold: true },
                      { label: t("threeStatement.netPPE"), key: "netPPE" },
                      { label: t("threeStatement.totalAssets"), key: "totalAssets", bold: true },
                    ],
                    data: result.balanceSheet,
                  },
                  {
                    title: t("threeStatement.liabilities"),
                    rows: [
                      { label: t("threeStatement.ap"), key: "accountsPayable" },
                      { label: t("threeStatement.totalCurrentLiab"), key: "totalCurrentLiabilities", bold: true },
                      { label: t("threeStatement.longTermDebt"), key: "longTermDebt" },
                      { label: t("threeStatement.totalLiabilities"), key: "totalLiabilities", bold: true },
                    ],
                    data: result.balanceSheet,
                  },
                  {
                    title: t("threeStatement.equity"),
                    rows: [
                      { label: t("threeStatement.commonStock"), key: "commonStock" },
                      { label: t("threeStatement.retainedEarnings"), key: "retainedEarnings" },
                      { label: t("threeStatement.totalEquity"), key: "totalEquity", bold: true },
                    ],
                    data: result.balanceSheet,
                  },
                ]}
              />
            </CardContent>
          </Card>

          {/* Cash Flow Statement Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("threeStatement.cashFlowStatement")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <StatementTable
                years={result.cashFlow.map(r => r.year)}
                sections={[
                  {
                    title: t("threeStatement.operating"),
                    rows: [
                      { label: t("projections.netIncome"), key: "netIncome" },
                      { label: t("threeStatement.addDepreciation"), key: "depreciation" },
                      { label: t("threeStatement.changeAR"), key: "changeInAR" },
                      { label: t("threeStatement.changeInventory"), key: "changeInInventory" },
                      { label: t("threeStatement.changeAP"), key: "changeInAP" },
                      { label: t("threeStatement.cashFromOps"), key: "cashFromOperations", bold: true },
                    ],
                    data: result.cashFlow,
                  },
                  {
                    title: t("threeStatement.investing"),
                    rows: [
                      { label: t("projections.capexLabel"), key: "capex" },
                      { label: t("threeStatement.cashFromInvesting"), key: "cashFromInvesting", bold: true },
                    ],
                    data: result.cashFlow,
                  },
                  {
                    title: t("threeStatement.financing"),
                    rows: [
                      { label: t("threeStatement.debtRepaymentLabel"), key: "debtRepayment" },
                      { label: t("threeStatement.cashFromFinancing"), key: "cashFromFinancing", bold: true },
                    ],
                    data: result.cashFlow,
                  },
                  {
                    title: "",
                    rows: [
                      { label: t("threeStatement.netCashChange"), key: "netCashChange", bold: true },
                      { label: t("threeStatement.endingCash"), key: "endingCash", bold: true },
                    ],
                    data: result.cashFlow,
                  },
                ]}
              />
            </CardContent>
          </Card>

          {/* Balance Sheet Composition Chart */}
          {result.balanceSheet.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("threeStatement.chart.bsComposition")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={result.balanceSheet}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => fmtCurrencyCompact(v)} />
                    <Tooltip formatter={(v) => fmtCurrencyCompact(v as number)} />
                    <Legend />
                    <Bar dataKey="totalAssets" fill="#3b82f6" name={t("threeStatement.chart.assets")} />
                    <Bar dataKey="totalLiabilities" fill="#ef4444" name={t("threeStatement.chart.liabilities")} />
                    <Bar dataKey="totalEquity" fill="#10b981" name={t("threeStatement.chart.equity")} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Cash Flow Trend Chart */}
          {result.cashFlow.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("threeStatement.chart.cashFlow")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={result.cashFlow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis yAxisId="left" tickFormatter={(v) => fmtCurrencyCompact(v)} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmtCurrencyCompact(v)} />
                    <Tooltip formatter={(v) => fmtCurrencyCompact(v as number)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="cashFromOperations" fill="#10b981" name={t("threeStatement.chart.cfo")} />
                    <Bar yAxisId="left" dataKey="cashFromInvesting" fill="#ef4444" name={t("threeStatement.chart.cfi")} />
                    <Bar yAxisId="left" dataKey="cashFromFinancing" fill="#3b82f6" name={t("threeStatement.chart.cff")} />
                    <Line yAxisId="right" type="monotone" dataKey="endingCash" stroke="#f97316" name={t("threeStatement.chart.endingCash")} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Generic Statement Table ────────────────────────────────────────────────

type StatementSection = {
  title: string;
  rows: { label: string; key: string; bold?: boolean }[];
  data: Record<string, number>[];
};

function StatementTable({ years, sections }: { years: number[]; sections: StatementSection[] }) {
  const { t } = useTranslation("analysis");
  return (
    <table className="w-full text-sm min-w-[700px]">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t("projections.lineItem")}
          </th>
          {years.map((y) => (
            <th key={y} className="text-right px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {y}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sections.map((section, si) => (
          <>
            {section.title && (
              <tr key={`section-${si}`} className="bg-muted/20">
                <td colSpan={years.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </td>
              </tr>
            )}
            {section.rows.map((row) => (
              <tr key={row.key} className={`border-b border-border/30 ${row.bold ? "bg-secondary/20" : ""}`}>
                <td className={`px-3 py-1.5 ${row.bold ? "font-semibold" : ""}`}>{row.label}</td>
                {section.data.map((d, i) => (
                  <td key={i} className={`text-right px-3 py-1.5 tabular-nums ${row.bold ? "font-semibold" : ""}`}>
                    {fmtCurrency(d[row.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </>
        ))}
      </tbody>
    </table>
  );
}
