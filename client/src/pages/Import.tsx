import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Sparkles, X, Download, PackageOpen, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export default function ImportPage() {
  return (
    <DashboardLayout>
      <ImportContent />
    </DashboardLayout>
  );
}

type ImportResult = {
  success: boolean;
  message: string;
  stats?: {
    shareholders: number;
    rounds: number;
    holdings: number;
    transactions: number;
    esopPools: number;
  };
  errors?: string[];
};

function ImportContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("settings");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const { canImport } = usePermissions();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Demo Pack state
  const [exporting, setExporting] = useState(false);
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [demoImporting, setDemoImporting] = useState(false);
  const [demoResult, setDemoResult] = useState<{ success: boolean; sheetsImported: string[]; totalRecords: number; errors: string[] } | null>(null);
  const demoFileRef = useRef<HTMLInputElement>(null);

  const exportDemoPack = trpc.admin.exportDemoPack.useMutation({
    onSuccess: (data) => {
      const binary = atob(data.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
      toast.success(t("import.demoExported"));
    },
    onError: (e) => {
      toast.error(t("import.exportFailed") + ": " + e.message);
      setExporting(false);
    },
  });

  const importDemoPackMut = trpc.admin.importDemoPack.useMutation({
    onSuccess: (data) => {
      setDemoResult(data);
      if (data.success) {
        toast.success(`Demo Pack imported! ${data.totalRecords} records across ${data.sheetsImported.length} tables.`);
        utils.fundingRounds.list.invalidate();
        utils.v1.capTable.current.invalidate();
        utils.v1.investors.list.invalidate();
        utils.v1.allocations.list.invalidate();
        utils.v1.register.list.invalidate();
        utils.v1.esop.pools.invalidate();
        utils.v1.esop.grants.invalidate();
      } else {
        toast.error(t("import.importErrors"));
      }
      setDemoImporting(false);
    },
    onError: (e) => {
      setDemoResult({ success: false, sheetsImported: [], totalRecords: 0, errors: [e.message] });
      toast.error(t("import.importFailed") + ": " + e.message);
      setDemoImporting(false);
    },
  });

  async function handleDemoImport() {
    if (!demoFile) return;
    setDemoImporting(true);
    setDemoResult(null);
    try {
      const arrayBuffer = await demoFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(binary);
      importDemoPackMut.mutate({ fileBase64 });
    } catch {
      setDemoResult({ success: false, sheetsImported: [], totalRecords: 0, errors: [t("import.fileReadError")] });
      setDemoImporting(false);
    }
  }

  const { data: rounds } = trpc.fundingRounds.list.useQuery();
  const { data: capTable } = trpc.v1.capTable.current.useQuery();

  const importExcel = trpc.import.excel.useMutation({
    onSuccess: (data) => {
      const raw = data as unknown as { success: boolean; recordsImported: number; errors: string[] };
      const r: ImportResult = {
        success: raw.success,
        message: raw.success
          ? `Successfully imported ${raw.recordsImported} records.`
          : `Import failed with ${raw.errors?.length ?? 0} errors.`,
        errors: raw.errors,
      };
      setResult(r);
      if (raw.success) {
        toast.success(`Cap table imported! ${raw.recordsImported} records processed.`);
        utils.fundingRounds.list.invalidate();
        utils.v1.capTable.current.invalidate();
        utils.v1.investors.list.invalidate();
        utils.v1.allocations.list.invalidate();
        utils.v1.register.list.invalidate();
        utils.v1.esop.pools.invalidate();
        utils.v1.esop.grants.invalidate();
      } else {
        toast.error(t("import.importErrors"));
      }
      setImporting(false);
    },
    onError: (e) => {
      setResult({ success: false, message: e.message });
      toast.error(t("import.importFailed") + ": " + e.message);
      setImporting(false);
    },
  });

  const analyzeRounds = trpc.analysis.analyze.useMutation({
    onSuccess: (data) => {
      const text = typeof data.analysis === "string" ? data.analysis : t("import.analysisUnavailable");
      setAnalysisText(text);
      setAnalyzing(false);
    },
    onError: (e: { message: string }) => {
      toast.error(t("import.analysisFailed") + ": " + e.message);
      setAnalyzing(false);
    },
  });

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      // Convert file to base64 for tRPC transport (avoids cookie issues with multipart)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(binary);

      importExcel.mutate({ fileBase64, fileName: file.name });
    } catch (err) {
      setResult({ success: false, message: t("import.fileReadRetry") });
      toast.error(t("import.fileReadError"));
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))) {
      setFile(dropped);
      setResult(null);
    } else {
      toast.error(t("import.uploadExcelOnly"));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  }

  function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisText("");
    analyzeRounds.mutate({
      rounds: (rounds || []).map(r => ({
        name: r.name,
        pricePerShareNtd: r.pricePerShareNtd,
        moneyRaisedNtd: r.moneyRaisedNtd,
        postMoneyValuationNtd: r.postMoneyValuationNtd,
        roundDate: r.roundDate ? new Date(r.roundDate).toISOString() : null,
      })),
      totalShares: capTable?.totalShares || 0,
      esopPoolShares: capTable?.esopPoolTotal || undefined,
      projections: [],
    });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="h-px bg-foreground/20 w-16 mb-4" />
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>
          {tPages("settings.import.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{tPages("settings.import.desc")}</p>
      </div>

      {/* Import Section */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-5">
        <div className="space-y-0.5">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{t("import.sectionImport")}</p>
          <h3 className="text-base font-semibold tracking-tight">{t("import.importTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("import.importDesc")}
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-sm p-12 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30 hover:bg-secondary/30"
          }`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div className="space-y-2">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · {t("import.clickToChange")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{t("import.dropHere")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("import.orBrowse")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Import Button */}
        <div className="flex items-center gap-4">
          {canImport ? (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? t("import.importing") : t("import.importCapTable")}
            </button>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-sm px-4 py-2">{t("import.noPermission")}</p>
          )}
          {file && (
            <button onClick={() => { setFile(null); setResult(null); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <X className="h-3.5 w-3.5" /> {t("import.clear")}
            </button>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className={`border rounded-sm p-4 space-y-3 ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center gap-2">
              {result.success
                ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              }
              <p className={`text-sm font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
                {result.message}
              </p>
            </div>
            {result.stats && (
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: t("import.shareholders"), value: result.stats.shareholders },
                  { label: t("import.rounds"), value: result.stats.rounds },
                  { label: t("import.holdings"), value: result.stats.holdings },
                  { label: t("import.transactions"), value: result.stats.transactions },
                  { label: t("import.esopPools"), value: result.stats.esopPools },
                ].map(s => (
                  <div key={s.label} className="text-center bg-white/60 rounded p-2">
                    <p className="text-lg font-bold text-green-800">{s.value}</p>
                    <p className="text-[10px] text-green-600">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            {result.errors && result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-700">{t("import.warnings")}</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Demo Data Pack Section */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-5">
        <div className="space-y-0.5">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">DEMO DATA PACK</p>
          <h3 className="text-base font-semibold tracking-tight">匯出/匯入完整 Demo 資料</h3>
          <p className="text-xs text-muted-foreground">
            將所有業務資料（投資人、輪次、股權、ESOP、合規、分析等 25+ 張表）匯出為 Excel，可匯入至任何帳號完整還原。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Export */}
          <div className="border border-border rounded-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">匯出 Demo Pack</p>
            </div>
            <p className="text-xs text-muted-foreground">將目前所有資料匯出為多 Sheet Excel 檔案。</p>
            {canImport ? (
              <button
                onClick={() => { setExporting(true); exportDemoPack.mutate(); }}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? "匯出中..." : "匯出 Excel"}
              </button>
            ) : (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-sm px-3 py-1.5 text-xs">需要 Owner/Admin 權限</p>
            )}
          </div>

          {/* Import */}
          <div className="border border-border rounded-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">匯入 Demo Pack</p>
            </div>
            <p className="text-xs text-muted-foreground">從 Demo Pack Excel 檔案匯入所有資料。建議先清空資料再匯入。</p>
            <input ref={demoFileRef} type="file" accept=".xlsx" onChange={e => { setDemoFile(e.target.files?.[0] || null); setDemoResult(null); }} className="hidden" />
            <div className="flex items-center gap-2">
              {canImport ? (
                <>
                  <button
                    onClick={() => demoFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary/50 transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {demoFile ? demoFile.name : "選擇檔案"}
                  </button>
                  {demoFile && (
                    <button
                      onClick={handleDemoImport}
                      disabled={demoImporting}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {demoImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {demoImporting ? "匯入中..." : "匯入"}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-sm px-3 py-1.5 text-xs">需要 Owner/Admin 權限</p>
              )}
            </div>
          </div>
        </div>

        {/* Demo Import Result */}
        {demoResult && (
          <div className={`border rounded-sm p-4 space-y-2 ${demoResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center gap-2">
              {demoResult.success
                ? <CheckCircle className="h-4 w-4 text-green-600" />
                : <AlertCircle className="h-4 w-4 text-red-600" />
              }
              <p className={`text-sm font-medium ${demoResult.success ? "text-green-800" : "text-red-800"}`}>
                {demoResult.success
                  ? `匯入成功！共 ${demoResult.totalRecords} 筆記錄，涵蓋 ${demoResult.sheetsImported.length} 張表。`
                  : "匯入失敗"}
              </p>
            </div>
            {demoResult.sheetsImported.length > 0 && (
              <p className="text-xs text-green-600">
                已匯入：{demoResult.sheetsImported.join(", ")}
              </p>
            )}
            {demoResult.errors.length > 0 && (
              <div className="space-y-1">
                {demoResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LLM Analysis Section */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-5">
        <div className="space-y-0.5">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{t("import.sectionAi")}</p>
          <h3 className="text-base font-semibold tracking-tight">{t("import.aiTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("import.aiDesc")}
          </p>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analyzing ? t("import.analyzing") : t("import.generateReport")}
        </button>

        {(analyzing || analysisText) && (
          <div className="border border-border rounded-sm p-6 bg-secondary/20 space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{t("import.aiReport")}</p>
            </div>
            {analyzing && !analysisText && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("import.analyzingData")}</span>
              </div>
            )}
            {analysisText && (
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap">{analysisText}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Format Guide */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{t("import.sectionFormat")}</p>
            <h3 className="text-base font-semibold tracking-tight">{t("import.formatTitle")}</h3>
            <p className="text-xs text-muted-foreground pt-1">
              {t("import.formatDesc")}
            </p>
          </div>
          <a
            href="/templates/captable_template.xlsx"
            download="captable_template.xlsx"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-primary/30 text-primary bg-primary/5 text-sm font-medium rounded-sm hover:bg-primary/10 transition-colors"
          >
            <Download className="h-4 w-4" />
            {t("import.downloadTemplate")}
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              sheet: t("import.sheetRegister"),
              desc: t("import.sheetRegisterDesc"),
              required: true,
            },
            {
              sheet: t("import.sheetCapTable"),
              desc: t("import.sheetCapTableDesc"),
              required: true,
            },
            {
              sheet: t("import.sheetCapTableEsop"),
              desc: t("import.sheetCapTableEsopDesc"),
              required: false,
            },
            {
              sheet: t("import.sheetProjection"),
              desc: t("import.sheetProjectionDesc"),
              required: false,
            },
          ].map(item => (
            <div key={item.sheet} className="space-y-1 p-3 border border-border rounded-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs font-medium">{item.sheet}</p>
                {item.required && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">{t("import.required")}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground pl-5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
