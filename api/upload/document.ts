import express from "express";
import { clerkMiddleware } from "@clerk/express";
import multer from "multer";
import { getUserByOpenId } from "../../server/db";
import { storagePut } from "../../server/storage";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(clerkMiddleware());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

export default app;
