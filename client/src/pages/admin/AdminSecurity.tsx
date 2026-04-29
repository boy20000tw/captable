/**
 * Admin Security & Privacy Architecture — overview of encryption,
 * key management, and data protection implementation status.
 */

import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Lock, ShieldCheck, Key, Globe, Database, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const SECTIONS = [
  { icon: ShieldCheck, titleKey: "security.encryption", descKey: "security.encryptionDesc" },
  { icon: Key,         titleKey: "security.keyMgmt",    descKey: "security.keyMgmtDesc" },
  { icon: Globe,       titleKey: "security.transit",    descKey: "security.transitDesc" },
  { icon: Database,    titleKey: "security.atRest",     descKey: "security.atRestDesc" },
  { icon: Search,      titleKey: "security.blindIndex", descKey: "security.blindIndexDesc" },
] as const;

const PHASES = [
  { nameKey: "security.phase1", statusKey: "security.phase1Status", done: true },
  { nameKey: "security.phase2", statusKey: "security.phase2Status", done: false },
  { nameKey: "security.phase3", statusKey: "security.phase3Status", done: false },
  { nameKey: "security.phase4", statusKey: "security.phase4Status", done: false },
  { nameKey: "security.phase5", statusKey: "security.phase5Status", done: false },
] as const;

export default function AdminSecurityPage() {
  return (
    <AdminLayout>
      <AdminSecurityContent />
    </AdminLayout>
  );
}

function AdminSecurityContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Lock className="h-6 w-6 text-primary" /> {tPages("admin.security.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tPages("admin.security.desc")}
        </p>
      </div>

      {/* Architecture cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map(({ icon: Icon, titleKey, descKey }) => (
          <Card key={titleKey}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" /> {t(titleKey)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{t(descKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Implementation phases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("security.status")}</CardTitle>
          <CardDescription>{t("security.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("security.phase")}</TableHead>
                <TableHead className="w-32">{t("security.phaseStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PHASES.map((phase) => (
                <TableRow key={phase.nameKey}>
                  <TableCell className="text-sm font-medium">{t(phase.nameKey)}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border-transparent ${
                      phase.done
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {t(phase.statusKey)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
