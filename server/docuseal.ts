// server/docuseal.ts — thin wrapper around DocuSeal REST API
//
// Auth: X-Auth-Token header with DOCUSEAL_API_KEY env var.
// Base URL defaults to https://api.docuseal.com, override with DOCUSEAL_API_URL.

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || "https://api.docuseal.com";
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY || "";

async function docusealFetch(path: string, options: RequestInit = {}) {
  if (!DOCUSEAL_API_KEY) {
    throw new Error("DOCUSEAL_API_KEY is not set");
  }
  const res = await fetch(`${DOCUSEAL_API_URL}${path}`, {
    ...options,
    headers: {
      "X-Auth-Token": DOCUSEAL_API_KEY,
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

export async function listTemplates() {
  return docusealFetch("/templates");
}

export async function getTemplate(templateId: number) {
  return docusealFetch(`/templates/${templateId}`);
}

export async function createTemplateFromPdf(name: string, fileBase64: string) {
  return docusealFetch("/templates/pdf", {
    method: "POST",
    body: JSON.stringify({
      name,
      documents: [{ name, file: fileBase64 }],
    }),
  });
}

export async function createTemplateFromDocx(name: string, fileBase64: string) {
  return docusealFetch("/templates/docx", {
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
  options?: { send_email?: boolean; message?: string; expire_at?: string }
) {
  return docusealFetch("/submissions", {
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

export async function getSubmission(submissionId: number) {
  return docusealFetch(`/submissions/${submissionId}`);
}

export async function listSubmissions(params?: { limit?: number; after?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.after) qs.set("after", String(params.after));
  const query = qs.toString();
  return docusealFetch(`/submissions${query ? `?${query}` : ""}`);
}

export async function archiveSubmission(submissionId: number) {
  return docusealFetch(`/submissions/${submissionId}`, { method: "DELETE" });
}
