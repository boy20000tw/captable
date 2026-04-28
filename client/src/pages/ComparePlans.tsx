import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Check, Minus, ArrowLeft } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMPARISON_TABLE } from "../../../shared/plans";

export default function ComparePlansPage() {
  const { t } = useTranslation("subscription");
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/subscription")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("compare.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("compare.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[28%]">{t("compare.feature")}</th>
                    <th className="text-center font-medium px-4 py-3 w-[18%]">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">{t("pricing.starter")}</Badge>
                    </th>
                    <th className="text-center font-medium px-4 py-3 w-[18%]">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">{t("pricing.standard")}</Badge>
                    </th>
                    <th className="text-center font-medium px-4 py-3 w-[18%]">
                      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">{t("pricing.plus")}</Badge>
                    </th>
                    <th className="text-center font-medium px-4 py-3 w-[18%]">
                      <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-50">{t("pricing.enterprise")}</Badge>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_TABLE.map((section) => (
                    <ComparisonSection key={section.sectionKey} section={section} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CTA at bottom */}
        <div className="flex justify-center mt-6">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/pricing")}>
            {t("compare.upgradeNow")}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ComparisonSection({ section, t }: { section: typeof COMPARISON_TABLE[number]; t: (key: string) => string }) {
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={5} className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t(section.sectionKey)}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.labelKey} className="border-b border-border/50 last:border-b-0">
          <td className="px-4 py-2.5">{t(row.labelKey)}</td>
          <td className="px-4 py-2.5 text-center"><CellValue value={row.starter} t={t} /></td>
          <td className="px-4 py-2.5 text-center"><CellValue value={row.standard} t={t} /></td>
          <td className="px-4 py-2.5 text-center"><CellValue value={row.plus} t={t} /></td>
          <td className="px-4 py-2.5 text-center"><CellValue value={row.enterprise} t={t} /></td>
        </tr>
      ))}
    </>
  );
}

function CellValue({ value, t }: { value: string | boolean; t: (key: string) => string }) {
  if (value === true) {
    return <Check className="h-4 w-4 text-green-600 mx-auto" />;
  }
  if (value === false) {
    return <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  }
  const translated = value.startsWith("compare.") ? t(value) : value;
  return <span className="text-xs text-muted-foreground">{translated}</span>;
}
