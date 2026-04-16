import { Calculator, FlaskConical } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
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
import { EstimatedValuationContent } from "./EstimatedValuation";

export default function ValuationPage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" />
            Valuation &amp; Scenario Modeling
          </h1>
          <p className="text-muted-foreground mt-1">
            Estimate per-round valuations today; model hypothetical future rounds.
          </p>
        </div>

        <Tabs defaultValue="estimated" className="space-y-6">
          <TabsList>
            <TabsTrigger value="estimated">Estimated Valuation</TabsTrigger>
            <TabsTrigger value="scenario">Scenario Modeling</TabsTrigger>
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
                  Scenario Modeling — coming in V2
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
    </DashboardLayout>
  );
}
