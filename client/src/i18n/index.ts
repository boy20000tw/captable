import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhTWCommon from "./locales/zh-TW/common.json";
import zhTWNav from "./locales/zh-TW/nav.json";
import zhTWPages from "./locales/zh-TW/pages.json";
import zhTWCompliance from "./locales/zh-TW/compliance.json";
import zhTWEquity from "./locales/zh-TW/equity.json";
import zhTWFundraising from "./locales/zh-TW/fundraising.json";
import zhTWAnalysis from "./locales/zh-TW/analysis.json";
import zhTWSettings from "./locales/zh-TW/settings.json";
import zhTWAdmin from "./locales/zh-TW/admin.json";
import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enPages from "./locales/en/pages.json";
import enCompliance from "./locales/en/compliance.json";
import enEquity from "./locales/en/equity.json";
import enFundraising from "./locales/en/fundraising.json";
import enAnalysis from "./locales/en/analysis.json";
import enSettings from "./locales/en/settings.json";
import enAdmin from "./locales/en/admin.json";
import enSubscription from "./locales/en/subscription.json";
import enSupport from "./locales/en/support.json";

import zhTWSubscription from "./locales/zh-TW/subscription.json";
import zhTWSupport from "./locales/zh-TW/support.json";

const LANG_KEY = "caploom-lang";

i18n.use(initReactI18next).init({
  resources: {
    "zh-TW": {
      common: zhTWCommon,
      nav: zhTWNav,
      pages: zhTWPages,
      compliance: zhTWCompliance,
      equity: zhTWEquity,
      fundraising: zhTWFundraising,
      analysis: zhTWAnalysis,
      settings: zhTWSettings,
      admin: zhTWAdmin,
      subscription: zhTWSubscription,
      support: zhTWSupport,
    },
    en: {
      common: enCommon,
      nav: enNav,
      pages: enPages,
      compliance: enCompliance,
      equity: enEquity,
      fundraising: enFundraising,
      analysis: enAnalysis,
      settings: enSettings,
      admin: enAdmin,
      subscription: enSubscription,
      support: enSupport,
    },
  },
  lng: localStorage.getItem(LANG_KEY) || "zh-TW",
  fallbackLng: "en",
  ns: ["common", "nav", "pages", "compliance", "equity", "fundraising", "analysis", "settings", "admin", "subscription", "support"],
  defaultNS: "common",
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

// Persist language choice on change
i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
