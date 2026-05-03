import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function ShareClassesContent() {
  const { t } = useTranslation("pages");
  const { t: tc } = useTranslation("common");
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  const LABELS = useMemo(() => ({
    classType: { common: t("sc.common"), preferred: t("sc.preferred") },
    participationType: {
      non_participating: t("sc.participationNonParticipating"),
      participating: t("sc.participationFullParticipating"),
      capped_participating: t("sc.participationCappedParticipating"),
    },
    antiDilutionType: {
      none: t("sc.antiDilutionNone"),
      full_ratchet: t("sc.antiDilutionFullRatchet"),
      broad_based_wa: t("sc.antiDilutionBroadBasedWa"),
      narrow_based_wa: t("sc.antiDilutionNarrowBasedWa"),
    },
    dividendType: {
      none: t("sc.dividendNone"),
      non_cumulative: t("sc.dividendNonCumulative"),
      cumulative: t("sc.dividendCumulative"),
    },
  }), [t]);

  const { data: classes, isLoading } = trpc.shareClasses.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ShareClassForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createMut = trpc.shareClasses.create.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success(t("sc.classCreated")); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.shareClasses.update.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success(t("sc.classUpdated")); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.shareClasses.delete.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success(t("sc.classDeleted")); },
    onError: (e) => toast.error(e.message),
  });
  const seedMut = trpc.shareClasses.seed.useMutation({
    onSuccess: () => { utils.shareClasses.list.invalidate(); toast.success(t("sc.defaultsCreated")); },
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
    if (!form.name.trim()) { toast.error(t("sc.nameRequired")); return; }
    if (!form.slug.trim()) { toast.error(t("sc.slugRequired")); return; }

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
            <h1 className="text-xl font-bold tracking-tight">{t("sc.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("sc.desc")}</p>
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
                {t("sc.seedDefaults")}
              </button>
            )}
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> {t("sc.newClass")}
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && canEdit && (
        <div className="border border-border rounded-xl p-6 bg-card space-y-5">
          <h2 className="text-base font-semibold">{editingId ? t("sc.editShareClass") : t("sc.newShareClass")}</h2>

          {/* Row 1: Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.name")}</label>
              <input
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value, slug: editingId ? f.slug : slugify(e.target.value) })); }}
                placeholder="Series A Preferred"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.slug")}</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="series_a"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.type")}</label>
              <select
                value={form.classType}
                onChange={e => setForm(f => ({ ...f, classType: e.target.value as ClassType }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="common">{t("sc.common")}</option>
                <option value="preferred">{t("sc.preferred")}</option>
              </select>
            </div>
          </div>

          {/* Row 2: Shares & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.authorizedShares")}</label>
              <input
                type="number"
                value={form.authorizedShares}
                onChange={e => setForm(f => ({ ...f, authorizedShares: e.target.value }))}
                placeholder="10,000,000"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.parValue")}</label>
              <input
                value={form.parValue}
                onChange={e => setForm(f => ({ ...f, parValue: e.target.value }))}
                placeholder="0.0001"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.pricePerShare")}</label>
              <input
                value={form.pricePerShare}
                onChange={e => setForm(f => ({ ...f, pricePerShare: e.target.value }))}
                placeholder="1.50"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.currency")}</label>
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
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{t("sc.liquidationTerms")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.liquidationMultiple")}</label>
                    <input
                      value={form.liquidationMultiple}
                      onChange={e => setForm(f => ({ ...f, liquidationMultiple: e.target.value }))}
                      placeholder="1.00"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.participationType")}</label>
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
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.participationCap")}</label>
                      <input
                        value={form.participationCap}
                        onChange={e => setForm(f => ({ ...f, participationCap: e.target.value }))}
                        placeholder="3.00"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.seniorityRank")}</label>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.antiDilution")}</label>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.dividendType")}</label>
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
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.dividendRate")}</label>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.conversionRatio")}</label>
                  <input
                    value={form.conversionRatio}
                    onChange={e => setForm(f => ({ ...f, conversionRatio: e.target.value }))}
                    placeholder="1.0000"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.votesPerShare")}</label>
                  <input
                    value={form.votingMultiplier}
                    onChange={e => setForm(f => ({ ...f, votingMultiplier: e.target.value }))}
                    placeholder="1.00"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.boardSeats")}</label>
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
                    {t("sc.convertibleToCommon")}
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Row: Notes + Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {form.classType === "preferred" ? t("sc.protectiveProvisions") : t("sc.notes")}
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("sc.sortOrder")}</label>
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
              {tc("btn.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {editingId ? tc("btn.update") : tc("btn.create")}
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
          <p className="text-lg font-medium mb-1">{t("sc.noClasses")}</p>
          <p className="text-sm mb-4">{t("sc.noClassesDesc")}</p>
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
                        {isPreferred ? t("sc.preferred") : t("sc.common")}
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
                            {t("sc.xVotes", {multiplier: sc.votingMultiplier})}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {sc.authorizedShares && (
                      <span className="text-xs text-muted-foreground">
                        {Number(sc.authorizedShares).toLocaleString()} {t("sc.authorized")}
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
                          onClick={e => { e.stopPropagation(); if (confirm(t("sc.deleteConfirm", {name: sc.name}))) deleteMut.mutate({ id: sc.id }); }}
                          disabled={deleteMut.isPending}
                          className="p-1.5 hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
                      <DetailItem label={t("sc.liquidationMultiple")} value={`${sc.liquidationMultiple}x`} />
                      <DetailItem label={t("sc.participationType")} value={LABELS.participationType[sc.participationType as ParticipationType] ?? "—"} />
                      {sc.participationCap && <DetailItem label={t("sc.participationCap")} value={`${sc.participationCap}x`} />}
                      <DetailItem label={t("sc.seniorityRank")} value={sc.seniorityRank?.toString() ?? "1"} />
                      <DetailItem label={t("sc.antiDilution")} value={LABELS.antiDilutionType[sc.antiDilutionType as AntiDilutionType] ?? t("sc.antiDilutionNone")} />
                      <DetailItem label={t("sc.convertibleToCommon")} value={sc.isConvertible ? t("sc.convertibleYes", {ratio: sc.conversionRatio}) : t("sc.convertibleNo")} />
                      <DetailItem label={t("sc.dividendType")} value={sc.dividendType === "none" ? t("sc.dividendNone") : `${sc.dividendRate ?? "—"}% ${LABELS.dividendType[sc.dividendType as DividendType]}`} />
                      <DetailItem label={t("sc.votesPerShare")} value={`${sc.votingMultiplier ?? "1.00"}x`} />
                      {sc.boardSeats > 0 && <DetailItem label={t("sc.boardSeats")} value={sc.boardSeats.toString()} />}
                      {sc.parValue && <DetailItem label={t("sc.parValue")} value={`${sc.currency} ${sc.parValue}`} />}
                    </div>
                    {sc.protectiveProvisions && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("sc.protectiveProvisions")}</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{sc.protectiveProvisions}</p>
                      </div>
                    )}
                    {sc.notes && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("sc.notes")}</p>
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
