import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const handler = createExpressMiddleware({
  router: appRouter,
  createContext,
});

export default handler;
