import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Building2, ArrowRight, ArrowLeft, Check, Loader2,
  Rocket, Sparkles,
} from "lucide-react";

type Step = "welcome" | "creating" | "done";

interface OnboardingWizardProps {
  onSkip?: () => void;
}

export default function OnboardingWizard({ onSkip }: OnboardingWizardProps) {
  const { t } = useTranslation("pages");
  const { user, refresh, clerkUser } = useAuth();

  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [taxId, setTaxId] = useState("");
  const [error, setError] = useState("");

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: async () => {
      setStep("done");
      // Refetch auth so the wizard won't show again
      await refresh();
    },
    onError: (err) => {
      setError(err.message);
      setStep("welcome");
    },
  });

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      setError(t("onboarding.errorNameRequired"));
      return;
    }
    setError("");
    setStep("creating");
    createMutation.mutate({
      name: name.trim(),
      ...(nameEn.trim() ? { nameEn: nameEn.trim() } : {}),
      ...(taxId.trim() ? { taxId: taxId.trim() } : {}),
    });
  }, [name, nameEn, taxId, createMutation, t]);

  const displayName = clerkUser?.firstName || user?.name || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* ── Step 1: Welcome + Company Info ── */}
        {step === "welcome" && (
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {displayName
                  ? t("onboarding.welcomeUser", { name: displayName })
                  : t("onboarding.welcome")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {t("onboarding.welcomeDesc")}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs text-primary font-medium">{t("onboarding.step1Label")}</span>
              </div>
              <div className="w-8 h-px bg-border" />
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <span className="text-xs text-muted-foreground">{t("onboarding.step2Label")}</span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("onboarding.companyName")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t("onboarding.companyNamePlaceholder")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {t("onboarding.companyNameEn")}
                  <span className="text-xs ml-1">({t("onboarding.optional")})</span>
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  placeholder={t("onboarding.companyNameEnPlaceholder")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {t("onboarding.taxId")}
                  <span className="text-xs ml-1">({t("onboarding.optional")})</span>
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  placeholder={t("onboarding.taxIdPlaceholder")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
              )}
            </div>

            {/* CTA */}
            <div className="space-y-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("onboarding.createCompany")}
                <ArrowRight className="h-4 w-4" />
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {t("onboarding.skip")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Creating... ── */}
        {step === "creating" && (
          <div className="p-8 flex flex-col items-center justify-center space-y-4 min-h-[300px]">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">{t("onboarding.creating")}</h3>
              <p className="text-sm text-muted-foreground">{t("onboarding.creatingDesc")}</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {t("onboarding.doneTitle")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {t("onboarding.doneDesc", { name: name.trim() })}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">{t("onboarding.step1Label")}</span>
              </div>
              <div className="w-8 h-px bg-emerald-300" />
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">{t("onboarding.step2Label")}</span>
              </div>
            </div>

            {/* Quick tips */}
            <div className="bg-muted/40 rounded-md p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("onboarding.nextSteps")}
              </p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{t("onboarding.tip1")}</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{t("onboarding.tip2")}</span>
                </li>
              </ul>
            </div>

            {/* CTA — just reload / navigate to dashboard */}
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t("onboarding.startUsing")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
