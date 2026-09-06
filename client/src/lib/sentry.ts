/**
 * Sentry Client (Frontend) Initialization
 * Import and call initSentry() in main.tsx BEFORE React renders.
 */
import * as Sentry from "@sentry/react";

const DSN_RE = /^https:\/\/[0-9a-f]+@[a-z0-9.-]+\.sentry\.io\/\d+$/i;

/**
 * Validate the DSN and repair the one failure mode we have actually shipped:
 * the env var pasted twice ("https://…sentry.https://…sentry.io/123").
 * An invalid DSN makes Sentry.init() throw → zero frontend monitoring, silently.
 */
function resolveDsn(): string | null {
  const raw = (import.meta.env.VITE_SENTRY_DSN ?? "").trim();
  if (!raw) return null;
  if (DSN_RE.test(raw)) return raw;
  const lastHttps = raw.lastIndexOf("https://");
  const repaired = lastHttps > 0 ? raw.slice(lastHttps) : raw;
  if (DSN_RE.test(repaired)) {
    console.warn("[Sentry] VITE_SENTRY_DSN looked malformed — repaired at runtime. Fix the env var in Vercel.");
    return repaired;
  }
  console.error("[Sentry] VITE_SENTRY_DSN is invalid — frontend error monitoring is DISABLED. Fix the env var in Vercel.");
  return null;
}

export function initSentry() {
  const dsn = resolveDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `caploom@${import.meta.env.VITE_APP_VERSION ?? "unknown"}`,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      const frames = event.exception?.values?.[0]?.stacktrace?.frames;
      if (frames?.some((f) => f.filename?.includes("extension://"))) {
        return null;
      }
      return event;
    },
  });
}

/** Set user context after authentication. */
export function setSentryUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.name ?? undefined,
  });
}

/** Clear user context on logout. */
export function clearSentryUser() {
  Sentry.setUser(null);
}
