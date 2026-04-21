import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import {
  PenLine, Plus, Trash2, Send, FileUp, Download, Info,
  Eye, Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

// ════════════════════════════════════════════════════════════════════════════
// eSignature (DocuSeal Integration)
//
// Send equity documents for electronic signature. Track signing status,
// store signed PDFs. Uses trpc.esign.* endpoints that proxy to DocuSeal API.
// ════════════════════════════════════════════════════════════════════════════

export default function ESignPage() {
  return (
    <DashboardLayout>
      <ESignContent />
    </DashboardLayout>
  );
}

type DocType = "share_certificate" | "safe_agreement" | "convertible_note" | "stock_option_grant" | "board_resolution" | "sha" | "custom";
type SigningStatus = "draft" | "pending" | "viewed" | "completed" | "declined" | "expired";

type Signer = { role: string; name: string; email: string; signedAt?: string };

type ESignForm = {
  docType: DocType;
  title: string;
  description: string;
  signers: Signer[];
  expiresAt: string;
};

const emptyForm: ESignForm = {
  docType: "share_certificate",
  title: "",
  description: "",
  signers: [{ role: "First Party", name: "", email: "" }],
  expiresAt: "",
};

const DOC_TYPE_LABELS: Record<DocType, string> = {
  share_certificate: "Share Certificate",
  safe_agreement: "SAFE Agreement",
  convertible_note: "Convertible Note",
  stock_option_grant: "Stock Option Grant",
  board_resolution: "Board Resolution",
  sha: "Shareholders' Agreement",
  custom: "Custom Document",
};

const STATUS_CONFIG: Record<SigningStatus, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Send },
  viewed: { label: "Viewed", color: "bg-blue-100 text-blue-800", icon: Eye },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-800", icon: XCircle },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500", icon: AlertTriangle },
};

const TAB_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "viewed", label: "Viewed" },
  { value: "completed", label: "Completed" },
];

function ESignContent() {
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  const { data: requests, isLoading } = trpc.esign.list.useQuery();

  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ESignForm>(emptyForm);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const createMut = trpc.esign.create.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); toast.success("Signing request created"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.esign.delete.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); toast.success("Signing request deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const createTemplateMut = trpc.esign.createTemplate.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); toast.success("Document uploaded to DocuSeal"); },
    onError: (e) => toast.error(e.message),
  });
  const sendMut = trpc.esign.send.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); setSendingId(null); toast.success("Signing request sent!"); },
    onError: (e) => { setSendingId(null); toast.error(e.message); },
  });

  const filtered = useMemo(() => {
    if (!requests) return [];
    if (tab === "all") return requests;
    return requests.filter((r: any) => r.status === tab);
  }, [requests, tab]);

  function resetForm() {
    setForm(emptyForm);
    setSelectedFile(null);
    setShowForm(false);
  }

  async function handleCreate() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const validSigners = form.signers.filter(s => s.email.trim());
    if (validSigners.length === 0) { toast.error("At least one signer with email is required"); return; }

    try {
      const row = await createMut.mutateAsync({
        docType: form.docType,
        title: form.title,
        description: form.description || undefined,
        signers: JSON.stringify(validSigners),
        expiresAt: form.expiresAt || undefined,
      });

      // If a file was selected, upload it to create the DocuSeal template
      if (selectedFile && row?.id) {
        setUploadingFile(true);
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(",")[1];
            await createTemplateMut.mutateAsync({
              signingRequestId: row.id,
              fileName: selectedFile.name,
              fileBase64: base64,
            });
          } catch { /* error toast already shown by mutation */ }
          setUploadingFile(false);
        };
        reader.readAsDataURL(selectedFile);
      }

      resetForm();
    } catch { /* error toast already shown */ }
  }

  async function handleSend(id: number) {
    setSendingId(id);
    await sendMut.mutateAsync({ signingRequestId: id });
  }

  function addSigner() {
    setForm(prev => ({
      ...prev,
      signers: [...prev.signers, { role: "First Party", name: "", email: "" }],
    }));
  }

  function removeSigner(index: number) {
    setForm(prev => ({
      ...prev,
      signers: prev.signers.filter((_, i) => i !== index),
    }));
  }

  function updateSigner(index: number, field: keyof Signer, value: string) {
    setForm(prev => ({
      ...prev,
      signers: prev.signers.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="p-6 sm:p-10 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            eSignature
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send equity documents for electronic signature via DocuSeal.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-6 space-y-5 bg-card shadow-sm">
          <h2 className="font-semibold text-lg">New Signing Request</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document Type</label>
              <select
                value={form.docType}
                onChange={e => setForm(prev => ({ ...prev, docType: e.target.value as DocType }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Series A Share Certificate — John Doe"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              placeholder="Optional notes about this signing request"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none"
            />
          </div>

          {/* Upload document */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upload Document (PDF / DOCX)</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <FileUp className="h-4 w-4" />
                {selectedFile ? selectedFile.name : "Choose File"}
              </button>
              {selectedFile && (
                <span className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          </div>

          {/* Signers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signers</label>
              <button
                onClick={addSigner}
                className="text-xs text-primary hover:underline"
              >
                + Add Signer
              </button>
            </div>
            {form.signers.map((signer, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Role</label>
                  <input
                    value={signer.role}
                    onChange={e => updateSigner(i, "role", e.target.value)}
                    placeholder="First Party"
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Name</label>
                  <input
                    value={signer.name}
                    onChange={e => updateSigner(i, "name", e.target.value)}
                    placeholder="John Doe"
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Email *</label>
                  <input
                    type="email"
                    value={signer.email}
                    onChange={e => updateSigner(i, "email", e.target.value)}
                    placeholder="john@example.com"
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  />
                </div>
                <div>
                  {form.signers.length > 1 && (
                    <button
                      onClick={() => removeSigner(i)}
                      className="text-destructive hover:text-destructive/80 p-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Expiry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry Date (optional)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={createMut.isPending || uploadingFile}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMut.isPending || uploadingFile ? "Creating…" : "Save & Upload"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TAB_OPTIONS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="py-3 pr-4">Title</th>
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Signers</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Created</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No signing requests{tab !== "all" ? ` with status "${tab}"` : ""}.
                </td>
              </tr>
            )}
            {filtered.map((req: any) => {
              const signers: Signer[] = req.signers ? JSON.parse(req.signers) : [];
              const signedCount = signers.filter(s => s.signedAt).length;
              const statusCfg = STATUS_CONFIG[req.status as SigningStatus] || STATUS_CONFIG.draft;
              const StatusIcon = statusCfg.icon;

              return (
                <tr key={req.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{req.title}</div>
                    {req.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{req.description}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {DOC_TYPE_LABELS[req.docType as DocType] || req.docType}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs">
                      {signedCount}/{signers.length} signed
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Send button — only for draft with template */}
                      {canEdit && req.status === "draft" && req.docusealTemplateId && (
                        <button
                          onClick={() => handleSend(req.id)}
                          disabled={sendingId === req.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                          title="Send for signing"
                        >
                          <Send className="h-3 w-3" />
                          {sendingId === req.id ? "Sending…" : "Send"}
                        </button>
                      )}
                      {/* Download signed PDF */}
                      {req.status === "completed" && req.signedDocumentUrl && (
                        <a
                          href={req.signedDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                          title="Download signed PDF"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </a>
                      )}
                      {/* Delete — only drafts */}
                      {canEdit && req.status === "draft" && (
                        <button
                          onClick={() => {
                            if (confirm("Delete this signing request?")) {
                              deleteMut.mutate({ id: req.id });
                            }
                          }}
                          className="p-1.5 text-destructive hover:text-destructive/80"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div className="rounded-xl border bg-muted/30 p-5 mt-6">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">How eSignature works</p>
            <p>
              <strong>1. Create</strong> — Choose document type, add signers, upload a PDF or DOCX.
            </p>
            <p>
              <strong>2. Send</strong> — DocuSeal emails each signer a link to review and sign.
            </p>
            <p>
              <strong>3. Track</strong> — Status updates automatically via webhook: Pending → Viewed → Completed.
            </p>
            <p>
              <strong>4. Download</strong> — Once all parties sign, the completed PDF is available here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
