import express from "express";
import { getSigningRequestBySubmissionId, updateSigningRequest, createAuditLog } from "../../server/db";

const app = express();
app.use(express.json());

app.post("/api/webhooks/docuseal", async (req, res) => {
  try {
    const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
    if (secret && req.headers["x-docuseal-secret"] !== secret) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }
    const { event_type, data } = req.body;

    if (event_type === "form.completed" && data?.submission_id) {
      const signingReq = await getSigningRequestBySubmissionId(data.submission_id);
      if (signingReq) {
        const signedUrl = data.documents?.[0]?.url || null;
        const signers = signingReq.signers ? JSON.parse(signingReq.signers) : [];
        const updatedSigners = signers.map((s: any) => {
          if (s.email === data.email) return { ...s, signedAt: new Date().toISOString() };
          return s;
        });
        const allSigned = updatedSigners.every((s: any) => s.signedAt);
        await updateSigningRequest(signingReq.companyId, signingReq.id, {
          signers: JSON.stringify(updatedSigners),
          ...(signedUrl ? { signedDocumentUrl: signedUrl } : {}),
          ...(allSigned ? { status: "completed", completedAt: new Date() } : { status: "viewed" }),
        });
        await createAuditLog({
          companyId: signingReq.companyId,
          userId: signingReq.createdBy || 0,
          action: "update", resourceType: "signing_request",
          resourceId: signingReq.id, resourceName: signingReq.title,
          changesAfter: JSON.stringify({ event: event_type, signer: data.email, allSigned }),
        });
      }
    }

    if ((event_type === "form.started" || event_type === "form.viewed") && data?.submission_id) {
      const signingReq = await getSigningRequestBySubmissionId(data.submission_id);
      if (signingReq && signingReq.status === "pending") {
        await updateSigningRequest(signingReq.companyId, signingReq.id, { status: "viewed" });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("DocuSeal webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default app;
