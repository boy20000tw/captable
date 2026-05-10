/**
 * Admin Templates — manage platform-level eSignature templates.
 * Templates are classified by category + docType and gated by minPlan.
 */

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import {
  FileText, Search, Upload, Pencil, Trash2, Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  "shareholder_agreement", "investment_agreement", "employee_contract",
  "board_resolution", "equity_certificate", "esop_grant", "nda", "other",
] as const;

const DOC_TYPES = [
  "share_certificate", "safe_agreement", "convertible_note",
  "stock_option_grant", "board_resolution", "sha", "custom",
] as const;

const PLANS = ["starter", "standard", "plus", "enterprise"] as const;

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-transparent",
  standard: "bg-blue-100 text-blue-700 border-transparent",
  plus: "bg-indigo-100 text-indigo-700 border-transparent",
  enterprise: "bg-purple-100 text-purple-700 border-transparent",
};

// ─── Page wrapper ───────────────────────────────────────────────────────────

export default function AdminTemplatesPage() {
  return (
    <AdminLayout>
      <AdminTemplatesContent />
    </AdminLayout>
  );
}

// ─── Content ────────────────────────────────────────────────────────────────

function AdminTemplatesContent() {
  const { t } = useTranslation("admin");
  const utils = trpc.useUtils();

  // State
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Data
  const { data: templates, isLoading } = trpc.esign.platformTemplates.useQuery();

  // Mutations
  const uploadMut = trpc.esign.uploadPlatformTemplate.useMutation({
    onSuccess: () => {
      toast.success(t("templates.uploadSuccess"));
      utils.esign.platformTemplates.invalidate();
      setUploadOpen(false);
    },
    onError: (err) => toast.error(err.message || t("templates.uploadFailed")),
  });

  const updateMut = trpc.esign.updatePlatformTemplate.useMutation({
    onSuccess: () => {
      toast.success(t("templates.updateSuccess"));
      utils.esign.platformTemplates.invalidate();
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message || t("templates.updateFailed")),
  });

  const deleteMut = trpc.esign.deletePlatformTemplate.useMutation({
    onSuccess: () => {
      toast.success(t("templates.deleteSuccess"));
      utils.esign.platformTemplates.invalidate();
      setDeleteOpen(false);
      setSelectedTemplate(null);
    },
    onError: (err) => toast.error(err.message || t("templates.deleteFailed")),
  });

  // Filter templates
  const filtered = (templates ?? []).filter((tmpl: any) => {
    if (search && !tmpl.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== "all" && tmpl.category !== filterCategory) return false;
    if (filterPlan !== "all" && tmpl.minPlan !== filterPlan) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> {t("templates.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("templates.desc")}
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Upload className="h-4 w-4" /> {t("templates.upload")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("templates.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("templates.allCategories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{t(`templates.cat.${c}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("templates.allPlans")}</SelectItem>
            {PLANS.map((p) => (
              <SelectItem key={p} value={p}>{t(`templates.plan.${p}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="px-4 pb-4 pt-0">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {templates && templates.length > 0
                ? t("templates.noResults")
                : t("templates.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("templates.colName")}</TableHead>
                  <TableHead>{t("templates.colCategory")}</TableHead>
                  <TableHead>{t("templates.colDocType")}</TableHead>
                  <TableHead>{t("templates.colMinPlan")}</TableHead>
                  <TableHead>{t("templates.colCreated")}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tmpl: any) => (
                  <TableRow key={tmpl.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{tmpl.name}</p>
                        {tmpl.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">{tmpl.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t(`templates.cat.${tmpl.category}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{t(`templates.docType.${tmpl.docType}`)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${PLAN_COLORS[tmpl.minPlan] ?? ""}`}>
                        {t(`templates.plan.${tmpl.minPlan}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(tmpl.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => { setSelectedTemplate(tmpl); setEditOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => { setSelectedTemplate(tmpl); setDeleteOpen(true); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={(data) => uploadMut.mutate(data)}
        isPending={uploadMut.isPending}
        t={t}
      />

      {/* Edit Dialog */}
      {selectedTemplate && (
        <EditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          template={selectedTemplate}
          onSubmit={(data) => updateMut.mutate({ id: selectedTemplate.id, data })}
          isPending={updateMut.isPending}
          t={t}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("templates.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("templates.deleteDesc", { name: selectedTemplate?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("templates.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate({ id: selectedTemplate?.id })}
              disabled={deleteMut.isPending}
            >
              {t("templates.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Upload Dialog ──────────────────────────────────────────────────────────

function UploadDialog({
  open, onOpenChange, onSubmit, isPending, t,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState<string>("custom");
  const [category, setCategory] = useState<string>("other");
  const [minPlan, setMinPlan] = useState<string>("starter");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!file || !name) return;

    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    onSubmit({
      name,
      description: description || undefined,
      docType,
      category,
      minPlan,
      fileName: file.name,
      fileBase64: base64,
      contentType: file.type || "application/pdf",
    });
  };

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName("");
      setDescription("");
      setDocType("custom");
      setCategory("other");
      setMinPlan("starter");
      setFile(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("templates.uploadTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* File */}
          <div className="space-y-2">
            <Label>{t("templates.file")}</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {file ? file.name : t("templates.chooseFile")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("templates.fileHint")}</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>{t("templates.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("templates.namePlaceholder")} />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t("templates.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("templates.descPlaceholder")}
            />
          </div>

          {/* Category + DocType row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("templates.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`templates.cat.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("templates.docTypeLabel")}</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>{t(`templates.docType.${d}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Min Plan */}
          <div className="space-y-2">
            <Label>{t("templates.minPlanLabel")}</Label>
            <Select value={minPlan} onValueChange={setMinPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p}>{t(`templates.plan.${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("templates.minPlanHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("templates.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isPending || !file || !name}>
            {isPending ? t("templates.uploading") : t("templates.uploadBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ────────────────────────────────────────────────────────────

function EditDialog({
  open, onOpenChange, template, onSubmit, isPending, t,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: any;
  onSubmit: (data: any) => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [category, setCategory] = useState(template.category);
  const [minPlan, setMinPlan] = useState(template.minPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("templates.editTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("templates.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("templates.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("templates.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`templates.cat.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("templates.minPlanLabel")}</Label>
              <Select value={minPlan} onValueChange={setMinPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p}>{t(`templates.plan.${p}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("templates.cancel")}</Button>
          <Button
            onClick={() => onSubmit({
              name,
              description: description || null,
              category,
              minPlan,
            })}
            disabled={isPending || !name}
          >
            {isPending ? t("templates.saving") : t("templates.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
