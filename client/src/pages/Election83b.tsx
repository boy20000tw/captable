/**
 * 83(b) Election — placeholder for future US market expansion.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { FileCheck } from "lucide-react";

export default function Election83bPage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="text-center py-20">
          <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">83(b) Election</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Generate and track IRS 83(b) election filings — allows founders and employees to pay tax on restricted stock at grant-date value rather than vesting-date value.
          </p>
          <p className="text-xs text-muted-foreground mt-4">Coming soon</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
