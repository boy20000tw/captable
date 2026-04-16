import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function InstrumentsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Instruments</h1>
        <p className="text-slate-600 mb-6">
          Configure the financial instruments your company issues: Equity, SAFEs,
          Convertible Notes.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Coming in V2
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>V2 of Caploom adds full instrument support:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Equity</strong> — ordinary shares + preferred (already
                supported implicitly)
              </li>
              <li>
                <strong>SAFE</strong> — valuation cap, discount, MFN
              </li>
              <li>
                <strong>Convertible Note</strong> — interest rate, maturity, cap,
                discount
              </li>
            </ul>
            <p className="pt-3">
              See <code>SPEC-mvp-split.md §2</code> (V2 Moat) for the roadmap.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
