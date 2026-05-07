/**
 * Admin Version Log — displays the unified platform changelog.
 * Reads from shared/changelog.ts (single source of truth for all versioning).
 */

import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { CHANGELOG } from "../../../../shared/changelog";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_COLORS: Record<string, string> = {
  major: "bg-red-100 text-red-700 border-transparent",
  minor: "bg-blue-100 text-blue-700 border-transparent",
  patch: "bg-gray-100 text-gray-700 border-transparent",
};

export default function AdminVersionsPage() {
  return (
    <AdminLayout>
      <AdminVersionsContent />
    </AdminLayout>
  );
}

function AdminVersionsContent() {
  const { t } = useTranslation("admin");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Tag className="h-6 w-6 text-primary" /> {t("versions.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("versions.desc")}
        </p>
      </div>

      {CHANGELOG.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("versions.noEntries")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {CHANGELOG.map((entry) => (
            <Card key={entry.version}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Version + date + type badge */}
                  <div className="shrink-0 w-28">
                    <p className="font-mono text-base font-bold">v{entry.version}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.date}</p>
                    <Badge className={`${TYPE_COLORS[entry.type] ?? ""} text-[10px] mt-1.5`}>
                      {t(`versions.${entry.type}`)}
                    </Badge>
                  </div>
                  {/* Title + description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">
                      {entry.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {entry.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
