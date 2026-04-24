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
