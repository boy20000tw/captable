import { useState } from "react";
import { Layers, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Shield, Vote, DollarSign, ArrowDownUp } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ShareClassesPage() {
  return (
    <DashboardLayout>
      <ShareClassesContent />
    </DashboardLayout>
  );
}

type ClassType = "common" | "preferred";
type ParticipationType = "non_participating" | "participating" | "capped_participating";
type AntiDilutionType = "none" | "full_ratchet" | "broad_based_wa" | "narrow_based_wa";
type DividendType = "none" | "non_cumulative" | "cumulative";

type ShareClassForm = {
  name: string;
  slug: string;
  classType: ClassType;
  authorizedShares: string;
  parValue: string;
  pricePerShare: string;
  currency: string;
  liquidationMultiple: string;
  participationType: ParticipationType;
  participationCap: string;
  seniorityRank: number;
  antiDilutionType: AntiDilutionType;
  isConvertible: boolean;
  conversionRatio: string;
  dividendType: DividendType;
  dividendRate: string;
  votingMultiplier: string;
  boardSeats: number;
  protectiveProvisions: string;
  notes: string;
  sortOrder: number;
};

const emptyForm: ShareClassForm = {
  name: "",
  slug: "",
  classType: "common",
  authorizedShares: "",
  parValue: "",
  pricePerShare: "",
  currency: "USD",
  liquidationMultiple: "1.00",
  participationType: "non_participating",
  participationCap: "",
  seniorityRank: 1,
  antiDilutionType: "none",
  isConvertible: true,
  conversionRatio: "1.0000",
  dividendType: "none",
  dividendRate: "",
  votingMultiplier: "1.00",
  boardSeats: 0,
  protectiveProvisions: "",
  notes: "",
  sortOrder: 0,
};

const LABELS = {
  classType: { common: "Common", preferred: "Preferred" },
  participationType: {
    non_participating: "Non-Participating",
    participating: "Full Participating",
    capped_participating: "Capped Participating",
  },
  antiDilutionType: {
    none: "None",
    full_ratchet: "Full Ratchet",
    broad_based_wa: "Broad-Based WA",
    narrow_based_wa: "Narrow-Based WA",
  },
  dividendType: {
    none: "None",
    non_cumulative: "Non-Cumulative",
    cumulative: "Cumulative",
  },
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function ShareClassesContent() {
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  const { data: classes, isLoading } = trpc.shareClasses.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ShareClassForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createMut = trpc.shareClasses.create.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success("Share class created"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.shareClasses.update.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success("Share class updated"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.shareClasses.delete.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success("Share class deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const seedMut = trpc.shareClasses.seed.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success("Default classes created"); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(sc: any) {
    setEditingId(sc.id);
    setForm({
      name: sc.name,
      slug: sc.slug,
      classType: sc.classType,
      authorizedShares: sc.authorizedShares?.toString() ?? "",
      parValue: sc.parValue ?? "",
      pricePerShare: sc.pricePerShare ?? "",
      currency: sc.currency ?? "USD",
      liquidationMultiple: sc.liquidationMultiple ?? "1.00",
      participationType: sc.participationType ?? "non_participating",
      participationCap: sc.participationCap ?? "",
      seniorityRank: sc.seniorityRank ?? 1,
      antiDilutionType: sc.antiDilutionType ?? "none",
      isConvertible: sc.isConvertible ?? true,
      conversionRatio: sc.conversionRatio ?? "1.0000",
      dividendType: sc.dividendType ?? "none",
      dividendRate: sc.dividendRate ?? "",
      votingMultiplier: sc.votingMultiplier ?? "1.00",
      boardSeats: sc.boardSeats ?? 0,
      protectiveProvisions: sc.protectiveProvisions ?? "",
      notes: sc.notes ?? "",
      sortOrder: sc.sortOrder ?? 0,
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.slug.trim()) { toast.error("Slug is required"); return; }

    const payload = {
      name: form.name,
      slug: form.slug,
      classType: form.classType,
      authorizedShares: form.authorizedShares ? Number(form.authorizedShares) : undefined,
      parValue: form.parValue || undefined,
      pricePerShare: form.pricePerShare || undefined,
      currency: form.currency || undefined,
      liquidationMultiple: form.liquidationMultiple || undefined,
      participationType: form.participationType,
      participationCap: form.participationCap || undefined,
      seniorityRank: form.seniorityRank,
      antiDilutionType: form.antiDilutionType,
      isConvertible: form.isConvertible,
      conversionRatio: form.conversionRatio || undefined,
      dividendType: form.dividendType,
      dividendRate: form.dividendRate || undefined,
      votingMultiplier: form.votingMultiplier || undefined,
      boardSeats: form.boardSeats,
      protectiveProvisions: form.protectiveProvisions || undefined,
      notes: form.notes || undefined,
      sortOrder: form.sortOrder,
    };

    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const isEmpty = !isLoading && (!classes || classes.length === 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Share Classes</h1>
            <p className="text-sm text-muted-foreground">Define equity classes, preferred terms, and liquidation rights</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {isEmpty && (
              <button
                onClick={() => seedMut.mutate()}
                disabled={seedMut.isPending}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
              >
                Seed Defaults
              </button>
            )}
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Class
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && canEdit && (
        <div className="border border-border rounded-xl p-6 bg-card space-y-5">
          <h2 className="text-base font-semibold">{editingId ? "Edit Share Class" : "New Share Class"}</h2>

          {/* Row 1: Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <input
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value, slug: editingId ? f.slug : slugify(e.target.value) })); }}
                placeholder="Series A Preferred"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="series_a"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <select
                value={form.classType}
                onChange={e => setForm(f => ({ ...f, classType: e.target.value as ClassType }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="common">Common</option>
                <option value="preferred">Preferred</option>
              </select>
            </div>
          </div>

          {/* Row 2: Shares & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Authorized Shares</label>
              <input
                type="number"
                value={form.authorizedShares}
                onChange={e => setForm(f => ({ ...f, authorizedShares: e.target.value }))}
                placeholder="10,000,000"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Par Value</label>
              <input
                value={form.parValue}
                onChange={e => setForm(f => ({ ...f, parValue: e.target.value }))}
                placeholder="0.0001"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Price / Share</label>
              <input
                value={form.pricePerShare}
                onChange={e => setForm(f => ({ ...f, pricePerShare: e.target.value }))}
                placeholder="1.50"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="NTD">NTD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Row 3: Preferred Terms — only shown for Preferred */}
          {form.classType === "preferred" && (
            <>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Liquidation Terms</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Liquidation Multiple</label>
                    <input
                      value={form.liquidationMultiple}
                      onChange={e => setForm(f => ({ ...f, liquidationMultiple: e.target.value }))}
                      placeholder="1.00"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Participation Type</label>
                    <select
                      value={form.participationType}
                      onChange={e => setForm(f => ({ ...f, participationType: e.target.value as ParticipationType }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(LABELS.participationType).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  {form.participationType === "capped_participating" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Participation Cap</label>
                      <input
                        value={form.participationCap}
                        onChange={e => setForm(f => ({ ...f, participationCap: e.target.value }))}
                        placeholder="3.00"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Seniority Rank</label>
                    <input
                      type="number"
                      value={form.seniorityRank}
                      onChange={e => setForm(f => ({ ...f, seniorityRank: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Anti-Dilution</label>
                  <select
                    value={form.antiDilutionType}
                    onChange={e => setForm(f => ({ ...f, antiDilutionType: e.target.value as AntiDilutionType }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(LABELS.antiDilutionType).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Dividend Type</label>
                  <select
                    value={form.dividendType}
                    onChange={e => setForm(f => ({ ...f, dividendType: e.target.value as DividendType }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(LABELS.dividendType).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {form.dividendType !== "none" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Dividend Rate (%)</label>
                    <input
                      value={form.dividendRate}
                      onChange={e => setForm(f => ({ ...f, dividendRate: e.target.value }))}
                      placeholder="8.00"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Conversion Ratio</label>
                  <input
                    value={form.conversionRatio}
                    onChange={e => setForm(f => ({ ...f, conversionRatio: e.target.value }))}
                    placeholder="1.0000"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Votes / Share</label>
                  <input
                    value={form.votingMultiplier}
                    onChange={e => setForm(f => ({ ...f, votingMultiplier: e.target.value }))}
                    placeholder="1.00"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Board Seats</label>
                  <input
                    type="number"
                    value={form.boardSeats}
                    onChange={e => setForm(f => ({ ...f, boardSeats: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isConvertible}
                      onChange={e => setForm(f => ({ ...f, isConvertible: e.target.checked }))}
                      className="rounded border-input"
                    />
                    Convertible to Common
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Row: Notes + Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {form.classType === "preferred" ? "Protective Provisions / Notes" : "Notes"}
              </label>
              <textarea
                value={form.classType === "preferred" ? form.protectiveProvisions : form.notes}
                onChange={e => setForm(f => form.classType === "preferred"
                  ? { ...f, protectiveProvisions: e.target.value }
                  : { ...f, notes: e.target.value }
                )}
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
        </div>
      )}

      {/* Empty State */}
      {isEmpty && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">No share classes defined</p>
          <p className="text-sm mb-4">Create your first share class or seed the defaults (Common + ESOP)</p>
        </div>
      )}

      {/* Share Class Cards */}
      {classes && classes.length > 0 && (
        <div className="space-y-3">
          {classes.map((sc: any) => {
            const isExpanded = expandedId === sc.id;
            const isPreferred = sc.classType === "preferred";

            return (
              <div key={sc.id} className="border border-border rounded-xl bg-card overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : sc.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{sc.name}</span>
                      <Badge variant={isPreferred ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {isPreferred ? "Preferred" : "Common"}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{sc.slug}</span>
                    </div>
                    {isPreferred && (
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {sc.liquidationMultiple}x {LABELS.participationType[sc.participationType as ParticipationType] ?? sc.participationType}
                        </span>
                        {sc.antiDilutionType && sc.antiDilutionType !== "none" && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {LABELS.antiDilutionType[sc.antiDilutionType as AntiDilutionType]}
                          </span>
                        )}
                        {sc.votingMultiplier && sc.votingMultiplier !== "1.00" && (
                          <span className="flex items-center gap-1">
                            <Vote className="h-3 w-3" />
                            {sc.votingMultiplier}x votes
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {sc.authorizedShares && (
                      <span className="text-xs text-muted-foreground">
                        {Number(sc.authorizedShares).toLocaleString()} authorized
                      </span>
                    )}
                    {sc.pricePerShare && (
                      <span className="text-xs text-muted-foreground">
                        {sc.currency} {sc.pricePerShare}/sh
                      </span>
                    )}
                    {canEdit && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); startEdit(sc); }}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm(`Delete "${sc.name}"?`)) deleteMut.mutate({ id: sc.id }); }}
                          className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && isPreferred && (
                  <div className="border-t border-border px-5 py-4 bg-muted/20">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <DetailItem label="Liquidation Multiple" value={`${sc.liquidationMultiple}x`} />
                      <DetailItem label="Participation" value={LABELS.participationType[sc.participationType as ParticipationType] ?? "—"} />
                      {sc.participationCap && <DetailItem label="Participation Cap" value={`${sc.participationCap}x`} />}
                      <DetailItem label="Seniority Rank" value={sc.seniorityRank?.toString() ?? "1"} />
                      <DetailItem label="Anti-Dilution" value={LABELS.antiDilutionType[sc.antiDilutionType as AntiDilutionType] ?? "None"} />
                      <DetailItem label="Convertible" value={sc.isConvertible ? `Yes (${sc.conversionRatio}:1)` : "No"} />
                      <DetailItem label="Dividend" value={sc.dividendType === "none" ? "None" : `${sc.dividendRate ?? "—"}% ${LABELS.dividendType[sc.dividendType as DividendType]}`} />
                      <DetailItem label="Votes / Share" value={`${sc.votingMultiplier ?? "1.00"}x`} />
                      {sc.boardSeats > 0 && <DetailItem label="Board Seats" value={sc.boardSeats.toString()} />}
                      {sc.parValue && <DetailItem label="Par Value" value={`${sc.currency} ${sc.parValue}`} />}
                    </div>
                    {sc.protectiveProvisions && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Protective Provisions</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{sc.protectiveProvisions}</p>
                      </div>
                    )}
                    {sc.notes && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm text-foreground">{sc.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
