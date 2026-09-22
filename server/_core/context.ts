import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getRequestSession } from "./auth";
import { getUserByOpenId, getUserByEmail, bindPendingAdminOpenId, upsertUser, getUserCompanyMemberships, resolveCompanyMembership, getCompanyById } from "../db";
import { normalizePlan, type PlanKey } from "../../shared/plans";

export type CompanyMemberRole = "owner" | "admin" | "cfo" | "lawyer" | "investor" | "viewer";

export type TrpcContext = {
    req: CreateExpressContextOptions["req"];
    res: CreateExpressContextOptions["res"];
    user: User | null;
    // Active company context — set if user sent x-company-id header AND is a member,
    // or defaults to user's first company membership. null if no membership.
    companyId: number | null;
    companyRole: CompanyMemberRole | null;
    companyPlan: PlanKey | null;
};

export async function createContext(
    opts: CreateExpressContextOptions
  ): Promise<TrpcContext> {
    let user: User | null = null;
    let companyId: number | null = null;
    let companyRole: CompanyMemberRole | null = null;
    let companyPlan: PlanKey | null = null;

  try {
    // v2.69: Better Auth session (first-party cookie) replaces Clerk's req.auth
    const session = await getRequestSession(opts.req.headers);
    if (session) {
      // Keep `req.auth.userId` for the rate-limiter identifier (was set by Clerk)
      (opts.req as any).auth = { userId: session.userId };
      user = (await getUserByOpenId(session.userId)) ?? null;

      if (!user) {
        try {
          // First Better Auth login for someone we already know (Clerk-era account,
          // or an admin pre-provisioned by email as `pending_*`): re-bind the
          // existing row to the new identity. Only on a VERIFIED email — Google
          // accounts and email-OTP sign-ins both prove ownership of the address.
          if (session.emailVerified && session.email) {
            const existing = await getUserByEmail(session.email);
            if (existing) {
              await bindPendingAdminOpenId(existing.id, session.userId, existing.name ? null : session.name);
              user = (await getUserByOpenId(session.userId)) ?? null;
              console.log(`[Context] Re-bound user #${existing.id} to Better Auth identity`);
            }
          }

          if (!user) {
            await upsertUser({
              openId: session.userId,
              name: session.name,
              email: session.email,
              loginMethod: "better-auth",
              lastSignedIn: new Date(),
            });
            user = (await getUserByOpenId(session.userId)) ?? null;
          }
        } catch (syncError) {
          console.error("[Context] Failed to sync auth user:", syncError);
        }
      } else {
        // Update lastSignedIn at most hourly (was: a DB write on every request)
        const last = user.lastSignedIn ? new Date(user.lastSignedIn).getTime() : 0;
        if (Date.now() - last > 60 * 60 * 1000) {
          try {
            await upsertUser({ openId: session.userId, lastSignedIn: new Date() });
          } catch (_) { /* non-critical */ }
        }
      }
    }
  } catch (error) {
    console.error("[Context] Auth error:", error);
    user = null;
  }

  // Resolve active company: x-company-id header (validated) OR user's first membership
  if (user) {
    try {
      const headerValue = (opts.req.headers["x-company-id"] ?? opts.req.headers["X-Company-Id"]) as string | undefined;
      const requestedCompanyId = headerValue ? parseInt(String(headerValue), 10) : NaN;

      if (!Number.isNaN(requestedCompanyId) && requestedCompanyId > 0) {
        const membership = await resolveCompanyMembership(user.id, requestedCompanyId);
        if (membership) {
          companyId = membership.companyId;
          companyRole = membership.role as CompanyMemberRole;
        }
      }

      if (!companyId) {
        const memberships = await getUserCompanyMemberships(user.id);
        if (memberships.length > 0) {
          companyId = memberships[0].companyId;
          companyRole = memberships[0].role as CompanyMemberRole;
        }
      }
    } catch (error) {
      console.error("[Context] Company resolution error:", error);
    }
  }

  // Resolve company plan
  if (companyId) {
    try {
      const company = await getCompanyById(companyId);
      companyPlan = normalizePlan(company?.plan as string);
    } catch (_) { companyPlan = "starter"; }
  }

  return { req: opts.req, res: opts.res, user, companyId, companyRole, companyPlan };
}
