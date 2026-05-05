/**
 * Seed demo allocations for A Round funnel demonstration.
 * Creates 8 fictional investors (mix of institutional + individual) and
 * distributes allocations across all 5 lifecycle stages.
 *
 * Run with:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-allocation-funnel.ts
 */
import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}
const sql = neon(dbUrl);

const COMPANY_ID = 1;
const A_ROUND_ID = 36;
const PRICE_PER_SHARE = 80;
const SHARE_CLASS = "series_a";

type EntityKind = "individual" | "entity";
type AllocStatus = "planned" | "committed" | "signed" | "funded" | "issued";

interface InvestorSeed {
  name: string;
  entityKind: EntityKind;
  email: string;
  phone: string;
  nationality: string;
  website?: string;
  linkedinUrl?: string;
  firstContactAt: string;
  lastContactAt: string;
  notes: string;
}

interface AllocSeed {
  investorName: string;
  amountNtd: number;
  status: AllocStatus;
  plannedAt?: string;
  committedAt?: string;
  signedAt?: string;
  fundedAt?: string;
  issuedAt?: string;
  notes: string;
}

const investors: InvestorSeed[] = [
  {
    name: "TaiwanGrowth Ventures",
    entityKind: "entity",
    email: "deals@taiwangrowth.vc",
    phone: "+886-2-2700-1234",
    nationality: "TW",
    website: "https://taiwangrowth.vc",
    firstContactAt: "2026-03-12",
    lastContactAt: "2026-04-28",
    notes: "Lead candidate. Partner: Vivian Lin. 已簽 NDA、已交完整 data room。",
  },
  {
    name: "HealthTech Capital Asia",
    entityKind: "entity",
    email: "ir@healthtechcap.com",
    phone: "+852-2522-9988",
    nationality: "HK",
    website: "https://healthtechcap.com",
    firstContactAt: "2026-03-25",
    lastContactAt: "2026-04-26",
    notes: "Tier-2 healthcare fund. Co-lead potential. Partner: Andrew Chen.",
  },
  {
    name: "BioMedex Partners",
    entityKind: "entity",
    email: "partners@biomedex.com",
    phone: "+1-650-555-0182",
    nationality: "US",
    website: "https://biomedex.com",
    firstContactAt: "2026-02-08",
    lastContactAt: "2026-04-22",
    notes: "Bay Area healthcare fund，已口頭承諾 follow Lead 的 term sheet。",
  },
  {
    name: "林總 (個人天使)",
    entityKind: "individual",
    email: "lin.ceo@example.com",
    phone: "+886-912-345-100",
    nationality: "TW",
    linkedinUrl: "https://linkedin.com/in/lin-angel",
    firstContactAt: "2026-01-15",
    lastContactAt: "2026-04-20",
    notes: "前 ABC 醫療集團 CEO，有醫院通路資源。已口頭承諾 NT$5M。",
  },
  {
    name: "AsiaCare Fund I",
    entityKind: "entity",
    email: "deals@asiacare.fund",
    phone: "+65-6555-0100",
    nationality: "SG",
    website: "https://asiacare.fund",
    firstContactAt: "2026-02-20",
    lastContactAt: "2026-04-30",
    notes: "已簽 SPA，等 LP capital call 完成入金。",
  },
  {
    name: "王董家族辦公室",
    entityKind: "entity",
    email: "office@wang-family.tw",
    phone: "+886-2-8978-0001",
    nationality: "TW",
    firstContactAt: "2026-03-01",
    lastContactAt: "2026-04-29",
    notes: "王董本人已簽認股書，子女基金分兩筆撥款。",
  },
  {
    name: "陳醫師 (個人天使)",
    entityKind: "individual",
    email: "dr.chen@example-hospital.tw",
    phone: "+886-933-555-002",
    nationality: "TW",
    firstContactAt: "2026-02-05",
    lastContactAt: "2026-05-02",
    notes: "心臟科主治醫師，私人投資。已入金 NT$3M，等發股程序完成。",
  },
  {
    name: "Pacific Innovation Fund",
    entityKind: "entity",
    email: "ir@pacificinnov.com",
    phone: "+886-2-2345-6700",
    nationality: "TW",
    website: "https://pacificinnov.com",
    firstContactAt: "2026-01-10",
    lastContactAt: "2026-04-15",
    notes: "Pre-A 老股東 follow-on，已完成全流程入帳並發股。",
  },
];

const allocations: AllocSeed[] = [
  // === 1. PLANNED — pipeline 起步 ===
  {
    investorName: "TaiwanGrowth Ventures",
    amountNtd: 30_000_000,
    status: "planned",
    plannedAt: "2026-03-12",
    notes: [
      "🎯 Lead 候選人 — 30M, NT$80/share",
      "",
      "📅 會議紀錄：",
      "• 2026-03-12 初次會議：Vivian Lin (Partner) + Henry Su (Principal)，介紹產品 demo + 財務概況",
      "• 2026-03-28 第二次會議：CTO + 工程主管參與，深入技術 due diligence",
      "• 2026-04-15 IC 內部討論回饋：valuation 接受 NT$8.86 億 pre-money，但希望加入 1x non-participating LP",
      "• 2026-04-28 conference call：term sheet 草稿交換中",
      "",
      "⏭️ Next: 2026-05-08 預計簽 term sheet，5 月底完成 SPA 簽署",
      "👤 Owner: 共同創辦人",
    ].join("\n"),
  },
  {
    investorName: "HealthTech Capital Asia",
    amountNtd: 15_000_000,
    status: "planned",
    plannedAt: "2026-03-25",
    notes: [
      "🎯 Co-lead potential — 15M",
      "",
      "📅 會議紀錄：",
      "• 2026-03-25 引薦會議：透過 Pre-A 股東牽線",
      "• 2026-04-10 management presentation：CEO 現場報告 30 分鐘",
      "• 2026-04-26 ESG / 法遵 due diligence 進行中",
      "",
      "⏭️ Next: 2026-05-12 第二輪 IC，希望同步看 Lead term sheet",
      "⚠️ Risk: 估值偏好 NT$8 億 pre-money，需與 Lead 對齊",
    ].join("\n"),
  },
  // === 2. COMMITTED — 口頭承諾 ===
  {
    investorName: "BioMedex Partners",
    amountNtd: 15_000_000,
    status: "committed",
    plannedAt: "2026-02-08",
    committedAt: "2026-04-22",
    notes: [
      "✅ 口頭承諾 — 15M, follow Lead term sheet",
      "",
      "📅 會議紀錄：",
      "• 2026-02-08 (Zoom) 初次接觸：Partner Andrew Chen 主動詢問",
      "• 2026-03-15 Bay Area 出差面談：CEO + Andrew + Lisa Park (Principal)",
      "• 2026-04-22 verbal commit on call：confirm 將跟 Lead 條件投 USD$500K (≈NT$15M)",
      "",
      "⏭️ Next: 等 TaiwanGrowth term sheet 定案後 7 天內簽 SPA",
      "📎 KYC 文件已備齊",
    ].join("\n"),
  },
  {
    investorName: "林總 (個人天使)",
    amountNtd: 5_000_000,
    status: "committed",
    plannedAt: "2026-01-15",
    committedAt: "2026-04-20",
    notes: [
      "✅ 口頭承諾 — 5M (天使)",
      "",
      "📅 會議紀錄：",
      "• 2026-01-15 創辦人引薦晚宴",
      "• 2026-02-28 公司 office tour，看實驗室 + 試用產品",
      "• 2026-04-20 電話確認：將以個人名義投 NT$5M，可帶醫院通路",
      "",
      "⏭️ Next: 5/10 線下簽認股書，預計 5/20 入金",
      "💡 可協助：北部三家醫學中心採購引薦",
    ].join("\n"),
  },
  // === 3. SIGNED — 簽約完成 ===
  {
    investorName: "AsiaCare Fund I",
    amountNtd: 15_000_000,
    status: "signed",
    plannedAt: "2026-02-20",
    committedAt: "2026-03-25",
    signedAt: "2026-04-30",
    notes: [
      "✍️ SPA 已簽 — 15M",
      "",
      "📅 會議紀錄：",
      "• 2026-02-20 新加坡 deal team 視訊會議",
      "• 2026-03-25 IC 通過、term sheet 簽署",
      "• 2026-04-30 SPA 雙方蓋章完成 (DocuSeal)",
      "",
      "⏭️ Next: LP capital call 預計 2 週完成，5/15 前匯款",
      "📎 SPA 編號：SPA-AROUND-001",
      "👤 Contact: Sarah Tan (CFO)",
    ].join("\n"),
  },
  {
    investorName: "王董家族辦公室",
    amountNtd: 8_000_000,
    status: "signed",
    plannedAt: "2026-03-01",
    committedAt: "2026-04-10",
    signedAt: "2026-04-29",
    notes: [
      "✍️ 認股書已簽 — 8M",
      "",
      "📅 會議紀錄：",
      "• 2026-03-01 透過會計師事務所引薦",
      "• 2026-04-05 王董本人 + 二代家屬一同參訪",
      "• 2026-04-10 family office 內部決議通過",
      "• 2026-04-29 認股書簽署完成",
      "",
      "⏭️ Next: 分兩筆入金 — 王董本人 5M (5/8 前)、子女信託 3M (5/15 前)",
      "📋 Note: 子女信託需另準備受益人 KYC",
    ].join("\n"),
  },
  // === 4. FUNDED — 已入金等發股 ===
  {
    investorName: "陳醫師 (個人天使)",
    amountNtd: 3_000_000,
    status: "funded",
    plannedAt: "2026-02-05",
    committedAt: "2026-03-10",
    signedAt: "2026-04-18",
    fundedAt: "2026-05-02",
    notes: [
      "💰 已入金 — 3M",
      "",
      "📅 會議紀錄：",
      "• 2026-02-05 學會年會認識",
      "• 2026-03-10 個人決定參投",
      "• 2026-04-18 認股書簽署",
      "• 2026-05-02 全額匯款入帳 (兆豐銀行 帳號末四碼 XXXX)",
      "",
      "⏭️ Next: 5/10 完成董事會決議 → 發股 → 寫入 share register",
      "📎 匯款憑證已存檔",
    ].join("\n"),
  },
  // === 5. ISSUED — 已發股 ===
  {
    investorName: "Pacific Innovation Fund",
    amountNtd: 2_000_000,
    status: "issued",
    plannedAt: "2026-01-10",
    committedAt: "2026-02-15",
    signedAt: "2026-03-20",
    fundedAt: "2026-04-08",
    issuedAt: "2026-04-15",
    notes: [
      "🎉 已完成全流程 — 2M (Pre-A 股東 follow-on)",
      "",
      "📅 會議紀錄：",
      "• 2026-01-10 老股東 follow-on 意向確認",
      "• 2026-02-15 投委會通過",
      "• 2026-03-20 SPA 簽署",
      "• 2026-04-08 入金完成",
      "• 2026-04-15 董事會決議 + 發股，已登記 share register",
      "",
      "✅ Cap table 已反映",
    ].join("\n"),
  },
];

async function main() {
  console.log("🌱 Seeding A Round allocation funnel demo...\n");

  // 1. Insert investors (skip if name already exists)
  const investorIdByName = new Map<string, number>();
  console.log("━━━ Step 1: Creating investors ━━━");
  for (const inv of investors) {
    const existing = await sql`
      SELECT id FROM investors WHERE "companyId" = ${COMPANY_ID} AND name = ${inv.name} LIMIT 1
    `;
    if (existing.length > 0) {
      investorIdByName.set(inv.name, existing[0].id);
      console.log(`  ⏭️  ${inv.name} already exists (id=${existing[0].id})`);
      continue;
    }
    const inserted = await sql`
      INSERT INTO investors (
        "companyId", name, "entityKind", email, phone, nationality,
        website, "linkedinUrl", "firstContactAt", "lastContactAt", notes, status,
        "createdAt", "updatedAt"
      ) VALUES (
        ${COMPANY_ID}, ${inv.name}, ${inv.entityKind}, ${inv.email}, ${inv.phone}, ${inv.nationality},
        ${inv.website ?? null}, ${inv.linkedinUrl ?? null},
        ${inv.firstContactAt}, ${inv.lastContactAt}, ${inv.notes}, 'prospect',
        NOW(), NOW()
      )
      RETURNING id
    `;
    investorIdByName.set(inv.name, inserted[0].id);
    console.log(`  ✅ ${inv.name} (id=${inserted[0].id})`);
  }

  // 2. Insert allocations
  console.log("\n━━━ Step 2: Creating allocations ━━━");
  for (const a of allocations) {
    const investorId = investorIdByName.get(a.investorName);
    if (!investorId) {
      console.log(`  ⚠️  Skip ${a.investorName} — investor not found`);
      continue;
    }
    const shares = Math.floor(a.amountNtd / PRICE_PER_SHARE);
    const inserted = await sql`
      INSERT INTO allocations (
        "companyId", "fundingRoundId", "investorId", "shareClass",
        amount, currency, "fxToNtd", "sharesAllocated", "pricePerShare",
        status,
        "plannedAt", "committedAt", "signedAt", "fundedAt", "issuedAt",
        notes,
        "createdAt", "updatedAt"
      ) VALUES (
        ${COMPANY_ID}, ${A_ROUND_ID}, ${investorId}, ${SHARE_CLASS},
        ${a.amountNtd}, 'NTD', 1, ${shares}, ${PRICE_PER_SHARE},
        ${a.status},
        ${a.plannedAt ?? null}, ${a.committedAt ?? null}, ${a.signedAt ?? null},
        ${a.fundedAt ?? null}, ${a.issuedAt ?? null},
        ${a.notes},
        NOW(), NOW()
      )
      RETURNING id
    `;
    const fmt = (n: number) =>
      n >= 100_000_000 ? `${(n / 100_000_000).toFixed(2)}億` : n >= 10_000 ? `${(n / 10_000).toFixed(0)}萬` : n.toString();
    console.log(
      `  ✅ [${a.status.padEnd(9)}] ${a.investorName} — NT$${fmt(a.amountNtd)} / ${shares.toLocaleString()} shares (id=${inserted[0].id})`,
    );
  }

  // 3. Verify funnel breakdown
  console.log("\n━━━ Verification: Allocation Funnel for A Round ━━━");
  const funnel = await sql`
    SELECT status, COUNT(*) AS cnt, SUM(amount)::numeric AS total
    FROM allocations
    WHERE "fundingRoundId" = ${A_ROUND_ID}
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'planned' THEN 1
        WHEN 'committed' THEN 2
        WHEN 'signed' THEN 3
        WHEN 'funded' THEN 4
        WHEN 'issued' THEN 5
      END
  `;
  console.table(funnel);

  console.log("\n🎉 Done! 開瀏覽器到 Allocations 頁面查看 funnel。");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
