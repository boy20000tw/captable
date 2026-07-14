import { initSentryServer, sentryErrorHandler } from "./sentry";
initSentryServer();

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { clerkMiddleware } from "@clerk/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import multer from "multer";
import { importExcelFile } from "../excel-import";
import { storagePut } from "../storage";
import { getUserByOpenId, getUserCompanyMemberships, resolveCompanyMembership, getSigningRequestBySubmissionId, updateSigningRequest, createAuditLog } from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── Security Headers ──────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    // Prevent MIME-type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Prevent clickjacking — allow same-origin framing only
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    // Control referrer information
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Opt out of FLoC / Topics API
    res.setHeader("Permissions-Policy", "interest-cohort=()");
    // Enforce HTTPS (Vercel terminates TLS but this helps downstream proxies)
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    // CSP — allow Clerk, Sentry, Vercel Analytics, and inline styles (shadcn/ui)
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline'",                       // shadcn/ui uses inline styles
        "img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com",
        "font-src 'self' data:",
        "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.ingest.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
        "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "upgrade-insecure-requests",
      ].join("; ")
    );
    next();
  });

  // Clerk auth middleware
  app.use(clerkMiddleware());

  // Excel file upload endpoint
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post("/api/import/excel", upload.single("file"), async (req, res) => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      const user = await getUserByOpenId(auth.userId);
      if (!user) { res.status(401).json({ error: "User not found" }); return; }
      // Resolve active company: x-company-id header (validated) OR first membership
      const headerValue = (req.headers["x-company-id"] ?? req.headers["X-Company-Id"]) as string | undefined;
      const requestedCompanyId = headerValue ? parseInt(String(headerValue), 10) : NaN;
      let companyId: number | null = null;
      if (!Number.isNaN(requestedCompanyId) && requestedCompanyId > 0) {
        const m = await resolveCompanyMembership(user.id, requestedCompanyId);
        if (m) companyId = m.companyId;
      }
      if (!companyId) {
        const memberships = await getUserCompanyMemberships(user.id);
        if (memberships.length > 0) companyId = memberships[0].companyId;
      }
      if (!companyId) { res.status(403).json({ error: "No active company" }); return; }
      const result = await importExcelFile(req.file.buffer, req.file.originalname, companyId);
      res.json(result);
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Import failed", message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Document upload endpoint
  app.post("/api/upload/document", upload.single("file"), async (req, res) => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      const user = await getUserByOpenId(auth.userId);
      if (!user) { res.status(401).json({ error: "User not found" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      const ext = req.file.originalname.split(".").pop() || "bin";
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `documents/${user.id}-${Date.now()}-${randomSuffix}.${ext}`;
      const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);
      res.json({ url, fileKey, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Upload failed", message: error instanceof Error ? error.message : String(error) });
    }
  });

  // ─── DocuSeal Webhook ──────────────────────────────────────────────────────
  app.post("/api/webhooks/docuseal", async (req, res) => {
    try {
      const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
      if (secret && req.headers["x-docuseal-secret"] !== secret) {
        console.warn("DocuSeal webhook: invalid secret");
        res.status(401).json({ error: "Invalid webhook secret" });
        return;
      }
      const { event_type, data } = req.body;
      // Operational logging for webhook processing
      if (process.env.DEBUG) console.log(`[DocuSeal] webhook ${event_type}:`, data?.submission_id);

      if (event_type === "form.completed" && data?.submission_id) {
        const signingReq = await getSigningRequestBySubmissionId(data.submission_id);
        if (signingReq) {
          const signedUrl = data.documents?.[0]?.url || null;
          const signers = signingReq.signers ? JSON.parse(signingReq.signers) : [];
          const updatedSigners = signers.map((s: any) => {
            if (s.email === data.email) return { ...s, signedAt: new Date().toISOString() };
            return s;
          });
          const allSigned = updatedSigners.every((s: any) => s.signedAt);
          await updateSigningRequest(signingReq.companyId, signingReq.id, {
            signers: JSON.stringify(updatedSigners),
            ...(signedUrl ? { signedDocumentUrl: signedUrl } : {}),
            ...(allSigned ? { status: "completed", completedAt: new Date() } : { status: "viewed" }),
          });
          await createAuditLog({
            companyId: signingReq.companyId,
            userId: signingReq.createdBy || 0,
            action: "update", resourceType: "signing_request",
            resourceId: signingReq.id, resourceName: signingReq.title,
            changesAfter: JSON.stringify({ event: event_type, signer: data.email, allSigned }),
          });
        }
      }

      if ((event_type === "form.started" || event_type === "form.viewed") && data?.submission_id) {
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

  // ─── Export endpoints (PDF / Excel) ────────────────────────────────────────
  // All export routes require authenticated user + company membership.
  async function resolveExportContext(req: any, res: any): Promise<{ companyId: number } | null> {
    const auth = (req as any).auth;
    if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
    const user = await getUserByOpenId(auth.userId);
    if (!user) { res.status(401).json({ error: "User not found" }); return null; }
    const memberships = await getUserCompanyMemberships(user.id);
    if (memberships.length === 0) { res.status(403).json({ error: "No company access" }); return null; }
    // Use companyId from query param or first membership
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : memberships[0].companyId;
    const isMember = memberships.some(m => m.companyId === companyId);
    if (!isMember) { res.status(403).json({ error: "No access to this company" }); return null; }
    return { companyId };
  }

  app.get("/api/export/cap-table.pdf", async (req, res) => {
    try {
      const ctx = await resolveExportContext(req, res);
      if (!ctx) return;
      const { generateCapTablePdf } = await import("../v1/export");
      const buffer = await generateCapTablePdf(ctx.companyId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=cap-table.pdf");
      res.send(buffer);
    } catch (error) {
      console.error("Export cap-table PDF error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.get("/api/export/cap-table.xlsx", async (req, res) => {
    try {
      const ctx = await resolveExportContext(req, res);
      if (!ctx) return;
      const { generateCapTableExcel } = await import("../v1/export");
      const buffer = await generateCapTableExcel(ctx.companyId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=cap-table.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Export cap-table Excel error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.get("/api/export/share-register.xlsx", async (req, res) => {
    try {
      const ctx = await resolveExportContext(req, res);
      if (!ctx) return;
      const { generateRegisterExcel } = await import("../v1/export");
      const buffer = await generateRegisterExcel(ctx.companyId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=share-register.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Export share-register Excel error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.get("/api/export/certificate.pdf", async (req, res) => {
    try {
      const ctx = await resolveExportContext(req, res);
      if (!ctx) return;
      const { investorId, shareClass, shares, pricePerShare, currency, effectiveDate, registerEntryId } = req.query;
      if (!investorId || !shareClass || !shares || !effectiveDate) {
        res.status(400).json({ error: "Missing required params: investorId, shareClass, shares, effectiveDate" });
        return;
      }
      const { generateShareCertificatePdf } = await import("../v1/export");
      const buffer = await generateShareCertificatePdf(ctx.companyId, {
        investorId: Number(investorId),
        shareClass: String(shareClass),
        shares: Number(shares),
        pricePerShare: pricePerShare ? String(pricePerShare) : null,
        currency: currency ? String(currency) : "USD",
        effectiveDate: String(effectiveDate),
        registerEntryId: registerEntryId ? Number(registerEntryId) : undefined,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=certificate-${investorId}.pdf`);
      res.send(buffer);
    } catch (error) {
      console.error("Export certificate PDF error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Sentry error handler — must be after all API routes
  app.use(sentryErrorHandler());

  // In development, serve Vite dev server
  if (process.env.NODE_ENV === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    const path = await import("path");
    const distPath = path.resolve(import.meta.dirname, "../../dist/public");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
