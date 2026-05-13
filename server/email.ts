/**
 * Email notification service — powered by Resend.
 *
 * Requires RESEND_API_KEY env var. If missing, logs a warning
 * but does NOT throw so the main business flow is never blocked.
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn("[email] RESEND_API_KEY not set — email notifications disabled");
}

// ── Notification: new company created ──────────────────────────────────────

const ADMIN_NOTIFY_EMAIL = "wayne@cap-loom.com";

type NewCompanyPayload = {
  companyName: string;
  creatorName?: string;
  creatorEmail?: string;
  createdAt: Date;
};

export async function notifyNewCompanyCreated(payload: NewCompanyPayload) {
  if (!resend) return;

  const { companyName, creatorName, creatorEmail, createdAt } = payload;
  const time = createdAt.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  try {
    await resend.emails.send({
      from: "CapLoom Notifications <notifications@cap-loom.com>",
      to: ADMIN_NOTIFY_EMAIL,
      subject: `🆕 New Company Registered: ${companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px;">
          <h2 style="margin-bottom: 4px;">New Company Created</h2>
          <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
            <tr>
              <td style="padding: 6px 12px; font-weight: 600; color: #555;">Company</td>
              <td style="padding: 6px 12px;">${companyName}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 6px 12px; font-weight: 600; color: #555;">Created by</td>
              <td style="padding: 6px 12px;">${creatorName ?? "—"} ${creatorEmail ? `(${creatorEmail})` : ""}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-weight: 600; color: #555;">Time</td>
              <td style="padding: 6px 12px;">${time}</td>
            </tr>
          </table>
          <p style="margin-top: 16px; font-size: 13px; color: #888;">
            This is an automated notification from CapLoom.
          </p>
        </div>
      `,
    });
    console.log(`[email] New company notification sent for "${companyName}"`);
  } catch (err) {
    console.error("[email] Failed to send new company notification:", err);
  }
}
