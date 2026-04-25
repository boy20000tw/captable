/**
 * 409A Valuation — placeholder for future US market expansion.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { DollarSign } from "lucide-react";

export default function Valuation409APage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="text-center py-20">
          <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">409A Valuation</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Independent fair market value assessment for common stock — required by IRS Section 409A for US-based companies issuing stock options.
          </p>
          <p className="text-xs text-muted-foreground mt-4">Coming soon</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
