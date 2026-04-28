import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";

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
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="h-px bg-foreground/20 w-16 mb-4" />
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
            >
              {t("privacy.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("privacy.lastUpdated", { date: lastUpdated })}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{t("privacy.intro")}</p>

        <div className="max-w-3xl space-y-6">

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
      </div>
    </DashboardLayout>
  );
}
