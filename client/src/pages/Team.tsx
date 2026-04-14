import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Users, UserPlus, Link2, Shield, Copy, Trash2, Check, X, Clock, Mail, ArrowRightLeft, AlertTriangle, Database } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Role Config ──────────────────────────────────────────────────────────────
const ROLES = [
  { value: "owner",    label: "Owner",    color: "bg-amber-100 text-amber-800",   desc: "Full access, can manage team" },
  { value: "admin",    label: "Admin",    color: "bg-red-100 text-red-800",       desc: "Full read/write, can invite" },
  { value: "cfo",      label: "CFO",      color: "bg-blue-100 text-blue-800",     desc: "Full financial access" },
  { value: "lawyer",   label: "Lawyer",   color: "bg-purple-100 text-purple-800", desc: "Read-only + documents" },
  { value: "investor", label: "Investor", color: "bg-green-100 text-green-800",   desc: "Own holdings only" },
  { value: "viewer",   label: "Viewer",   color: "bg-stone-100 text-stone-600",   desc: "Read-only access" },
] as const;

type AppRole = typeof ROLES[number]["value"];

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLES.find(r => r.value === role) ?? ROLES[ROLES.length - 1];
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
}: {
  members: any[];
  currentUserId: number;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const utils = trpc.useUtils();

  const transferOwner = trpc.team.transferOwnership.useMutation({
    onSuccess: () => {
      utils.team.members.invalidate();
      toast.success("Ownership transferred successfully. Your role is now Admin.");
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
              <h2 className="font-serif text-lg font-semibold">Transfer Ownership</h2>
              <p className="text-xs text-muted-foreground">This action cannot be undone</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-sm p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Transferring ownership will demote your role to <strong>Admin</strong>. The new owner will have full control over this cap table.
          </p>
        </div>

        {/* Select new owner */}
        <div className="space-y-2">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Select New Owner</label>
          {eligibleMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other team members available. Invite someone first.</p>
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
                  <RoleBadge role={m.appRole ?? "viewer"} />
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
            <span className="text-sm text-muted-foreground">
              I understand that <strong>{selectedMember.name ?? selectedMember.email}</strong> will become the new Owner and my role will be changed to Admin.
            </span>
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
            {transferOwner.isPending ? "Transferring..." : "Transfer Ownership"}
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clear All Data Dialog ────────────────────────────────────────────────────
function ClearAllDataDialog({ onClose }: { onClose: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const REQUIRED_PHRASE = "CLEAR ALL DATA";
  const utils = trpc.useUtils();

  const clearData = trpc.admin.clearAllData.useMutation({
    onSuccess: (res) => {
      toast.success("All business data cleared successfully.");
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
              <h2 className="font-serif text-lg font-semibold">Clear All Data</h2>
              <p className="text-xs text-muted-foreground">This action cannot be undone</p>
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
            <p className="font-semibold">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>All shareholders &amp; holdings</li>
              <li>All funding rounds &amp; transactions</li>
              <li>All ESOP pools &amp; grants</li>
              <li>All valuations &amp; projections</li>
              <li>All snapshots &amp; audit logs</li>
              <li>All documents, anti-dilution &amp; liquidation data</li>
            </ul>
            <p className="pt-1">Team members &amp; invitations are preserved.</p>
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
          <span className="text-sm text-muted-foreground">
            I understand this will permanently delete all cap table data and this action is <strong>irreversible</strong>.
          </span>
        </label>

        {/* Step 2: Type exact phrase */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Type <span className="font-mono text-foreground">{REQUIRED_PHRASE}</span> to confirm
          </label>
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
            {clearData.isPending ? "Clearing..." : "Clear All Data"}
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Form ──────────────────────────────────────────────────────────────
function InviteForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [notes, setNotes] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const createInvite = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.inviteUrl);
      utils.invitations.list.invalidate();
      toast.success("Invitation link generated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (generatedLink) {
    return (
      <div className="border border-border rounded-sm p-6 bg-secondary/20 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">Invitation Link Created</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">Share this link with the invitee. It expires in 7 days.</p>
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
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-sm p-6 bg-secondary/20 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">Invite Team Member</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Email (optional)</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Role *</label>
          <select value={role} onChange={e => setRole(e.target.value as AppRole)}
            className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            {ROLES.filter(r => r.value !== "owner").map(r => (
              <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes (optional)</label>
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
          <Link2 className="h-4 w-4" /> {createInvite.isPending ? "Generating..." : "Generate Invite Link"}
        </button>
        <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ─── Remove Member Dialog ─────────────────────────────────────────────────────
function RemoveMemberDialog({
  member,
  onClose,
}: {
  member: any;
  onClose: () => void;
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
              <h2 className="font-serif text-lg font-semibold">Remove Team Member</h2>
              <p className="text-xs text-muted-foreground">This user will lose access to the cap table</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-sm p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-800 space-y-1">
            <p>
              Remove <strong>{member.name ?? member.email}</strong> ({member.email}) with role <strong>{member.appRole}</strong>?
            </p>
            <p className="pt-0.5">
              They will no longer be able to access any data in this cap table. If they sign in again they will re-join as a new <em>viewer</em> until you assign them a role.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => removeMember.mutate({ userId: member.id })}
            disabled={removeMember.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {removeMember.isPending ? "Removing..." : "Remove Member"}
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function TeamContent() {
  const { user } = useAuth();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");

  const { data: members, isLoading: loadingMembers } = trpc.team.members.useQuery();
  const { data: invitations, isLoading: loadingInvitations } = trpc.invitations.list.useQuery();
  const utils = trpc.useUtils();

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
        />
      )}

      {/* Clear All Data Dialog */}
      {showClearDialog && (
        <ClearAllDataDialog onClose={() => setShowClearDialog(false)} />
      )}

      {/* Remove Member Dialog */}
      {memberToRemove && (
        <RemoveMemberDialog
          member={memberToRemove}
          onClose={() => setMemberToRemove(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">Manage team members, roles, and access permissions.</p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setShowTransferDialog(true)}
              className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 text-sm font-medium rounded-sm hover:bg-amber-100 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" /> Transfer Ownership
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
            >
              <UserPlus className="h-4 w-4" /> Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Role Legend */}
      <div className="border border-border rounded-sm p-4 bg-secondary/10">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Role Permissions</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLES.map(r => (
            <div key={r.value} className="space-y-1">
              <RoleBadge role={r.value} />
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Form */}
      {showInviteForm && <InviteForm onClose={() => setShowInviteForm(false)} />}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {[
            { key: "members", label: "Members", count: members?.length ?? 0 },
            { key: "invitations", label: "Invitations", count: pendingInvites.length },
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
            <div className="p-8 text-center text-muted-foreground text-sm">Loading members...</div>
          ) : !members?.length ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No team members yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Last Sign In</th>
                  {canManage && <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>}
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
                            <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded">You</span>
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
                          <RoleBadge role={m.appRole ?? "viewer"} />
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
                                title="Remove member"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Remove</span>
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
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && (
        <div className="border border-border rounded-sm overflow-hidden">
          {loadingInvitations ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading invitations...</div>
          ) : !allInvites.length ? (
            <div className="p-8 text-center">
              <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No invitations sent yet.</p>
              {canManage && (
                <button onClick={() => setShowInviteForm(true)} className="mt-3 text-sm text-primary hover:underline">
                  Send your first invitation →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email / Notes</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Expires</th>
                  {canManage && <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>}
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
                      <td className="px-4 py-3"><RoleBadge role={inv.appRole} /></td>
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
                                <Copy className="h-3 w-3" /> Copy Link
                              </button>
                              <button
                                onClick={() => revokeInvite.mutate({ id: inv.id })}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" /> Revoke
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
          )}
        </div>
      )}

      {/* Danger Zone — Owner only */}
      {isOwner && (
        <div className="border border-red-200 rounded-sm bg-red-50/30">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-700" />
              <h2 className="font-serif text-lg font-semibold text-red-900">Danger Zone</h2>
            </div>
            <p className="text-xs text-red-700/80 mt-1">Irreversible actions. Owner-only.</p>
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm">Clear all cap table data</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete all shareholders, funding rounds, transactions, holdings, ESOP, valuations, and audit logs.
                Team members and invitations are preserved.
              </p>
            </div>
            <button
              onClick={() => setShowClearDialog(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 bg-white text-sm font-medium rounded-sm hover:bg-red-50 transition-colors"
            >
              <Database className="h-4 w-4" /> Clear All Data
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
