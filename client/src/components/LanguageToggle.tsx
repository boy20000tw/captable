import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function LanguageToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { i18n, t } = useTranslation();

  const toggle = () => {
    const next = i18n.language === "zh-TW" ? "en" : "zh-TW";
    i18n.changeLanguage(next);
  };

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8"
          >
            <Globe className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t("lang.toggle")}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5 text-xs h-8 px-2"
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{t("lang.current")}</span>
      <span className="text-muted-foreground">⇄</span>
      <span className="text-muted-foreground">{t("lang.toggle")}</span>
    </Button>
  );
}
