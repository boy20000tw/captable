import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { planHasFeature, minimumPlanFor, normalizePlan, type Feature, type PlanKey } from "../../shared/plans";
import { type AdminRole, getAdminCapabilities, normalizeAdminRole } from "../../shared/adminPermissions";
import { apiLimiter, getIdentifier } from "./ratelimit";
import { captureError } from "./sentry";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Sanitise raw DB / internal errors so they don't leak to the client.
    // TRPCErrors with explicit messages (auth, validation, plan guard) pass through unchanged.
    if (error.code === "INTERNAL_SERVER_ERROR") {
      captureError(error.cause ?? error, {
        trpcPath: shape.data?.path,
        trpcCode: shape.data?.code,
      });
      console.error("[tRPC] Internal error:", error.cause ?? error.message);
      return {
        ...shape,
        message: "An unexpected error occurred. Please try again.",
        data: { ...shape.data, stack: undefined },
      };
    }
    // Strip stack traces in production for all error types
    return {
      ...shape,
      data: { ...shape.data, stack: process.env.NODE_ENV === "production" ? undefined : shape.data.stack },
    };
  },
});

export const router = t.router;

// ─── Rate Limiter Middleware ──────────────────────────────────────────────
const rateLimitApi = t.middleware(async ({ ctx, next }) => {
  if (!apiLimiter) return next();
  const identifier = getIdentifier(ctx.req);
  const { success, remaining, reset } = await apiLimiter.limit(identifier);
  ctx.res.setHeader("X-RateLimit-Remaining", remaining.toString());
  ctx.res.setHeader("X-RateLimit-Reset", reset.toString());
  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
    });
  }
  return next();
});

export const publicProcedure = t.procedure.use(rateLimitApi);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(rateLimitApi).use(requireUser);

export const adminProcedure = t.procedure.use(rateLimitApi).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      console.warn(`[Admin Auth] FORBIDDEN: user=${ctx.user?.id ?? "anon"} attempted admin access`);
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    const adminRole = normalizeAdminRole(ctx.user.adminRole);
    return next({ ctx: { ...ctx, user: ctx.user, adminRole } });
  }),
);

// ─── Granular Admin Procedures ──────────────────────────────────────────────
// Use these for admin routes that require specific capabilities.

/** Require admin with canManageCompanies capability */
export const adminCompanyProcedure = t.procedure.use(rateLimitApi).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      console.warn(`[Admin Auth] FORBIDDEN: user=${ctx.user?.id ?? "anon"} attempted admin-company access`);
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    const adminRole = normalizeAdminRole(ctx.user.adminRole);
    if (!getAdminCapabilities(adminRole).canManageCompanies) {
      console.warn(`[Admin Auth] FORBIDDEN: user=${ctx.user.id} role=${adminRole} lacks canManageCompanies`);
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient admin privileges for company management." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, adminRole } });
  }),
);

/** Require admin with canManageAdminTeam capability (super_admin only) */
export const superAdminProcedure = t.procedure.use(rateLimitApi).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      console.warn(`[Admin Auth] FORBIDDEN: user=${ctx.user?.id ?? "anon"} attempted super-admin access`);
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    const adminRole = normalizeAdminRole(ctx.user.adminRole);
    if (!getAdminCapabilities(adminRole).canManageAdminTeam) {
      console.warn(`[Admin Auth] FORBIDDEN: user=${ctx.user.id} role=${adminRole} lacks canManageAdminTeam`);
      throw new TRPCError({ code: "FORBIDDEN", message: "Only super admins can manage the admin team." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, adminRole } });
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

export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const appRole = (ctx.user as { appRole?: string }).appRole;
    if (appRole !== 'owner') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the Owner can perform this action." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

// ─── Company-Scoped Procedures ──────────────────────────────────────────────
// Require (1) user authenticated and (2) an active company resolved in context.
// Active company comes from `x-company-id` header (validated for membership)
// or falls back to the user's first membership.

export const companyProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!ctx.companyId || !ctx.companyRole) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No active company. Create or select a company first." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, companyId: ctx.companyId, companyRole: ctx.companyRole } });
  }),
);

const COMPANY_EDITOR_ROLES = ['owner', 'admin', 'cfo'] as const;

export const companyEditorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!ctx.companyId || !ctx.companyRole) throw new TRPCError({ code: "FORBIDDEN", message: "No active company." });
    if (!(COMPANY_EDITOR_ROLES as readonly string[]).includes(ctx.companyRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only Owner, Admin, and CFO in this company can modify data." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, companyId: ctx.companyId, companyRole: ctx.companyRole } });
  }),
);

export const companyOwnerAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!ctx.companyId || !ctx.companyRole) throw new TRPCError({ code: "FORBIDDEN", message: "No active company." });
    if (!(['owner', 'admin'] as string[]).includes(ctx.companyRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only Owner and Admin can manage team members." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, companyId: ctx.companyId, companyRole: ctx.companyRole } });
  }),
);

export const companyOwnerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!ctx.companyId || !ctx.companyRole) throw new TRPCError({ code: "FORBIDDEN", message: "No active company." });
    if (ctx.companyRole !== 'owner') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the Owner of this company can perform this action." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, companyId: ctx.companyId, companyRole: ctx.companyRole } });
  }),
);

// ─── Plan Guard ────────────────────────────────────────────────────────────
// Factory: returns a middleware that checks if the company's plan includes
// the required feature. Returns FORBIDDEN with code "UPGRADE_REQUIRED" if not.
//
// Usage: companyProcedure.use(requireFeature("fundraising.rounds")).query(...)

export function requireFeature(feature: Feature) {
  return t.middleware(async ({ ctx, next }) => {
    const plan = normalizePlan(ctx.companyPlan as string);
    if (!planHasFeature(plan, feature)) {
      const required = minimumPlanFor(feature);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `UPGRADE_REQUIRED:${required}`,
      });
    }
    // Pass through without re-wrapping ctx to preserve narrowed types from prior middleware
    return next();
  });
}
