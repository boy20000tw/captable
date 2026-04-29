/**
 * Caploom Encryption Module — AES-256-GCM field-level encryption
 * with per-company Data Encryption Keys (DEK) and envelope encryption.
 *
 * Supports two modes:
 *   1. AWS KMS mode  — production (set AWS_KMS_KEY_ARN env var)
 *   2. Local mode    — development (uses ENCRYPTION_MASTER_KEY env var)
 *
 * Architecture:
 *   KEK (in KMS or env) → encrypts per-company DEK → DEK encrypts fields
 */

import crypto from "crypto";

// ── Configuration ───────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;       // GCM standard 96-bit
const AUTH_TAG_LENGTH = 16;  // 128-bit authentication tag
const DEK_LENGTH = 32;      // 256-bit key

/** Cache TTL for decrypted DEKs (reduces KMS calls) */
const DEK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Types ───────────────────────────────────────────────────────────────────

export interface EncryptedDekBundle {
  encryptedDek: string;   // base64-encoded encrypted DEK
  plaintextDek: Buffer;   // 32-byte key (only in memory, never stored)
}

export interface DekCacheEntry {
  dek: Buffer;
  expiresAt: number;
}

// ── Master Key Resolution ───────────────────────────────────────────────────

let _kmsClient: any = null;
let _masterKeyLocal: Buffer | null = null;

/**
 * Resolve the Key Encryption Key (KEK).
 *
 * Production:  AWS KMS — DEK is encrypted/decrypted via KMS API
 * Development: Local 256-bit key from ENCRYPTION_MASTER_KEY env var
 */
function getLocalMasterKey(): Buffer {
  if (_masterKeyLocal) return _masterKeyLocal;

  const envKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!envKey) {
    throw new Error(
      "[Encryption] Neither AWS_KMS_KEY_ARN nor ENCRYPTION_MASTER_KEY is set. " +
      "Set ENCRYPTION_MASTER_KEY (64 hex chars) for local dev."
    );
  }
  if (envKey.length !== 64) {
    throw new Error("[Encryption] ENCRYPTION_MASTER_KEY must be 64 hex characters (256 bits).");
  }
  _masterKeyLocal = Buffer.from(envKey, "hex");
  return _masterKeyLocal;
}

function isKmsMode(): boolean {
  return !!process.env.AWS_KMS_KEY_ARN;
}

async function getKmsClient() {
  if (_kmsClient) return _kmsClient;
  // Lazy-load AWS SDK to avoid import errors when not using KMS
  const { KMSClient } = await import("@aws-sdk/client-kms");
  _kmsClient = new KMSClient({ region: process.env.AWS_REGION || "ap-northeast-1" });
  return _kmsClient;
}

// ── DEK Generation ──────────────────────────────────────────────────────────

/**
 * Generate a new DEK for a company.
 * Returns both the encrypted DEK (for DB storage) and plaintext DEK (for immediate use).
 */
export async function generateCompanyDek(): Promise<EncryptedDekBundle> {
  if (isKmsMode()) {
    return generateDekWithKms();
  }
  return generateDekLocal();
}

/** KMS mode: use GenerateDataKey API */
async function generateDekWithKms(): Promise<EncryptedDekBundle> {
  const kms = await getKmsClient();
  const { GenerateDataKeyCommand } = await import("@aws-sdk/client-kms");
  const resp = await kms.send(
    new GenerateDataKeyCommand({
      KeyId: process.env.AWS_KMS_KEY_ARN!,
      KeySpec: "AES_256",
    })
  );
  return {
    encryptedDek: Buffer.from(resp.CiphertextBlob!).toString("base64"),
    plaintextDek: Buffer.from(resp.Plaintext!),
  };
}

/** Local mode: generate random DEK, encrypt with local master key */
function generateDekLocal(): EncryptedDekBundle {
  const masterKey = getLocalMasterKey();
  const plaintextDek = crypto.randomBytes(DEK_LENGTH);
  const encryptedDek = encryptRaw(plaintextDek, masterKey);
  return {
    encryptedDek,
    plaintextDek,
  };
}

// ── DEK Decryption ──────────────────────────────────────────────────────────

/**
 * Decrypt an encrypted DEK to obtain the plaintext key.
 * In KMS mode, calls AWS KMS Decrypt API.
 * In local mode, decrypts with local master key.
 */
export async function decryptDek(encryptedDekB64: string): Promise<Buffer> {
  if (isKmsMode()) {
    return decryptDekWithKms(encryptedDekB64);
  }
  return decryptDekLocal(encryptedDekB64);
}

async function decryptDekWithKms(encryptedDekB64: string): Promise<Buffer> {
  const kms = await getKmsClient();
  const { DecryptCommand } = await import("@aws-sdk/client-kms");
  const resp = await kms.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedDekB64, "base64"),
    })
  );
  return Buffer.from(resp.Plaintext!);
}

function decryptDekLocal(encryptedDekB64: string): Buffer {
  const masterKey = getLocalMasterKey();
  const decrypted = decryptRaw(encryptedDekB64, masterKey);
  return Buffer.from(decrypted, "binary");
}

// ── DEK Cache ───────────────────────────────────────────────────────────────

const dekCache = new Map<number, DekCacheEntry>();

/**
 * Get a company's plaintext DEK, using cache when available.
 * @param companyId  — company identifier
 * @param encryptedDekB64 — base64 encrypted DEK from company_keys table
 */
export async function getCompanyDek(
  companyId: number,
  encryptedDekB64: string
): Promise<Buffer> {
  const cached = dekCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dek;
  }

  const dek = await decryptDek(encryptedDekB64);
  dekCache.set(companyId, {
    dek,
    expiresAt: Date.now() + DEK_CACHE_TTL_MS,
  });
  return dek;
}

/** Invalidate cached DEK (e.g. after key rotation). */
export function invalidateDekCache(companyId: number): void {
  dekCache.delete(companyId);
}

/** Clear entire DEK cache (e.g. on shutdown). */
export function clearDekCache(): void {
  dekCache.clear();
}

// ── Field-Level Encryption ──────────────────────────────────────────────────

/**
 * Encrypt a single field value with AES-256-GCM.
 * Output format (base64): IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
 */
export function encryptField(plaintext: string, dek: Buffer): string {
  return encryptRaw(Buffer.from(plaintext, "utf8"), dek);
}

/**
 * Decrypt a single field value from base64 ciphertext.
 */
export function decryptField(encryptedB64: string, dek: Buffer): string {
  return decryptRaw(encryptedB64, dek);
}

// ── Batch Field Encryption / Decryption ─────────────────────────────────────

/**
 * Encrypt specified fields in an object.
 * Original field is removed; encrypted value stored as `{field}_enc`.
 *
 * @example
 *   encryptFields({ name: "Wayne", age: 30 }, ["name"], dek)
 *   // → { name_enc: "base64...", age: 30 }
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: string[],
  dek: Buffer
): Record<string, any> {
  const result: Record<string, any> = { ...obj };
  for (const field of fields) {
    if (result[field] != null && result[field] !== undefined) {
      result[`${field}_enc`] = encryptField(String(result[field]), dek);
      delete result[field];
    }
  }
  return result;
}

/**
 * Decrypt `{field}_enc` fields back to their original field names.
 *
 * @example
 *   decryptFields({ name_enc: "base64...", age: 30 }, ["name"], dek)
 *   // → { name: "Wayne", age: 30 }
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: string[],
  dek: Buffer
): Record<string, any> {
  const result: Record<string, any> = { ...obj };
  for (const field of fields) {
    const encKey = `${field}_enc`;
    if (result[encKey] != null && result[encKey] !== undefined) {
      result[field] = decryptField(result[encKey] as string, dek);
      delete result[encKey];
    }
  }
  return result;
}

// ── Blind Index ─────────────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 blind index for searchable encrypted fields.
 * Always normalizes to lowercase + trim before hashing.
 *
 * @example
 *   blindIndex("Wayne@Example.com") // deterministic hex hash
 */
export function blindIndex(value: string): string {
  const secret = process.env.BLIND_INDEX_SECRET;
  if (!secret) {
    throw new Error("[Encryption] BLIND_INDEX_SECRET env var is required for blind index.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(value.toLowerCase().trim())
    .digest("hex");
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/** Low-level AES-256-GCM encrypt: returns base64(iv + authTag + ciphertext) */
function encryptRaw(data: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Low-level AES-256-GCM decrypt: input is base64(iv + authTag + ciphertext) */
function decryptRaw(encryptedB64: string, key: Buffer): string {
  const buf = Buffer.from(encryptedB64, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("[Encryption] Ciphertext too short — corrupted or invalid data.");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── Exported Constants (for schema & documentation) ─────────────────────────

export const ENCRYPTION_ALGORITHM = ALGORITHM;
export const ENCRYPTION_DEK_CACHE_TTL_MS = DEK_CACHE_TTL_MS;
