// Better Auth browser client (v2.69) — same-origin /api/auth, httpOnly cookie session.
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export const { useSession } = authClient;
