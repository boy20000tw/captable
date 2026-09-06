/**
 * Sentry Server (Backend) Initialization
 * Import and call initSentryServer() at the TOP of server/_core/index.ts.
 */
import * as Sentry from "@sentry/node";

let _initialised = false;
export function initSentryServer() {
  if (!process.env.SENTRY_DSN || _initialised) return;
  _initialised = true;

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

/**
 * Flush pending events. Call at the end of a serverless invocation —
 * otherwise the lambda is frozen before the HTTP request to Sentry completes.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* never let monitoring break the response path */
  }
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
