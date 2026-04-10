import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate, getRoundLabel } from "@/lib/utils";
import { useState, useMemo } from "react";
import { BookOpen, Download, ArrowRightLeft, Plus, X, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export default function RegisterPage() {
  return (
    <DashboardLayout>
      <RegisterContent />
    </DashboardLayout>
  );
}

type ActiveTab = "register" | "history" | "transfer";

function RegisterContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("register");
  const [showTransferForm, setShowTransferForm] = useState(false);
  const { canEdit } = usePermissions();

  // Sort state for register table
  const [regSortKey, setRegSortKey] = useState<"id" | "name" | "type" | "shares" | "paidIn">("shares");
  const [regSortDir, setRegSortDir] = useState<"asc" | "desc">("desc");
  function toggleRegSort(key: typeof regSortKey) {
    if (regSortKey === key) {
      setRegSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setRegSortKey(key);
      setRegSortDir(key === "name" || key === "type" ? "asc" : "desc");
    }
  }

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    fromShareholderId: "",
    toShareholderId: "",
    sharesAmount: "",
    shareClass: "common" as string,
    transferDate: new Date().toISOString().split("T")[0],
    pricePerShareNtd: "",
    totalAmountNtd: "",
    fundingRoundId: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: transactions, isLoading } = trpc.transactions.list.useQuery();
  const { data: shareholders } = trpc.shareholders.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  // Build stable #ID map matching Investors page — non-ESOP shareholders sorted by DB id
  const sortedAllForIdx = useMemo(() => {
    return (shareholders || []).filter(s => s.type !== "esop").slice().sort((a, b) => a.id - b.id);
  }, [shareholders]);
  const idxMap = useMemo(() => {
    const m = new Map();
    sortedAllForIdx.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sortedAllForIdx]);

  const createTransaction = trpc.transactions.create.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.capTable.summary.invalidate();
      utils.holdings.all.invalidate();
      toast.success("Share transfer recorded successfully");
      setShowTransferForm(false);
      setTransferForm({
        fromShareholderId: "", toShareholderId: "", sharesAmount: "", shareClass: "common",
        transferDate: new Date().toISOString().split("T")[0], pricePerShareNtd: "",
        totalAmountNtd: "", fundingRoundId: "", notes: "",
      });
      setActiveTab("history");
    },
    onError: (e) => toast.error(e.message),
  });

  const enriched = useMemo(() => (transactions || []).map(t => ({
    ...t,
    shareholder: (shareholders || []).find(s => s.id === t.shareholderId),
    round: (rounds || []).find(r => r.id === t.fundingRoundId),
  })).sort((a, b) => {
    const da = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
    const db = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
    return db - da; // newest first
  }), [transactions, shareholders, rounds]);

  // Group by shareholder for register view
  const registerRows = useMemo(() => {
    const byShareholderId = enriched.reduce((acc, t) => {
      if (!acc[t.shareholderId]) acc[t.shareholderId] = [];
      acc[t.shareholderId].push(t);
      return acc;
    }, {} as Record<number, typeof enriched>);

    return Object.entries(byShareholderId).map(([shId, txns]) => {
      const sh = (shareholders || []).find(s => s.id === parseInt(shId));
      const totalShares = txns.reduce((s, t) => {
        if (t.transactionType === "issuance" || t.transactionType === "transfer_in") return s + t.sharesAmount;
        if (t.transactionType === "transfer_out") return s - t.sharesAmount;
        return s;
      }, 0);
      const paidIn = txns.reduce((s, t) => s + (t.totalAmountNtd ? parseFloat(t.totalAmountNtd) : 0), 0);
      const taxQualified = txns.some(t => t.taxQualified);
      const lockUpDate = txns.map(t => t.lockUpEndDate).filter(Boolean).sort().pop();
      const taxYear = txns.map(t => t.taxDeductionYear).filter(Boolean).sort().pop();
      const taxAmount = txns.reduce((s, t) => s + (t.taxDeductionAmountNtd ? parseFloat(t.taxDeductionAmountNtd) : 0), 0);
      return { sh, totalShares, paidIn, taxQualified, lockUpDate, taxYear, taxAmount, txns };
    }).filter(r => r.sh && r.totalShares > 0)
      .sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (regSortKey === "id") { av = idxMap.get(a.sh!.id) || 0; bv = idxMap.get(b.sh!.id) || 0; }
      else if (regSortKey === "name") { av = a.sh!.name.toLowerCase(); bv = b.sh!.name.toLowerCase(); }
      else if (regSortKey === "type") { av = a.sh!.type || ""; bv = b.sh!.type || ""; }
      else if (regSortKey === "shares") { av = a.totalShares; bv = b.totalShares; }
      else if (regSortKey === "paidIn") { av = a.paidIn; bv = b.paidIn; }
      if (av < bv) return regSortDir === "asc" ? -1 : 1;
      if (av > bv) return regSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [enriched, shareholders, regSortKey, regSortDir, idxMap]);

  const grandTotal = registerRows.reduce((s, r) => s + r.totalShares, 0);
  const grandPaidIn = registerRows.reduce((s, r) => s + r.paidIn, 0);

  // Transfer history (only transfer transactions)
  const transferHistory = useMemo(() =>
    enriched.filter(t => t.transactionType === "transfer_in" || t.transactionType === "transfer_out"),
    [enriched]
  );

  // Validate transfer: from shareholder must have enough shares
  const fromShareholder = shareholders?.find(s => s.id === parseInt(transferForm.fromShareholderId));
  const fromHolding = registerRows.find(r => r.sh?.id === parseInt(transferForm.fromShareholderId));
  const fromAvailableShares = fromHolding?.totalShares || 0;
  const transferShares = parseInt(transferForm.sharesAmount) || 0;
  const hasInsufficientShares = transferShares > 0 && transferShares > fromAvailableShares;

  function handleTransfer() {
    if (!transferForm.fromShareholderId || !transferForm.toShareholderId || !transferForm.sharesAmount) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (transferForm.fromShareholderId === transferForm.toShareholderId) {
      toast.error("From and To shareholders must be different");
      return;
    }
    if (hasInsufficientShares) {
      toast.error(`Insufficient shares: ${fromShareholder?.name} only has ${fromAvailableShares.toLocaleString()} shares`);
      return;
    }

    const price = parseFloat(transferForm.pricePerShareNtd) || undefined;
    const totalAmt = price ? String(transferShares * price) : (transferForm.totalAmountNtd || undefined);

    // Create transfer_out for sender
    createTransaction.mutate({
      shareholderId: parseInt(transferForm.fromShareholderId),
      transactionType: "transfer_out",
      shareClass: transferForm.shareClass as "common",
      sharesAmount: transferShares,
      transactionDate: transferForm.transferDate,
      pricePerShareNtd: transferForm.pricePerShareNtd || undefined,
      totalAmountNtd: totalAmt,
      fundingRoundId: transferForm.fundingRoundId ? parseInt(transferForm.fundingRoundId) : undefined,
      notes: transferForm.notes ? `Transfer to ${(shareholders || []).find(s => s.id === parseInt(transferForm.toShareholderId))?.name}: ${transferForm.notes}` : undefined,
    });
  }

  // After transfer_out succeeds, create transfer_in (handled via onSuccess above)
  // We need a two-step approach: create both in sequence
  const [pendingTransferIn, setPendingTransferIn] = useState<null | {
    shareholderId: number;
    sharesAmount: number;
    shareClass: string;
    transactionDate: string;
    pricePerShareNtd?: string;
    totalAmountNtd?: string;
    fundingRoundId?: number;
    notes?: string;
  }>(null);

  const createTransferIn = trpc.transactions.create.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.capTable.summary.invalidate();
      utils.holdings.all.invalidate();
      setPendingTransferIn(null);
    },
    onError: (e) => toast.error(`Transfer out recorded but transfer in failed: ${e.message}`),
  });

  // Two-step transfer: out then in
  const createTransferOut = trpc.transactions.create.useMutation({
    onSuccess: () => {
      if (pendingTransferIn) {
        createTransferIn.mutate({
          ...pendingTransferIn,
          transactionType: "transfer_in",
          shareClass: pendingTransferIn.shareClass as "common",
        });
      }
      utils.transactions.list.invalidate();
      utils.capTable.summary.invalidate();
      utils.holdings.all.invalidate();
      toast.success("Share transfer recorded successfully");
      setShowTransferForm(false);
      setTransferForm({
        fromShareholderId: "", toShareholderId: "", sharesAmount: "", shareClass: "common",
        transferDate: new Date().toISOString().split("T")[0], pricePerShareNtd: "",
        totalAmountNtd: "", fundingRoundId: "", notes: "",
      });
      setActiveTab("history");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmitTransfer() {
    if (!transferForm.fromShareholderId || !transferForm.toShareholderId || !transferForm.sharesAmount) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (transferForm.fromShareholderId === transferForm.toShareholderId) {
      toast.error("From and To shareholders must be different");
      return;
    }
    if (hasInsufficientShares) {
      toast.error(`Insufficient shares: ${fromShareholder?.name} only has ${fromAvailableShares.toLocaleString()} shares`);
      return;
    }

    const toShareholder = (shareholders || []).find(s => s.id === parseInt(transferForm.toShareholderId));
    const price = parseFloat(transferForm.pricePerShareNtd) || undefined;
    const totalAmt = price ? String(transferShares * price) : (transferForm.totalAmountNtd || undefined);
    const fundingRoundId = transferForm.fundingRoundId ? parseInt(transferForm.fundingRoundId) : undefined;

    // Queue the transfer_in
    setPendingTransferIn({
      shareholderId: parseInt(transferForm.toShareholderId),
      sharesAmount: transferShares,
      shareClass: transferForm.shareClass,
      transactionDate: transferForm.transferDate,
      pricePerShareNtd: transferForm.pricePerShareNtd || undefined,
      totalAmountNtd: totalAmt,
      fundingRoundId,
      notes: transferForm.notes ? `Transfer from ${fromShareholder?.name}: ${transferForm.notes}` : `Transfer from ${fromShareholder?.name}`,
    });

    // Execute transfer_out first
    createTransferOut.mutate({
      shareholderId: parseInt(transferForm.fromShareholderId),
      transactionType: "transfer_out",
      shareClass: transferForm.shareClass as "common",
      sharesAmount: transferShares,
      transactionDate: transferForm.transferDate,
      pricePerShareNtd: transferForm.pricePerShareNtd || undefined,
      totalAmountNtd: totalAmt,
      fundingRoundId,
      notes: transferForm.notes ? `Transfer to ${toShareholder?.name}: ${transferForm.notes}` : `Transfer to ${toShareholder?.name}`,
    });
  }

  const shareClasses = ["common", "seed", "seed_plus", "pre_a", "bridge", "series_a", "pre_b", "series_b", "pre_c", "series_c", "esop"];
  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: "register", label: "Shareholder Register", count: registerRows.length },
    { id: "history", label: "Transaction History", count: enriched.length },
    { id: "transfer", label: "Share Transfer" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Share Register
          </h1>
          <p className="text-sm text-muted-foreground">
            Official register of shareholders and transaction history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => { setActiveTab("transfer"); setShowTransferForm(true); }}
              className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-sm px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Record Transfer
            </button>
          )}
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-sm px-3 py-1.5 transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Register Tab */}
      {activeTab === "register" && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold tracking-tight">Register of Shareholders</h3>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : !registerRows.length ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No shareholder records. Import your cap table to populate the register.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="cap-table w-full">
                <thead>
                  <tr>
                    <th className="cursor-pointer select-none" onClick={() => toggleRegSort("id")}>
                      # {regSortKey === "id" ? (regSortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">⇕</span>}
                    </th>
                    <th className="cursor-pointer select-none" onClick={() => toggleRegSort("name")}>
                      Shareholder {regSortKey === "name" ? (regSortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">⇕</span>}
                    </th>
                    <th className="cursor-pointer select-none" onClick={() => toggleRegSort("type")}>
                      Type {regSortKey === "type" ? (regSortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">⇕</span>}
                    </th>
                    <th className="text-right cursor-pointer select-none" onClick={() => toggleRegSort("shares")}>
                      Shares Held {regSortKey === "shares" ? (regSortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">⇕</span>}
                    </th>
                    <th className="text-right cursor-pointer select-none" onClick={() => toggleRegSort("paidIn")}>
                      Paid-In Capital {regSortKey === "paidIn" ? (regSortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">⇕</span>}
                    </th>
                    <th>Tax Qualified</th>
                    <th>Lock-Up Expiry</th>
                    <th>Tax Deduction Year</th>
                    <th className="text-right">Tax Deduction Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {registerRows.map((row, i) => (
                    <tr key={row.sh!.id}>
                      <td className="text-center text-[11px] font-mono text-muted-foreground tabular-nums">#{String(idxMap.get(row.sh!.id) || 0).padStart(3, "0")}</td>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{row.sh!.name}</p>
                          {row.sh!.aka && <p className="text-xs text-muted-foreground">{row.sh!.aka}</p>}
                          {row.sh!.isEntity && (
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Entity</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${row.sh!.type || "other"}`}>
                          {getRoundLabel(row.sh!.type || "other")}
                        </span>
                      </td>
                      <td className="text-right tabular-nums font-medium">{formatShares(row.totalShares)}</td>
                      <td className="text-right tabular-nums">
                        {row.paidIn > 0 ? `NT$ ${row.paidIn.toLocaleString()}` : "—"}
                      </td>
                      <td>
                        {row.taxQualified ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Yes</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {row.lockUpDate ? formatDate(row.lockUpDate) : "—"}
                      </td>
                      <td className="text-muted-foreground text-sm tabular-nums">
                        {row.taxYear || "—"}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {row.taxAmount > 0 ? `NT$ ${row.taxAmount.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={3} className="font-semibold">Total</td>
                    <td className="text-right tabular-nums font-semibold">{formatShares(grandTotal)}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {grandPaidIn > 0 ? `NT$ ${grandPaidIn.toLocaleString()}` : "—"}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction History Tab */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Transfer Summary */}
          {transferHistory.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-sm p-5 space-y-2">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Total Transfers</p>
                <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {transferHistory.filter(t => t.transactionType === "transfer_out").length}
                </p>
                <p className="text-xs text-muted-foreground">transfer events</p>
              </div>
              <div className="bg-card border border-border rounded-sm p-5 space-y-2">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Shares Transferred</p>
                <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {formatShares(transferHistory.filter(t => t.transactionType === "transfer_out").reduce((s, t) => s + t.sharesAmount, 0))}
                </p>
                <p className="text-xs text-muted-foreground">total shares moved</p>
              </div>
              <div className="bg-card border border-border rounded-sm p-5 space-y-2">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Latest Transfer</p>
                <p className="text-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {transferHistory[0] ? formatDate(transferHistory[0].transactionDate) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">most recent</p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Transaction History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{enriched.length} total transactions</p>
              </div>
            </div>
            {!enriched.length ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No transactions recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="cap-table w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shareholder</th>
                      <th>Type</th>
                      <th>Share Class</th>
                      <th className="text-right">Shares</th>
                      <th className="text-right">Price / Share</th>
                      <th className="text-right">Total Amount</th>
                      <th>Round</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map(t => (
                      <tr key={t.id}>
                        <td className="text-muted-foreground">{formatDate(t.transactionDate)}</td>
                        <td className="font-medium">{t.shareholder?.name || `#${t.shareholderId}`}</td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            t.transactionType === "issuance" ? "bg-green-100 text-green-700" :
                            t.transactionType === "transfer_in" ? "bg-blue-100 text-blue-700" :
                            t.transactionType === "transfer_out" ? "bg-red-100 text-red-700" :
                            t.transactionType === "esop_grant" ? "bg-purple-100 text-purple-700" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {t.transactionType === "transfer_in" ? "← Transfer In" :
                             t.transactionType === "transfer_out" ? "→ Transfer Out" :
                             t.transactionType.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="text-muted-foreground text-xs">{t.shareClass}</td>
                        <td className="text-right tabular-nums font-medium">{formatShares(t.sharesAmount)}</td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {t.pricePerShareNtd ? `NT$ ${parseFloat(t.pricePerShareNtd).toLocaleString()}` : "—"}
                        </td>
                        <td className="text-right tabular-nums">
                          {t.totalAmountNtd ? `NT$ ${parseFloat(t.totalAmountNtd).toLocaleString()}` : "—"}
                        </td>
                        <td className="text-muted-foreground text-xs">{t.round?.name || "—"}</td>
                        <td className="text-muted-foreground text-xs max-w-[160px] truncate" title={t.notes || ""}>
                          {t.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Transfer Tab */}
      {activeTab === "transfer" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-sm p-6 space-y-6">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-base font-semibold tracking-tight">Record Share Transfer</h3>
                <p className="text-xs text-muted-foreground">Transfer shares between shareholders. Both transfer_out and transfer_in will be recorded automatically.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* From Shareholder */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">From Shareholder *</label>
                <select
                  value={transferForm.fromShareholderId}
                  onChange={e => setTransferForm(f => ({ ...f, fromShareholderId: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select shareholder...</option>
                  {(shareholders || []).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.aka ? ` (${s.aka})` : ""}
                    </option>
                  ))}
                </select>
                {transferForm.fromShareholderId && (
                  <p className="text-xs text-muted-foreground">
                    Available: <strong>{formatShares(fromAvailableShares)}</strong> shares
                  </p>
                )}
              </div>

              {/* To Shareholder */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">To Shareholder *</label>
                <select
                  value={transferForm.toShareholderId}
                  onChange={e => setTransferForm(f => ({ ...f, toShareholderId: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select shareholder...</option>
                  {(shareholders || []).filter(s => s.id !== parseInt(transferForm.fromShareholderId)).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.aka ? ` (${s.aka})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shares Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Number of Shares *</label>
                <input
                  type="number"
                  value={transferForm.sharesAmount}
                  onChange={e => setTransferForm(f => ({ ...f, sharesAmount: e.target.value }))}
                  className={`w-full border rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
                    hasInsufficientShares ? "border-destructive focus:ring-destructive" : "border-input"
                  }`}
                  placeholder="e.g. 100000"
                  min="1"
                />
                {hasInsufficientShares && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Exceeds available shares ({formatShares(fromAvailableShares)})
                  </div>
                )}
              </div>

              {/* Share Class */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Share Class</label>
                <select
                  value={transferForm.shareClass}
                  onChange={e => setTransferForm(f => ({ ...f, shareClass: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {shareClasses.map(sc => (
                    <option key={sc} value={sc}>{sc.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>

              {/* Transfer Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Transfer Date *</label>
                <input
                  type="date"
                  value={transferForm.transferDate}
                  onChange={e => setTransferForm(f => ({ ...f, transferDate: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Funding Round */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Related Round (Optional)</label>
                <select
                  value={transferForm.fundingRoundId}
                  onChange={e => setTransferForm(f => ({ ...f, fundingRoundId: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None</option>
                  {(rounds || []).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Price per Share */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Price per Share (NT$)</label>
                <input
                  type="number"
                  value={transferForm.pricePerShareNtd}
                  onChange={e => setTransferForm(f => ({ ...f, pricePerShareNtd: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Optional"
                  step="0.01"
                />
              </div>

              {/* Total Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Total Amount (NT$)</label>
                <input
                  type="number"
                  value={
                    transferForm.pricePerShareNtd && transferForm.sharesAmount
                      ? String(parseFloat(transferForm.pricePerShareNtd) * parseInt(transferForm.sharesAmount))
                      : transferForm.totalAmountNtd
                  }
                  onChange={e => setTransferForm(f => ({ ...f, totalAmountNtd: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Auto-calculated if price set"
                  readOnly={!!(transferForm.pricePerShareNtd && transferForm.sharesAmount)}
                />
              </div>

              {/* Notes */}
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes</label>
                <textarea
                  value={transferForm.notes}
                  onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Reason for transfer, agreement reference, etc."
                />
              </div>
            </div>

            {/* Preview */}
            {transferForm.fromShareholderId && transferForm.toShareholderId && transferForm.sharesAmount && !hasInsufficientShares && (
              <div className="bg-secondary/40 rounded-sm p-4 space-y-2 border border-border">
                <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Transfer Preview</p>
                <div className="flex items-center gap-3 text-sm">
                  <div className="font-medium">
                    {(shareholders || []).find(s => s.id === parseInt(transferForm.fromShareholderId))?.name}
                  </div>
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="font-medium">
                    {(shareholders || []).find(s => s.id === parseInt(transferForm.toShareholderId))?.name}
                  </div>
                  <div className="ml-auto text-right">
                    <span className="font-bold tabular-nums">{formatShares(transferShares)}</span>
                    <span className="text-muted-foreground ml-1">shares</span>
                  </div>
                </div>
                {transferForm.pricePerShareNtd && (
                  <p className="text-xs text-muted-foreground">
                    Total consideration: NT$ {(parseFloat(transferForm.pricePerShareNtd) * transferShares).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmitTransfer}
                disabled={
                  !transferForm.fromShareholderId || !transferForm.toShareholderId ||
                  !transferForm.sharesAmount || hasInsufficientShares ||
                  createTransferOut.isPending || createTransferIn.isPending
                }
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Check className="h-4 w-4" />
                {createTransferOut.isPending || createTransferIn.isPending ? "Recording..." : "Record Transfer"}
              </button>
              <button
                onClick={() => setTransferForm({
                  fromShareholderId: "", toShareholderId: "", sharesAmount: "", shareClass: "common",
                  transferDate: new Date().toISOString().split("T")[0], pricePerShareNtd: "",
                  totalAmountNtd: "", fundingRoundId: "", notes: "",
                })}
                className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Recent Transfers */}
          {transferHistory.length > 0 && (
            <div className="bg-card border border-border rounded-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-semibold tracking-tight">Recent Transfers</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{transferHistory.filter(t => t.transactionType === "transfer_out").length} transfer events</p>
              </div>
              <table className="cap-table w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Direction</th>
                    <th>Shareholder</th>
                    <th>Share Class</th>
                    <th className="text-right">Shares</th>
                    <th className="text-right">Price / Share</th>
                    <th className="text-right">Total Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transferHistory.map(t => (
                    <tr key={t.id}>
                      <td className="text-muted-foreground">{formatDate(t.transactionDate)}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.transactionType === "transfer_in" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                        }`}>
                          {t.transactionType === "transfer_in" ? "← In" : "→ Out"}
                        </span>
                      </td>
                      <td className="font-medium">{t.shareholder?.name || `#${t.shareholderId}`}</td>
                      <td className="text-muted-foreground text-xs">{t.shareClass}</td>
                      <td className="text-right tabular-nums font-medium">{formatShares(t.sharesAmount)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {t.pricePerShareNtd ? `NT$ ${parseFloat(t.pricePerShareNtd).toLocaleString()}` : "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {t.totalAmountNtd ? `NT$ ${parseFloat(t.totalAmountNtd).toLocaleString()}` : "—"}
                      </td>
                      <td className="text-muted-foreground text-xs max-w-[180px] truncate" title={t.notes || ""}>
                        {t.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
