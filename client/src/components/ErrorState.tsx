import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  onRetry?: () => void;
}

export default function ErrorState({ onRetry }: ErrorStateProps) {
  const { t } = useTranslation("pages");

  return (
    <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t("error.title")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("error.desc")}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t("error.retry")}
        </button>
      )}
    </div>
  );
}
