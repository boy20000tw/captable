import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
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
import { BarChart3, DollarSign, Download, Plus, TrendingUp } from "lucide-react";

export default function ProjectionsPage() {
  return (
    <DashboardLayout>
      <ProjectionsContent />
    </DashboardLayout>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ─── Main Content ───────────────────────────────────────────────────────────

function ProjectionsContent() {
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
      setSelectedProjectionId((created as any).id);
      toast.success("Projection created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProjection = trpc.financialProjections.update.useMutation({
    onSuccess: () => {
      utils.financialProjections.list.invalidate();
      toast.success("Assumptions saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProjection = trpc.financialProjections.delete.useMutation({
    onSuccess: () => {
      utils.financialProjections.list.invalidate();
      setSelectedProjectionId(null);
      toast.success("Projection deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreateDefault() {
    const now = new Date();
    createProjection.mutate({
      name: "Base Case",
      startYear: now.getFullYear(),
      years: 5,
      assumptions: DEFAULT_ASSUMPTIONS,
    });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projections & DCF</h1>
        <p className="text-muted-foreground mt-1">
          Build 5-year financial projections and run DCF valuations
        </p>
      </div>

      <Tabs defaultValue="projection" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projection" className="gap-2">
            <BarChart3 className="h-4 w-4" /> 5-Year Projection
          </TabsTrigger>
          <TabsTrigger value="dcf" className="gap-2">
            <DollarSign className="h-4 w-4" /> DCF Valuation
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
                <Plus className="h-4 w-4" /> New Projection
              </Button>
            )}
          </div>

          {/* Empty state */}
          {!isLoading && projections.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground mb-4">No projections yet.</p>
                {canEdit && (
                  <Button onClick={handleCreateDefault} disabled={createProjection.isPending}>
                    Create your first 5-year projection
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
    toast.success("CSV exported");
  }

  return (
    <div className="space-y-6">
      {/* Name + actions */}
      <div className="flex items-center justify-between">
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
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {canEdit && (
            <>
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                Save
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Assumptions Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Assumptions</CardTitle>
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
          <CardTitle className="text-sm">5-Year P&L Projection</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ProjectionTable rows={rows} />
        </CardContent>
      </Card>
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
          ["grossMargin", "Gross Margin (%)"],
          ["salesMarketing", "S&M (% Rev)"],
          ["rnd", "R&D (% Rev)"],
          ["gAndA", "G&A (% Rev)"],
          ["depreciation", "D&A (% Rev)"],
          ["capex", "CapEx (% Rev)"],
          ["workingCapital", "NWC (% Rev)"],
          ["taxRate", "Tax Rate (%)"],
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

const ROW_DEFS: { key: keyof YearlyPnL; label: string; bold?: boolean }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "cogs", label: "COGS" },
  { key: "grossProfit", label: "Gross Profit", bold: true },
  { key: "salesMarketing", label: "S&M" },
  { key: "rnd", label: "R&D" },
  { key: "gAndA", label: "G&A" },
  { key: "ebitda", label: "EBITDA", bold: true },
  { key: "depreciation", label: "D&A" },
  { key: "ebit", label: "EBIT", bold: true },
  { key: "tax", label: "Tax" },
  { key: "netIncome", label: "Net Income", bold: true },
  { key: "capex", label: "CapEx" },
  { key: "changeInNWC", label: "\u0394NWC" },
  { key: "freeCashFlow", label: "Free Cash Flow", bold: true },
];

function ProjectionTable({ rows }: { rows: YearlyPnL[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Line Item
          </th>
          {rows.map((r) => (
            <th
              key={r.year}
              className="text-right px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
            >
              {r.year}
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
  );
}

// ─── DCF Tab ────────────────────────────────────────────────────────────────

type DCFTabProps = {
  projections: { id: number; name: string; startYear: number; years: number; assumptions: unknown }[];
  canEdit: boolean;
};

function DCFTab({ projections, canEdit }: DCFTabProps) {
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

  // Local form state for DCF inputs
  const [discountRate, setDiscountRate] = useState(0.12);
  const [terminalGrowth, setTerminalGrowth] = useState(0.03);
  const [netDebt, setNetDebt] = useState(0);
  const [cash, setCash] = useState(0);
  const [targetRaise, setTargetRaise] = useState<string>("");
  const [targetPreMoney, setTargetPreMoney] = useState<string>("");

  // Load scenario values when selection changes
  useMemo(() => {
    if (activeScenario) {
      setDiscountRate(parseFloat(activeScenario.discountRate ?? "0.12") || 0.12);
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
      setSelectedScenarioId((created as any).id);
      toast.success("DCF scenario created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateScenario = trpc.dcf.update.useMutation({
    onSuccess: () => {
      utils.dcf.listByProjection.invalidate({ projectionId: activeProjId! });
      toast.success("DCF scenario saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteScenario = trpc.dcf.delete.useMutation({
    onSuccess: () => {
      utils.dcf.listByProjection.invalidate({ projectionId: activeProjId! });
      setSelectedScenarioId(null);
      toast.success("DCF scenario deleted");
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

  // Run DCF
  const dcfResult: DCFResult | null = useMemo(() => {
    if (projectionRows.length === 0) return null;
    return runDCF({
      fcfs: projectionRows.map((r) => r.freeCashFlow),
      discountRate,
      terminalGrowth,
      netDebt,
      cash,
      targetRaise: targetRaise ? Number(targetRaise) : null,
      targetPreMoney: targetPreMoney ? Number(targetPreMoney) : null,
    });
  }, [projectionRows, discountRate, terminalGrowth, netDebt, cash, targetRaise, targetPreMoney]);

  function handleCreateScenario() {
    if (!activeProjId) return;
    createScenario.mutate({
      projectionId: activeProjId,
      name: "Base DCF",
      discountRate,
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
        discountRate,
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
            Create a 5-year projection first to run a DCF valuation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source projection selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <Label className="text-xs mb-1 block">Source Projection</Label>
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
            <Label className="text-xs mb-1 block">DCF Scenario</Label>
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
              <Plus className="h-4 w-4" /> New Scenario
            </Button>
            {activeScenario && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSaveScenario}
                  disabled={updateScenario.isPending}
                >
                  Save
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete scenario "${activeScenario.name}"?`))
                      deleteScenario.mutate({ id: activeScenario.id });
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* DCF Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">DCF Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs">Discount Rate / WACC (%)</Label>
              <Input
                type="number"
                value={(discountRate * 100).toFixed(1)}
                onChange={(e) => setDiscountRate((Number(e.target.value) || 0) / 100)}
              />
            </div>
            <div>
              <Label className="text-xs">Terminal Growth (%)</Label>
              <Input
                type="number"
                value={(terminalGrowth * 100).toFixed(1)}
                onChange={(e) => setTerminalGrowth((Number(e.target.value) || 0) / 100)}
              />
            </div>
            <div>
              <Label className="text-xs">Net Debt ($)</Label>
              <Input
                type="number"
                value={netDebt}
                onChange={(e) => setNetDebt(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Cash ($)</Label>
              <Input
                type="number"
                value={cash}
                onChange={(e) => setCash(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Target Raise ($)</Label>
              <Input
                type="number"
                value={targetRaise}
                onChange={(e) => setTargetRaise(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label className="text-xs">Target Pre-Money ($)</Label>
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

      {/* DCF Results */}
      {dcfResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Valuation Results Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Valuation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {([
                  ["Sum PV(FCF)", dcfResult.sumPVFCF],
                  ["Terminal Value", dcfResult.terminalValue],
                  ["PV of Terminal", dcfResult.pvOfTerminal],
                  ["Enterprise Value", dcfResult.enterpriseValue],
                  ["Equity Value = Implied Pre-money", dcfResult.equityValue],
                ] as const).map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmtCurrency(val)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Valuation Gap Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Valuation Gap
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dcfResult.valuationGap !== null ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Implied Pre-money</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtCurrency(dcfResult.impliedPreMoney)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Target Pre-money</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtCurrency(Number(targetPreMoney) || 0)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Gap</span>
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
                        ? "Implied value exceeds target - favorable"
                        : "Implied value below target - unfavorable"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Enter a Target Pre-Money to see the valuation gap analysis.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
