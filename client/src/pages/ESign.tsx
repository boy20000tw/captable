import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import {
  PenLine, Plus, Trash2, Send, FileUp, Download, Info,
  Eye, Clock, CheckCircle2, XCircle, AlertTriangle,
  FolderOpen, Globe, Building2, ExternalLink, Key, Link2, Unlink,
  ArrowRight, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

// ════════════════════════════════════════════════════════════════════════════
// eSignature (DocuSeal Integration)
//
// Three states:
//   0. Not connected → onboarding flow (register at DocuSeal + input API key)
//   1. Connected → Signing Requests tab
//   2. Connected → Template Library tab
// ════════════════════════════════════════════════════════════════════════════

export default function ESignPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="esign">
        <ESignContent />
      </FeatureGate>
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
  templateId: number | "";
};

const emptyForm: ESignForm = {
  docType: "share_certificate",
  title: "",
  description: "",
  signers: [{ role: "First Party", name: "", email: "" }],
  expiresAt: "",
  templateId: "",
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

// ─── Main entry point ─────────────────────────────────────────────────────

type PageSection = "requests" | "templates";

function ESignContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("equity");
  const [section, setSection] = useState<PageSection>("requests");

  const connectionQuery = trpc.esign.connectionStatus.useQuery();
  const isConnected = connectionQuery.data?.connected === true;
  const isLoading = connectionQuery.isLoading;

  if (isLoading) {
    return (
      <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!isConnected) {
    return <DocuSealOnboarding onConnected={() => connectionQuery.refetch()} />;
  }

  return (
    <div className="p-6 sm:p-10 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            {tPages("esign.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPages("esign.desc")}
          </p>
        </div>
        <ConnectionBadge />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setSection("requests")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            section === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("esign.signingRequests")}
        </button>
        <button
          onClick={() => setSection("templates")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            section === "templates"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t("esign.templateLibrary")}
        </button>
      </div>

      {section === "requests" ? <RequestsSection /> : <TemplatesSection />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Connection Badge — shown in header when connected, allows disconnect
// ════════════════════════════════════════════════════════════════════════════

function ConnectionBadge() {
  const { t } = useTranslation("equity");
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();
  const [showConfirm, setShowConfirm] = useState(false);

  const disconnectMut = trpc.esign.disconnect.useMutation({
    onSuccess: () => {
      utils.esign.connectionStatus.invalidate();
      toast.success(t("esign.connection.disconnected"));
      setShowConfirm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="relative">
      <button
        onClick={() => canEdit && setShowConfirm(!showConfirm)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {t("esign.connection.connected")}
      </button>
      {showConfirm && canEdit && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border bg-card shadow-lg p-4 z-20">
          <p className="text-sm font-medium mb-1">{t("esign.connection.disconnectTitle")}</p>
          <p className="text-xs text-muted-foreground mb-3">{t("esign.connection.disconnectDesc")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
            >
              {t("esign.connection.cancel")}
            </button>
            <button
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
              className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Unlink className="h-3 w-3 inline mr-1" />
              {disconnectMut.isPending ? "..." : t("esign.connection.disconnect")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Onboarding — Guide user to register at DocuSeal, then input API key
// ════════════════════════════════════════════════════════════════════════════

function DocuSealOnboarding({ onConnected }: { onConnected: () => void }) {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("equity");
  const { canEdit } = usePermissions();
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const connectMut = trpc.esign.connect.useMutation({
    onSuccess: () => {
      toast.success(t("esign.connection.success"));
      onConnected();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleConnect() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error(t("esign.connection.keyRequired"));
      return;
    }
    connectMut.mutate({ apiKey: trimmed });
  }

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PenLine className="h-6 w-6 text-primary" />
          {tPages("esign.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tPages("esign.desc")}
        </p>
      </div>

      {/* Onboarding card */}
      <div className="border rounded-2xl bg-card shadow-sm overflow-hidden">
        {/* Hero section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 px-8 py-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 shadow-sm mb-4">
            <PenLine className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold">{t("esign.onboarding.title")}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {t("esign.onboarding.subtitle")}
          </p>
        </div>

        {/* Steps */}
        <div className="px-8 py-8 space-y-6">
          {/* Step 1: Register at DocuSeal */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">
                1
              </div>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-6">
              <h3 className="font-semibold text-sm">{t("esign.onboarding.step1Title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("esign.onboarding.step1Desc")}
              </p>
              <a
                href="https://www.docuseal.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t("esign.onboarding.registerBtn")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Step 2: Get API Key */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">
                2
              </div>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-6">
              <h3 className="font-semibold text-sm">{t("esign.onboarding.step2Title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("esign.onboarding.step2Desc")}
              </p>
              <a
                href="https://www.docuseal.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t("esign.onboarding.apiSettingsLink")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Step 3: Connect */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">
                3
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm">{t("esign.onboarding.step3Title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("esign.onboarding.step3Desc")}
              </p>

              {canEdit ? (
                <>
                  {!showKeyInput ? (
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 border-2 border-dashed border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      <Key className="h-4 w-4" />
                      {t("esign.onboarding.enterKeyBtn")}
                    </button>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder={t("esign.onboarding.keyPlaceholder")}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background font-mono"
                          onKeyDown={e => e.key === "Enter" && handleConnect()}
                          autoFocus
                        />
                        <button
                          onClick={handleConnect}
                          disabled={connectMut.isPending || !apiKey.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {connectMut.isPending ? (
                            <>{t("esign.onboarding.validating")}</>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4" />
                              {t("esign.onboarding.connectBtn")}
                            </>
                          )}
                        </button>
                      </div>
                      {connectMut.isError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          {connectMut.error.message}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-amber-600">
                  {t("esign.onboarding.editorOnly")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-8 py-4 bg-muted/30 border-t">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {t("esign.onboarding.footerNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Section 1: Signing Requests
// ════════════════════════════════════════════════════════════════════════════

const REQUEST_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "viewed", label: "Viewed" },
  { value: "completed", label: "Completed" },
];

function RequestsSection() {
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  const { data: requests, isLoading } = trpc.esign.list.useQuery();
  const { data: templates } = trpc.esign.templates.useQuery();

  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ESignForm>(emptyForm);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [docSource, setDocSource] = useState<"template" | "upload">("template");
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const createMut = trpc.esign.create.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); toast.success(t("esign.toastCreated")); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.esign.delete.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); toast.success(t("esign.toastDeleted")); },
    onError: (e) => toast.error(e.message),
  });
  const createTemplateMut = trpc.esign.createTemplate.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); toast.success(t("esign.toastUploaded")); },
    onError: (e) => toast.error(e.message),
  });
  const sendMut = trpc.esign.send.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); setSendingId(null); toast.success(t("esign.toastSent")); },
    onError: (e) => { setSendingId(null); toast.error(e.message); },
  });
  const updateMut = trpc.esign.update.useMutation({
    onSuccess: () => { utils.esign.list.invalidate(); },
    onError: (e) => toast.error(e.message),
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
    setDocSource("template");
  }

  async function handleCreate() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const validSigners = form.signers.filter(s => s.email.trim());
    if (validSigners.length === 0) { toast.error("At least one signer with email is required"); return; }

    if (docSource === "template" && !form.templateId) { toast.error("Select a template or switch to upload"); return; }
    if (docSource === "upload" && !selectedFile) { toast.error("Select a file to upload or use a template"); return; }

    try {
      const selectedTemplate = docSource === "template" && form.templateId
        ? templates?.find((t: any) => t.id === form.templateId)
        : null;

      const row = await createMut.mutateAsync({
        docType: form.docType,
        title: form.title,
        description: form.description || undefined,
        signers: JSON.stringify(validSigners),
        expiresAt: form.expiresAt || undefined,
        docusealTemplateId: selectedTemplate?.docusealTemplateId ?? undefined,
      });

      if (row?.id && docSource === "upload" && selectedFile) {
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
          } catch { /* toast already shown */ }
          setUploadingFile(false);
          // Reset form after async upload completes to avoid race condition
          setTimeout(() => resetForm(), 0);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        // Reset form immediately if no file upload
        resetForm();
      }
    } catch { /* toast already shown */ }
  }

  async function handleSend(id: number) {
    setSendingId(id);
    await sendMut.mutateAsync({ signingRequestId: id });
  }

  function addSigner() {
    setForm(prev => ({ ...prev, signers: [...prev.signers, { role: "First Party", name: "", email: "" }] }));
  }
  function removeSigner(index: number) {
    setForm(prev => ({ ...prev, signers: prev.signers.filter((_, i) => i !== index) }));
  }
  function updateSigner(index: number, field: keyof Signer, value: string) {
    setForm(prev => ({ ...prev, signers: prev.signers.map((s, i) => i === index ? { ...s, [field]: value } : s) }));
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("esign.newRequest")}
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-6 space-y-5 bg-card shadow-sm">
          <h2 className="font-semibold text-lg">{t("esign.newRequest")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document Type</label>
              <select value={form.docType} onChange={e => setForm(prev => ({ ...prev, docType: e.target.value as DocType }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title *</label>
              <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Series A Share Certificate — John Doe" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={2} placeholder="Optional notes" className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
          </div>

          {/* Document source: template or upload */}
          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document Source</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDocSource("template")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${docSource === "template" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                <FolderOpen className="h-3.5 w-3.5 inline mr-1.5" />
                From Template
              </button>
              <button
                onClick={() => setDocSource("upload")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${docSource === "upload" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                <FileUp className="h-3.5 w-3.5 inline mr-1.5" />
                Upload New
              </button>
            </div>

            {docSource === "template" && (
              <div className="space-y-1.5">
                <select
                  value={form.templateId}
                  onChange={e => setForm(prev => ({ ...prev, templateId: e.target.value ? Number(e.target.value) : "" }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select a template…</option>
                  {templates && (templates as any[]).filter((t: any) => t.scope === "platform").length > 0 && (
                    <optgroup label="Platform Templates">
                      {(templates as any[]).filter((t: any) => t.scope === "platform").map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name} — {DOC_TYPE_LABELS[t.docType as DocType] || t.docType}</option>
                      ))}
                    </optgroup>
                  )}
                  {templates && (templates as any[]).filter((t: any) => t.scope === "company").length > 0 && (
                    <optgroup label="Company Templates">
                      {(templates as any[]).filter((t: any) => t.scope === "company").map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name} — {DOC_TYPE_LABELS[t.docType as DocType] || t.docType}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {templates && (templates as any[]).length === 0 && (
                  <p className="text-xs text-muted-foreground">No templates yet. Upload one in the Template Library tab, or switch to "Upload New".</p>
                )}
              </div>
            )}

            {docSource === "upload" && (
              <div className="flex items-center gap-3">
                <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
                  <FileUp className="h-4 w-4" />
                  {selectedFile ? selectedFile.name : "Choose File (PDF / DOCX)"}
                </button>
                {selectedFile && <span className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</span>}
              </div>
            )}
          </div>

          {/* Signers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signers</label>
              <button onClick={addSigner} className="text-xs text-primary hover:underline">+ Add Signer</button>
            </div>
            {form.signers.map((signer, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Role</label>
                  <input value={signer.role} onChange={e => updateSigner(i, "role", e.target.value)} placeholder="First Party" className="w-full border rounded px-2 py-1.5 text-sm bg-background" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Name</label>
                  <input value={signer.name} onChange={e => updateSigner(i, "name", e.target.value)} placeholder="John Doe" className="w-full border rounded px-2 py-1.5 text-sm bg-background" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Email *</label>
                  <input type="email" value={signer.email} onChange={e => updateSigner(i, "email", e.target.value)} placeholder="john@example.com" className="w-full border rounded px-2 py-1.5 text-sm bg-background" />
                </div>
                <div>
                  {form.signers.length > 1 && (
                    <button onClick={() => removeSigner(i)} className="text-destructive hover:text-destructive/80 p-1.5" aria-label={t("esign.removeSigner")} title={t("esign.removeSigner")}><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Expiry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry Date (optional)</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(prev => ({ ...prev, expiresAt: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={createMut.isPending || uploadingFile} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMut.isPending || uploadingFile ? "Creating…" : "Save & Upload"}
            </button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Request filter tabs */}
      <div className="flex gap-1 border-b">
        {REQUEST_TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Requests table */}
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
              <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No signing requests{tab !== "all" ? ` with status "${tab}"` : ""}.</td></tr>
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
                    {req.description && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{req.description}</div>}
                  </td>
                  <td className="py-3 pr-4"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{DOC_TYPE_LABELS[req.docType as DocType] || req.docType}</span></td>
                  <td className="py-3 pr-4"><span className="text-xs">{signedCount}/{signers.length} signed</span></td>
                  <td className="py-3 pr-4"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusCfg.color}`}><StatusIcon className="h-3 w-3" />{statusCfg.label}</span></td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && req.status === "draft" && req.docusealTemplateId && (
                        <button onClick={() => handleSend(req.id)} disabled={sendingId === req.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50" title="Send for signing">
                          <Send className="h-3 w-3" />{sendingId === req.id ? "Sending…" : "Send"}
                        </button>
                      )}
                      {req.status === "completed" && req.signedDocumentUrl && (
                        <a href={req.signedDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200" title="Download signed PDF">
                          <Download className="h-3 w-3" />PDF
                        </a>
                      )}
                      {canEdit && req.status === "draft" && (
                        <button onClick={() => { if (confirm("Delete this signing request?")) deleteMut.mutate({ id: req.id }); }} disabled={deleteMut.isPending} className="p-1.5 text-destructive hover:text-destructive/80 disabled:opacity-50 disabled:pointer-events-none" aria-label="Delete request" title="Delete">
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
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Section 2: Template Library
// ════════════════════════════════════════════════════════════════════════════

function TemplatesSection() {
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const isAppAdmin = me.data?.role === "admin";

  const { data: templates, isLoading } = trpc.esign.templates.useQuery();

  const [showUpload, setShowUpload] = useState(false);
  const [uploadScope, setUploadScope] = useState<"company" | "platform">("company");
  const [uploadForm, setUploadForm] = useState({ name: "", description: "", docType: "custom" as DocType });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const uploadCompanyMut = trpc.esign.uploadTemplate.useMutation({
    onSuccess: () => { utils.esign.templates.invalidate(); setShowUpload(false); setUploadFile(null); setUploadForm({ name: "", description: "", docType: "custom" }); toast.success("Template uploaded"); },
    onError: (e) => toast.error(e.message),
  });
  const uploadPlatformMut = trpc.esign.uploadPlatformTemplate.useMutation({
    onSuccess: () => { utils.esign.templates.invalidate(); setShowUpload(false); setUploadFile(null); setUploadForm({ name: "", description: "", docType: "custom" }); toast.success("Platform template uploaded"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTemplateMut = trpc.esign.deleteTemplate.useMutation({
    onSuccess: () => { utils.esign.templates.invalidate(); toast.success("Template deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const platformTemplates = useMemo(() => (templates as any[] || []).filter((t: any) => t.scope === "platform"), [templates]);
  const companyTemplates = useMemo(() => (templates as any[] || []).filter((t: any) => t.scope === "company"), [templates]);

  async function handleUpload() {
    if (!uploadForm.name.trim()) { toast.error("Template name is required"); return; }
    if (!uploadFile) { toast.error("Select a file to upload"); return; }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const payload = {
        name: uploadForm.name,
        description: uploadForm.description || undefined,
        docType: uploadForm.docType as DocType,
        fileName: uploadFile.name,
        fileBase64: base64,
      };
      if (uploadScope === "platform") {
        await uploadPlatformMut.mutateAsync(payload);
      } else {
        await uploadCompanyMut.mutateAsync(payload);
      }
    };
    reader.readAsDataURL(uploadFile);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <FileUp className="h-4 w-4" />
            Upload Template
          </button>
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <div className="border rounded-xl p-6 space-y-5 bg-card shadow-sm">
          <h2 className="font-semibold text-lg">Upload Template</h2>

          {/* Scope selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template Scope</label>
            <div className="flex gap-2">
              <button
                onClick={() => setUploadScope("company")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${uploadScope === "company" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                <Building2 className="h-3.5 w-3.5" />
                My Company Only
              </button>
              {isAppAdmin && (
                <button
                  onClick={() => setUploadScope("platform")}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${uploadScope === "platform" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Platform (All Companies)
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {uploadScope === "platform"
                ? "This template will be available to all companies on the platform."
                : "This template will only be available to your company."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template Name *</label>
              <input value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard SAFE Agreement" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document Type</label>
              <select value={uploadForm.docType} onChange={e => setUploadForm(p => ({ ...p, docType: e.target.value as DocType }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
            <textarea value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Optional description of this template" className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File (PDF / DOCX) *</label>
            <div className="flex items-center gap-3">
              <input ref={uploadRef} type="file" accept=".pdf,.docx" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="hidden" />
              <button onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
                <FileUp className="h-4 w-4" />
                {uploadFile ? uploadFile.name : "Choose File"}
              </button>
              {uploadFile && <span className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(0)} KB</span>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleUpload} disabled={uploadCompanyMut.isPending || uploadPlatformMut.isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              {(uploadCompanyMut.isPending || uploadPlatformMut.isPending) ? "Uploading…" : "Upload Template"}
            </button>
            <button onClick={() => { setShowUpload(false); setUploadFile(null); }} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Platform templates */}
      {platformTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
            <Globe className="h-3.5 w-3.5" />
            Platform Templates
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {platformTemplates.map((t: any) => (
              <TemplateCard key={t.id} template={t} canDelete={isAppAdmin} onDelete={() => {
                if (confirm("Delete this platform template?")) deleteTemplateMut.mutate({ id: t.id });
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Company templates */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
          <Building2 className="h-3.5 w-3.5" />
          Company Templates
        </h3>
        {companyTemplates.length === 0 ? (
          <div className="border rounded-xl p-8 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No company templates yet.</p>
            <p className="text-xs mt-1">Upload your own contract templates to reuse them across signing requests.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companyTemplates.map((t: any) => (
              <TemplateCard key={t.id} template={t} canDelete={canEdit} onDelete={() => {
                if (confirm("Delete this template?")) deleteTemplateMut.mutate({ id: t.id });
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border bg-muted/30 p-5 mt-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">About Template Library</p>
            <p><strong>Platform Templates</strong> are managed by platform admins and available to all companies. Good for standard contracts like SAFE agreements or share certificates.</p>
            <p><strong>Company Templates</strong> are your own. Upload contracts you've customized with your legal team and reuse them for each signing request.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card Component ────────────────────────────────────────────────

function TemplateCard({ template, canDelete, onDelete }: { template: any; canDelete: boolean; onDelete: () => void }) {
  return (
    <div className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{template.name}</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 mt-1 inline-block">
            {DOC_TYPE_LABELS[template.docType as DocType] || template.docType}
          </span>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{template.description}</p>
          )}
        </div>
        {canDelete && (
          <button onClick={onDelete} className="p-1 text-destructive/60 hover:text-destructive shrink-0" aria-label="Delete template" title="Delete template">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
        {template.fileName && <span>{template.fileName}</span>}
        <span>{new Date(template.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
