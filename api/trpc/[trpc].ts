// Sentry MUST be initialised before anything else is imported so that the
// express/tRPC integrations can instrument correctly. Previously initSentryServer()
// was only called in server/_core/index.ts (the local dev server), which means
// production on Vercel never had backend error monitoring at all. (v2.66)
import { initSentryServer, flushSentry } from "../../server/_core/sentry";
initSentryServer();

import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const app = express();

// Clerk must run first to populate req.auth
app.use(clerkMiddleware());

// tRPC handler
app.use(
    createExpressMiddleware({
          router: appRouter,
          createContext,
    })
  );

/**
 * Vercel serverless wrapper.
 * We wait for the response to finish, then flush Sentry so captured errors
 * actually leave the lambda before it is frozen. Without the flush, events
 * captured in the tRPC errorFormatter are silently dropped most of the time.
 */
export default async function handler(req: express.Request, res: express.Response) {
  await new Promise<void>((resolve) => {
    res.once("finish", () => resolve());
    res.once("close", () => resolve());
    app(req, res);
  });
  await flushSentry();
}
