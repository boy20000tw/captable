import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

export default function TermsOfServicePage() {
  const { t } = useTranslation("legal");
  const lastUpdated = "2026-04-28";

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-6 md:p-10 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("terms.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("terms.lastUpdated", { date: lastUpdated })}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{t("terms.intro")}</p>

        <hr className="border-border" />

        {/* 1. Service Description */}
        <Section title={t("terms.sections.serviceDescription.title")}>
          <p>{t("terms.sections.serviceDescription.description")}</p>
        </Section>

        {/* 2. Accounts */}
        <Section title={t("terms.sections.accounts.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.accounts.registration")}</Li>
            <Li>{t("terms.sections.accounts.security")}</Li>
            <Li>{t("terms.sections.accounts.roles")}</Li>
            <Li>{t("terms.sections.accounts.unauthorized")}</Li>
          </ul>
        </Section>

        {/* 3. Acceptable Use */}
        <Section title={t("terms.sections.acceptableUse.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.acceptableUse.noViolation")}</Li>
            <Li>{t("terms.sections.acceptableUse.noInterference")}</Li>
            <Li>{t("terms.sections.acceptableUse.noScraping")}</Li>
            <Li>{t("terms.sections.acceptableUse.noMisrepresent")}</Li>
          </ul>
        </Section>

        {/* 4. Intellectual Property */}
        <Section title={t("terms.sections.intellectualProperty.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.intellectualProperty.ourIP")}</Li>
            <Li>{t("terms.sections.intellectualProperty.yourData")}</Li>
            <Li>{t("terms.sections.intellectualProperty.license")}</Li>
          </ul>
        </Section>

        {/* 5. Subscription */}
        <Section title={t("terms.sections.subscriptionPayment.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.subscriptionPayment.plans")}</Li>
            <Li>{t("terms.sections.subscriptionPayment.billing")}</Li>
            <Li>{t("terms.sections.subscriptionPayment.downgrade")}</Li>
            <Li>{t("terms.sections.subscriptionPayment.refund")}</Li>
          </ul>
        </Section>

        {/* 6. Disclaimer */}
        <Section title={t("terms.sections.disclaimer.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.disclaimer.asIs")}</Li>
            <Li>{t("terms.sections.disclaimer.noGuarantee")}</Li>
            <Li>{t("terms.sections.disclaimer.noAdvice")}</Li>
          </ul>
        </Section>

        {/* 7. Limitation */}
        <Section title={t("terms.sections.limitation.title")}>
          <p>{t("terms.sections.limitation.description")}</p>
        </Section>

        {/* 8. Termination */}
        <Section title={t("terms.sections.termination.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.termination.byUser")}</Li>
            <Li>{t("terms.sections.termination.byUs")}</Li>
            <Li>{t("terms.sections.termination.effect")}</Li>
          </ul>
        </Section>

        {/* 9. Governing Law */}
        <Section title={t("terms.sections.governing.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("terms.sections.governing.law")}</Li>
            <Li>{t("terms.sections.governing.jurisdiction")}</Li>
          </ul>
        </Section>

        {/* 10. Changes */}
        <Section title={t("terms.sections.changes.title")}>
          <p>{t("terms.sections.changes.description")}</p>
        </Section>

        {/* 11. Contact */}
        <Section title={t("terms.sections.contact.title")}>
          <p>{t("terms.sections.contact.description")}</p>
          <p className="font-medium">{t("terms.sections.contact.email")}</p>
        </Section>
      </div>
    </DashboardLayout>
  );
}
