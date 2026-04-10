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

export default app;
