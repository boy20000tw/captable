import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Users, Search } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function V1InvestorsPage() {
  return (
    <DashboardLayout>
      <V1InvestorsContent />
    </DashboardLayout>
  );
}

type InvestorStatus = "prospect" | "meeting" | "term_sheet" | "invested" | "passed";
type EntityKind = "individual" | "entity";

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

const EMPTY_FORM: InvestorForm = {
  name: "",
  entityKind: "individual",
  status: "prospect",
  email: "",
  phone: "",
  nationality: "",
  aka: "",
  website: "",
  linkedinUrl: "",
  notes: "",
};

const STATUS_OPTIONS: { value: InvestorStatus; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "meeting", label: "Meeting" },
  { value: "term_sheet", label: "Term Sheet" },
  { value: "invested", label: "Invested" },
  { value: "passed", label: "Passed" },
];

function statusBadge(status: InvestorStatus) {
  const map: Record<InvestorStatus, { cls: string; label: string }> = {
    prospect: { cls: "bg-gray-100 text-gray-700 border-transparent", label: "Prospect" },
    meeting: { cls: "bg-blue-100 text-blue-700 border-transparent", label: "Meeting" },
    term_sheet: { cls: "bg-yellow-100 text-yellow-700 border-transparent", label: "Term Sheet" },
    invested: { cls: "bg-green-100 text-green-700 border-transparent", label: "Invested" },
    passed: { cls: "bg-red-100 text-red-700 border-transparent", label: "Passed" },
  };
  const info = map[status];
  return <Badge className={info.cls}>{info.label}</Badge>;
}

function entityBadge(kind: EntityKind) {
  if (kind === "entity") {
    return <Badge variant="outline" className="text-[11px]">Entity</Badge>;
  }
  return <Badge variant="outline" className="text-[11px]">Individual</Badge>;
}

function V1InvestorsContent() {
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();
  const { data: investors, isLoading } = trpc.v1.investors.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<InvestorForm>(EMPTY_FORM);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const createMut = trpc.v1.investors.create.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      toast.success("Investor created");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.v1.investors.update.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      toast.success("Investor updated");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.v1.investors.delete.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      toast.success("Investor deleted");
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
      toast.error("Name is required");
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
    if (!confirm(`Delete "${inv.name}"? This cannot be undone.`)) return;
    deleteMut.mutate({ id: inv.id });
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Investors
          </h1>
          <p className="text-muted-foreground mt-1">
            Pipeline + current investors
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Investor
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by name..."
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
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
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
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="entity">Entity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Investors</CardTitle>
              <CardDescription>
                {filtered.length} of {baseInvestors.length}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : isEmpty ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                No investors yet. Add your first prospect to start building your
                pipeline.
              </p>
              {canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> New Investor
                </Button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No investors match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Entity Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-secondary/30">
                    <TableCell className="font-medium">
                      {inv.name}
                      {inv.aka && inv.aka !== inv.name && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({inv.aka})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{entityBadge(inv.entityKind as EntityKind)}</TableCell>
                    <TableCell>{statusBadge(inv.status as InvestorStatus)}</TableCell>
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
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleDelete(inv, e)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => (v ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId != null ? "Edit Investor" : "New Investor"}
            </DialogTitle>
            <DialogDescription>
              {editId != null
                ? "Update investor details."
                : "Add a new investor to your pipeline."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Ventures"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Entity Kind</Label>
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
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="entity">Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
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
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+886 ..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input
                value={form.nationality}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nationality: e.target.value }))
                }
                placeholder="e.g. Taiwan"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Also Known As</Label>
              <Input
                value={form.aka}
                onChange={(e) => setForm((f) => ({ ...f, aka: e.target.value }))}
                placeholder="Alias / short name"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>LinkedIn URL</Label>
              <Input
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                }
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending || !form.name.trim()}
            >
              {editId != null ? "Save Changes" : "Create Investor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
