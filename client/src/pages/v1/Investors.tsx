import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Users, Search, ChevronDown, ChevronUp,
  Calendar, FileText, MessageSquare, Phone, Mail, StickyNote,
  MoreHorizontal, CheckCircle2, Clock, X, ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import ErrorState from "@/components/ErrorState";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function V1InvestorsPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="fundraising.investors">
        <V1InvestorsContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

type InvestorStatus = "prospect" | "meeting" | "term_sheet" | "invested" | "passed";
type EntityKind = "individual" | "entity";
type ActivityType = "meeting" | "document" | "discussion" | "follow_up" | "call" | "email" | "note" | "other";
type ActivityStatus = "pending" | "completed" | "cancelled";
type ActivityPriority = "high" | "medium" | "low";

type InvestorForm = {
  name: string;
  entityKind: EntityKind;
  status: InvestorStatus;
  email: string;
  phone: string;
  nationality: string;
  aka: string;
  website: string;
  linkedinUrl: string;
  notes: string;
};

type ActivityForm = {
  type: ActivityType;
  title: string;
  description: string;
  dueDate: string;
  priority: ActivityPriority;
};

const EMPTY_FORM: InvestorForm = {
  name: "", entityKind: "individual", status: "prospect",
  email: "", phone: "", nationality: "", aka: "", website: "", linkedinUrl: "", notes: "",
};

const EMPTY_ACTIVITY: ActivityForm = {
  type: "follow_up", title: "", description: "", dueDate: "", priority: "medium",
};

function getStatusOptions(t: any): { value: InvestorStatus; label: string }[] {
  return [
    { value: "prospect", label: t("investors.prospect") },
    { value: "meeting", label: t("investors.meeting") },
    { value: "term_sheet", label: t("investors.termSheet") },
    { value: "invested", label: t("investors.invested") },
    { value: "passed", label: t("investors.passed") },
  ];
}

function statusBadge(status: InvestorStatus, t: any) {
  const map: Record<InvestorStatus, { cls: string; key: string }> = {
    prospect: { cls: "bg-gray-100 text-gray-700 border-transparent", key: "investors.prospect" },
    meeting: { cls: "bg-blue-100 text-blue-700 border-transparent", key: "investors.meeting" },
    term_sheet: { cls: "bg-yellow-100 text-yellow-700 border-transparent", key: "investors.termSheet" },
    invested: { cls: "bg-green-100 text-green-700 border-transparent", key: "investors.invested" },
    passed: { cls: "bg-red-100 text-red-700 border-transparent", key: "investors.passed" },
  };
  const info = map[status];
  return <Badge className={info.cls}>{t(info.key)}</Badge>;
}

function entityBadge(kind: EntityKind) {
  if (kind === "entity") {
    return <Badge variant="outline" className="text-[11px]">Entity</Badge>;
  }
  return <Badge variant="outline" className="text-[11px]">Individual</Badge>;
}

const ACTIVITY_ICONS: Record<ActivityType, typeof Calendar> = {
  meeting: Calendar,
  document: FileText,
  discussion: MessageSquare,
  follow_up: ArrowRight,
  call: Phone,
  email: Mail,
  note: StickyNote,
  other: MoreHorizontal,
};

function activityTypeBadge(type: ActivityType, t: any) {
  const key = `activities.type_${type}`;
  const colors: Record<ActivityType, string> = {
    meeting: "bg-blue-100 text-blue-700",
    document: "bg-purple-100 text-purple-700",
    discussion: "bg-teal-100 text-teal-700",
    follow_up: "bg-orange-100 text-orange-700",
    call: "bg-green-100 text-green-700",
    email: "bg-indigo-100 text-indigo-700",
    note: "bg-yellow-100 text-yellow-700",
    other: "bg-gray-100 text-gray-700",
  };
  const Icon = ACTIVITY_ICONS[type];
  return (
    <Badge className={`${colors[type]} border-transparent gap-1`}>
      <Icon className="h-3 w-3" />
      {t(key) || type}
    </Badge>
  );
}

function priorityBadge(priority: ActivityPriority, t: any) {
  const map: Record<ActivityPriority, string> = {
    high: "bg-red-100 text-red-700 border-transparent",
    medium: "bg-yellow-100 text-yellow-700 border-transparent",
    low: "bg-gray-100 text-gray-600 border-transparent",
  };
  return <Badge className={map[priority]}>{t(`activities.priority_${priority}`) || priority}</Badge>;
}

/* ─────────────────────────────── Activity Timeline ─────────────────────────────── */

function InvestorActivityTimeline({
  investorId,
  investorName,
  canEdit,
}: {
  investorId: number;
  investorName: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation("fundraising");
  const utils = trpc.useUtils();
  const { data: activities, isLoading } = trpc.investorActivities.byInvestor.useQuery({ investorId });

  const [activityDialog, setActivityDialog] = useState(false);
  const [editActivityId, setEditActivityId] = useState<number | null>(null);
  const [actForm, setActForm] = useState<ActivityForm>(EMPTY_ACTIVITY);

  const createAct = trpc.investorActivities.create.useMutation({
    onSuccess: () => {
      utils.investorActivities.byInvestor.invalidate({ investorId });
      utils.v1.investors.list.invalidate();
      toast.success(t("activities.created") || "Activity created");
      closeActivityDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAct = trpc.investorActivities.update.useMutation({
    onSuccess: () => {
      utils.investorActivities.byInvestor.invalidate({ investorId });
      utils.v1.investors.list.invalidate();
      toast.success(t("activities.updated") || "Activity updated");
      closeActivityDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAct = trpc.investorActivities.delete.useMutation({
    onSuccess: () => {
      utils.investorActivities.byInvestor.invalidate({ investorId });
      utils.v1.investors.list.invalidate();
      toast.success(t("activities.deleted") || "Activity deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const completeAct = trpc.investorActivities.update.useMutation({
    onSuccess: () => {
      utils.investorActivities.byInvestor.invalidate({ investorId });
      utils.v1.investors.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreateActivity() {
    setEditActivityId(null);
    setActForm(EMPTY_ACTIVITY);
    setActivityDialog(true);
  }

  function openEditActivity(act: any) {
    setEditActivityId(act.id);
    setActForm({
      type: act.type,
      title: act.title,
      description: act.description ?? "",
      dueDate: act.dueDate ? new Date(act.dueDate).toISOString().slice(0, 10) : "",
      priority: act.priority,
    });
    setActivityDialog(true);
  }

  function closeActivityDialog() {
    setActivityDialog(false);
    setEditActivityId(null);
    setActForm(EMPTY_ACTIVITY);
  }

  function handleActivitySubmit() {
    if (!actForm.title.trim()) {
      toast.error(t("activities.titleRequired") || "Title is required");
      return;
    }
    if (editActivityId != null) {
      updateAct.mutate({
        id: editActivityId,
        type: actForm.type,
        title: actForm.title.trim(),
        description: actForm.description || undefined,
        dueDate: actForm.dueDate || null,
        priority: actForm.priority,
      });
    } else {
      createAct.mutate({
        investorId,
        type: actForm.type,
        title: actForm.title.trim(),
        description: actForm.description || undefined,
        dueDate: actForm.dueDate || undefined,
        priority: actForm.priority,
      });
    }
  }

  function handleToggleComplete(act: any) {
    completeAct.mutate({
      id: act.id,
      status: act.status === "completed" ? "pending" : "completed",
    });
  }

  function handleDeleteActivity(actId: number) {
    if (!confirm(t("activities.confirmDelete") || "Delete this activity?")) return;
    deleteAct.mutate({ id: actId });
  }

  // Split activities into pending and completed
  const pending = useMemo(() =>
    (activities ?? []).filter((a) => a.status === "pending").sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
  [activities]);

  const completed = useMemo(() =>
    (activities ?? []).filter((a) => a.status === "completed").sort((a, b) =>
      new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime()
    ),
  [activities]);

  const cancelled = useMemo(() =>
    (activities ?? []).filter((a) => a.status === "cancelled"),
  [activities]);

  function isDueSoon(dueDate: string | Date | null) {
    if (!dueDate) return false;
    const d = new Date(dueDate);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  }

  function isOverdue(dueDate: string | Date | null) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  return (
    <div className="border-t bg-muted/30 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {t("activities.timelineTitle") || "Activity Timeline"} — {investorName}
        </h3>
        {canEdit && (
          <Button size="sm" onClick={openCreateActivity}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("activities.addActivity") || "Add Activity"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          {t("activities.loading") || "Loading activities..."}
        </div>
      ) : (activities ?? []).length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm space-y-2">
          <Clock className="h-8 w-8 mx-auto opacity-40" />
          <p>{t("activities.emptyTimeline") || "No activities yet. Add a meeting, follow-up, or note to start tracking."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Activities */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("activities.pendingSection") || "Pending"} ({pending.length})
              </h4>
              <div className="space-y-2">
                {pending.map((act) => (
                  <div
                    key={act.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border bg-white ${
                      isOverdue(act.dueDate) ? "border-red-300 bg-red-50/50" :
                      isDueSoon(act.dueDate) ? "border-orange-300 bg-orange-50/50" : ""
                    }`}
                  >
                    {canEdit && (
                      <button
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
                        onClick={() => handleToggleComplete(act)}
                        title={t("activities.markComplete") || "Mark complete"}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {activityTypeBadge(act.type as ActivityType, t)}
                        {priorityBadge(act.priority as ActivityPriority, t)}
                        {act.dueDate && (
                          <span className={`text-xs ${
                            isOverdue(act.dueDate) ? "text-red-600 font-medium" :
                            isDueSoon(act.dueDate) ? "text-orange-600 font-medium" : "text-muted-foreground"
                          }`}>
                            {isOverdue(act.dueDate)
                              ? `${t("activities.overdue") || "Overdue"}: ${formatDate(act.dueDate)}`
                              : `${t("activities.due") || "Due"}: ${formatDate(act.dueDate)}`}
                          </span>
                        )}
                      </div>
                      <p className="font-medium mt-1">{act.title}</p>
                      {act.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{act.description}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditActivity(act)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteActivity(act.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Activities */}
          {completed.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("activities.completedSection") || "Completed"} ({completed.length})
              </h4>
              <div className="space-y-1.5">
                {completed.slice(0, 10).map((act) => (
                  <div key={act.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-white/50 opacity-70">
                    {canEdit && (
                      <button
                        className="mt-0.5 shrink-0 text-green-500 hover:text-muted-foreground transition-colors"
                        onClick={() => handleToggleComplete(act)}
                        title={t("activities.markPending") || "Mark pending"}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {activityTypeBadge(act.type as ActivityType, t)}
                        <span className="text-xs text-muted-foreground">
                          {act.completedAt ? formatDate(act.completedAt) : formatDate(act.updatedAt)}
                        </span>
                      </div>
                      <p className="font-medium mt-0.5 line-through text-muted-foreground">{act.title}</p>
                    </div>
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleDeleteActivity(act.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {completed.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{completed.length - 10} {t("activities.moreCompleted") || "more completed"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {cancelled.length} {t("activities.cancelledCount") || "cancelled"}
            </p>
          )}
        </div>
      )}

      {/* Add / Edit Activity Dialog */}
      <Dialog open={activityDialog} onOpenChange={(v) => (v ? setActivityDialog(true) : closeActivityDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editActivityId != null
                ? (t("activities.editActivity") || "Edit Activity")
                : (t("activities.newActivity") || "New Activity")}
            </DialogTitle>
            <DialogDescription>
              {t("activities.activityFor") || "Activity for"} {investorName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("activities.typeLabel") || "Type"}</Label>
                <Select value={actForm.type} onValueChange={(v) => setActForm((f) => ({ ...f, type: v as ActivityType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["meeting", "document", "discussion", "follow_up", "call", "email", "note", "other"] as ActivityType[]).map((type) => (
                      <SelectItem key={type} value={type}>{t(`activities.type_${type}`) || type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("activities.priorityLabel") || "Priority"}</Label>
                <Select value={actForm.priority} onValueChange={(v) => setActForm((f) => ({ ...f, priority: v as ActivityPriority }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{t("activities.priority_high") || "High"}</SelectItem>
                    <SelectItem value="medium">{t("activities.priority_medium") || "Medium"}</SelectItem>
                    <SelectItem value="low">{t("activities.priority_low") || "Low"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("activities.titleLabel") || "Title"} *</Label>
              <Input
                value={actForm.title}
                onChange={(e) => setActForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("activities.titlePlaceholder") || "e.g. Follow up on term sheet review"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("activities.dueDateLabel") || "Due Date"}</Label>
              <Input
                type="date"
                value={actForm.dueDate}
                onChange={(e) => setActForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("activities.descriptionLabel") || "Description"}</Label>
              <Textarea
                rows={3}
                value={actForm.description}
                onChange={(e) => setActForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("activities.descriptionPlaceholder") || "Notes, agenda, details..."}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeActivityDialog}>
              {t("investors.cancelButton")}
            </Button>
            <Button
              onClick={handleActivitySubmit}
              disabled={createAct.isPending || updateAct.isPending || !actForm.title.trim()}
            >
              {editActivityId != null
                ? (t("activities.saveActivity") || "Save")
                : (t("activities.createActivity") || "Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────── Main Content ─────────────────────────────── */

function V1InvestorsContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("fundraising");
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();
  const { data: investors, isLoading, isError, refetch } = trpc.v1.investors.list.useQuery();

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<InvestorForm>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const createMut = trpc.v1.investors.create.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      toast.success(t("investors.investorCreated"));
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.v1.investors.update.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      toast.success(t("investors.investorUpdated"));
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.v1.investors.delete.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      toast.success(t("investors.investorDeleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(inv: NonNullable<typeof investors>[number], e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditId(inv.id);
    setForm({
      name: inv.name ?? "",
      entityKind: (inv.entityKind as EntityKind) ?? "individual",
      status: (inv.status as InvestorStatus) ?? "prospect",
      email: inv.email ?? "",
      phone: inv.phone ?? "",
      nationality: inv.nationality ?? "",
      aka: inv.aka ?? "",
      website: inv.website ?? "",
      linkedinUrl: inv.linkedinUrl ?? "",
      notes: inv.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error(t("investors.nameRequiredError"));
      return;
    }
    if (editId != null) {
      updateMut.mutate({
        id: editId,
        data: {
          name: form.name.trim(),
          entityKind: form.entityKind,
          status: form.status,
          email: form.email || null,
          phone: form.phone || null,
          nationality: form.nationality || null,
          aka: form.aka || null,
          website: form.website || null,
          linkedinUrl: form.linkedinUrl || null,
          notes: form.notes || null,
        },
      });
    } else {
      createMut.mutate({
        name: form.name.trim(),
        entityKind: form.entityKind,
        status: form.status,
        email: form.email || undefined,
        phone: form.phone || undefined,
        nationality: form.nationality || undefined,
        aka: form.aka || undefined,
        website: form.website || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        notes: form.notes || undefined,
      });
    }
  }

  function handleDelete(inv: NonNullable<typeof investors>[number], e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(t("investors.confirmDelete", { name: inv.name }))) return;
    deleteMut.mutate({ id: inv.id });
  }

  function toggleExpanded(invId: number) {
    setExpandedId((prev) => (prev === invId ? null : invId));
  }

  // Exclude ESOP pool entries — they belong on Cap Table, not Investors
  const baseInvestors = useMemo(() => {
    const list = investors ?? [];
    return list.filter((inv) => !inv.name?.toUpperCase().includes('ESOP'));
  }, [investors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseInvestors.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (kindFilter !== "all" && inv.entityKind !== kindFilter) return false;
      if (q && !inv.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [baseInvestors, statusFilter, kindFilter, search]);

  const isEmpty = !isLoading && baseInvestors.length === 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            {tPages("investors.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tPages("investors.desc")}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> {t("investors.newInvestor")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder={t("investors.searchPlaceholder") || "Search by name..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("investors.allStatuses") || "All statuses"}</SelectItem>
            {getStatusOptions(t).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("investors.allKinds") || "All kinds"}</SelectItem>
            <SelectItem value="individual">{t("investors.individual") || "Individual"}</SelectItem>
            <SelectItem value="entity">{t("investors.entity") || "Entity"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("investors.allInvestors")}</CardTitle>
              <CardDescription>
                {filtered.length} of {baseInvestors.length}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm px-6">
              {t("investors.loading")}
            </div>
          ) : isEmpty ? (
            <div className="py-12 text-center space-y-3 px-6">
              <p className="text-muted-foreground text-sm">
                {t("investors.emptyDesc")}
              </p>
              {canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> {t("investors.newInvestor")}
                </Button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground px-6">
              {t("investors.noMatch") || "No investors match the current filters."}
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto px-6">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>{t("investors.name")}</TableHead>
                      <TableHead>{t("investors.entityKind")}</TableHead>
                      <TableHead>{t("investors.status")}</TableHead>
                      <TableHead>{t("investors.email")}</TableHead>
                      <TableHead>{t("investors.phone")}</TableHead>
                      <TableHead>{t("investors.lastContact") || "Last Contact"}</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => (
                      <>
                        <TableRow
                          key={inv.id}
                          className="hover:bg-secondary/30 cursor-pointer"
                          onClick={() => toggleExpanded(inv.id)}
                        >
                          <TableCell className="w-8 pr-0">
                            {expandedId === inv.id
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium">
                            {inv.name}
                            {inv.aka && inv.aka !== inv.name && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({inv.aka})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{entityBadge(inv.entityKind as EntityKind)}</TableCell>
                          <TableCell>{statusBadge(inv.status as InvestorStatus, t)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.email ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.phone ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.lastContactAt ? formatDate(inv.lastContactAt) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canEdit && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => openEdit(inv, e)}
                                  title={t("investors.edit")}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => handleDelete(inv, e)}
                                  title={t("investors.delete")}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedId === inv.id && (
                          <TableRow key={`${inv.id}-timeline`}>
                            <TableCell colSpan={8} className="p-0">
                              <InvestorActivityTimeline
                                investorId={inv.id}
                                investorName={inv.name}
                                canEdit={canEdit}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => (v ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId != null ? t("investors.editDialog") : t("investors.newDialog")}
            </DialogTitle>
            <DialogDescription>
              {editId != null
                ? t("investors.editDesc")
                : t("investors.newDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("investors.nameRequired")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("investors.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("investors.entityKind")}</Label>
              <Select
                value={form.entityKind}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, entityKind: v as EntityKind }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">{t("investors.individual") || "Individual"}</SelectItem>
                  <SelectItem value="entity">{t("investors.entity") || "Entity"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("investors.status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as InvestorStatus }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getStatusOptions(t).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("investors.email")}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t("investors.emailPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("investors.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder={t("investors.phonePlaceholder") || "+886 ..."}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("investors.nationality") || "Nationality"}</Label>
              <Input
                value={form.nationality}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nationality: e.target.value }))
                }
                placeholder={t("investors.nationalityPlaceholder") || "e.g. Taiwan"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("investors.aka") || "Also Known As"}</Label>
              <Input
                value={form.aka}
                onChange={(e) => setForm((f) => ({ ...f, aka: e.target.value }))}
                placeholder={t("investors.akaPlaceholder") || "Alias / short name"}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("investors.website")}</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder={t("investors.websitePlaceholder")}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("investors.linkedinUrl") || "LinkedIn URL"}</Label>
              <Input
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                }
                placeholder={t("investors.linkedinPlaceholder") || "https://linkedin.com/in/..."}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("investors.notes")}</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("investors.optional")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              {t("investors.cancelButton")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending || !form.name.trim()}
            >
              {editId != null ? t("investors.saveChanges") : t("investors.createInvestor")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
