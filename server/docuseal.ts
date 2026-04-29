// server/docuseal.ts — thin wrapper around DocuSeal REST API
//
// Per-company API key: each company stores its own key in DB (docuseal_tenant_api_key).
// Fallback: if no per-company key, uses DOCUSEAL_API_KEY env var (platform-level).
// Base URL defaults to https://api.docuseal.com, override with DOCUSEAL_API_URL.

import { getCompanyById, resolveCompanyDek } from "./db";
import { decryptField } from "./encryption";

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || "https://api.docuseal.com";
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY || "";

/**
 * Resolve the API key for a given company.
 * Priority: encrypted key > plaintext key > global env var.
 */
export async function resolveApiKey(companyId?: number | null): Promise<string> {
  if (companyId) {
    const company = await getCompanyById(companyId);
    if (company) {
      // Prefer encrypted version (Phase 4)
      if (company.docusealTenantApiKeyEnc) {
        try {
          const dek = await resolveCompanyDek(companyId);
          return decryptField(company.docusealTenantApiKeyEnc, dek);
        } catch { /* fall through to plaintext */ }
      }
      if (company.docusealTenantApiKey) {
        return company.docusealTenantApiKey;
      }
    }
  }
  return DOCUSEAL_API_KEY;
}

/**
 * Check whether a company has a valid DocuSeal connection (has an API key stored).
 */
export async function hasDocuSealConnection(companyId: number): Promise<boolean> {
  const company = await getCompanyById(companyId);
  return !!(company?.docusealTenantApiKeyEnc || company?.docusealTenantApiKey);
}

/**
 * Validate a DocuSeal API key by calling GET /templates?limit=1.
 * Returns true if the key is valid, false otherwise.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${DOCUSEAL_API_URL}/templates?limit=1`, {
      headers: {
        "X-Auth-Token": apiKey,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, error: "Invalid API key" };
    const body = await res.text();
    return { valid: false, error: `DocuSeal returned ${res.status}: ${body}` };
  } catch (err: any) {
    return { valid: false, error: err.message || "Network error" };
  }
}

async function docusealFetch(apiKey: string, path: string, options: RequestInit = {}) {
  if (!apiKey) {
    throw new Error("No DocuSeal API key available. Please connect your DocuSeal account first.");
  }
  const res = await fetch(`${DOCUSEAL_API_URL}${path}`, {
    ...options,
    headers: {
      "X-Auth-Token": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DocuSeal API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, "/templates");
}

export async function getTemplate(templateId: number, companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, `/templates/${templateId}`);
}

export async function createTemplateFromPdf(name: string, fileBase64: string, companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, "/templates/pdf", {
    method: "POST",
    body: JSON.stringify({
      name,
      documents: [{ name, file: fileBase64 }],
    }),
  });
}

export async function createTemplateFromDocx(name: string, fileBase64: string, companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, "/templates/docx", {
    method: "POST",
    body: JSON.stringify({
      name,
      documents: [{ name, file: fileBase64 }],
    }),
  });
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export interface DocuSealSubmitter {
  role: string;
  email: string;
  name?: string;
  external_id?: string;
  fields?: Array<{ name: string; default_value: string }>;
}

export async function createSubmission(
  templateId: number,
  submitters: DocuSealSubmitter[],
  options?: { send_email?: boolean; message?: string; expire_at?: string },
  companyId?: number | null,
) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, "/submissions", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      send_email: options?.send_email ?? true,
      message: options?.message,
      expire_at: options?.expire_at,
      submitters,
    }),
  });
}

export async function getSubmission(submissionId: number, companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, `/submissions/${submissionId}`);
}

export async function listSubmissions(params?: { limit?: number; after?: number }, companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.after) qs.set("after", String(params.after));
  const query = qs.toString();
  return docusealFetch(key, `/submissions${query ? `?${query}` : ""}`);
}

export async function archiveSubmission(submissionId: number, companyId?: number | null) {
  const key = await resolveApiKey(companyId);
  return docusealFetch(key, `/submissions/${submissionId}`, { method: "DELETE" });
}
