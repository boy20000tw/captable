/**
 * Admin Version Log — displays both Platform and Admin Panel changelogs.
 * Platform changelog: shared/changelog.ts
 * Admin changelog: shared/adminChangelog.ts
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { CHANGELOG } from "../../../../shared/changelog";
import { ADMIN_CHANGELOG } from "../../../../shared/adminChangelog";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_COLORS: Record<string, string> = {
  major: "bg-red-100 text-red-700 border-transparent",
  minor: "bg-blue-100 text-blue-700 border-transparent",
  patch: "bg-gray-100 text-gray-700 border-transparent",
};

type TabKey = "admin" | "platform";

export default function AdminVersionsPage() {
  return (
    <AdminLayout>
      <AdminVersionsContent />
    </AdminLayout>
  );
}

function AdminVersionsContent() {
  const { t, i18n } = useTranslation("admin");
  const [activeTab, setActiveTab] = useState<TabKey>("admin");
  const isZh = i18n.language.startsWith("zh");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "admin", label: t("versions.tabAdmin") },
    { key: "platform", label: t("versions.tabPlatform") },
  ];

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

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Admin changelog */}
      {activeTab === "admin" && (
        <ChangelogList
          entries={ADMIN_CHANGELOG.map((e) => ({
            version: e.version,
            date: e.date,
            type: e.type,
            title: isZh ? e.title : e.titleEn,
            description: isZh ? e.description : e.descriptionEn,
          }))}
          t={t}
        />
      )}

      {/* Platform changelog */}
      {activeTab === "platform" && (
        <ChangelogList
          entries={CHANGELOG.map((e) => ({
            version: e.version,
            date: e.date,
            type: e.type,
            title: e.title,
            description: e.description,
          }))}
          t={t}
        />
      )}
    </div>
  );
}

function ChangelogList({
  entries,
  t,
}: {
  entries: Array<{ version: string; date: string; type: string; title: string; description: string }>;
  t: (key: string) => string;
}) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t("versions.noEntries")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.version}>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-28">
                <p className="font-mono text-base font-bold">v{entry.version}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.date}</p>
                <Badge className={`${TYPE_COLORS[entry.type] ?? ""} text-[10px] mt-1.5`}>
                  {t(`versions.${entry.type}`)}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{entry.title}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{entry.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
