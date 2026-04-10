import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { clerkClient } from "@clerk/express";
import { getUserByOpenId, upsertUser } from "../db";

export type TrpcContext = {
    req: CreateExpressContextOptions["req"];
    res: CreateExpressContextOptions["res"];
    user: User | null;
};

export async function createContext(
    opts: CreateExpressContextOptions
  ): Promise<TrpcContext> {
    let user: User | null = null;

  try {
        // Clerk adds auth info to the request via middleware
      const auth = (opts.req as any).auth;
        if (auth?.userId) {
                user = await getUserByOpenId(auth.userId) ?? null;
                // Auto-sync user from Clerk if not in our DB
          if (!user) {
                    try {
                                const clerkUser = await clerkClient.users.getUser(auth.userId);
                                await upsertUser({
                                              openId: auth.userId,
                                              name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
                                              email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
                                              loginMethod: "clerk",
                                              lastSignedIn: new Date(),
                                });
                                user = await getUserByOpenId(auth.userId) ?? null;
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

  return { req: opts.req, res: opts.res, user };
}
