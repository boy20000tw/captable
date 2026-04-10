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
import { getUserByOpenId } from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Clerk auth middleware
  app.use(clerkMiddleware());

  // Excel file upload endpoint
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post("/api/import/excel", upload.single("file"), async (req, res) => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      const result = await importExcelFile(req.file.buffer, req.file.originalname);
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

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

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
