# Caploom 台灣本地化提案：合規模組 + i18n 架構

> **版本**：v1.0 | **日期**：2026-04-27 | **狀態**：提案 Draft

---

## 一、目標

1. 在 Compliance & Tax 模組中加入台灣法規需求（技術股課稅、閉鎖性公司特別股），現有 US 項目保留為 Advanced 子群組
2. 規劃全站中英文切換（i18n）架構，後續分批實作

---

## 二、Compliance & Tax 導航重構

### 現行結構

```
Compliance & Tax
├── 409A Valuation
├── 83(b) Election
└── Share Transfers
```

### 改造後結構

```
Compliance & Tax
├── 🇹🇼 台灣法規 (Taiwan)
│   ├── 技術股 / RSA 課稅追蹤       ← 新增
│   └── 閉鎖性公司特別股管理         ← 新增
│
└── 🇺🇸 US Advanced (預設收合)
    ├── 409A Valuation              ← 保留
    ├── 83(b) Election              ← 保留
    └── Share Transfers             ← 保留
```

US Advanced 子群組預設收合，標註「適用於計畫赴美發展的公司」。

---

## 三、台灣合規功能 #1：技術股 / 限制型股票課稅追蹤

### 3.1 法規背景

| 法規 | 適用場景 | 重點 |
|------|---------|------|
| 所得稅法 §14、產創條例 §19-1 | 技術股緩課 | 轉讓或離職時才課稅，需持有滿 2 年；FMV 以取得時價計算 |
| 所得稅法 §14 | 限制型股票 (RSA) | 解限時以 FMV 課稅；若符合產創條例可延緩 5 年 |
| 產創條例 §19-1 | 緩課股票稅額試算 | 取得時價 vs 轉讓時價的差額課稅 |

### 3.2 資料模型

```
techShareTaxRecords
├── id                  serial PK
├── companyId           integer NOT NULL
├── grantId             integer (FK → esopGrants / allocations)
├── holderName          varchar(255)
├── holderTaxId         varchar(20)       // 統一編號或身分證 (加密儲存)
├── shareType           enum: "tech_share" | "rsa"
│
├── ── 取得資訊 ──
├── acquisitionDate     date              // 取得日
├── sharesAcquired      integer           // 取得股數
├── acquisitionFmv      decimal(18,6)     // 取得時每股 FMV (TWD)
├── paidAmount          decimal(18,6)     // 實際支付金額 (RSA 的認購價)
│
├── ── 緩課條件 ──
├── isDeferralEligible  boolean           // 是否適用緩課 (產創 §19-1)
├── deferralStartDate   date              // 緩課起算日
├── deferralExpiryDate  date              // 緩課到期日 (取得日 + 5 年)
├── holdingPeriodMet    boolean           // 是否滿 2 年持有期
│
├── ── RSA 解限 ──
├── vestingDate         date              // 解限日 (RSA only)
├── vestingFmv          decimal(18,6)     // 解限時 FMV
│
├── ── 處分 / 轉讓 ──
├── dispositionDate     date              // 轉讓/離職日
├── dispositionFmv      decimal(18,6)     // 處分時 FMV
├── dispositionType     enum: "transfer" | "resignation" | "ipo" | "other"
│
├── ── 稅務計算 ──
├── taxableIncome       decimal(20,4)     // 應稅所得 = (處分FMV - 取得FMV) × 股數
├── taxRate             decimal(6,4)      // 適用稅率
├── estimatedTax        decimal(20,4)     // 估計稅額
├── taxStatus           enum: "deferred" | "taxable" | "filed" | "exempt"
│
├── ── 申報追蹤 ──
├── filingDeadline      date              // 申報期限
├── filingDate          date              // 實際申報日
├── filingReference     varchar(100)      // 申報文號
│
├── notes               text
├── createdAt           timestamp
├── updatedAt           timestamp
```

### 3.3 功能清單

| 功能 | 說明 | 優先度 |
|------|------|--------|
| 記錄建立 | 從既有 ESOP grant 或手動新增技術股/RSA 記錄 | P0 |
| 緩課計時器 | 顯示距離 2 年持有期 / 5 年緩課到期的剩餘天數 | P0 |
| 到期提醒 | 緩課即將到期時在通知中心發送提醒（30天、7天） | P0 |
| 稅額試算 | 自動計算 (處分FMV - 取得FMV) × 股數 的應稅所得 | P1 |
| 批次匯入 | 支援 CSV/Excel 批次匯入技術股持有人資料 | P2 |
| 報表匯出 | 產出年度技術股/RSA 課稅明細表（PDF/Excel） | P2 |

### 3.4 UI 設計

頁面結構類似 83(b) Election：

- **頂部統計卡片**：緩課中數量、即將到期數量、已課稅數量
- **列表**：技術股/RSA 記錄表格，含持有人、取得日、股數、FMV、緩課狀態、到期日
- **到期提醒橫幅**：距離到期 30 天內顯示 amber warning
- **CRUD Dialog**：建立/編輯記錄表單

---

## 四、台灣合規功能 #2：閉鎖性公司特別股管理

### 4.1 法規背景

| 法規 | 適用場景 | 重點 |
|------|---------|------|
| 公司法 §356-1 ~ §356-14 | 閉鎖性股份有限公司 | 可發行複數表決權特別股、無面額股票 |
| 公司法 §356-7 | 轉讓限制 | 章程可約定股份轉讓需董事會同意 |
| 公司法 §356-9 | 特別股條款 | 可約定複數表決權、否決權、保障董事席次等 |

### 4.2 資料模型

```
closedCompanyProvisions
├── id                   serial PK
├── companyId            integer NOT NULL
│
├── ── 公司設定 ──
├── isClosedCompany      boolean           // 是否為閉鎖性公司
├── parValueType         enum: "par" | "no_par"  // 面額/無面額
├── articlesUrl          varchar(500)      // 章程連結
│
├── ── 轉讓限制 ──
├── transferRestriction  enum: "none" | "board_approval" | "shareholder_approval" | "custom"
├── transferDescription  text              // 自訂轉讓限制說明
│
├── ── 修改歷史 ──
├── effectiveDate        date              // 生效日
├── notes                text
├── createdAt            timestamp
├── updatedAt            timestamp

closedCompanyShareRights (特別股權利條款)
├── id                   serial PK
├── companyId            integer NOT NULL
├── shareClassId         integer           // FK → share_classes
│
├── ── 表決權 ──
├── votesPerShare        decimal(6,2)      // 每股表決權數 (可 > 1)
├── hasVetoRight         boolean           // 是否有否決權
├── vetoMatters          text              // 否決事項列表 (JSON)
│
├── ── 董事 ──
├── guaranteedBoardSeats integer           // 保障董事席次
├── boardObserverRights  boolean           // 列席權
│
├── ── 股利 ──
├── dividendPriority     enum: "cumulative" | "non_cumulative" | "participating" | "none"
├── dividendRate         decimal(6,4)      // 特別股利率
│
├── ── 清算 ──
├── liquidationPriority  integer           // 清算順位
├── liquidationMultiple  decimal(6,2)      // 清算倍數
│
├── ── 轉換 ──
├── isConvertible        boolean
├── conversionRatio      decimal(10,4)
├── conversionTrigger    text              // 轉換觸發條件
│
├── ── 其他 ──
├── customProvisions     text              // 其他章程約定 (JSON/markdown)
├── notes                text
├── createdAt            timestamp
├── updatedAt            timestamp
```

### 4.3 功能清單

| 功能 | 說明 | 優先度 |
|------|------|--------|
| 公司屬性設定 | 標記是否為閉鎖性公司、面額/無面額、轉讓限制類型 | P0 |
| 特別股條款 CRUD | 對每個 share class 設定表決權倍數、否決權、董事席次等 | P0 |
| 條款摘要卡片 | Dashboard 上顯示各 share class 的權利摘要 | P1 |
| 對照表匯出 | 產出各 share class 權利對照表（PDF/Excel） | P2 |
| 章程產生器 | 根據設定產出閉鎖性公司章程範本（未來） | P3 |

### 4.4 UI 設計

頁面結構：

- **頂部：公司設定卡片**：閉鎖性/一般公司切換、面額類型、轉讓限制設定
- **特別股權利列表**：每個 share class 一張卡片，顯示表決權、否決權、董事席次、股利、清算等
- **新增/編輯 Dialog**：選擇 share class → 設定各項權利
- **對照表 Tab**：所有 share class 的權利比較矩陣

---

## 五、與現有系統的整合

### 5.1 Share Classes 整合

閉鎖性公司的特別股條款直接關聯到現有的 `share_classes` 表。需新增欄位：

```sql
ALTER TABLE share_classes ADD COLUMN
  isClosedCompanyClass boolean DEFAULT false;
```

技術股/RSA 記錄可連結到 `esop_grants_v1` 或 `allocations` 表。

### 5.2 通知系統整合

新增通知類型：

```typescript
// 現有 notificationTypeEnum 新增：
"tech_share_deferral"   // 技術股緩課即將到期
"closed_company"        // 閉鎖性公司相關變更
```

### 5.3 審計日誌整合

所有台灣合規操作自動寫入 `audit_logs`，resourceType 新增 `"tech_share_tax"` 和 `"closed_company_provision"`。

---

## 六、i18n 全站中英切換架構

### 6.1 技術選型

| 方案 | 套件 | 優缺 |
|------|------|------|
| **react-i18next（推薦）** | `react-i18next` + `i18next` | 生態系最成熟、支援 namespace 拆分、lazy load、plurals |
| DIY Context | 自建 Context + JSON | 輕量但需自行處理複數、內插、fallback |
| next-intl | `next-intl` | 適合 Next.js，我們用 Vite 不適用 |

**推薦方案：react-i18next**

### 6.2 目錄結構

```
client/src/
├── i18n/
│   ├── index.ts              // i18next 初始化
│   ├── locales/
│   │   ├── zh-TW/
│   │   │   ├── common.json   // 共用 (按鈕、狀態、日期格式)
│   │   │   ├── nav.json      // 導航
│   │   │   ├── equity.json   // Equity 模組
│   │   │   ├── compliance.json // Compliance & Tax
│   │   │   ├── analysis.json // 分析
│   │   │   └── settings.json // 設定
│   │   └── en/
│   │       ├── common.json
│   │       ├── nav.json
│   │       ├── equity.json
│   │       ├── compliance.json
│   │       ├── analysis.json
│   │       └── settings.json
│   └── useLocale.ts          // 自定義 hook
```

### 6.3 初始化設定

```typescript
// client/src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhTWCommon from "./locales/zh-TW/common.json";
import enCommon from "./locales/en/common.json";
// ... 其他 namespace

i18n.use(initReactI18next).init({
  resources: {
    "zh-TW": { common: zhTWCommon, nav: zhTWNav, ... },
    en: { common: enCommon, nav: enNav, ... },
  },
  lng: localStorage.getItem("caploom-lang") || "zh-TW",  // 預設中文
  fallbackLng: "en",
  ns: ["common", "nav", "equity", "compliance", "analysis", "settings"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});
```

### 6.4 翻譯 Key 命名規範

```json
// zh-TW/common.json
{
  "btn.save": "儲存",
  "btn.cancel": "取消",
  "btn.create": "新增",
  "btn.delete": "刪除",
  "btn.edit": "編輯",
  "status.pending": "待處理",
  "status.completed": "已完成",
  "status.active": "啟用中",
  "date.format": "YYYY/MM/DD",
  "currency.twd": "新台幣",
  "currency.usd": "美元"
}

// zh-TW/nav.json
{
  "dashboard": "總覽",
  "equity": "股權管理",
  "equity.capTable": "股權結構表",
  "equity.register": "股東名冊",
  "equity.esop": "員工認股 (ESOP)",
  "equity.investors": "投資人",
  "compliance": "合規 & 稅務",
  "compliance.tw": "台灣法規",
  "compliance.tw.techShare": "技術股 / RSA 課稅",
  "compliance.tw.closedCompany": "閉鎖性公司管理",
  "compliance.us": "US Advanced",
  "compliance.us.409a": "409A 估值",
  "compliance.us.83b": "83(b) 選擇",
  "compliance.us.transfers": "股份轉讓"
}

// zh-TW/compliance.json
{
  "techShare.title": "技術股 / 限制型股票課稅追蹤",
  "techShare.desc": "管理技術股緩課、RSA 解限課稅計算與申報追蹤",
  "techShare.deferralStatus": "緩課狀態",
  "techShare.deferralExpiry": "緩課到期日",
  "techShare.holdingPeriod": "持有期間",
  "techShare.taxableIncome": "應稅所得",
  "techShare.filingDeadline": "申報期限",
  "closedCompany.title": "閉鎖性公司特別股管理",
  "closedCompany.isClosedCompany": "本公司為閉鎖性股份有限公司",
  "closedCompany.parValue": "面額類型",
  "closedCompany.transferRestriction": "轉讓限制",
  "closedCompany.votesPerShare": "每股表決權數",
  "closedCompany.vetoRight": "否決權"
}
```

### 6.5 元件使用方式

```tsx
// 使用 useTranslation hook
import { useTranslation } from "react-i18next";

function TechSharePage() {
  const { t } = useTranslation("compliance");

  return (
    <h1>{t("techShare.title")}</h1>
    // 輸出：技術股 / 限制型股票課稅追蹤
  );
}
```

### 6.6 語言切換 UI

在 sidebar footer（user dropdown 旁）加一個語言切換按鈕：

```
┌──────────────────────┐
│ 🌐 繁中 ⇄ EN        │  ← 單擊切換
└──────────────────────┘
```

切換時：
1. 更新 `i18n.changeLanguage()`
2. 存入 `localStorage("caploom-lang")`
3. 所有 UI 即時更新（react-i18next 自動 re-render）

### 6.7 實作順序建議

| 階段 | 範圍 | 估計工時 |
|------|------|---------|
| Phase 1 | 安裝 i18next、初始化、語言切換按鈕、`common.json` + `nav.json` | 2-3 小時 |
| Phase 2 | 導航側邊欄 + 所有頁面標題中英化 | 3-4 小時 |
| Phase 3 | Compliance & Tax 模組完整翻譯（含新台灣功能） | 2-3 小時 |
| Phase 4 | Equity、Fundraising、Analysis 模組翻譯 | 4-5 小時 |
| Phase 5 | Settings、Admin、表單欄位、錯誤訊息翻譯 | 3-4 小時 |
| Phase 6 | 日期格式、數字格式本地化 (2026/04/27 vs Apr 27, 2026) | 1-2 小時 |

**合計約 15-21 小時**，建議從 Phase 1-3 開始，Phase 4-6 可分批進行。

---

## 七、實作優先度總覽

| 優先度 | 項目 | 依賴 |
|--------|------|------|
| **P0** | Compliance & Tax 導航重構（TW/US 子群組） | 無 |
| **P0** | 技術股/RSA 課稅追蹤（Schema + CRUD + 提醒） | 導航重構 |
| **P0** | 閉鎖性公司特別股管理（Schema + CRUD） | 導航重構 |
| **P1** | i18n Phase 1-2（框架 + 導航翻譯） | 無 |
| **P1** | i18n Phase 3（Compliance 模組翻譯） | i18n Phase 1-2 |
| **P2** | 稅額試算功能 | 技術股追蹤 |
| **P2** | 特別股對照表匯出 | 閉鎖性公司管理 |
| **P3** | i18n Phase 4-6（全站翻譯） | i18n Phase 1-2 |
| **P3** | 章程產生器 | 閉鎖性公司管理 |

---

## 八、備註

- 技術股持有人的身分證/統一編號屬於敏感個資，需加密儲存 (`pgcrypto` 或 application-level encryption)
- 稅率計算僅供試算參考，需附免責聲明：「本系統僅供試算用途，實際稅務申報請諮詢會計師」
- 閉鎖性公司特別股條款的設定與現有 `share_classes` 表整合，避免資料重複
- US Advanced 功能不刪除，但 UI 上清楚標示為「適用赴美發展」，避免台灣用戶混淆
