import express from "express";
import { clerkMiddleware } from "@clerk/express";
import multer from "multer";
import { getUserByOpenId, getUserCompanyMemberships, resolveCompanyMembership } from "../../server/db";
import { importExcelFile } from "../../server/excel-import";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(clerkMiddleware());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.post("/api/import/excel", upload.single("file"), async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const user = await getUserByOpenId(auth.userId);
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
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

export default app;
