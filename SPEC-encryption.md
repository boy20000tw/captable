# SPEC: AES-256 全平台加密 + Per-Company Key Isolation

> **Version**: 1.0  
> **Date**: 2026-04-28  
> **Status**: Draft  
> **Priority**: High — 隱私基礎建設  

---

## 1. 目標

為 Caploom 平台所有客戶資料建立 AES-256 加密保護，做到：

- 所有敏感資料在 DB 中以密文儲存（application-level encryption）
- 每家公司擁有獨立加密金鑰（per-tenant key isolation）
- 任一公司金鑰洩漏不影響其他公司
- 金鑰由雲端 KMS 管理，平台本身不儲存明文金鑰
- Privacy Policy 可宣稱「AES-256 三層加密 + 租戶級金鑰隔離」

---

## 2. 三層加密架構

```
Layer 1 — 儲存層加密（已啟用）
  Neon PostgreSQL 內建 AES-256 靜態加密
  → 磁碟上所有資料自動加密，DB 使用者透明存取

Layer 2 — 傳輸層加密（已啟用）
  TLS 1.3 / SSL（Neon 強制 sslmode=require）
  → 應用程式 ↔ DB 之間所有流量加密

Layer 3 — 應用層欄位加密（本 SPEC 新增）
  AES-256-GCM + Envelope Encryption + Per-Company DEK
  → 敏感欄位在寫入 DB 前先加密，讀取時解密
  → 每家公司各自一把 DEK（Data Encryption Key）
  → DEK 由 AWS KMS 的 KEK（Key Encryption Key）加密後儲存
```

---

## 3. 信封加密（Envelope Encryption）原理

```
                    ┌──────────────┐
                    │   AWS KMS    │
                    │  Master Key  │  ← KEK（永遠不離開 KMS）
                    │   (CMK)      │
                    └──────┬───────┘
                           │ encrypt / decrypt
                    ┌──────▼───────┐
                    │  Encrypted   │
                    │     DEK      │  ← 密文 DEK 存在 DB
                    │  (per-co.)   │
                    └──────┬───────┘
                           │ decrypt via KMS → plaintext DEK（只在記憶體）
                    ┌──────▼───────┐
                    │  AES-256-GCM │
                    │  加/解密資料  │  ← 用明文 DEK 加密每個欄位
                    └──────────────┘
```

**流程：**
1. 公司建立時 → 產生隨機 DEK → 用 KMS 加密 DEK → 存入 `company_keys` 表
2. 讀取資料時 → 取出該公司的 encrypted DEK → 呼叫 KMS 解密 → 取得明文 DEK → 解密欄位
3. 寫入資料時 → 同上取得明文 DEK → 加密欄位 → 存入 DB
4. 明文 DEK 只存在伺服器記憶體，帶 TTL cache（5 分鐘）

---

## 4. 加密欄位分級

### Tier A — 高敏感 PII（必須加密）

| Table | Fields | 說明 |
|-------|--------|------|
| `companies` | `taxId`, `docusealTenantApiKey`, `docusealWebhookSecret` | 統編、API 金鑰 |
| `companies` | `representativeName`, `representativeTitle`, `signatureUrl` | 代表人資料 |
| `companies` | `address`, `phone`, `contactEmail` | 聯絡資訊 |
| `shareholders` | `name`, `aka`, `email`, `phone`, `nationality` | 股東個人資料 |
| `users` | `name`, `email` | 用戶 PII |
| `esop_grants` | `granteeName` | 員工個人資料 |
| `user_invitations` | `email` | 受邀者信箱 |

### Tier B — 財務數據（建議加密）

| Table | Fields | 說明 |
|-------|--------|------|
| `funding_rounds` | `moneyRaisedNtd`, `preMoneyValuationNtd`, `postMoneyValuationNtd`, `pricePerShareNtd` | 募資金額與估值 |
| `share_holdings` | `commonShares`, `totalShares`, `ownershipPct`, `paidInCapitalNtd` | 持股數據 |
| `share_transactions` | `sharesAmount`, `pricePerShareNtd`, `totalAmountNtd` | 交易明細 |
| `allocations` | `shares`, `pricePerShare`, `totalInvested` | 投資分配 |
| `esop_grants` | `sharesGranted`, `exercisePriceNtd` | 期權數據 |
| `esop_pool` | `totalShares`, `allocatedShares` | ESOP 池 |

### Tier C — 不加密（維持查詢能力）

| Fields | 說明 |
|--------|------|
| `id`, `companyId`, `userId`, `createdAt`, `updatedAt` | 主鍵、外鍵、時間戳 |
| `plan`, `role`, `status`, `type` | Enum 欄位（需要 WHERE / JOIN） |
| `slug`, `sortOrder` | 排序與路由用途 |

### 針對需要搜尋的加密欄位（Blind Index）

部分 Tier A 欄位需要支援查詢（如 email 查找用戶），使用 **HMAC-SHA256 blind index**：

```
原始值: "wayne@example.com"
加密值: AES-256-GCM(plaintext) → 存入 email_enc 欄位
盲索引: HMAC-SHA256(lowercase(email), blind_index_key) → 存入 email_idx 欄位
```

查詢時用盲索引比對，不需解密整欄。

---

## 5. Schema 變更

### 5.1 新增 `company_keys` 表

```typescript
export const companyKeys = pgTable("company_keys", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique(),
  encryptedDek: text("encrypted_dek").notNull(),     // KMS 加密後的 DEK (base64)
  dekVersion: integer("dek_version").default(1).notNull(),
  kmsKeyId: varchar("kms_key_id", { length: 255 }).notNull(), // AWS KMS CMK ARN
  algorithm: varchar("algorithm", { length: 32 }).default("aes-256-gcm").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rotatedAt: timestamp("rotated_at"),
});
```

### 5.2 加密欄位改造模式

以 `shareholders` 表為例：

```typescript
// Before
name: varchar("name", { length: 255 }).notNull(),
email: varchar("email", { length: 320 }),

// After
name_enc: text("name_enc").notNull(),        // AES-256-GCM 密文 (base64)
name_idx: varchar("name_idx", { length: 64 }), // HMAC blind index (hex, 可選)
email_enc: text("email_enc"),
email_idx: varchar("email_idx", { length: 64 }),
```

**命名規則：**
- `{field}_enc` — 加密後的密文（base64 encoded: iv + ciphertext + authTag）
- `{field}_idx` — HMAC blind index（僅需搜尋的欄位才加）

---

## 6. 核心模組：`server/encryption.ts`

```typescript
import crypto from "crypto";
import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from "@aws-sdk/client-kms";

const KMS_KEY_ARN = process.env.AWS_KMS_KEY_ARN!;
const BLIND_INDEX_SECRET = process.env.BLIND_INDEX_SECRET!;
const kms = new KMSClient({ region: process.env.AWS_REGION || "ap-northeast-1" });

// ── DEK Management ──────────────────────────────────────────────

/** 為新公司產生 DEK，回傳加密後的 DEK（存 DB）和明文 DEK（僅暫用） */
export async function generateCompanyDek(): Promise<{
  encryptedDek: string;   // base64, 存入 company_keys
  plaintextDek: Buffer;   // 32 bytes, 僅在記憶體使用
}> {
  const resp = await kms.send(new GenerateDataKeyCommand({
    KeyId: KMS_KEY_ARN,
    KeySpec: "AES_256",
  }));
  return {
    encryptedDek: Buffer.from(resp.CiphertextBlob!).toString("base64"),
    plaintextDek: Buffer.from(resp.Plaintext!),
  };
}

/** 解密公司的 DEK（呼叫 KMS），結果暫存記憶體 */
export async function decryptDek(encryptedDekB64: string): Promise<Buffer> {
  const resp = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(encryptedDekB64, "base64"),
  }));
  return Buffer.from(resp.Plaintext!);
}

// ── DEK Cache（TTL 5min，減少 KMS 呼叫） ────────────────────────
const dekCache = new Map<number, { dek: Buffer; expiresAt: number }>();
const DEK_TTL_MS = 5 * 60 * 1000;

export async function getCompanyDek(companyId: number, encryptedDekB64: string): Promise<Buffer> {
  const cached = dekCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) return cached.dek;

  const dek = await decryptDek(encryptedDekB64);
  dekCache.set(companyId, { dek, expiresAt: Date.now() + DEK_TTL_MS });
  return dek;
}

// ── Field-Level Encryption ──────────────────────────────────────

/** AES-256-GCM 加密單一欄位值 → base64 字串 */
export function encryptField(plaintext: string, dek: Buffer): string {
  const iv = crypto.randomBytes(12); // GCM 標準 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 128-bit tag
  // 格式: iv(12) + authTag(16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** 解密 base64 密文 → 原始字串 */
export function decryptField(encryptedB64: string, dek: Buffer): string {
  const buf = Buffer.from(encryptedB64, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/** 批量加密物件中的指定欄位 */
export function encryptFields<T extends Record<string, any>>(
  obj: T, fields: (keyof T)[], dek: Buffer
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) {
      (result as any)[`${String(field)}_enc`] = encryptField(String(result[field]), dek);
      delete (result as any)[field];
    }
  }
  return result;
}

/** 批量解密物件中的 _enc 欄位 */
export function decryptFields<T extends Record<string, any>>(
  obj: T, fields: string[], dek: Buffer
): T {
  const result = { ...obj };
  for (const field of fields) {
    const encKey = `${field}_enc`;
    if (result[encKey] != null) {
      (result as any)[field] = decryptField(result[encKey] as string, dek);
      delete (result as any)[encKey];
    }
  }
  return result;
}

// ── Blind Index ─────────────────────────────────────────────────

/** 產生 HMAC-SHA256 blind index，用於搜尋加密欄位 */
export function blindIndex(value: string): string {
  return crypto
    .createHmac("sha256", BLIND_INDEX_SECRET)
    .update(value.toLowerCase().trim())
    .digest("hex");
}
```

---

## 7. 使用方式：DB 層整合

```typescript
// server/db.ts — createShareholder 範例

import { encryptFields, blindIndex, getCompanyDek } from "./encryption";
import { getCompanyEncryptedDek } from "./db"; // 從 company_keys 取 encrypted DEK

const SHAREHOLDER_ENCRYPTED_FIELDS = ["name", "aka", "email", "phone", "nationality"];
const SHAREHOLDER_INDEXED_FIELDS = ["name", "email"]; // 需要搜尋的欄位

export async function createShareholder(companyId: number, data: InsertShareholder) {
  const db = await getDb();
  const encDek = await getCompanyEncryptedDek(companyId);
  const dek = await getCompanyDek(companyId, encDek);

  // 建立 blind index
  const indices: Record<string, string> = {};
  for (const field of SHAREHOLDER_INDEXED_FIELDS) {
    if (data[field]) indices[`${field}_idx`] = blindIndex(String(data[field]));
  }

  // 加密欄位
  const encrypted = encryptFields(data, SHAREHOLDER_ENCRYPTED_FIELDS, dek);

  return db.insert(shareholders).values({
    ...encrypted,
    ...indices,
    companyId,
  }).returning();
}
```

---

## 8. 環境變數

```bash
# .env (新增)
AWS_REGION=ap-northeast-1
AWS_KMS_KEY_ARN=arn:aws:kms:ap-northeast-1:123456789:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
BLIND_INDEX_SECRET=<64 chars random hex>  # openssl rand -hex 32
```

---

## 9. 實作分期

### Phase 1 — 基礎架構（預計 2-3 天）

- [ ] 建立 `server/encryption.ts` 核心模組
- [ ] 建立 `company_keys` 表（schema + migration）
- [ ] 公司建立流程自動產生 DEK
- [ ] 設定 AWS KMS（建立 CMK）
- [ ] 加入 DEK cache 機制

### Phase 2 — Tier A 高敏感 PII 加密（預計 3-4 天）

- [ ] `companies` 表：加密 taxId, API keys, 代表人資訊, 聯絡資訊
- [ ] `shareholders` 表：加密 name, email, phone, nationality + blind index
- [ ] `users` 表：加密 name, email + blind index
- [ ] `esop_grants` 表：加密 granteeName
- [ ] `user_invitations` 表：加密 email + blind index
- [ ] 既有資料 migration script（加密現有明文資料）

### Phase 3 — Tier B 財務數據加密（預計 2-3 天）

- [ ] `funding_rounds` 表：加密金額與估值欄位
- [ ] `share_holdings` 表：加密持股與出資欄位
- [ ] `share_transactions` 表：加密交易金額欄位
- [ ] `allocations` 表：加密投資分配欄位
- [ ] `esop_pool` + `esop_grants` 表：加密股數與價格欄位
- [ ] 既有資料 migration script

### Phase 4 — 金鑰輪替 + 監控（預計 1-2 天）

- [ ] Admin Panel：金鑰輪替功能（re-encrypt with new DEK）
- [ ] KMS 使用量監控 + 告警
- [ ] Audit log 記錄所有加/解密操作
- [ ] 金鑰存取日誌

### Phase 5 — 驗證 + 文件（預計 1 天）

- [ ] 單元測試：加密 → 解密 round-trip
- [ ] 測試：跨公司金鑰隔離（公司 A 的 DEK 不能解公司 B 的資料）
- [ ] 更新 Privacy Policy 加密聲明
- [ ] 更新 Changelog

---

## 10. 成本估算

| 項目 | 費用 |
|------|------|
| AWS KMS CMK | $1/月/key |
| KMS API 呼叫 | 前 20,000 次免費，之後 $0.03/10,000 次 |
| DEK cache 減少呼叫 | 估計 90%+ 的讀取走 cache |
| **月估計** | **< $5 USD**（早期用戶量） |

---

## 11. 安全性保證

| 威脅 | 防護 |
|------|------|
| DB 被入侵 | 攻擊者只拿到密文 + encrypted DEK，無法解密 |
| 單一公司金鑰洩漏 | 僅該公司資料受影響，其他公司不受影響 |
| Server 記憶體被 dump | DEK 帶 TTL cache，最多暴露 5 分鐘窗口 |
| KMS 被撤銷 | 所有資料無法解密（需要 KMS 存取才能運作） |
| DB 備份被竊取 | 備份內仍是密文，無 KMS 無法解密 |
| Blind index 碰撞 | SHA-256 碰撞機率極低，不影響資料安全 |

---

## 12. 注意事項與限制

1. **加密欄位不可 SQL 排序/範圍查詢** — 數字欄位加密後無法 `ORDER BY amount` 或 `WHERE amount > 1000`。前端排序或應用層排序。

2. **Blind index 不支援模糊搜尋** — `LIKE '%wayne%'` 無法運作。只能精確比對（完整 email）或前綴比對（需額外設計）。

3. **效能影響** — 每次讀寫多一步加/解密，但 AES-256-GCM 在現代 CPU 上極快（~1GB/s），影響可忽略。KMS 呼叫是主要瓶頸，DEK cache 解決。

4. **金鑰輪替需 re-encrypt** — 輪替 DEK 時需要讀出所有該公司資料 → 解密 → 用新 DEK 加密 → 寫回。大量資料時需要 background job。

5. **Recovery** — 如果 KMS CMK 被刪除，所有資料將永久無法解密。務必啟用 KMS key 的 deletion protection。
