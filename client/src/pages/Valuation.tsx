import { useTranslation } from "react-i18next";
import { Calculator, FlaskConical } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EstimatedValuationContent } from "@/components/v1/EstimatedValuation";

export default function ValuationPage() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("analysis");
  return (
    <DashboardLayout>
      <FeatureGate feature="analysis.valuation">
        <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" />
            {tPages("valuation.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tPages("valuation.desc")}
          </p>
        </div>

        <Tabs defaultValue="estimated" className="space-y-6">
          <TabsList>
            <TabsTrigger value="estimated">{t("valuation.estimatedTab")}</TabsTrigger>
            <TabsTrigger value="scenario">{t("valuation.scenarioTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="estimated" className="space-y-0">
            {/* The existing EstimatedValuationContent already includes its own
                padded container, so we render it bare — DashboardLayout is
                applied only once at the top of this page. */}
            <EstimatedValuationContent />
          </TabsContent>

          <TabsContent value="scenario">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  {t("valuation.scenarioTab")} — {t("valuation.comingSoon")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  Model hypothetical future rounds: adjust round size, price, pool
                  top-up, SAFE conversion — see the resulting cap table and
                  per-shareholder dilution delta in real time.
                </p>
                <p>
                  Follow progress in <code>SPEC-mvp-split.md §2 V2</code>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
