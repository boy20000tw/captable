import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

const EDITOR_ROLES = ['owner', 'admin', 'cfo'] as const;

export const editorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const appRole = (ctx.user as { appRole?: string }).appRole;
    if (!appRole || !(EDITOR_ROLES as readonly string[]).includes(appRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to perform this action. Only Owner, Admin, and CFO roles can modify data." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

export const ownerAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const appRole = (ctx.user as { appRole?: string }).appRole;
    if (!appRole || !(['owner', 'admin'] as string[]).includes(appRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only Owner and Admin can manage team members." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
