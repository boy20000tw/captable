/**
 * Caploom Changelog — single source of truth for versioning.
 *
 * HOW TO UPDATE:
 *   1. Add a new entry at the TOP of the `CHANGELOG` array
 *   2. Bump the version number following semver:
 *      - major: platform architecture redesign (1.x → 2.x)
 *      - minor: new feature (+0.1.0)
 *      - patch: bug fix / tweak (+0.0.1)
 *   3. The frontend reads CHANGELOG[0] to display the current version
 */

export type ChangelogEntry = {
  version: string;          // "1.4.0"
  date: string;             // "2026-04-24"
  type: "major" | "minor" | "patch";
  title: string;            // short headline
  description: string;      // 1-2 sentence summary
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.0.0",
    date: "2026-04-28",
    type: "major",
    title: "Layout 重構 — Content Header + Sidebar 精簡",
    description: "新增內容區頂部 Header Bar：Caploom logo、Admin Panel、語言切換、通知鈴鐺、登出。Sidebar Header 改為 CompanySwitcher（左）+ 收合按鈕（右）+ 使用者資訊（從 footer 上移）。Sidebar Footer 精簡為僅 VersionBadge。Mobile header 維持不變。",
  },
  {
    version: "1.23.2",
    date: "2026-04-28",
    type: "patch",
    title: "ClosedCompany 配置統一 + Rounds i18n 修復",
    description: "閉鎖性公司管理頁面改為與其他頁面一致的配置（p-8 max-w-6xl、inline icon、semantic token）。募資輪次頁面完成全欄位 i18n：新增 fundraising namespace hook、表格標頭、對話框、表單欄位、狀態 Badge、toast 訊息、刪除確認等全部改用 t() 呼叫。",
  },
  {
    version: "1.23.1",
    date: "2026-04-28",
    type: "patch",
    title: "ESOP 頁面 i18n 修復",
    description: "修復 ESOP 頁面 50+ 個硬編碼英文字串未連接翻譯系統的問題。KPI 卡片、表格標題、對話框、表單欄位、空白狀態、toast 訊息、行使流程等全部改用 t() 呼叫。新增 70 個 esop.* 翻譯鍵至 equity namespace。語言切換現在完整涵蓋 ESOP 所有 UI 元素。",
  },
  {
    version: "1.23.0",
    date: "2026-04-27",
    type: "minor",
    title: "i18n Phase 6 — 剩餘頁面 + 共用元件全站翻譯完成",
    description: "完成全站 i18n：Home Dashboard、EstimatedValuation、ShareClasses、Join、NotFound 五個頁面，以及 AllocationDialog、CompanySwitcher、NotificationBell、ChangelogDrawer、VestingTimeline 五個共用元件。新增 200+ 翻譯鍵至 pages / common namespace，涵蓋 KPI 卡片、圖表、漏斗、空白狀態、功能卡片、表單欄位等所有 UI 文字。全站零硬編碼字串。",
  },
  {
    version: "1.22.0",
    date: "2026-04-27",
    type: "minor",
    title: "i18n Phase 5 — Settings & Admin 全模組翻譯",
    description: "新增 settings / admin 兩個 namespace，完成 7 個頁面全欄位 i18n：AuditLog、Import、Team、Snapshots、AdminOverview、AdminCompanies、AdminActivity。稽核日誌、資料匯入、角色權限、團隊管理、快照操作、平台管理等 150+ 個翻譯鍵皆支援語言切換。",
  },
  {
    version: "1.21.0",
    date: "2026-04-27",
    type: "minor",
    title: "i18n Phase 4 — Equity, Fundraising & Analysis 全模組翻譯",
    description: "新增 equity / fundraising / analysis 三個 namespace，完成 12 個頁面全欄位 i18n：CapTable、ShareRegister、ESOP、ESign、FundingRounds、RoundDetail、Investors、Instruments、Waterfall、Valuation、Projections、AntiDilution。所有表單、表格、對話框、按鈕、模擬器皆支援語言切換。",
  },
  {
    version: "1.12.0",
    date: "2026-04-25",
    type: "minor",
    title: "Admin panel",
    description: "Platform admin backend — company management with subscription tiers (Free/Paid/Custom), audit log viewer, plan editor, suspend/reactivate, and admin activity tracking.",
  },
  {
    version: "1.11.0",
    date: "2026-04-25",
    type: "minor",
    title: "Navigation redesign",
    description: "Streamlined sidebar from 18 flat items to 6 collapsible groups — Dashboard, Equity, Fundraising, Analysis, Investor Portal, Settings — with auto-expanding active section.",
  },
  {
    version: "1.10.0",
    date: "2026-04-25",
    type: "minor",
    title: "Investor portal",
    description: "Dedicated read-only view for investors — see holdings by share class, ESOP vesting timeline, download share certificates, and track document signing status.",
  },
  {
    version: "1.9.0",
    date: "2026-04-25",
    type: "minor",
    title: "Share certificate PDF",
    description: "Generate formal share certificates from any issuance or ESOP exercise entry — includes company branding, certificate number, share details, and authorized signatory block.",
  },
  {
    version: "1.8.0",
    date: "2026-04-25",
    type: "minor",
    title: "Vesting schedule visualization",
    description: "Click any ESOP grant to expand an interactive vesting timeline — area chart with cliff/today markers, progress bar, and milestone cards.",
  },
  {
    version: "1.7.0",
    date: "2026-04-25",
    type: "minor",
    title: "ESOP exercise flow",
    description: "Exercise vested options into Common Stock with one click — atomically updates grant, writes to share register, and triggers cap table snapshot.",
  },
  {
    version: "1.6.0",
    date: "2026-04-25",
    type: "minor",
    title: "Investor portal",
    description: "投資人登入後可以查看持股、vesting 進度和文件簽署狀態。",
  },
  {
    version: "1.5.1",
    date: "2026-04-24",
    type: "patch",
    title: "Share class cleanup",
    description: "Removed ESOP from share class options — ESOP exercises into Common Stock. Corrected share class dropdown to show Common/Preferred only.",
  },
  {
    version: "1.5.0",
    date: "2026-04-24",
    type: "minor",
    title: "Data export",
    description: "Cap table PDF/Excel and share register Excel export with formatted workbooks, frozen headers, and dynamic share class names.",
  },
  {
    version: "1.4.0",
    date: "2026-04-24",
    type: "minor",
    title: "Share class management",
    description: "Define equity classes with preferred terms — liquidation multiple, participation type, anti-dilution, dividends, voting rights, and conversion ratio.",
  },
  {
    version: "1.3.0",
    date: "2026-04-24",
    type: "minor",
    title: "eSignature template library",
    description: "Two-layer template system: platform-wide templates for all companies and company-scoped templates for custom contracts.",
  },
  {
    version: "1.2.0",
    date: "2026-04-24",
    type: "minor",
    title: "DocuSeal eSignature",
    description: "Send equity documents for signing via DocuSeal — create templates from PDF/DOCX, track signing status, and receive webhook notifications.",
  },
  {
    version: "1.1.1",
    date: "2026-04-23",
    type: "patch",
    title: "Mobile responsive layout",
    description: "Bottom navigation bar, scrollable tables, and responsive grid layouts for mobile devices.",
  },
  {
    version: "1.1.0",
    date: "2026-04-22",
    type: "minor",
    title: "Instruments — SAFE & Convertible Notes",
    description: "Track SAFEs and convertible notes with conversion modeling, interest accrual, and batch conversion to equity.",
  },
  {
    version: "1.0.0",
    date: "2026-04-20",
    type: "major",
    title: "Caploom v1 launch",
    description: "Cap table, share register, funding rounds, investor pipeline, ESOP management, waterfall analysis, financial projections, and audit logging.",
  },
];

/** Current version — always the first entry. */
export const CURRENT_VERSION = CHANGELOG[0].version;
