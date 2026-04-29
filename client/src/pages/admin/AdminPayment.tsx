/**
 * Admin Payment Integration Architecture — overview of subscription billing,
 * payment processing strategy, and integration roadmap.
 */

import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { CreditCard, Zap, Target, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  { icon: Zap,      titleKey: "payment.currentState",  descKey: "payment.currentStateDesc" },
  { icon: Target,   titleKey: "payment.planned",        descKey: "payment.plannedDesc" },
  { icon: CreditCard, titleKey: "payment.architecture", descKey: "payment.architectureDesc" },
  { icon: Calendar, titleKey: "payment.timeline",       descKey: "payment.timelineDesc" },
] as const;

export default function AdminPaymentPage() {
  return (
    <AdminLayout>
      <AdminPaymentContent />
    </AdminLayout>
  );
}

function AdminPaymentContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" /> {tPages("admin.payment.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tPages("admin.payment.desc")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  );
}
