import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { clerkClient } from "@clerk/express";
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
        // Clerk adds auth info to the request via middleware
      const auth = (opts.req as any).auth;
        if (auth?.userId) {
                user = await getUserByOpenId(auth.userId) ?? null;
                // Auto-sync user from Clerk if not in our DB
          if (!user) {
                    try {
                                const clerkUser = await clerkClient.users.getUser(auth.userId);
                                const clerkEmail = clerkUser.emailAddresses[0]?.emailAddress ?? null;
                                const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

                                // Check if this is a pre-provisioned admin logging in for the first time
                                if (clerkEmail) {
                                  const pendingUser = await getUserByEmail(clerkEmail);
                                  if (pendingUser && typeof pendingUser.openId === "string" && pendingUser.openId.startsWith("pending_")) {
                                    // Bind the real Clerk openId to the pre-provisioned record
                                    await bindPendingAdminOpenId(pendingUser.id, auth.userId, clerkName);
                                    user = await getUserByOpenId(auth.userId) ?? null;
                                    console.log(`[Context] Bound pre-provisioned admin ${clerkEmail} → ${auth.userId}`);
                                  }
                                }

                                // Standard new-user sync (if not a pre-provisioned admin)
                                if (!user) {
                                  await upsertUser({
                                    openId: auth.userId,
                                    name: clerkName,
                                    email: clerkEmail,
                                    loginMethod: "clerk",
                                    lastSignedIn: new Date(),
                                  });
                                  user = await getUserByOpenId(auth.userId) ?? null;
                                }
                    } catch (syncError) {
                                console.error("[Context] Failed to sync Clerk user:", syncError);
                    }
          } else {
                    // Update lastSignedIn for existing users
                  try {
                              await upsertUser({
                                            openId: auth.userId,
                                            lastSignedIn: new Date(),
                              });
                  } catch (_) { /* non-critical */ }
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
