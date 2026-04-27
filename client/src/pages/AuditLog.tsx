import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Search, Filter, ChevronDown, ChevronUp, User, Plus, Pencil, Trash2, Upload, Download, LogIn, Mail } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ActionBadge({ action, actionConfig }: { action: string; actionConfig: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> }) {
  const cfg = actionConfig[action] ?? { label: action, icon: ClipboardList, color: "text-stone-600 bg-stone-100" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ChangeDetail({ before, after, t }: { before?: string | null; after?: string | null; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  if (!before && !after) return null;

  const parseJson = (s: string | null | undefined) => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return s; }
  };

  const beforeObj = parseJson(before);
  const afterObj = parseJson(after);

  const renderValue = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? t("auditLog.hideChanges") : t("auditLog.viewChanges")}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {beforeObj !== null && (
            <div className="rounded-sm border border-red-200 bg-red-50 p-3">
              <div className="text-xs font-medium text-red-600 mb-1">{t("auditLog.before")}</div>
              <pre className="text-xs text-red-800 whitespace-pre-wrap break-all">{renderValue(beforeObj)}</pre>
            </div>
          )}
          {afterObj !== null && (
            <div className="rounded-sm border border-green-200 bg-green-50 p-3">
              <div className="text-xs font-medium text-green-600 mb-1">{t("auditLog.after")}</div>
              <pre className="text-xs text-green-800 whitespace-pre-wrap break-all">{renderValue(afterObj)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function AuditLogContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("settings");
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterResource, setFilterResource] = useState("all");
  const [limit] = useState(200);

  const { data: logs, isLoading } = trpc.auditLog.list.useQuery({ limit, offset: 0 });

  // Move ACTION_CONFIG inside component to use t()
  const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
    create:  { label: t("auditLog.actionCreated"),  icon: Plus,         color: "text-green-600 bg-green-50" },
    update:  { label: t("auditLog.actionUpdated"),  icon: Pencil,        color: "text-blue-600 bg-blue-50" },
    delete:  { label: t("auditLog.actionDeleted"),  icon: Trash2,        color: "text-red-600 bg-red-50" },
    import:  { label: t("auditLog.actionImported"), icon: Upload,        color: "text-purple-600 bg-purple-50" },
    export:  { label: t("auditLog.actionExported"), icon: Download,      color: "text-stone-600 bg-stone-100" },
    login:   { label: t("auditLog.actionSignedIn"),icon: LogIn,         color: "text-teal-600 bg-teal-50" },
    invite:  { label: t("auditLog.actionInvited"),  icon: Mail,          color: "text-amber-600 bg-amber-50" },
  };

  // Move RESOURCE_LABELS inside component to use t()
  const RESOURCE_LABELS: Record<string, string> = {
    shareholder:    t("auditLog.resShareholder"),
    funding_round:  t("auditLog.resFundingRound"),
    esop_grant:     t("auditLog.resEsopGrant"),
    esop_pool:      t("auditLog.resEsopPool"),
    share_holding:  t("auditLog.resShareHolding"),
    share_transfer: t("auditLog.resShareTransfer"),
    snapshot:       t("auditLog.resSnapshot"),
    anti_dilution:  t("auditLog.resAntiDilution"),
    document:       t("auditLog.resDocument"),
    valuation:      t("auditLog.resValuation"),
    waterfall:      t("auditLog.resWaterfall"),
    user:           t("auditLog.resUser"),
    invitation:     t("auditLog.resInvitation"),
    import:         t("auditLog.resImport"),
  };

  const filtered = (logs ?? []).filter(log => {
    const matchSearch = !search ||
      (log.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (log.resourceName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (log.resourceType ?? "").toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === "all" || log.action === filterAction;
    const matchResource = filterResource === "all" || (log.resourceType ?? "") === filterResource;
    return matchSearch && matchAction && matchResource;
  });

  const uniqueResources = Array.from(new Set((logs ?? []).map(l => l.resourceType ?? "").filter(Boolean))).sort();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{tPages("settings.auditLog.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {tPages("settings.auditLog.desc")}
          </p>
        </div>
        <button
          onClick={() => {
            const headers = ["Timestamp", "User", "Action", "Resource Type", "Resource ID", "Resource Name", "IP Address"];
            const rows = filtered.map(log => [
              log.createdAt ? new Date(log.createdAt as any).toISOString() : "",
              log.userName ?? "",
              log.action ?? "",
              log.resourceType ?? "",
              log.resourceId ?? "",
              log.resourceName ?? "",
              log.ipAddress ?? "",
            ]);
            const csv = [headers, ...rows]
              .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
              .join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!filtered.length}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border border-border text-sm text-muted-foreground font-medium rounded-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-4 w-4" /> {t("auditLog.exportCsv")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("auditLog.totalEvents"), value: logs?.length ?? 0 },
          { label: t("auditLog.creates"), value: (logs ?? []).filter(l => l.action === "create").length },
          { label: t("auditLog.updates"), value: (logs ?? []).filter(l => l.action === "update").length },
          { label: t("auditLog.deletes"), value: (logs ?? []).filter(l => l.action === "delete").length },
        ].map(stat => (
          <div key={stat.label} className="border border-border rounded-sm p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</div>
            <div className="text-2xl font-serif font-bold mt-1">{stat.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("auditLog.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 border border-input rounded-sm text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            className="border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">{t("auditLog.allActions")}</option>
            {Object.entries(ACTION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={filterResource} onChange={e => setFilterResource(e.target.value)}
            className="border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">{t("auditLog.allResources")}</option>
            {uniqueResources.map(r => (
              <option key={r} value={r ?? ""}>{RESOURCE_LABELS[r ?? ""] ?? r}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Log Timeline */}
      {isLoading ? (
        <div className="border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
          {t("auditLog.loading")}
        </div>
      ) : !filtered.length ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("auditLog.noEvents")}</p>
          {(logs ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("auditLog.activeNotice")}
            </p>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("auditLog.timestamp")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("auditLog.user")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("auditLog.action")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("auditLog.resource")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("auditLog.details")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={log.id} className={`border-b border-border last:border-0 align-top ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                        {(log.userName ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs">{log.userName ?? `User #${log.userId}`}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} actionConfig={ACTION_CONFIG} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{RESOURCE_LABELS[log.resourceType ?? ""] ?? log.resourceType ?? "Unknown"}</div>
                    {log.resourceName && (
                      <div className="text-xs text-muted-foreground">{log.resourceName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ChangeDetail before={log.changesBefore} after={log.changesAfter} t={t} />
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

export default function AuditLog() {
  return (
    <DashboardLayout>
      <AuditLogContent />
    </DashboardLayout>
  );
}
