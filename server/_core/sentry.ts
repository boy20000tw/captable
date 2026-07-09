/**
 * Sentry Server (Backend) Initialization
 * Import and call initSentryServer() at the TOP of server/_core/index.ts.
 */
import * as Sentry from "@sentry/node";

export function initSentryServer() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    release: `caploom-server@${process.env.npm_package_version ?? "unknown"}`,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    integrations: [Sentry.expressIntegration()],
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-clerk-auth-token"];
      }
      return event;
    },
  });
}

/** Express error handler — add as the LAST middleware. */
export function sentryErrorHandler() {
  return Sentry.expressErrorHandler();
}

/** Capture an error manually (for caught errors in tRPC handlers). */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) {
    console.error("[Error]", error);
    return;
  }
  Sentry.captureException(error, { extra: context });
}
