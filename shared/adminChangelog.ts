/**
 * Admin Panel (MintPanel) Changelog — 管理者平台版本紀錄。
 *
 * 與平台 changelog.ts 獨立，僅記錄 Admin Panel 的功能變更。
 *
 * HOW TO UPDATE:
 *   1. Add a new entry at the TOP of the `ADMIN_CHANGELOG` array
 *   2. Bump the version number following semver
 *   3. The Admin Panel reads ADMIN_CHANGELOG[0] as current version
 */

export type AdminChangelogEntry = {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
};

export const ADMIN_CHANGELOG: AdminChangelogEntry[] = [
  {
    version: "1.13.1",
    date: "2026-05-13",
    type: "patch",
    title: "Admin Team — Super Admin 可管理其他 Super Admin",
    titleEn: "Admin Team — Super Admin Can Manage Other Super Admins",
    description: "修正 Admin Team 頁面權限邏輯：Super Admin 現在可以 Edit/Remove 其他 Super Admin。Transfer 仍僅對非 Super Admin 顯示（已是 Super Admin 無需轉移）。",
    descriptionEn: "Fixed Admin Team permission logic: Super Admin can now Edit/Remove other Super Admins. Transfer remains hidden for existing Super Admins since transfer is unnecessary.",
  },
  {
    version: "1.13.0",
    date: "2026-05-13",
    type: "minor",
    title: "獨立 Admin 登入 + Super Admin 新增支援",
    titleEn: "Independent Admin Login + Super Admin Role Support",
    description: "新增 /admin/login 獨立登入頁，Admin 不需前台帳號即可登入。支援 email 預建帳號、首次 Clerk 登入自動綁定 openId。Add Admin 對話框與 API 新增 Super Admin 角色選項。修復 adminCreateUser 因 lastSignedIn null 導致建帳失敗的問題。",
    descriptionEn: "Added standalone /admin/login page — admins no longer need a frontend account. Supports pre-provisioned admin accounts by email with automatic openId binding on first Clerk login. Add Admin dialog and API now support Super Admin role. Fixed adminCreateUser failure caused by lastSignedIn null violating NOT NULL constraint.",
  },
  {
    version: "1.12.0",
    date: "2026-05-07",
    type: "minor",
    title: "版本紀錄整合 — 同時顯示前臺與後臺 Changelog",
    titleEn: "Unified Version Log — Display Both Frontend & Admin Changelogs",
    description: "Admin 版本紀錄頁面改為 Tab 切換，同時顯示前臺（Platform）與後臺（Admin Panel）兩份 Changelog。Overview 頁面同時展示兩者最新版本。",
    descriptionEn: "Admin Version Log page now uses tabs to display both Platform and Admin Panel changelogs side by side. Overview page shows latest version from both changelogs.",
  },
  {
    version: "1.11.0",
    date: "2026-05-07",
    type: "minor",
    title: "廣播通知管理 — 平台級公告推送",
    titleEn: "Broadcast Notifications — Platform-Wide Announcements",
    description: "新增後臺廣播通知功能：管理員可向所有公司發送站內 / Email / 雙管道通知。含發送表單、頻道選擇、歷史記錄。",
    descriptionEn: "Added broadcast notification feature: admins can send in-app/email/both notifications to all companies. Includes send form, channel selection, and broadcast history.",
  },
  {
    version: "1.10.0",
    date: "2026-05-04",
    type: "minor",
    title: "公司刪除功能 — 含確認保護",
    titleEn: "Delete Company — With Confirmation Protection",
    description: "平台管理員可永久刪除公司，需輸入完整公司名稱確認。刪除涵蓋所有業務資料、團隊成員、加密金鑰。操作記錄於稽核日誌。",
    descriptionEn: "Platform admins can permanently delete companies with full name confirmation. Deletion cascades through all business data, team members, and encryption keys. Logged to audit trail.",
  },
  {
    version: "1.9.0",
    date: "2026-04-30",
    type: "minor",
    title: "平台範本管理 — 電子簽名範本統一管控",
    titleEn: "Platform Template Management — Unified eSign Template Control",
    description: "Admin Panel 新增 Templates 頁面。管理員可上傳、編輯、刪除合約範本，依文件類型分類、設定最低方案門檻。公司端依訂閱方案即時可見對應範本。",
    descriptionEn: "Added Templates page to Admin Panel. Admins can upload, edit, and delete contract templates with document type classification and minimum plan requirements. Companies see templates based on their subscription tier.",
  },
  {
    version: "1.8.0",
    date: "2026-04-29",
    type: "minor",
    title: "Security Phase 5 — 金鑰輪替與稽核 UI",
    titleEn: "Security Phase 5 — Key Rotation & Audit UI",
    description: "安全頁面新增平台 DEK 輪替按鈕（僅 Super Admin），所有階段狀態更新為已完成。輪替操作自動記錄至 admin audit log。",
    descriptionEn: "Added platform DEK rotation button on Security page (super_admin only). All 5 phases marked completed. Rotation operations are auto-logged to admin audit log.",
  },
  {
    version: "1.7.0",
    date: "2026-04-29",
    type: "minor",
    title: "Security Phase 4 — DocuSeal 密鑰加密",
    titleEn: "Security Phase 4 — DocuSeal Secret Encryption",
    description: "DocuSeal API 金鑰與 webhook secret 加入 AES-256-GCM 加密雙寫。",
    descriptionEn: "Added AES-256-GCM dual-write encryption for DocuSeal API key and webhook secret.",
  },
  {
    version: "1.6.0",
    date: "2026-04-29",
    type: "minor",
    title: "Security Phase 3 — 核心交易金額加密雙寫",
    titleEn: "Security Phase 3 — Financial Data Encryption (Dual-Write)",
    description: "allocations / shareRegisterEntries / instruments / shareTransfers 核心交易表的金額與股數欄位加入 AES-256-GCM 加密雙寫（22 個欄位）。",
    descriptionEn: "Added AES-256-GCM dual-write encryption for 22 financial fields across allocations, share register entries, instruments, and share transfers tables.",
  },
  {
    version: "1.5.0",
    date: "2026-04-29",
    type: "minor",
    title: "Security Phase 2 — PII 欄位級加密雙寫",
    titleEn: "Security Phase 2 — PII Field-Level Encryption (Dual-Write)",
    description: "users / companies / shareholders / investors 的 PII 欄位加入 AES-256-GCM 加密雙寫模式。新增 platform DEK 與 blind index 支援加密後 email 查詢。",
    descriptionEn: "Added AES-256-GCM dual-write encryption for PII fields across users, companies, shareholders, and investors tables. Introduced platform DEK and blind index for encrypted email lookup.",
  },
  {
    version: "1.4.0",
    date: "2026-04-29",
    type: "minor",
    title: "Admin RBAC 精簡為 2 角色",
    titleEn: "Admin RBAC Simplified to 2 Roles",
    description: "移除 support/viewer 角色，僅保留 super_admin 與 admin。簡化權限矩陣與團隊管理 UI。",
    descriptionEn: "Removed support/viewer roles, keeping only super_admin and admin. Simplified permission matrix and team management UI.",
  },
  {
    version: "1.3.0",
    date: "2026-04-29",
    type: "minor",
    title: "RBAC 權限系統 + 團隊管理",
    titleEn: "RBAC Permission System + Team Management",
    description: "新增 4 角色 RBAC（super_admin/admin/support/viewer），Sidebar 依角色過濾。新增管理員團隊頁面：列表、新增/移除、角色變更、超管移轉。後端細粒度權限中介層。",
    descriptionEn: "Added 4-role RBAC (super_admin/admin/support/viewer) with sidebar filtering. New admin team page: list, add/remove, role change, super admin transfer. Granular backend permission middleware.",
  },
  {
    version: "1.2.0",
    date: "2026-04-29",
    type: "minor",
    title: "Header Bar + 語言切換 + 架構頁面",
    titleEn: "Header Bar + Language Toggle + Architecture Pages",
    description: "Admin Header 加入語言切換、登出、返回主站。新增安全隱私架構頁與金流串接架構頁。",
    descriptionEn: "Admin header with language toggle, sign out, back to app. Added Security & Privacy architecture page and Payment Integration architecture page.",
  },
  {
    version: "1.1.0",
    date: "2026-04-29",
    type: "minor",
    title: "Overview 豐富化 + 分組 Sidebar + 版本紀錄",
    titleEn: "Enriched Overview + Grouped Sidebar + Version Log",
    description: "Overview 新增統計卡片、方案分佈、快速操作、近期公司與活動。Sidebar 重構為 4 組導航。新增版本紀錄頁面。全頁面 padding 統一。",
    descriptionEn: "Overview with stat cards, plan distribution, quick actions, recent companies & activity. Sidebar restructured to 4 nav groups. Version log page. Unified page padding.",
  },
  {
    version: "1.0.0",
    date: "2026-04-22",
    type: "major",
    title: "Admin Panel 初始版本",
    titleEn: "Admin Panel Initial Release",
    description: "平台管理面板：公司管理（方案/停權）、客服工單、管理員活動日誌、Dashboard 總覽。",
    descriptionEn: "Platform admin panel: company management (plan/suspend), support tickets, admin activity log, dashboard overview.",
  },
];
