/**
 * Better Auth (v2.69) — replaces Clerk.
 *
 * Identity (who you are) lives in the `ba_*` tables; business data still hangs
 * off our own `users` table, linked by `users.openId = ba_user.id`.
 *
 * Sign-in methods: Google OAuth + passwordless email OTP (sent via Resend).
 * Everything runs same-origin under https://app.cap-loom.com/api/auth/*, so the
 * session is a first-party httpOnly cookie — no third-party script on the
 * login page any more.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import { getDb } from "../db";
import { baUser, baSession, baAccount, baVerification, baRateLimit } from "../../drizzle/schema";
import { sendLoginOtpEmail } from "../email";

const PROD_URL = "https://app.cap-loom.com";
const vercelUrls = [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
  .filter(Boolean)
  .map((h) => `https://${h}`);

// Production → app.cap-loom.com; Vercel preview → its own URL (so email-code
// sign-in works on previews); local dev → localhost.
const BASE_URL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_ENV === "preview" && vercelUrls[0]
    ? vercelUrls[0]
    : process.env.NODE_ENV === "production"
      ? PROD_URL
      : `http://localhost:${process.env.PORT ?? 3000}`);

async function createAuth() {
  const db = await getDb();
  if (!db) throw new Error("[auth] DATABASE_URL not configured");

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return betterAuth({
    appName: "Caploom",
    baseURL: BASE_URL,
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: Array.from(new Set([BASE_URL, PROD_URL, ...(process.env.VERCEL_ENV === "preview" ? vercelUrls : [])])),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: baUser,
        session: baSession,
        account: baAccount,
        verification: baVerification,
        rateLimit: baRateLimit,
      },
    }),
    user: { modelName: "user" },
    session: {
      expiresIn: 60 * 60 * 24 * 30,      // 30 days
      updateAge: 60 * 60 * 24,           // refresh expiry at most once a day
      // Signed cookie cache: most requests validate the session without a DB
      // round-trip (re-checked against the DB every 5 minutes).
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "email-otp"] },
    },
    socialProviders: googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            prompt: "select_account",
          },
        }
      : {},
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        async sendVerificationOTP({ email, otp, type }) {
          // Don't await — avoids leaking timing info about whether the email exists.
          void sendLoginOtpEmail({ email, otp, type });
        },
      }),
    ],
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 10 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
      useSecureCookies: BASE_URL.startsWith("https://"),
    },
    telemetry: { enabled: false },
  });
}

type Auth = Awaited<ReturnType<typeof createAuth>>;
let _auth: Promise<Auth> | null = null;

/** Lazily build the Better Auth instance (reuses the app's DB connection). */
export function getAuth(): Promise<Auth> {
  if (!_auth) {
    _auth = createAuth().catch((err) => {
      _auth = null; // allow retry on next request
      throw err;
    });
  }
  return _auth;
}

export type AuthSession = {
  userId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
};

/** Resolve the Better Auth session for an incoming Node/Express request. */
export async function getRequestSession(headers: IncomingHttpHeaders): Promise<AuthSession | null> {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  if (!result?.user) return null;
  const u = result.user;
  return {
    userId: u.id,
    email: u.email,
    emailVerified: Boolean(u.emailVerified),
    name: u.name || null,
    image: u.image ?? null,
  };
}

/** Remove the identity record (sessions + linked accounts cascade). */
export async function deleteAuthUser(authUserId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { eq } = await import("drizzle-orm");
  await db.delete(baUser).where(eq(baUser.id, authUserId));
}
