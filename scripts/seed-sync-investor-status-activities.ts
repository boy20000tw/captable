/**
 * Sync Investor Status from Allocations + Seed Activities
 * ────────────────────────────────────────────────────────
 * Run: source .env && npx tsx scripts/seed-sync-investor-status-activities.ts
 *
 * 1. Queries all investors whose allocation status is more advanced than
 *    their investor status → updates investor status accordingly.
 * 2. Adds realistic activities reflecting each investor's journey based
 *    on their allocation notes / timeline.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// Allocation status → target investor status
const ALLOC_TO_INVESTOR: Record<string, string> = {
  planned: "prospect",
  committed: "meeting",
  signed: "term_sheet",
  funded: "invested",
  issued: "invested",
};

// Investor status ordering
const STATUS_ORDER: Record<string, number> = {
  prospect: 0,
  meeting: 1,
  term_sheet: 2,
  invested: 3,
  passed: 4,
};

// ─── Activity definitions per investor (keyed by name) ──────────────────────
type Act = {
  type: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate: string;      // absolute date
  status: "pending" | "completed";
};

const activitiesByInvestor: Record<string, Act[]> = {
  "TaiwanGrowth Ventures": [
    { type: "meeting", title: "初次會議 — Vivian Lin Partner Meeting", description: "Vivian Lin (Partner) + Henry Su (Principal) 參與，30 分鐘產品 demo + 財務概況簡報。反應正面，要求提供 data room。", priority: "high", dueDate: "2026-03-12", status: "completed" },
    { type: "document", title: "簽署 NDA + 開放 Data Room 存取", description: "透過 DocuSeal 完成 NDA 簽署，開放完整 data room（財報、技術文件、IP、客戶合約）。", priority: "high", dueDate: "2026-03-18", status: "completed" },
    { type: "meeting", title: "第二次會議 — CTO + 工程主管深入技術 DD", description: "CTO 和工程主管一同參與，深入技術 due diligence，包含系統架構、AI 模型效能、資料安全措施。", priority: "high", dueDate: "2026-03-28", status: "completed" },
    { type: "note", title: "IC 回饋：估值接受，要求 1x non-participating LP", description: "投委會內部討論回饋：接受 NT$8.86 億 pre-money 估值，但希望加入 1x non-participating liquidation preference。需與律師討論。", priority: "medium", dueDate: "2026-04-15", status: "completed" },
    { type: "call", title: "Conference Call — Term Sheet 草稿交換", description: "雙方律師 + 創辦人 + Vivian 四方通話，討論 term sheet 主要條款。LP 條件基本達共識。", priority: "high", dueDate: "2026-04-28", status: "completed" },
    { type: "document", title: "簽署 Term Sheet", description: "預計完成 term sheet 簽署，鎖定 Lead 條件：NT$30M at NT$80/share, 1x non-participating LP。", priority: "high", dueDate: "2026-05-08", status: "pending" },
  ],

  "HealthTech Capital Asia": [
    { type: "meeting", title: "引薦會議 — 透過 Pre-A 股東牽線", description: "Pre-A 輪老股東引薦，與 Andrew Chen (Partner) 進行 30 分鐘線上簡報，介紹公司現況和 A 輪規劃。", priority: "medium", dueDate: "2026-03-25", status: "completed" },
    { type: "meeting", title: "Management Presentation — CEO 現場報告", description: "CEO 前往香港辦公室做 30 分鐘正式 management presentation，含財務預測、市場策略、競爭分析。", priority: "high", dueDate: "2026-04-10", status: "completed" },
    { type: "follow_up", title: "ESG / 法遵 Due Diligence 進行中", description: "HealthTech 要求額外的 ESG 和法規遵循審查。已提交台灣 TFDA、個資法相關合規文件。等待回覆。", priority: "medium", dueDate: "2026-04-26", status: "completed" },
    { type: "call", title: "第二輪 IC — 同步看 Lead Term Sheet", description: "HealthTech 希望在 IC 前看到 TaiwanGrowth 的 term sheet 條件，以決定是否跟投或 co-lead。估值偏好 NT$8 億需協調。", priority: "high", dueDate: "2026-05-12", status: "pending" },
  ],

  "BioMedex Partners": [
    { type: "call", title: "Zoom 初次接觸 — Partner Andrew Chen", description: "Andrew Chen 主動透過 LinkedIn 聯繫，安排 30 分鐘 Zoom 了解產品和技術。表達對 AI 醫療影像領域的興趣。", priority: "medium", dueDate: "2026-02-08", status: "completed" },
    { type: "meeting", title: "Bay Area 出差面談 — CEO + Andrew + Lisa Park", description: "CEO 赴 Bay Area 出差，在 BioMedex 辦公室做正式 pitch。Lisa Park (Principal) 也參與，問了很多技術和商業模式問題。", priority: "high", dueDate: "2026-03-15", status: "completed" },
    { type: "email", title: "KYC 文件提交 + DD 問答", description: "提交 BioMedex 要求的 KYC 文件和 15 題 DD 問答。涵蓋財報、客戶合約、專利狀態。", priority: "medium", dueDate: "2026-04-05", status: "completed" },
    { type: "call", title: "Verbal Commit — 確認跟 Lead 投 USD$500K", description: "Andrew 電話中確認將跟 Lead 條件投 USD$500K（約 NT$15M）。等 TaiwanGrowth term sheet 定案後 7 天內簽 SPA。", priority: "high", dueDate: "2026-04-22", status: "completed" },
    { type: "document", title: "準備 SPA — 等 Lead 定案後簽署", description: "律師已備好 SPA 草稿，待 TaiwanGrowth term sheet 確認後即可簽署。KYC 文件已齊全。", priority: "high", dueDate: "2026-05-15", status: "pending" },
  ],

  "林總 (個人天使)": [
    { type: "meeting", title: "創辦人引薦晚宴", description: "透過共同友人在晚宴上認識林總。林總是前 ABC 醫療集團 CEO，退休後做天使投資。對 AI 醫療很有興趣。", priority: "medium", dueDate: "2026-01-15", status: "completed" },
    { type: "meeting", title: "公司 Office Tour — 看實驗室 + 試用產品", description: "林總到公司參觀，看了實驗室和產品 demo。特別對醫院通路有想法，主動提出可以引薦北部三家醫學中心。", priority: "high", dueDate: "2026-02-28", status: "completed" },
    { type: "call", title: "電話確認 — 個人名義投 NT$5M", description: "林總電話確認將以個人名義投資 NT$5M。可協助北部三家醫學中心的採購引薦。", priority: "high", dueDate: "2026-04-20", status: "completed" },
    { type: "document", title: "線下簽認股書", description: "預計面對面簽署認股書，同步準備匯款資料。預計 5/20 完成入金。", priority: "high", dueDate: "2026-05-10", status: "pending" },
  ],

  "AsiaCare Fund I": [
    { type: "call", title: "新加坡 Deal Team 視訊會議", description: "與 AsiaCare 新加坡 deal team 進行初次視訊會議。Sarah Tan (CFO) 主持，了解公司概況和 A 輪條件。", priority: "medium", dueDate: "2026-02-20", status: "completed" },
    { type: "document", title: "IC 通過 + Term Sheet 簽署", description: "AsiaCare 投委會通過投資案，簽署 term sheet。金額 NT$15M。", priority: "high", dueDate: "2026-03-25", status: "completed" },
    { type: "email", title: "DD 文件交換 — 法律 + 財務審查", description: "完成法律和財務 due diligence 文件交換，AsiaCare 律師審閱合約。", priority: "medium", dueDate: "2026-04-10", status: "completed" },
    { type: "document", title: "SPA 雙方蓋章完成 (DocuSeal)", description: "透過 DocuSeal 完成 SPA 簽署。SPA 編號：SPA-AROUND-001。Contact: Sarah Tan (CFO)。", priority: "high", dueDate: "2026-04-30", status: "completed" },
    { type: "follow_up", title: "等待 LP Capital Call — 預計 5/15 前匯款", description: "SPA 已完成，等 LP capital call 程序完成後匯款。預計 2 週內（5/15 前）完成入金。", priority: "high", dueDate: "2026-05-15", status: "pending" },
  ],

  "王董家族辦公室": [
    { type: "meeting", title: "會計師事務所引薦", description: "透過會計師事務所引薦認識王董家族辦公室。初次會面了解投資偏好和決策流程。", priority: "medium", dueDate: "2026-03-01", status: "completed" },
    { type: "meeting", title: "王董本人 + 二代家屬參訪公司", description: "王董本人帶二代家屬一同參訪公司，看產品 demo 和未來規劃。二代對 AI 技術很感興趣。", priority: "high", dueDate: "2026-04-05", status: "completed" },
    { type: "note", title: "Family Office 內部決議通過 — NT$8M", description: "王董家族辦公室內部決議通過投資案，金額 NT$8M。分兩筆：王董本人 5M + 子女信託 3M。", priority: "high", dueDate: "2026-04-10", status: "completed" },
    { type: "document", title: "認股書簽署完成", description: "認股書簽署完成。下一步：分兩筆入金 — 王董本人 5M (5/8 前)、子女信託 3M (5/15 前)。子女信託需另準備受益人 KYC。", priority: "high", dueDate: "2026-04-29", status: "completed" },
    { type: "follow_up", title: "追蹤入金 — 王董 5M + 子女信託 3M", description: "追蹤兩筆入金進度：王董本人 5M 預計 5/8 前入帳，子女信託 3M 需完成受益人 KYC 後於 5/15 前入帳。", priority: "high", dueDate: "2026-05-08", status: "pending" },
  ],

  "陳醫師 (個人天使)": [
    { type: "meeting", title: "學會年會認識", description: "在醫學會年會上認識陳醫師。心臟科主治醫師，對 AI 醫療影像技術有很深的了解，主動表達投資興趣。", priority: "medium", dueDate: "2026-02-05", status: "completed" },
    { type: "discussion", title: "產品技術深入討論", description: "陳醫師作為臨床醫師，提出多項產品改進建議。討論 AI 模型在心臟影像的應用場景和精準度。", priority: "medium", dueDate: "2026-02-20", status: "completed" },
    { type: "call", title: "確認個人投資決定 — NT$3M", description: "陳醫師電話確認以私人名義投資 NT$3M。將以兆豐銀行帳戶匯款。", priority: "high", dueDate: "2026-03-10", status: "completed" },
    { type: "document", title: "認股書簽署", description: "完成認股書簽署。簽署日期 2026-04-18。", priority: "high", dueDate: "2026-04-18", status: "completed" },
    { type: "note", title: "全額匯款入帳 — NT$3M 到位", description: "陳醫師全額匯款 NT$3M 已入帳（兆豐銀行）。匯款憑證已存檔。等待董事會決議後發股。", priority: "high", dueDate: "2026-05-02", status: "completed" },
    { type: "follow_up", title: "董事會決議 → 發股 → 寫入 Share Register", description: "5/10 預計完成董事會決議，決議後即可發股並登記至 share register。", priority: "high", dueDate: "2026-05-10", status: "pending" },
  ],

  "Pacific Innovation Fund": [
    { type: "email", title: "老股東 Follow-on 意向確認", description: "Pre-A 老股東 Pacific Innovation Fund 主動表達 A 輪 follow-on 意向。金額 NT$2M。", priority: "medium", dueDate: "2026-01-10", status: "completed" },
    { type: "document", title: "投委會通過 — Follow-on NT$2M", description: "Pacific Innovation Fund 投委會通過 follow-on 投資案，金額 NT$2M，跟隨 A 輪條件。", priority: "high", dueDate: "2026-02-15", status: "completed" },
    { type: "document", title: "SPA 簽署完成", description: "SPA 簽署完成。條件與 A 輪主要投資人一致。", priority: "high", dueDate: "2026-03-20", status: "completed" },
    { type: "note", title: "入金完成 — NT$2M", description: "全額入金 NT$2M 完成。準備提交董事會決議發股。", priority: "high", dueDate: "2026-04-08", status: "completed" },
    { type: "note", title: "已發股 — Share Register 已登記", description: "董事會決議通過 + 已發股。已登記 share register，cap table 已反映。全流程完成。", priority: "medium", dueDate: "2026-04-15", status: "completed" },
  ],
};

async function main() {
  console.log("🔍 Querying investors with allocations...\n");

  // Get companyId
  const companies = await sql`SELECT id FROM companies LIMIT 1`;
  const companyId = companies[0].id;

  // Get userId for activities
  const users = await sql`SELECT "userId" AS id FROM company_members WHERE "companyId" = ${companyId} LIMIT 1`;
  const userId = users[0].id;

  console.log(`companyId=${companyId}, userId=${userId}\n`);

  // ━━━ Step 1: Update investor statuses based on allocation progress ━━━
  console.log("━━━ Step 1: Sync investor status from allocations ━━━");

  // Get the highest allocation status per investor
  const allocByInvestor = await sql`
    SELECT DISTINCT ON (a."investorId")
      a."investorId", a.status AS alloc_status,
      i.name, i.status AS investor_status
    FROM allocations a
    JOIN investors i ON i.id = a."investorId"
    WHERE a."companyId" = ${companyId}
    ORDER BY a."investorId",
      CASE a.status
        WHEN 'issued' THEN 5
        WHEN 'funded' THEN 4
        WHEN 'signed' THEN 3
        WHEN 'committed' THEN 2
        WHEN 'planned' THEN 1
      END DESC
  `;

  let statusUpdated = 0;
  for (const row of allocByInvestor) {
    const targetInvestorStatus = ALLOC_TO_INVESTOR[row.alloc_status];
    if (!targetInvestorStatus) continue;

    const currentOrder = STATUS_ORDER[row.investor_status] ?? 0;
    const targetOrder = STATUS_ORDER[targetInvestorStatus] ?? 0;

    if (targetOrder > currentOrder && row.investor_status !== "passed") {
      await sql`
        UPDATE investors
        SET status = ${targetInvestorStatus}, "updatedAt" = NOW()
        WHERE id = ${row.investorId}
      `;
      console.log(`  ✅ ${row.name}: ${row.investor_status} → ${targetInvestorStatus} (alloc: ${row.alloc_status})`);
      statusUpdated++;
    } else {
      console.log(`  ⏭️  ${row.name}: already ${row.investor_status} (alloc: ${row.alloc_status})`);
    }
  }
  console.log(`  Updated: ${statusUpdated} investor(s)\n`);

  // ━━━ Step 2: Add activities for funnel investors ━━━
  console.log("━━━ Step 2: Seeding activities ━━━");

  let totalActivities = 0;

  for (const [investorName, activities] of Object.entries(activitiesByInvestor)) {
    // Find investor id
    const inv = await sql`
      SELECT id FROM investors WHERE name = ${investorName} AND "companyId" = ${companyId} LIMIT 1
    `;
    if (inv.length === 0) {
      console.log(`  ⚠️ ${investorName} not found, skipping`);
      continue;
    }
    const investorId = inv[0].id;

    // Check if activities already exist
    const existingCount = await sql`
      SELECT COUNT(*) as cnt FROM investor_activities
      WHERE "investorId" = ${investorId} AND "companyId" = ${companyId}
    `;
    if (Number(existingCount[0].cnt) > 0) {
      console.log(`  ⏭️  ${investorName} already has ${existingCount[0].cnt} activities, skipping`);
      continue;
    }

    console.log(`  📋 ${investorName}:`);
    for (const act of activities) {
      const completedAt = act.status === "completed" ? act.dueDate : null;
      await sql`
        INSERT INTO investor_activities ("companyId", "investorId", "userId", type, title, description, "dueDate", status, priority, "completedAt")
        VALUES (
          ${companyId}, ${investorId}, ${userId},
          ${act.type}, ${act.title}, ${act.description},
          ${act.dueDate}, ${act.status}, ${act.priority}, ${completedAt}
        )
      `;
      const icon = act.status === "completed" ? "✓" : "○";
      console.log(`     ${icon} [${act.type}] ${act.title.slice(0, 40)}… (${act.dueDate})`);
      totalActivities++;
    }
  }

  console.log(`\n  Total activities created: ${totalActivities}`);

  // ━━━ Step 3: Update lastContactAt for all affected investors ━━━
  console.log("\n━━━ Step 3: Updating lastContactAt ━━━");
  for (const [investorName, activities] of Object.entries(activitiesByInvestor)) {
    const latestDate = activities
      .filter(a => a.status === "completed")
      .map(a => a.dueDate)
      .sort()
      .pop();
    if (!latestDate) continue;

    await sql`
      UPDATE investors SET "lastContactAt" = ${latestDate}, "updatedAt" = NOW()
      WHERE name = ${investorName} AND "companyId" = ${companyId}
    `;
  }
  console.log("  Done.\n");

  // ━━━ Summary ━━━
  console.log("━━━ Final investor status breakdown ━━━");
  const breakdown = await sql`
    SELECT status, COUNT(*) as cnt
    FROM investors WHERE "companyId" = ${companyId}
    GROUP BY status ORDER BY
      CASE status WHEN 'prospect' THEN 1 WHEN 'meeting' THEN 2 WHEN 'term_sheet' THEN 3 WHEN 'invested' THEN 4 WHEN 'passed' THEN 5 END
  `;
  for (const row of breakdown) {
    console.log(`  ${row.status}: ${row.cnt}`);
  }

  console.log("\n🎉 Done!");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
