import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { planHasFeature, minimumPlanFor, normalizePlan, type Feature, type PlanKey } from "../../shared/plans";
import { type AdminRole, getAdminCapabilities, normalizeAdminRole } from "../../shared/adminPermissions";

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
    const adminRole = normalizeAdminRole(ctx.user.adminRole ?? 'super_admin');
    return next({ ctx: { ...ctx, user: ctx.user, adminRole } });
  }),
);

// ─── Granular Admin Procedures ──────────────────────────────────────────────
// Use these for admin routes that require specific capabilities.

/** Require admin with canManageCompanies capability */
export const adminCompanyProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    const adminRole = normalizeAdminRole(ctx.user.adminRole ?? 'super_admin');
    if (!getAdminCapabilities(adminRole).canManageCompanies) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient admin privileges for company management." });
    }
    return next({ ctx: { ...ctx, user: ctx.user, adminRole } });
  }),
);

/** Require admin with canManageAdminTeam capability (super_admin only) */
export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    const adminRole = normalizeAdminRole(ctx.user.adminRole ?? 'super_admin');
    if (!getAdminCapabilities(adminRole).canManageAdminTeam) {
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
