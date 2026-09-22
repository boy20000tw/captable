import type { IncomingMessage, ServerResponse } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { getAuth } from "./auth";

let _handler: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | null = null;

/**
 * Node handler for /api/auth/*. Must be mounted BEFORE any body parser.
 *
 * On Vercel the function lives at /api/auth and receives the sub-path through
 * a rewrite (`/api/auth/:path*` → `/api/auth?__ba=:path*`). Rebuild the
 * original URL so Better Auth's router sees e.g. /api/auth/callback/google.
 */
export async function handleAuthRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://internal");
  const sub = url.searchParams.get("__ba");
  if (sub !== null) {
    url.searchParams.delete("__ba");
    const qs = url.searchParams.toString();
    req.url = `/api/auth/${sub.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
  }
  if (!_handler) _handler = toNodeHandler(await getAuth());
  await _handler(req, res);
}
