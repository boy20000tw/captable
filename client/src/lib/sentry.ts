/**
 * Sentry Client (Frontend) Initialization
 * Import and call initSentry() in main.tsx BEFORE React renders.
 */
import * as Sentry from "@sentry/react";

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
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
