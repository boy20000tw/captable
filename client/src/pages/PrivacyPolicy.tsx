import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Shield } from "lucide-react";

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

export default function PrivacyPolicyPage() {
  const { t } = useTranslation("legal");
  const lastUpdated = "2026-04-28";

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-6 md:p-10 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("privacy.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("privacy.lastUpdated", { date: lastUpdated })}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.intro")}</p>

        <hr className="border-border" />

        {/* 1. Data Collection */}
        <Section title={t("privacy.sections.dataCollection.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("privacy.sections.dataCollection.account")}</Li>
            <Li>{t("privacy.sections.dataCollection.company")}</Li>
            <Li>{t("privacy.sections.dataCollection.usage")}</Li>
            <Li>{t("privacy.sections.dataCollection.cookies")}</Li>
          </ul>
        </Section>

        {/* 2. Data Use */}
        <Section title={t("privacy.sections.dataUse.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("privacy.sections.dataUse.provide")}</Li>
            <Li>{t("privacy.sections.dataUse.authenticate")}</Li>
            <Li>{t("privacy.sections.dataUse.communicate")}</Li>
            <Li>{t("privacy.sections.dataUse.improve")}</Li>
            <Li>{t("privacy.sections.dataUse.comply")}</Li>
          </ul>
        </Section>

        {/* 3. Third-Party */}
        <Section title={t("privacy.sections.thirdParty.title")}>
          <p>{t("privacy.sections.thirdParty.description")}</p>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("privacy.sections.thirdParty.clerk")}</Li>
            <Li>{t("privacy.sections.thirdParty.neon")}</Li>
            <Li>{t("privacy.sections.thirdParty.docuseal")}</Li>
            <Li>{t("privacy.sections.thirdParty.vercel")}</Li>
          </ul>
          <p className="font-medium text-foreground">{t("privacy.sections.thirdParty.note")}</p>
        </Section>

        {/* 4. Data Retention */}
        <Section title={t("privacy.sections.dataRetention.title")}>
          <p>{t("privacy.sections.dataRetention.description")}</p>
        </Section>

        {/* 5. User Rights */}
        <Section title={t("privacy.sections.userRights.title")}>
          <ul className="list-disc list-outside ml-4 space-y-1.5">
            <Li>{t("privacy.sections.userRights.access")}</Li>
            <Li>{t("privacy.sections.userRights.correction")}</Li>
            <Li>{t("privacy.sections.userRights.deletion")}</Li>
            <Li>{t("privacy.sections.userRights.portability")}</Li>
          </ul>
          <p>{t("privacy.sections.userRights.howTo")}</p>
        </Section>

        {/* 6. Security */}
        <Section title={t("privacy.sections.security.title")}>
          <p>{t("privacy.sections.security.description")}</p>
        </Section>

        {/* 7. Children */}
        <Section title={t("privacy.sections.children.title")}>
          <p>{t("privacy.sections.children.description")}</p>
        </Section>

        {/* 8. Changes */}
        <Section title={t("privacy.sections.changes.title")}>
          <p>{t("privacy.sections.changes.description")}</p>
        </Section>

        {/* 9. Contact */}
        <Section title={t("privacy.sections.contact.title")}>
          <p>{t("privacy.sections.contact.description")}</p>
          <p className="font-medium">{t("privacy.sections.contact.email")}</p>
        </Section>
      </div>
    </DashboardLayout>
  );
}
