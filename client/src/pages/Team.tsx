import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Users, UserPlus, Link2, Shield, Copy, Trash2, Check, X, Clock, Mail, ArrowRightLeft, AlertTriangle, Database } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type AppRole = "owner" | "admin" | "cfo" | "lawyer" | "investor" | "viewer";

function RoleBadge({ role, roles }: { role: string; roles: Array<{ value: string; label: string; color: string; desc: string }> }) {
  const cfg = roles.find(r => r.value === role) ?? roles[roles.length - 1];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Transfer Owner Dialog ────────────────────────────────────────────────────
function TransferOwnerDialog({
  members,
  currentUserId,
  onClose,
  t,
  roles,
}: {
  members: any[];
  currentUserId: number;
  onClose: () => void;
  t: (key: string) => string;
  roles: Array<{ value: string; label: string; color: string; desc: string }>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const utils = trpc.useUtils();

  const transferOwner = trpc.team.transferOwnership.useMutation({
    onSuccess: () => {
      utils.team.members.invalidate();
      toast.success(t("team.transferSuccess"));
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const eligibleMembers = members.filter(m => m.id !== currentUserId);
  const selectedMember = eligibleMembers.find(m => m.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-sm shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold">{t("team.transferOwnership")}</h2>
              <p className="text-xs text-muted-foreground">{t("team.cannotBeUndone")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-sm p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800" dangerouslySetInnerHTML={{ __html: t("team.transferWarning") }} />
        </div>

        {/* Select new owner */}
        <div className="space-y-2">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{t("team.selectNewOwner")}</label>
          {eligibleMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("team.noMembers")}</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {eligibleMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedId(m.id); setConfirmed(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm border text-left transition-colors ${
                    selectedId === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/30"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                    {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email ?? "—"}</div>
                  </div>
                  <RoleBadge role={m.appRole ?? "viewer"} roles={roles} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation checkbox */}
        {selectedMember && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("team.transferConfirm").replace("{{name}}", selectedMember.name ?? selectedMember.email) }} />
          </label>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => selectedId && transferOwner.mutate({ newOwnerId: selectedId })}
            disabled={!selectedId || !confirmed || transferOwner.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {transferOwner.isPending ? t("team.transferring") : t("team.transferBtn")}
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
            {t("team.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clear All Data Dialog ────────────────────────────────────────────────────
function ClearAllDataDialog({ onClose, t }: { onClose: () => void; t: (key: string) => string }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const REQUIRED_PHRASE = "CLEAR ALL DATA";
  const utils = trpc.useUtils();

  const clearData = trpc.admin.clearAllData.useMutation({
    onSuccess: (res) => {
      toast.success(t("team.clearSuccess"));
      // Invalidate every query we can - data is gone
      utils.invalidate();
      onClose();
      // Hard reload to reset any client-side caches and redirect UI to empty state
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = acknowledged && phrase === REQUIRED_PHRASE && !clearData.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-sm shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold">{t("team.clearAllData")}</h2>
              <p className="text-xs text-muted-foreground">{t("team.cannotBeUndone")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-sm p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-800 space-y-1">
            <p className="font-semibold">{t("team.clearWarningTitle")}</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>All shareholders &amp; holdings</li>
              <li>All funding rounds &amp; transactions</li>
              <li>All ESOP pools &amp; grants</li>
              <li>All valuations &amp; projections</li>
              <li>All snapshots &amp; audit logs</li>
              <li>All documents, anti-dilution &amp; liquidation data</li>
            </ul>
            <p className="pt-1">{t("team.clearPreserve")}</p>
          </div>
        </div>

        {/* Step 1: Acknowledgment */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("team.clearAcknowledge") }} />
        </label>

        {/* Step 2: Type exact phrase */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("team.clearTypeConfirm").replace("{{phrase}}", `<span class="font-mono text-foreground">${REQUIRED_PHRASE}</span>`) }} />

          <input
            type="text"
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            disabled={!acknowledged}
            placeholder={REQUIRED_PHRASE}
            className="w-full border border-input rounded-sm px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => clearData.mutate({ confirmationPhrase: phrase })}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {clearData.isPending ? t("team.clearing") : t("team.clearBtn")}
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
            {t("team.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Form ──────────────────────────────────────────────────────────────
function InviteForm({ onClose, t, roles }: { onClose: () => void; t: (key: string) => string; roles: Array<{ value: string; label: string; color: string; desc: string }> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [notes, setNotes] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const createInvite = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.inviteUrl);
      utils.invitations.list.invalidate();
      toast.success(t("team.inviteLinkCreated"));
    },
    onError: (e) => toast.error(e.message),
  });

  if (generatedLink) {
    return (
      <div className="border border-border rounded-sm p-6 bg-secondary/20 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">{t("team.inviteLinkCreated")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">{t("team.inviteLinkExpiry")}</p>
        <div className="flex items-center gap-2 bg-background border border-border rounded-sm px-3 py-2">
          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-mono truncate flex-1">{generatedLink}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success("Copied!"); }}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity">
          {t("team.done")}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-sm p-6 bg-secondary/20 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">{t("team.inviteForm")}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{t("team.emailOptional")}</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{t("team.roleRequired")}</label>
          <select value={role} onChange={e => setRole(e.target.value as AppRole)}
            className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            {roles.filter(r => r.value !== "owner").map(r => (
              <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{t("team.notesOptional")}</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Lead investor, Series A"
            className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => createInvite.mutate({ email: email || undefined, appRole: role as "admin" | "cfo" | "lawyer" | "investor" | "viewer", notes: notes || undefined, origin: window.location.origin })}
          disabled={createInvite.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Link2 className="h-4 w-4" /> {createInvite.isPending ? t("team.generating") : t("team.generateLink")}
        </button>
        <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">{t("team.cancel")}</button>
      </div>
    </div>
  );
}

// ─── Remove Member Dialog ─────────────────────────────────────────────────────
function RemoveMemberDialog({
  member,
  onClose,
  t,
  roles,
}: {
  member: any;
  onClose: () => void;
  t: (key: string) => string;
  roles: Array<{ value: string; label: string; color: string; desc: string }>;
}) {
  const utils = trpc.useUtils();
  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      utils.team.members.invalidate();
      toast.success(`${member.name ?? member.email} has been removed.`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-sm shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold">{t("team.removeMember")}</h2>
              <p className="text-xs text-muted-foreground">{t("team.removeWarning")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-sm p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-800 space-y-1">
            <p dangerouslySetInnerHTML={{ __html: t("team.removeConfirm").replace("{{name}}", `<strong>${member.name ?? member.email}</strong>`).replace("{{email}}", member.email).replace("{{role}}", `<strong>${member.appRole}</strong>`) }} />
            <p className="pt-0.5">{t("team.removeDesc")}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => removeMember.mutate({ userId: member.id })}
            disabled={removeMember.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {removeMember.isPending ? t("team.removing") : t("team.removeBtn")}
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
            {t("team.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function TeamContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");

  const { data: members, isLoading: loadingMembers } = trpc.team.members.useQuery();
  const { data: invitations, isLoading: loadingInvitations } = trpc.invitations.list.useQuery();
  const utils = trpc.useUtils();

  // Build ROLES array with translations
  const ROLES = [
    { value: "owner", label: t("team.roleOwner"), color: "text-purple-600 bg-purple-50", desc: t("team.roleOwnerDesc") },
    { value: "admin", label: t("team.roleAdmin"), color: "text-blue-600 bg-blue-50", desc: t("team.roleAdminDesc") },
    { value: "cfo", label: t("team.roleCfo"), color: "text-green-600 bg-green-50", desc: t("team.roleCfoDesc") },
    { value: "lawyer", label: t("team.roleLawyer"), color: "text-amber-600 bg-amber-50", desc: t("team.roleLawyerDesc") },
    { value: "investor", label: t("team.roleInvestor"), color: "text-cyan-600 bg-cyan-50", desc: t("team.roleInvestorDesc") },
    { value: "viewer", label: t("team.roleViewer"), color: "text-stone-600 bg-stone-50", desc: t("team.roleViewerDesc") },
  ];

  const updateRole = trpc.team.updateRole.useMutation({
    onSuccess: () => { utils.team.members.invalidate(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });

  const revokeInvite = trpc.invitations.revoke.useMutation({
    onSuccess: () => { utils.invitations.list.invalidate(); toast.success("Invitation revoked"); },
    onError: (e) => toast.error(e.message),
  });

  const currentUserRole = (members?.find(m => (m as any).id === user?.id) as any)?.appRole ?? "viewer";
  const isOwner = currentUserRole === "owner";
  const canManage = ["owner", "admin"].includes(currentUserRole);

  const pendingInvites = invitations?.filter(i => i.status === "pending") ?? [];
  const allInvites = invitations ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Transfer Owner Dialog */}
      {showTransferDialog && members && user && (
        <TransferOwnerDialog
          members={members as any[]}
          currentUserId={user.id}
          onClose={() => setShowTransferDialog(false)}
          t={t}
          roles={ROLES}
        />
      )}

      {/* Clear All Data Dialog */}
      {showClearDialog && (
        <ClearAllDataDialog onClose={() => setShowClearDialog(false)} t={t} />
      )}

      {/* Remove Member Dialog */}
      {memberToRemove && (
        <RemoveMemberDialog
          member={memberToRemove}
          onClose={() => setMemberToRemove(null)}
          t={t}
          roles={ROLES}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">{tPages("settings.team.title")}</h1>
          <p className="text-muted-foreground mt-1">{tPages("settings.team.desc")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setShowTransferDialog(true)}
              className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 text-sm font-medium rounded-sm hover:bg-amber-100 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" /> {t("team.transferOwnership")}
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
            >
              <UserPlus className="h-4 w-4" /> {t("team.inviteMember")}
            </button>
          )}
        </div>
      </div>

      {/* Role Legend */}
      <div className="border border-border rounded-sm p-4 bg-secondary/10">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("team.rolePermissions")}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLES.map(r => (
            <div key={r.value} className="space-y-1">
              <RoleBadge role={r.value} roles={ROLES} />
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Form */}
      {showInviteForm && <InviteForm onClose={() => setShowInviteForm(false)} t={t} roles={ROLES} />}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {[
            { key: "members", label: t("team.tabMembers"), count: members?.length ?? 0 },
            { key: "invitations", label: t("team.tabInvitations"), count: pendingInvites.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "members" | "invitations")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-secondary rounded text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="border border-border rounded-sm overflow-hidden">
          {loadingMembers ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("team.loadingMembers")}</div>
          ) : !members?.length ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">{t("team.noMembers2")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colMember")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colRole")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colJoined")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colLastSignIn")}</th>
                  {canManage && <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colActions")}</th>}
                </tr>
              </thead>
              <tbody>
                {(members as any[]).map((m, i) => {
                  const isCurrentUser = m.id === user?.id;
                  return (
                    <tr key={m.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{m.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{m.email ?? "—"}</div>
                          </div>
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded">{t("team.you")}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canManage && !isCurrentUser && m.appRole !== "owner" ? (
                          <select
                            value={m.appRole ?? "viewer"}
                            onChange={e => {
                              const v = e.target.value as AppRole;
                              if (v !== "owner") updateRole.mutate({ userId: m.id, appRole: v });
                            }}
                            className="border border-input rounded-sm px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {ROLES.filter(r => r.value !== "owner").map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge role={m.appRole ?? "viewer"} roles={ROLES} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(m.createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(m.lastSignedIn)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const targetRole = m.appRole ?? "viewer";
                            const canRemove =
                              !isCurrentUser &&
                              targetRole !== "owner" &&
                              (isOwner || targetRole !== "admin");
                            return canRemove ? (
                              <button
                                onClick={() => setMemberToRemove(m)}
                                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-sm transition-colors"
                                title={t("team.remove")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t("team.remove")}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            );
                          })()}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && (
        <div className="border border-border rounded-sm overflow-hidden">
          {loadingInvitations ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("team.loadingInvitations")}</div>
          ) : !allInvites.length ? (
            <div className="p-8 text-center">
              <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">{t("team.noInvitations")}</p>
              {canManage && (
                <button onClick={() => setShowInviteForm(true)} className="mt-3 text-sm text-primary hover:underline">
                  {t("team.sendFirst")}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colEmailNotes")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colRole")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colStatus")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colExpires")}</th>
                  {canManage && <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("team.colActions")}</th>}
                </tr>
              </thead>
              <tbody>
                {allInvites.map((inv, i) => {
                  const isExpired = new Date() > new Date(inv.expiresAt);
                  const statusColor = {
                    pending: "text-amber-600",
                    accepted: "text-green-600",
                    revoked: "text-red-500",
                    expired: "text-muted-foreground",
                  }[inv.status] ?? "text-muted-foreground";
                  const StatusIcon = {
                    pending: Clock,
                    accepted: Check,
                    revoked: X,
                    expired: X,
                  }[inv.status] ?? Clock;
                  return (
                    <tr key={inv.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{inv.email ?? "—"}</div>
                        {inv.notes && <div className="text-xs text-muted-foreground">{inv.notes}</div>}
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={inv.appRole} roles={ROLES} /></td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                          <StatusIcon className="h-3 w-3" />
                          {isExpired && inv.status === "pending" ? "expired" : inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(inv.expiresAt)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {inv.status === "pending" && !isExpired && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  const url = `${window.location.origin}/join?token=${inv.token}`;
                                  navigator.clipboard.writeText(url);
                                  toast.success("Link copied!");
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                <Copy className="h-3 w-3" /> {t("team.copyLink")}
                              </button>
                              <button
                                onClick={() => revokeInvite.mutate({ id: inv.id })}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" /> {t("team.revoke")}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Danger Zone — Owner only */}
      {isOwner && (
        <div className="border border-red-200 rounded-sm bg-red-50/30">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-700" />
              <h2 className="font-serif text-lg font-semibold text-red-900">{t("team.dangerZone")}</h2>
            </div>
            <p className="text-xs text-red-700/80 mt-1">{t("team.dangerDesc")}</p>
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm">{t("team.clearDataTitle")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("team.clearDataDesc")}
              </p>
            </div>
            <button
              onClick={() => setShowClearDialog(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 bg-white text-sm font-medium rounded-sm hover:bg-red-50 transition-colors"
            >
              <Database className="h-4 w-4" /> {t("team.clearBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function Team() {
  return (
    <DashboardLayout>
      <TeamContent />
    </DashboardLayout>
  );
}
