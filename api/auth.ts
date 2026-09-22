// Better Auth endpoint (v2.69). All /api/auth/* paths are rewritten here by
// vercel.json; see server/_core/authHandler.ts for the URL reconstruction.
import { initSentryServer, flushSentry } from "../server/_core/sentry";
initSentryServer();

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAuthRequest } from "../server/_core/authHandler";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await handleAuthRequest(req, res);
  } catch (err) {
    console.error("[api/auth] handler error", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "auth_unavailable" }));
    }
  } finally {
    await flushSentry();
  }
}
