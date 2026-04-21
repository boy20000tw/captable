# SPEC: DocuSeal eSignature Integration

> **Goal**: Let founders send equity documents (share certificates, SAFE agreements, stock option grants) for electronic signature via DocuSeal, track signing status, and store signed PDFs — all scoped per company.

---

## 一、Architecture Overview

```
┌─────────────┐   create_submission   ┌──────────────┐
│  Caploom     │ ──────────────────▶  │  DocuSeal     │
│  Backend     │                      │  Cloud API    │
│              │ ◀──────────────────  │               │
└─────────────┘   webhook callback    └──────────────┘
       │               (form.completed / form.started)
       ▼
  signing_requests table + audit_log
```

**Auth**: `X-Auth-Token: <DOCUSEAL_API_KEY>` header on every DocuSeal API call.  
**Base URL**: `https://api.docuseal.com` (or custom via `DOCUSEAL_API_URL` env var).

---

## 二、Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `DOCUSEAL_API_KEY` | DocuSeal account API key (Settings → API) |
| `DOCUSEAL_API_URL` | Optional. Default `https://api.docuseal.com` |
| `DOCUSEAL_WEBHOOK_SECRET` | Webhook secret header for verifying inbound webhooks |

> ⚠ 這些是 **平台級** 環境變數，不是 per-company。Per-company 的 `docusealTenantApiKey` 欄位在 `companies` table 已預留，Phase 3 再做 multi-tenant DocuSeal。

---

## 三、Database Changes (`drizzle/schema.ts`)

### 3.1 New enum: `signingStatusEnum`

```ts
export const signingStatusEnum = pgEnum("signing_status", [
  "draft",      // Created but not sent
  "pending",    // Sent, waiting for signatures
  "viewed",     // At least one signer has viewed
  "completed",  // All signers signed
  "declined",   // A signer declined
  "expired",    // Past deadline, not completed
]);
```

### 3.2 New enum: `signingDocTypeEnum`

```ts
export const signingDocTypeEnum = pgEnum("signing_doc_type", [
  "share_certificate",
  "safe_agreement",
  "convertible_note",
  "stock_option_grant",
  "board_resolution",
  "sha",               // Shareholders' Agreement
  "custom",
]);
```

### 3.3 New table: `signing_requests`

```ts
export const signingRequests = pgTable("signing_requests", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),

  // Document type & metadata
  docType: signingDocTypeEnum("doc_type").notNull(),
  title: text("title").notNull(),                     // e.g. "Series A Share Certificate — John Doe"
  description: text("description"),

  // Linked entity (optional — ties back to an investor/instrument/grant)
  linkedResourceType: text("linked_resource_type"),   // "investor" | "instrument" | "esop_grant" | null
  linkedResourceId: integer("linked_resource_id"),

  // DocuSeal IDs
  docusealTemplateId: integer("docuseal_template_id"),
  docusealSubmissionId: integer("docuseal_submission_id"),

  // Status
  status: signingStatusEnum("status").default("draft").notNull(),

  // Signers (JSON array: [{role, name, email, signedAt?}])
  signers: text("signers"),  // JSON string

  // Files
  sourceDocumentUrl: text("source_document_url"),  // original uploaded PDF/DOCX
  signedDocumentUrl: text("signed_document_url"),  // completed signed PDF (from DocuSeal webhook)

  // Tracking
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),

  // Metadata
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SigningRequest = typeof signingRequests.$inferSelect;
export type InsertSigningRequest = typeof signingRequests.$inferInsert;
```

---

## 四、Server: DB Functions (`server/db.ts`)

Add these functions with `companyId` scoping (same pattern as instruments):

```ts
// ─── Signing Requests ────────────────────────────────────────────────────────

export async function getAllSigningRequests(companyId: number) {
  return db.select().from(signingRequests)
    .where(eq(signingRequests.companyId, companyId))
    .orderBy(desc(signingRequests.createdAt));
}

export async function getSigningRequestById(companyId: number, id: number) {
  const [row] = await db.select().from(signingRequests)
    .where(and(eq(signingRequests.companyId, companyId), eq(signingRequests.id, id)));
  return row;
}

export async function getSigningRequestsByStatus(companyId: number, status: string) {
  return db.select().from(signingRequests)
    .where(and(eq(signingRequests.companyId, companyId), eq(signingRequests.status, status)))
    .orderBy(desc(signingRequests.createdAt));
}

export async function getSigningRequestBySubmissionId(submissionId: number) {
  const [row] = await db.select().from(signingRequests)
    .where(eq(signingRequests.docusealSubmissionId, submissionId));
  return row;
}

export async function createSigningRequest(data: InsertSigningRequest) {
  const [row] = await db.insert(signingRequests).values(data).returning();
  return row;
}

export async function updateSigningRequest(companyId: number, id: number, data: Partial<InsertSigningRequest>) {
  const [row] = await db.update(signingRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(signingRequests.companyId, companyId), eq(signingRequests.id, id)))
    .returning();
  return row;
}

export async function deleteSigningRequest(companyId: number, id: number) {
  return db.delete(signingRequests)
    .where(and(eq(signingRequests.companyId, companyId), eq(signingRequests.id, id)));
}
```

Also add `signingRequests` to `truncateAllBusinessData`.

---

## 五、Server: DocuSeal API Helper (`server/docuseal.ts`) — NEW FILE

```ts
// server/docuseal.ts — thin wrapper around DocuSeal REST API

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || "https://api.docuseal.com";
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY || "";

async function docusealFetch(path: string, options: RequestInit = {}) {
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
```

---

## 六、Server: tRPC Router (`server/routers.ts`)

Mount as `esign: esignRouter` in `appRouter`.

```ts
const esignRouter = router({
  // ─── CRUD ─────────────────────────────────────────────────────────────────

  list: companyProcedure.query(({ ctx }) =>
    getAllSigningRequests(ctx.companyId)
  ),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) =>
      getSigningRequestById(ctx.companyId, input.id)
    ),

  byStatus: companyProcedure
    .input(z.object({ status: z.string() }))
    .query(({ ctx, input }) =>
      getSigningRequestsByStatus(ctx.companyId, input.status)
    ),

  create: companyEditorProcedure
    .input(z.object({
      docType: z.enum(["share_certificate", "safe_agreement", "convertible_note", "stock_option_grant", "board_resolution", "sha", "custom"]),
      title: z.string().min(1),
      description: z.string().optional(),
      linkedResourceType: z.string().optional(),
      linkedResourceId: z.number().optional(),
      sourceDocumentUrl: z.string().optional(),
      signers: z.string().optional(),  // JSON array
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await createSigningRequest({
        companyId: ctx.companyId,
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdBy: ctx.user!.id,
      });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "create",
        resourceType: "signing_request",
        resourceName: input.title,
        changesAfter: JSON.stringify(input),
      });
      return row;
    }),

  update: companyEditorProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "pending", "viewed", "completed", "declined", "expired"]).optional(),
        signers: z.string().optional(),
        signedDocumentUrl: z.string().optional(),
        completedAt: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await updateSigningRequest(ctx.companyId, input.id, {
        ...input.data,
        completedAt: input.data.completedAt ? new Date(input.data.completedAt) : undefined,
      });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "signing_request",
        resourceId: input.id,
        changesAfter: JSON.stringify(input.data),
      });
      return row;
    }),

  delete: companyEditorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const row = await deleteSigningRequest(ctx.companyId, input.id);
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "delete",
        resourceType: "signing_request",
        resourceId: input.id,
      });
      return row;
    }),

  // ─── DocuSeal Actions ────────────────────────────────────────────────────

  /** Upload a PDF/DOCX → create DocuSeal template → update signing_request */
  createTemplate: companyEditorProcedure
    .input(z.object({
      signingRequestId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createTemplateFromPdf, createTemplateFromDocx } = await import("./docuseal");
      const ext = input.fileName.split(".").pop()?.toLowerCase();
      const createFn = ext === "docx" ? createTemplateFromDocx : createTemplateFromPdf;
      const template = await createFn(input.fileName, input.fileBase64);
      await updateSigningRequest(ctx.companyId, input.signingRequestId, {
        docusealTemplateId: template.id,
      });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "signing_request",
        resourceId: input.signingRequestId,
        changesAfter: JSON.stringify({ docusealTemplateId: template.id }),
      });
      return { templateId: template.id, template };
    }),

  /** Send the signing request → DocuSeal create_submission → mark as pending */
  send: companyEditorProcedure
    .input(z.object({
      signingRequestId: z.number(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const req = await getSigningRequestById(ctx.companyId, input.signingRequestId);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (!req.docusealTemplateId) throw new TRPCError({ code: "BAD_REQUEST", message: "No template — upload a document first" });

      const signers: Array<{ role: string; email: string; name?: string }> = req.signers ? JSON.parse(req.signers) : [];
      if (signers.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No signers defined" });

      const { createSubmission } = await import("./docuseal");
      const submission = await createSubmission(
        req.docusealTemplateId,
        signers.map(s => ({ role: s.role || "First Party", email: s.email, name: s.name })),
        {
          send_email: true,
          message: input.message,
          expire_at: req.expiresAt?.toISOString(),
        },
      );

      // submission is an array of submitter objects; the submission_id is on each
      const submissionId = Array.isArray(submission) ? submission[0]?.submission_id : submission.id;

      await updateSigningRequest(ctx.companyId, input.signingRequestId, {
        docusealSubmissionId: submissionId,
        status: "pending",
        sentAt: new Date(),
      });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "signing_request",
        resourceId: input.signingRequestId,
        resourceName: req.title,
        changesAfter: JSON.stringify({ status: "pending", docusealSubmissionId: submissionId }),
      });
      return { submissionId, submission };
    }),

  /** List DocuSeal templates (for reuse) */
  listTemplates: companyProcedure.query(async () => {
    const { listTemplates } = await import("./docuseal");
    return listTemplates();
  }),
});
```

---

## 七、Server: Webhook Endpoint (`server/_core/index.ts`)

Add a raw Express endpoint (not tRPC) to receive DocuSeal webhook callbacks.

```ts
// ─── DocuSeal Webhook ────────────────────────────────────────────────────────
app.post("/api/webhooks/docuseal", express.json(), async (req, res) => {
  try {
    // Verify webhook secret if configured
    const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
    if (secret && req.headers["x-docuseal-secret"] !== secret) {
      console.warn("DocuSeal webhook: invalid secret");
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    const { event_type, data } = req.body;
    console.log(`DocuSeal webhook: ${event_type}`, data?.submission_id);

    if (event_type === "form.completed") {
      // data.submission_id → look up our signing_request
      const signingReq = await getSigningRequestBySubmissionId(data.submission_id);
      if (signingReq) {
        // data.documents is an array of { name, url } for signed PDFs
        const signedUrl = data.documents?.[0]?.url || null;
        // Update signer status in signers JSON
        const signers = signingReq.signers ? JSON.parse(signingReq.signers) : [];
        const updatedSigners = signers.map((s: any) => {
          if (s.email === data.email) {
            return { ...s, signedAt: new Date().toISOString() };
          }
          return s;
        });

        // Check if all signers have signed
        const allSigned = updatedSigners.every((s: any) => s.signedAt);

        await updateSigningRequest(signingReq.companyId, signingReq.id, {
          signers: JSON.stringify(updatedSigners),
          ...(signedUrl ? { signedDocumentUrl: signedUrl } : {}),
          ...(allSigned ? { status: "completed", completedAt: new Date() } : { status: "viewed" }),
        });

        await createAuditLog({
          companyId: signingReq.companyId,
          userId: signingReq.createdBy || 0,
          action: "webhook",
          resourceType: "signing_request",
          resourceId: signingReq.id,
          resourceName: signingReq.title,
          changesAfter: JSON.stringify({ event: event_type, signer: data.email, allSigned }),
        });
      }
    }

    if (event_type === "form.started" || event_type === "form.viewed") {
      const signingReq = await getSigningRequestBySubmissionId(data.submission_id);
      if (signingReq && signingReq.status === "pending") {
        await updateSigningRequest(signingReq.companyId, signingReq.id, { status: "viewed" });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("DocuSeal webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
```

> **Webhook URL to configure in DocuSeal dashboard**: `https://<your-domain>/api/webhooks/docuseal`

---

## 八、Frontend: eSign Page (`client/src/pages/ESign.tsx`) — NEW FILE

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ eSignature                              [+ New Request] │
├─────────────────────────────────────────────────────────┤
│ Tabs: All | Draft | Pending | Completed | Declined      │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Title         Type              Signers   Status    │ │
│ │ Series A...   Share Certificate 2/3       Pending   │ │
│ │ SAFE — JD     SAFE Agreement    1/1       Completed │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ── New / Edit Dialog ──                                 │
│ Document Type: [dropdown]                               │
│ Title: [input]                                          │
│ Upload Document: [file picker - PDF/DOCX]               │
│ Signers:                                                │
│   [+ Add Signer] → role, name, email                    │
│ Expiry Date: [date picker, optional]                    │
│ Description: [textarea]                                 │
│                                                         │
│ [Save Draft]  [Upload & Send for Signing]               │
└─────────────────────────────────────────────────────────┘
```

### Key UI behaviors

1. **Create flow**: Fill form → Save Draft → Upload document (calls `esign.createTemplate`) → Add signers → Send (calls `esign.send`)
2. **Status badges**: `draft` = gray, `pending` = yellow, `viewed` = blue, `completed` = green, `declined` = red, `expired` = gray
3. **Completed row**: Shows "Download Signed PDF" link (`signedDocumentUrl`)
4. **Mobile**: Same `flex-col sm:flex-row` header pattern, `overflow-x-auto` table

### Type labels

```ts
const DOC_TYPE_LABELS: Record<string, string> = {
  share_certificate: "Share Certificate",
  safe_agreement: "SAFE Agreement",
  convertible_note: "Convertible Note",
  stock_option_grant: "Stock Option Grant",
  board_resolution: "Board Resolution",
  sha: "Shareholders' Agreement",
  custom: "Custom Document",
};
```

---

## 九、Navigation & Routing

### `DashboardLayout.tsx` — Add to Ownership group

```ts
// In menuGroups → "Ownership" items array, add:
{ icon: PenLine, label: "eSignature", path: "/esign" },
```

Import `PenLine` from `lucide-react`.

### `App.tsx` — Add route

```ts
import ESignPage from "./pages/ESign";
// ...
<Route path="/esign" component={ESignPage} />
```

### `MobileBottomNav.tsx` — NO CHANGE

eSignature stays in the sidebar "More" sheet on mobile (it's in Ownership group which already appears in the More sheet).

---

## 十、Company Settings — Activate Signature Upload

In `client/src/pages/v1/CompanySettings.tsx`, uncomment/add the signature upload UI section that was deferred to Phase 2. This allows the representative to upload their signature image.

The backend `trpc.companies.uploadSignature` mutation already exists and works.

---

## 十一、Migration Command

```bash
cd ~/Desktop/Claude\ Task/captable-v2
npx drizzle-kit generate
npx drizzle-kit push
```

---

## 十二、Implementation Order

1. Schema: add enums + `signing_requests` table → generate migration
2. `server/docuseal.ts` — new file, DocuSeal API wrapper
3. `server/db.ts` — add CRUD functions
4. `server/routers.ts` — add `esignRouter`, mount in appRouter
5. `server/_core/index.ts` — add webhook endpoint
6. `client/src/pages/ESign.tsx` — new page
7. `client/src/pages/v1/CompanySettings.tsx` — activate signature upload section
8. `DashboardLayout.tsx` + `App.tsx` — nav + routing
9. TypeScript check: `npx tsc --noEmit`

---

## 十三、Env Setup Checklist

Before running:

- [ ] DocuSeal account registered (boy20000tw@gmail.com) ✅
- [ ] Get API key from https://console.docuseal.com/api
- [ ] Set in Vercel: `DOCUSEAL_API_KEY`
- [ ] Set in Vercel: `DOCUSEAL_API_URL` (optional, defaults to `https://api.docuseal.com`)
- [ ] After deploy: configure webhook URL in DocuSeal dashboard → `https://<domain>/api/webhooks/docuseal`
- [ ] Set in Vercel: `DOCUSEAL_WEBHOOK_SECRET` (match the value in DocuSeal webhook settings)
