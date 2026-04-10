import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Search, Filter, ChevronDown, ChevronUp, User, Plus, Pencil, Trash2, Upload, Download, LogIn, Mail } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Action Config ────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  create:  { label: "Created",  icon: Plus,         color: "text-green-600 bg-green-50" },
  update:  { label: "Updated",  icon: Pencil,        color: "text-blue-600 bg-blue-50" },
  delete:  { label: "Deleted",  icon: Trash2,        color: "text-red-600 bg-red-50" },
  import:  { label: "Imported", icon: Upload,        color: "text-purple-600 bg-purple-50" },
  export:  { label: "Exported", icon: Download,      color: "text-stone-600 bg-stone-100" },
  login:   { label: "Signed In",icon: LogIn,         color: "text-teal-600 bg-teal-50" },
  invite:  { label: "Invited",  icon: Mail,          color: "text-amber-600 bg-amber-50" },
};

const RESOURCE_LABELS: Record<string, string> = {
  shareholder:    "Shareholder",
  funding_round:  "Funding Round",
  esop_grant:     "ESOP Grant",
  esop_pool:      "ESOP Pool",
  share_holding:  "Share Holding",
  share_transfer: "Share Transfer",
  snapshot:       "Snapshot",
  anti_dilution:  "Anti-Dilution",
  document:       "Document",
  valuation:      "FMV Valuation",
  waterfall:      "Waterfall",
  user:           "User",
  invitation:     "Invitation",
  import:         "Data Import",
};

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? { label: action, icon: ClipboardList, color: "text-stone-600 bg-stone-100" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ChangeDetail({ before, after }: { before?: string | null; after?: string | null }) {
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
        {expanded ? "Hide changes" : "View changes"}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {beforeObj !== null && (
            <div className="rounded-sm border border-red-200 bg-red-50 p-3">
              <div className="text-xs font-medium text-red-600 mb-1">Before</div>
              <pre className="text-xs text-red-800 whitespace-pre-wrap break-all">{renderValue(beforeObj)}</pre>
            </div>
          )}
          {afterObj !== null && (
            <div className="rounded-sm border border-green-200 bg-green-50 p-3">
              <div className="text-xs font-medium text-green-600 mb-1">After</div>
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
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterResource, setFilterResource] = useState("all");
  const [limit] = useState(200);

  const { data: logs, isLoading } = trpc.auditLog.list.useQuery({ limit, offset: 0 });

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
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          Complete history of all data changes for compliance and traceability.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: logs?.length ?? 0 },
          { label: "Creates", value: (logs ?? []).filter(l => l.action === "create").length },
          { label: "Updates", value: (logs ?? []).filter(l => l.action === "update").length },
          { label: "Deletes", value: (logs ?? []).filter(l => l.action === "delete").length },
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
            placeholder="Search by user, resource..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-sm text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            className="border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">All Actions</option>
            {Object.entries(ACTION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={filterResource} onChange={e => setFilterResource(e.target.value)}
            className="border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">All Resources</option>
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
          Loading audit log...
        </div>
      ) : !filtered.length ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No events found.</p>
          {(logs ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Audit logging is active. Events will appear here as you make changes.
            </p>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Resource</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Details</th>
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
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{RESOURCE_LABELS[log.resourceType ?? ""] ?? log.resourceType ?? "Unknown"}</div>
                    {log.resourceName && (
                      <div className="text-xs text-muted-foreground">{log.resourceName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ChangeDetail before={log.changesBefore} after={log.changesAfter} />
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
