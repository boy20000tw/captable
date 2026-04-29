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
