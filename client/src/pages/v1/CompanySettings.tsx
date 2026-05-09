import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Upload, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ════════════════════════════════════════════════════════════════════════════
// Company Settings (SPEC-company-settings.md)
//
// Manages: basic info, contact, representative, logo, signature, default
// currency for the currently ACTIVE company (ctx.companyId). DocuSeal
// columns (docusealTenantApiKey / docusealWebhookSecret) are reserved in the
// schema but intentionally NOT surfaced until Phase 2 eSignature work.
// ════════════════════════════════════════════════════════════════════════════

type FormState = {
  name: string;
  nameEn: string;
  taxId: string;
  address: string;
  phone: string;
  contactEmail: string;
  website: string;
  representativeName: string;
  representativeTitle: string;
  defaultCurrency: "NTD" | "USD";
};

const EMPTY_FORM: FormState = {
  name: "",
  nameEn: "",
  taxId: "",
  address: "",
  phone: "",
  contactEmail: "",
  website: "",
  representativeName: "",
  representativeTitle: "",
  defaultCurrency: "NTD",
};

export default function CompanySettingsPage() {
  return (
    <DashboardLayout>
      <CompanySettingsContent />
    </DashboardLayout>
  );
}

function CompanySettingsContent() {
  const { t } = useTranslation(["pages", "settings"]);
  const { canEdit } = usePermissions();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const companyQuery = trpc.companies.get.useQuery();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  // Hydrate form from the API once (and whenever the underlying record
  // actually changes identity — e.g., after switching companies).
  useEffect(() => {
    if (!companyQuery.data) return;
    setForm({
      name: companyQuery.data.name ?? "",
      nameEn: companyQuery.data.nameEn ?? "",
      taxId: companyQuery.data.taxId ?? "",
      address: companyQuery.data.address ?? "",
      phone: companyQuery.data.phone ?? "",
      contactEmail: companyQuery.data.contactEmail ?? "",
      website: companyQuery.data.website ?? "",
      representativeName: companyQuery.data.representativeName ?? "",
      representativeTitle: companyQuery.data.representativeTitle ?? "",
      defaultCurrency: (companyQuery.data.defaultCurrency as "NTD" | "USD") ?? "NTD",
    });
    setHydrated(true);
  }, [companyQuery.data?.id, companyQuery.data]);

  const updateMut = trpc.companies.update.useMutation({
    onSuccess: () => {
      utils.companies.get.invalidate();
      utils.companies.active.invalidate();
      utils.companies.myCompanies.invalidate();
      toast.success(t("settings:companySettings.profileUpdated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadLogoMut = trpc.companies.uploadLogo.useMutation({
    onSuccess: () => {
      utils.companies.get.invalidate();
      toast.success(t("settings:companySettings.logoUploaded"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAccountMut = trpc.auth.deleteMyAccount.useMutation({
    onSuccess: () => {
      toast.success(t("settings:companySettings.deleteAccountSuccess"));
      // Redirect to home after account deletion
      navigate("/");
    },
    onError: (e) => {
      if (e.message.includes("Email does not match")) {
        toast.error(t("settings:companySettings.deleteAccountEmailMismatch"));
      } else {
        toast.error(e.message);
      }
    },
  });

  // Signature upload is deferred to Phase 2 (DocuSeal eSignature integration).
  // The backend `trpc.companies.uploadSignature` mutation and the
  // `companies.signatureUrl` DB column are still in place so that work can
  // plug in without another migration — the UI is just intentionally absent.

  const logoInputRef = useRef<HTMLInputElement>(null);

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error(t("settings:companySettings.nameRequired"));
      return;
    }
    updateMut.mutate({
      name: form.name.trim(),
      nameEn: form.nameEn || null,
      taxId: form.taxId || null,
      address: form.address || null,
      phone: form.phone || null,
      contactEmail: form.contactEmail || null,
      website: form.website || null,
      representativeName: form.representativeName || null,
      representativeTitle: form.representativeTitle || null,
      defaultCurrency: form.defaultCurrency,
    });
  }

  function handleDeleteAccount() {
    if (user && deleteConfirmEmail === user.email) {
      deleteAccountMut.mutate({ confirmEmail: deleteConfirmEmail });
    }
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings:companySettings.invalidImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("settings:companySettings.fileTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const base64 = raw.includes(",") ? raw.split(",")[1] : raw;
      uploadLogoMut.mutate({ fileName: file.name, fileBase64: base64, contentType: file.type });
    };
    reader.readAsDataURL(file);
  }

  const company = companyQuery.data;
  const isLoading = companyQuery.isLoading || !hydrated;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight flex items-center gap-2"
            style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
          >
            <Building2 className="h-7 w-7 text-primary" />
            {t("settings.company.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("settings.company.desc")}
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={updateMut.isPending || isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {updateMut.isPending ? t("settings.company.saving") : t("settings.company.saveChanges")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {t("settings:companySettings.loading")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Basic info + Representative */}
            <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {t("settings:companySettings.basicInformation")}
                </CardTitle>
                <CardDescription>
                  {t("settings:companySettings.basicInformationDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("settings:companySettings.companyName")}</Label>
                    <Input
                      id="name"
                      placeholder="e.g. 台灣生醫科技股份有限公司"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nameEn">{t("settings:companySettings.companyNameEn")}</Label>
                    <Input
                      id="nameEn"
                      placeholder="e.g. Taiwan BioMed Tech Co., Ltd."
                      value={form.nameEn}
                      onChange={(e) => handleChange("nameEn", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxId">{t("settings:companySettings.taxId")}</Label>
                    <Input
                      id="taxId"
                      placeholder="e.g. 12345678"
                      value={form.taxId}
                      onChange={(e) => handleChange("taxId", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">{t("settings:companySettings.website")}</Label>
                    <Input
                      id="website"
                      placeholder="https://example.com"
                      value={form.website}
                      onChange={(e) => handleChange("website", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("settings:companySettings.address")}</Label>
                  <Input
                    id="address"
                    placeholder="e.g. 新竹縣竹北市…"
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    disabled={!canEdit}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">{t("settings:companySettings.contactEmail")}</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contact@company.com"
                      value={form.contactEmail}
                      onChange={(e) => handleChange("contactEmail", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("settings:companySettings.phone")}</Label>
                    <Input
                      id="phone"
                      placeholder="+886-3-xxx-xxxx"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultCurrency">{t("settings:companySettings.defaultCurrency")}</Label>
                    <Select
                      value={form.defaultCurrency}
                      onValueChange={(v) => handleChange("defaultCurrency", v as "NTD" | "USD")}
                      disabled={!canEdit}
                    >
                      <SelectTrigger id="defaultCurrency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NTD">{t("settings:companySettings.currencyNTD")}</SelectItem>
                        <SelectItem value="USD">{t("settings:companySettings.currencyUSD")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings:companySettings.representative")}</CardTitle>
                <CardDescription>
                  {t("settings:companySettings.representativeDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="representativeName">{t("settings:companySettings.representativeName")}</Label>
                    <Input
                      id="representativeName"
                      placeholder="e.g. 王大明"
                      value={form.representativeName}
                      onChange={(e) => handleChange("representativeName", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="representativeTitle">{t("settings:companySettings.representativeTitle")}</Label>
                    <Input
                      id="representativeTitle"
                      placeholder="e.g. 董事長 / CEO"
                      value={form.representativeTitle}
                      onChange={(e) => handleChange("representativeTitle", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                {/*
                  Signature image upload (for auto-sign) is deferred to Phase 2
                  when the DocuSeal eSignature integration lands. The backend
                  schema (companies.signatureUrl) and uploadSignature mutation
                  are already in place — only the UI is intentionally absent.
                */}
              </CardContent>
            </Card>
          </div>

          {/* Right: Logo */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings:companySettings.companyLogo")}</CardTitle>
                <CardDescription>
                  {t("settings:companySettings.companyLogoDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  {company?.logoUrl ? (
                    <div className="border rounded-lg p-4 bg-white w-full flex items-center justify-center">
                      <img
                        src={company.logoUrl}
                        alt={t("settings:companySettings.companyLogo")}
                        className="max-h-32 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-8 bg-muted/50 w-full flex flex-col items-center justify-center text-muted-foreground">
                      <Building2 className="h-12 w-12 mb-2" />
                      <span className="text-sm">{t("settings:companySettings.noLogoUploaded")}</span>
                    </div>
                  )}
                  {canEdit && (
                    <>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogoUpload(f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadLogoMut.isPending}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {company?.logoUrl ? t("settings:companySettings.replaceLogo") : t("settings:companySettings.uploadLogo")}
                      </Button>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    {t("settings:companySettings.logoHint")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Danger Zone - Account Deletion */}
        <div className="mt-12 pt-8 border-t">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                {t("settings:companySettings.dangerZone")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-red-900 mb-2">
                  {t("settings:companySettings.deleteAccount")}
                </h3>
                <p className="text-sm text-red-800 mb-4">
                  {t("settings:companySettings.deleteAccountDesc")}
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteAccountMut.isPending}
                >
                  {deleteAccountMut.isPending ? t("settings:companySettings.deleting") : t("settings:companySettings.deleteAccountBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delete Account Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-700">
                {t("settings:companySettings.deleteAccountConfirmTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("settings:companySettings.deleteAccountConfirmDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">
                  {t("settings:companySettings.deleteAccountConfirmLabel")}
                </Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  placeholder={user?.email || ""}
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmEmail("");
                }}
              >
                {t("settings:companySettings.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={
                  deleteConfirmEmail !== (user?.email || "") ||
                  deleteAccountMut.isPending
                }
              >
                {deleteAccountMut.isPending ? t("settings:companySettings.deleting") : t("settings:companySettings.deleteAccountBtn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      )}
    </div>
  );
}
