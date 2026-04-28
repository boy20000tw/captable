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
    version: "2.10.0",
    date: "2026-04-28",
    type: "minor",
    title: "Privacy Policy + Terms of Service 法律頁面",
    description: "新增 /privacy 隱私權政策與 /terms 服務條款頁面，完整雙語 i18n。Sidebar footer 新增 Privacy · Terms · © 2026 Caploom 連結列。Settings 側邊欄新增 Legal 入口。登入頁底部新增法律連結。所有角色皆可查閱法律頁面。",
  },
  {
    version: "2.9.0",
    date: "2026-04-28",
    type: "minor",
    title: "完整角色權限控管 (RBAC)",
    description: "六種公司角色（Owner / Admin / CFO / Lawyer / Investor / Viewer）各自擁有獨立的側邊欄、可訪問路由與操作權限。新增 shared/rolePermissions.ts 作為單一權限定義來源，RoleGuard 負責路由層級重導，ActionGuard 負責按鈕層級隱藏。Investor 登入後自動跳轉 Investor Portal。後端 mutation 已驗證皆有正確的 procedure guard。",
  },
  {
    version: "2.8.2",
    date: "2026-04-28",
    type: "patch",
    title: "Header 新增 Sign Out 圖示按鈕",
    description: "Desktop header 右上角新增 LogOut icon 按鈕，點擊即登出。Logout 現在同時出現在右上角 header 與左側 sidebar Account 兩處。CompanySwitcher 的 Sign out 文字也改用 i18n。",
  },
  {
    version: "2.8.1",
    date: "2026-04-28",
    type: "patch",
    title: "修復邀請加入後狀態停留 Pending 的問題",
    description: "Join 頁面原本僅做 read-only 驗證，未呼叫 acceptInvitation mutation 更新 DB。新增 useEffect 於使用者驗證 + 邀請有效時自動觸發 mutation，將 invitation status 更新為 accepted 並加入 company_members。新增接受中 / 失敗 UI 狀態與雙語 i18n。",
  },
  {
    version: "2.8.0",
    date: "2026-04-28",
    type: "minor",
    title: "Pricing 月付/年付切換 — 年繳 9 折優惠",
    description: "Pricing 頁面新增月付/年付 toggle switch，預設月付。切換至年付時自動計算 9 折價：Standard NT$269/月（年繳 NT$3,228，省 NT$360）、Plus NT$629/月（年繳 NT$7,548，省 NT$840）。綠色 badge 顯示「省 10%」，每張卡片下方顯示年繳總額與節省金額。Starter/Enterprise 不受影響。全站雙語 i18n。",
  },
  {
    version: "2.7.2",
    date: "2026-04-28",
    type: "patch",
    title: "電子簽名移回 Standard + 移除發送次數限制",
    description: "電子簽名從 Plus 移回 Standard（3 模板），Plus 升級為無限模板。移除 esignSendsPerMonth 限制（發送次數由 DocuSeal 管理，平台無法控制），僅保留模板數量限制。COMPARISON_TABLE 移除 esignSends 行，Subscription 用量改為顯示模板數。",
  },
  {
    version: "2.7.1",
    date: "2026-04-28",
    type: "patch",
    title: "用量限制下修 + 資料匯出 Starter 關閉",
    description: "公司數下修：Standard 1 間、Plus 3 間。股東人數下修：Starter 5 位、Standard 15 位、Plus 無限。資料匯出（PDF/Excel）從 Starter 移除，Standard 以上才有。同步更新 plans.ts limits + COMPARISON_TABLE、Pricing/Subscription i18n（EN/zh-TW）。",
  },
  {
    version: "2.7.0",
    date: "2026-04-28",
    type: "minor",
    title: "台幣定價策略 — NT$299/699 + 功能重新分配",
    description: "定價全面改為台幣計價：Starter NT$0、Standard NT$299/月（🔥 主打）、Plus NT$699/月（Anchor）、Enterprise 聯繫銷售。功能重新分配：Standard 著重無限股東、基本稀釋、台灣合規；Plus 升級為情境模擬、DCF、電子簽名（5 模板 30 次/月）、投資人入口；Enterprise 含 SSO、API、客製匯入。同步更新 COMPARISON_TABLE、Pricing 四欄、Subscription 用量限制、EN/zh-TW i18n。",
  },
  {
    version: "2.6.0",
    date: "2026-04-28",
    type: "minor",
    title: "DocuSeal 帳號串接 — Per-Company API Key + 引導流程",
    description: "eSignature 頁面新增帳號連線引導：未連結時顯示三步驟流程（註冊 DocuSeal → 複製 API Key → 貼上連線）。後端 docuseal.ts 重構為 per-company API key 架構，每間公司可獨立連結自己的 DocuSeal 帳號。新增 connect/disconnect/connectionStatus 三個 tRPC endpoint，API Key 存入 DB 前先驗證有效性。Header 顯示連線狀態 badge 與斷開連結功能。全站雙語 i18n。",
  },
  {
    version: "2.5.2",
    date: "2026-04-28",
    type: "patch",
    title: "合規功能分級調整 — 台灣合規→Standard，美國合規→Plus",
    description: "因主要 TA 為台灣新創，將技術股課稅與閉鎖性公司功能從 Plus 移至 Standard；409A 與 83(b) 從 Standard 移至 Plus（擴展美國市場階段）。同步更新 plans.ts feature sets、Compare Plans 比較表、Pricing 頁面 i18n。",
  },
  {
    version: "2.5.1",
    date: "2026-04-28",
    type: "patch",
    title: "修復舊方案值導致的 Runtime Crash",
    description: "新增 normalizePlan() 輔助函數，將 DB 中舊的方案值（free/paid/custom）自動對應至新的四級方案（starter/standard/enterprise）。修復 SubscriptionBadge、FeatureGate、Pricing、Subscription、Admin 頁面及 server context 共 8 處讀取 plan 值的位置，防止未知值導致 undefined 存取錯誤。",
  },
  {
    version: "2.5.0",
    date: "2026-04-28",
    type: "minor",
    title: "四級訂閱方案重構 — Starter / Standard / Plus / Enterprise",
    description: "訂閱方案從 Free/Pro/Enterprise 三級改為 Starter/Standard/Plus/Enterprise 四級。Standard 含限制模板電子簽名（3 模板、30 次/月）、瀑布分析、投資人入口；Plus 解鎖無限模板、DCF 預測、反稀釋模型、台灣合規；Enterprise 含 SSO、API、專屬客戶經理。DB enum、plans.ts、Pricing 四欄、Compare Plans 五欄、FeatureGate、SubscriptionBadge、Admin 面板全站更新。",
  },
  {
    version: "2.4.0",
    date: "2026-04-28",
    type: "minor",
    title: "Landing Page Quick Start Guide — 新手引導流程",
    description: "重新設計空白狀態首頁：新增 5 步驟 Quick Start 指引（公司設定 → 投資人 → 募資輪次 → ESOP → Cap Table），附帶步驟編號、垂直連接線與 hover CTA。底部提示列含 Excel 匯入捷徑。下方保留 3×3 功能探索卡片。全站雙語 i18n。",
  },
  {
    version: "2.3.0",
    date: "2026-04-28",
    type: "minor",
    title: "Help & Support — FAQ + Feedback + 聯繫客服",
    description: "新增 /help 頁面含三個分頁：分類 FAQ（帳戶/訂閱/股權/技術/一般）含搜尋；意見回饋表單（feedback/feature request/bug）；聯繫客服表單（帳單/技術/客製化需求）含優先級。Header 新增問號 icon。Support tickets 存入 DB 並在 Admin Panel 新增工單管理頁。全站雙語 i18n（support namespace）。",
  },
  {
    version: "2.2.1",
    date: "2026-04-28",
    type: "patch",
    title: "Pricing / Compare Plans 頁面拆分",
    description: "將原本合併在 Pricing 頁的功能比較表拆為獨立 /compare-plans 頁面。Subscription 頁「比較方案」按鈕導向 /compare-plans，「變更方案」導向 /pricing。FeatureGate overlay 同步更新連結。",
  },
  {
    version: "2.2.0",
    date: "2026-04-28",
    type: "minor",
    title: "訂閱方案功能分級 — Feature Gating + 用量限制",
    description: "新增 shared/plans.ts 定義三級方案功能矩陣與用量上限。後端 planGuard middleware 攔截受限 API（14 個模組）；前端 FeatureGate 元件對 16 個頁面加上模糊升級覆蓋層。Pricing 頁新增完整功能比較表，Subscription 頁新增「比較方案」按鈕。Create 操作（股東、ESOP、公司、團隊邀請）加入用量檢查。",
  },
  {
    version: "2.1.0",
    date: "2026-04-28",
    type: "minor",
    title: "訂閱方案 — Badge + Pricing + Subscription 頁面",
    description: "右上角 Header 新增方案 Badge（Free/Pro/Enterprise），點擊進入訂閱管理頁。新增 Pricing 三欄比較頁（功能清單、升級 CTA）與 Subscription 管理頁（目前方案、使用量進度條、帳單區塊）。全站雙語 i18n（subscription namespace）。",
  },
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
