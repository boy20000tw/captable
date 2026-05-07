/**
 * Demo Seed: Meeting-Status Investors + Activities
 * ─────────────────────────────────────────────────
 * Run: DATABASE_URL=... npx tsx scripts/seed-meeting-investors.ts
 *
 * Creates 5 Individual investors (status = meeting) with diverse activities
 * to showcase the Board (Kanban) and Calendar views.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// ─── 5 Individual Investors ─────────────────────────────────────────────────
const meetingInvestors = [
  {
    name: "陳醫師",
    aka: "Dr. Chen",
    email: "dr.chen@biohealth.tw",
    phone: "+886-912-100-001",
    nationality: "TW",
    notes: "連鎖診所負責人，對 AI 醫療影像興趣高。已透過校友會引薦。",
    website: "https://biohealth-clinic.tw",
  },
  {
    name: "黃創投合夥人",
    aka: "James Huang",
    email: "james.huang@appworks.vc",
    phone: "+886-912-100-002",
    nationality: "TW",
    notes: "AppWorks 合夥人，專注 B2B SaaS。曾投資多家台灣新創 Series A。",
    website: "https://appworks.tw",
    linkedinUrl: "https://linkedin.com/in/jameshuang",
  },
  {
    name: "王天使投資人",
    aka: "Angela Wang",
    email: "angela.wang@gmail.com",
    phone: "+886-933-200-003",
    nationality: "TW",
    notes: "半導體業退休高管，個人天使投資經驗豐富，偏好醫療+AI。",
  },
  {
    name: "田中太郎",
    aka: "Tanaka",
    email: "tanaka@med-fund.jp",
    phone: "+81-90-1234-5678",
    nationality: "JP",
    notes: "日本醫療基金個人 LP，正在尋找台灣 Biotech 投資機會。",
    website: "https://med-fund.jp",
    linkedinUrl: "https://linkedin.com/in/tanaka-taro",
  },
  {
    name: "李家豪",
    aka: "Kevin Li",
    email: "kevin.li@startuphub.sg",
    phone: "+65-9876-5432",
    nationality: "SG",
    notes: "新加坡早期基金 scout，上月新竹 Demo Day 認識。對 digital health 有興趣。",
  },
];

// ─── Activity templates per investor ────────────────────────────────────────
// Designed to cover all 8 activity types and show variety in the calendar.
type ActivityDef = {
  type: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueOffsetDays: number; // relative to today; negative = past, positive = future
  status: "pending" | "completed";
};

const today = new Date();
function offsetDate(days: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
}

const investorActivities: Record<number, ActivityDef[]> = {
  // 陳醫師 — 3 activities
  0: [
    { type: "meeting", title: "初次面談：產品 Demo + 投資意向", description: "在竹北辦公室安排 1 小時產品展示，準備 pitch deck v3 和 financial model。", priority: "high", dueOffsetDays: -3, status: "completed" },
    { type: "follow_up", title: "寄出 Data Room 連結 + NDA", description: "陳醫師要求看更詳細的技術架構和 IP 資料。準備 DocuSeal NDA 後發送 data room 邀請。", priority: "high", dueOffsetDays: 2, status: "pending" },
    { type: "call", title: "電話確認投資意向 & 額度", description: "上次 Demo 後反應正面，電話跟進確認參與意願和可能的投資金額（預期 NT$3-5M）。", priority: "medium", dueOffsetDays: 7, status: "pending" },
  ],
  // 黃創投合夥人 — 3 activities
  1: [
    { type: "meeting", title: "AppWorks 辦公室拜訪 — Partner Meeting", description: "週二下午 2:00 前往 AppWorks 辦公室，與 James 和另一位 Partner 做正式 pitch。攜帶完整 financial model。", priority: "high", dueOffsetDays: 1, status: "pending" },
    { type: "document", title: "準備 Term Sheet 草稿", description: "根據上次電話討論的條件（pre-money NT$80M, 10% equity），準備 term sheet 初稿讓律師審閱。", priority: "high", dueOffsetDays: 5, status: "pending" },
    { type: "email", title: "回覆 Due Diligence 問題清單", description: "James 寄來 15 題 DD 問題，涵蓋財報、客戶合約、技術專利。需與 CTO 和會計確認後回覆。", priority: "medium", dueOffsetDays: -1, status: "completed" },
  ],
  // 王天使投資人 — 3 activities
  2: [
    { type: "discussion", title: "午餐會 — 討論產業趨勢 & 投資哲學", description: "在新竹遠東巨城的餐廳午餐，聊產業趨勢為主，順便介紹公司近況。較軟性的交流。", priority: "medium", dueOffsetDays: -5, status: "completed" },
    { type: "note", title: "Angela 對估值有疑慮 — 需要更多 traction 數據", description: "午餐會後筆記：Angela 認為現階段估值偏高，建議下一季有更多客戶數據後再談。可能需要 bridge round 方案。", priority: "low", dueOffsetDays: -5, status: "completed" },
    { type: "follow_up", title: "寄送 Q1 業績更新 email", description: "Angela 要求看到 Q1 的 MRR 成長和新客戶數，月底前整理好寄給她。", priority: "medium", dueOffsetDays: 10, status: "pending" },
  ],
  // 田中太郎 — 2 activities
  3: [
    { type: "call", title: "Video Call — 產品英文簡報 + Q&A", description: "透過 Google Meet 做 45 分鐘英文簡報。Tanaka 會帶翻譯。準備英文版 pitch deck。", priority: "high", dueOffsetDays: 3, status: "pending" },
    { type: "email", title: "寄送英文版 Executive Summary", description: "Tanaka 要求 2 頁英文摘要，包含市場規模、競爭優勢、財務預測。已完成初稿，請 co-founder 校閱。", priority: "medium", dueOffsetDays: -2, status: "completed" },
  ],
  // 李家豪 — 3 activities
  4: [
    { type: "meeting", title: "Demo Day 後續 — Coffee Chat", description: "在竹北星巴克喝咖啡，Kevin 對產品很有興趣，想了解更多技術細節和 go-to-market 策略。", priority: "medium", dueOffsetDays: -7, status: "completed" },
    { type: "discussion", title: "與 Kevin 的基金 GP 安排電話會議", description: "Kevin 表示願意引薦給基金 GP。需要準備一份精簡的投資備忘錄（investment memo）。", priority: "high", dueOffsetDays: 4, status: "pending" },
    { type: "other", title: "整理 Kevin 提供的 SG 市場進入建議", description: "Kevin 分享了新加坡 MedTech 法規和市場進入策略的筆記，整理成內部參考文件。", priority: "low", dueOffsetDays: 8, status: "pending" },
  ],
};

async function main() {
  // Get companyId from existing data
  const existing = await sql`SELECT "companyId" FROM investors LIMIT 1`;
  if (existing.length === 0) { console.error("❌ No existing investors, cannot determine companyId"); process.exit(1); }
  const companyId = existing[0].companyId;

  // Get userId for activities (pick first user)
  const users = await sql`SELECT id FROM users WHERE "companyId" = ${companyId} LIMIT 1`;
  if (users.length === 0) { console.error("❌ No users found"); process.exit(1); }
  const userId = users[0].id;

  console.log(`companyId=${companyId}, userId=${userId}\n`);

  let createdInvestors = 0;
  let createdActivities = 0;

  for (let i = 0; i < meetingInvestors.length; i++) {
    const inv = meetingInvestors[i];

    // Check if already exists
    const dup = await sql`SELECT id FROM investors WHERE name = ${inv.name} AND "companyId" = ${companyId}`;
    let investorId: number;

    if (dup.length > 0) {
      investorId = dup[0].id;
      console.log(`⚠️ ${inv.name} already exists (id=${investorId}), skipping insert`);
    } else {
      const [row] = await sql`
        INSERT INTO investors ("companyId", name, "entityKind", status, email, phone, nationality, notes, website, "linkedinUrl", aka, "lastContactAt")
        VALUES (
          ${companyId}, ${inv.name}, 'individual', 'meeting',
          ${inv.email}, ${inv.phone}, ${inv.nationality},
          ${inv.notes}, ${(inv as any).website ?? null}, ${(inv as any).linkedinUrl ?? null},
          ${inv.aka}, ${offsetDate(-3)}
        )
        RETURNING id
      `;
      investorId = row.id;
      createdInvestors++;
      console.log(`✅ Created: ${inv.name} (${inv.aka}) → id=${investorId}, status=meeting`);
    }

    // Create activities
    const activities = investorActivities[i];
    for (const act of activities) {
      const dueDate = offsetDate(act.dueOffsetDays);
      const completedAt = act.status === "completed" ? dueDate : null;

      const [aRow] = await sql`
        INSERT INTO investor_activities ("companyId", "investorId", "userId", type, title, description, "dueDate", status, priority, "completedAt")
        VALUES (
          ${companyId}, ${investorId}, ${userId},
          ${act.type}, ${act.title}, ${act.description},
          ${dueDate}, ${act.status}, ${act.priority}, ${completedAt}
        )
        RETURNING id
      `;
      const statusIcon = act.status === "completed" ? "✓" : "○";
      console.log(`   ${statusIcon} [${act.type}] ${act.title} (due: ${dueDate.toISOString().slice(0, 10)})`);
      createdActivities++;
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Investors created: ${createdInvestors}`);
  console.log(`  Activities created: ${createdActivities}`);

  const total = await sql`SELECT count(*) as cnt FROM investors WHERE "companyId" = ${companyId} AND status = 'meeting'`;
  console.log(`  Total "meeting" investors: ${total[0].cnt}`);
  console.log("\n🎉 Done!");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
