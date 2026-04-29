import {
  protectedProcedure, publicProcedure, router, adminProcedure,
  adminCompanyProcedure, superAdminProcedure,
  companyProcedure, companyEditorProcedure, companyOwnerAdminProcedure, companyOwnerProcedure,
  requireFeature,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  // Funding rounds (still used by V1 Rounds UI; tables shared)
  getAllFundingRounds, getFundingRoundById, createFundingRound, updateFundingRound, deleteFundingRound,
  // Anti-dilution
  getAllAntiDilutionProvisions, getProvisionsByShareholder, createAntiDilutionProvision, updateAntiDilutionProvision, deleteAntiDilutionProvision,
  // Waterfall
  getLiquidationPreferences, upsertLiquidationPreference, computeWaterfall,
  // Import logs
  getAllImportLogs,
  // Invitations
  getAllInvitations, createInvitation, getInvitationByToken, updateInvitationStatus,
  // Audit
  createAuditLog, getAuditLogs, getAuditLogsByResource,
  // Danger zone
  truncateAllBusinessData,
  // Financial projections + DCF
  getAllFinancialProjections, getFinancialProjectionById, createFinancialProjection, updateFinancialProjection, deleteFinancialProjection,
  getDcfScenariosByProjection, createDcfScenario, updateDcfScenario, deleteDcfScenario,
  // Companies
  getCompanyById, createCompany, updateCompany,
  getUserCompanyMemberships, listCompanyMembers,
  addCompanyMember, updateCompanyMemberRole, removeCompanyMember,
  // 409A Valuations
  get409aValuations, get409aValuationById, getActive409aValuation, create409aValuation, update409aValuation, delete409aValuation,
  // 83(b) Elections
  get83bElections, get83bElectionById, getPending83bElections, create83bElection, update83bElection, delete83bElection,
  // V1
  getAllInvestors, getInvestorById, createInvestor, updateInvestor, deleteInvestor,
  getAllocationsByCompany, getAllocationById, createAllocation, updateAllocation, deleteAllocation,
  getAllRegisterEntries, getAllSnapshotsV1,
  getAllEsopPoolsV1, getEsopPoolV1ById, createEsopPoolV1, updateEsopPoolV1, deleteEsopPoolV1,
  getAllEsopGrantsV1, getEsopGrantV1ById, createEsopGrantV1, updateEsopGrantV1, deleteEsopGrantV1,
  // Instruments (V1)
  getAllInstruments, getInstrumentById, getInstrumentsByInvestor, getInstrumentsByRound, getInstrumentsByType, getActiveConvertibles,
  createInstrument, updateInstrument, deleteInstrument,
  // Signing Requests (DocuSeal eSignature)
  getAllSigningRequests, getSigningRequestById, getSigningRequestsByStatus,
  createSigningRequest, updateSigningRequest, deleteSigningRequest,
  // Signing Templates
  getSigningTemplatesForCompany, getPlatformSigningTemplates, getSigningTemplateById,
  createSigningTemplate, updateSigningTemplate, deleteSigningTemplate,
  // Share Classes
  getShareClasses, getShareClassById, getShareClassBySlug,
  createShareClass, updateShareClass, deleteShareClass, seedDefaultShareClasses,
  // Admin
  adminListCompanies, adminGetCompanyDetail, adminUpdateCompanyPlan,
  adminGetCompanyAuditLogs, createAdminAuditLog, getAdminAuditLogs,
  adminGetPlatformStats,
  adminListTeamMembers, adminUpdateAdminRole, adminPromoteUser,
  adminDemoteUser, adminTransferSuperAdmin, getUserByEmail,
  // Notifications
  getNotifications, getUnreadNotificationCount, createNotification,
  markNotificationRead, markAllNotificationsRead, deleteNotification,
  // Share Transfers
  getShareTransfers, getShareTransferById, createShareTransfer,
  updateShareTransfer, deleteShareTransfer,
  // Tech Share Tax (TW)
  getTechShareTaxRecords, getTechShareTaxRecordById, getDeferralExpiringRecords,
  createTechShareTaxRecord, updateTechShareTaxRecord, deleteTechShareTaxRecord,
  // Closed Company (TW)
  getClosedCompanyProvision, upsertClosedCompanyProvision,
  getClosedCompanyShareRights, getClosedCompanyShareRightById,
  createClosedCompanyShareRight, updateClosedCompanyShareRight, deleteClosedCompanyShareRight,
  // Support
  createSupportTicket, getAllSupportTickets, getSupportTicketsByUser, getSupportTicketById, updateSupportTicket,
  getAllSupportFaqs, createSupportFaq, updateSupportFaq, deleteSupportFaq,
} from "./db";
import { ProjectionAssumptionsSchema } from "../shared/projectionTypes";
import { advanceAllocation, type AllocationStatus } from "../shared/allocationLifecycle";
import { writeRegisterEntry, createManualSnapshot } from "./v1/registerWrite";
import { deriveCapTable } from "./v1/capTable";
import { planLimit, type PlanKey, type UsageLimitKey } from "../shared/plans";

// Platform owner — auto-promoted to super_admin on login
const PLATFORM_OWNER_EMAIL = "boy20000tw@gmail.com";

/**
 * Check usage limit before a create operation.
 * Throws FORBIDDEN with LIMIT_REACHED message if limit exceeded.
 */
async function checkUsageLimit(
  companyPlan: PlanKey | null,
  limitKey: UsageLimitKey,
  currentCount: number,
) {
  const plan = companyPlan ?? "starter";
  const max = planLimit(plan, limitKey);
  if (max !== Infinity && currentCount >= max) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `LIMIT_REACHED:${limitKey}:${currentCount}:${max}`,
    });
  }
}


// ─── Funding Rounds Router ────────────────────────────────────────────────────
const fundingRoundsRouter = router({
  list: companyProcedure.use(requireFeature("fundraising.rounds")).query(({ ctx }) => getAllFundingRounds(ctx.companyId)),
  get: companyProcedure.use(requireFeature("fundraising.rounds")).input(z.object({ id: z.number() })).query(({ input, ctx }) => getFundingRoundById(ctx.companyId, input.id)),
  create: companyEditorProcedure.input(z.object({
    name: z.string().min(1),
    roundDate: z.string().optional(),
    pricePerShareNtd: z.string().optional(),
    moneyRaisedNtd: z.string().optional(),
    preMoneyValuationNtd: z.string().optional(),
    postMoneyValuationNtd: z.string().optional(),
    exchangeRate: z.string().optional(),
    status: z.enum(["completed","projected","bridge"]).default("completed"),
    notes: z.string().optional(),
    sortOrder: z.number().default(0),
  })).mutation(async ({ input, ctx }) => {
    const result = await createFundingRound({ ...input, companyId: ctx.companyId, roundDate: input.roundDate ?? undefined });
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "create", resourceType: "funding_round", resourceName: input.name, changesAfter: JSON.stringify(input) });
    return result;
  }),
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().min(1).optional(),
      roundDate: z.string().optional(),
      pricePerShareNtd: z.string().optional(),
      moneyRaisedNtd: z.string().optional(),
      preMoneyValuationNtd: z.string().optional(),
      postMoneyValuationNtd: z.string().optional(),
      exchangeRate: z.string().optional(),
      status: z.enum(["completed","projected","bridge"]).optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const result = await updateFundingRound(ctx.companyId, input.id, { ...input.data, roundDate: input.data.roundDate ?? undefined });
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "update", resourceType: "funding_round", resourceId: input.id, changesAfter: JSON.stringify(input.data) });
    return result;
  }),
  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await deleteFundingRound(ctx.companyId, input.id);
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "delete", resourceType: "funding_round", resourceId: input.id });
    return result;
  }),
});





// ─── Anti-Dilution Router ─────────────────────────────────────────────────────
const antiDilutionRouter = router({
  list: companyProcedure.use(requireFeature("analysis.antiDilution")).query(({ ctx }) => getAllAntiDilutionProvisions(ctx.companyId)),
  byShareholder: companyProcedure.input(z.object({ shareholderId: z.number() })).query(({ input, ctx }) => getProvisionsByShareholder(ctx.companyId, input.shareholderId)),
  create: companyEditorProcedure.input(z.object({
    shareholderId: z.number(),
    fundingRoundId: z.number(),
    provisionType: z.enum(["full_ratchet", "broad_based_wa", "narrow_based_wa", "none"]).default("broad_based_wa"),
    originalPriceNtd: z.string(),
    originalShares: z.number(),
    notes: z.string().optional(),
  })).mutation(({ input, ctx }) => createAntiDilutionProvision({ ...input, companyId: ctx.companyId })),
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      adjustedPriceNtd: z.string().optional(),
      adjustedShares: z.number().optional(),
      triggerRoundId: z.number().optional(),
      status: z.enum(["active", "triggered", "waived", "expired"]).optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input, ctx }) => updateAntiDilutionProvision(ctx.companyId, input.id, input.data)),
  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(({ input, ctx }) => deleteAntiDilutionProvision(ctx.companyId, input.id)),

  // ── Down-round simulator (read-only) ──────────────────────────────────────
  // Computes the adjusted conversion price + additional shares each active
  // provision would receive if a new round were priced at `newRoundPriceNtd`.
  // Does NOT write to the DB — results come back in-memory for the UI to
  // preview. Fully-diluted base comes from the V1 deriveCapTable() so the
  // numbers match the rest of the app.
  simulate: companyProcedure
    .input(z.object({
      newRoundPriceNtd: z.string(),
      newRoundSharesIssued: z.number(),
      newRoundMoneyRaisedNtd: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const all = await getAllAntiDilutionProvisions(ctx.companyId);
      const provisions = all.filter(p => p.status === "active");
      if (provisions.length === 0) {
        const ct = await deriveCapTable(ctx.companyId);
        return {
          results: [],
          totalNewShares: 0,
          fullyDilutedBefore: ct.totalShares,
          fullyDilutedAfter: ct.totalShares + input.newRoundSharesIssued,
        };
      }

      const capTable = await deriveCapTable(ctx.companyId);
      const fullyDilutedBefore = capTable.totalShares;

      const newPrice = parseFloat(input.newRoundPriceNtd);
      const newShares = input.newRoundSharesIssued;
      const newMoney = parseFloat(input.newRoundMoneyRaisedNtd);

      let totalNewSharesFromAdjustment = 0;

      type SimResult = {
        provisionId: number;
        shareholderId: number;
        fundingRoundId: number;
        provisionType: string;
        originalPriceNtd: number;
        originalShares: number;
        adjustedPriceNtd: number;
        adjustedShares: number;
        additionalShares: number;
        triggered: boolean;
      };

      const results: SimResult[] = provisions.map((p) => {
        const originalPrice = Number(p.originalPriceNtd);
        const originalShares = Number(p.originalShares);

        // Not a down round for this investor — no adjustment.
        if (newPrice >= originalPrice) {
          return {
            provisionId: p.id,
            shareholderId: p.shareholderId,
            fundingRoundId: p.fundingRoundId,
            provisionType: p.provisionType,
            originalPriceNtd: originalPrice,
            originalShares,
            adjustedPriceNtd: originalPrice,
            adjustedShares: originalShares,
            additionalShares: 0,
            triggered: false,
          };
        }

        let adjustedPrice: number;

        switch (p.provisionType) {
          case "full_ratchet":
            // Investor's conversion price drops to match the new round.
            adjustedPrice = newPrice;
            break;

          case "narrow_based_wa": {
            // Only the round's own outstanding shares count in denominator.
            // Approximated as the sum of originalShares across provisions
            // from the same funding round.
            const roundPool = provisions
              .filter(pp => pp.fundingRoundId === p.fundingRoundId)
              .reduce((sum, pp) => sum + Number(pp.originalShares), 0);
            const A = roundPool || originalShares;
            const B = newMoney / originalPrice;
            const C = newShares;
            adjustedPrice = originalPrice * (A + B) / (A + C);
            break;
          }

          case "broad_based_wa":
          default: {
            // Industry-standard broad-based weighted-average formula:
            //   New CP = Old CP * (A + B) / (A + C)
            //   A = fully diluted shares before the new round
            //   B = new money / old conversion price
            //   C = shares actually issued in the new round
            const A = fullyDilutedBefore;
            const B = newMoney / originalPrice;
            const C = newShares;
            adjustedPrice = originalPrice * (A + B) / (A + C);
            break;
          }
        }

        // Floor the adjusted price at the new round price (sanity guard —
        // anti-dilution should never make the price lower than the trigger).
        adjustedPrice = Math.max(adjustedPrice, newPrice);

        // Adjusted share count = original investment / adjusted conversion
        // price. The investor ends up with more shares to compensate for
        // the price drop.
        const investmentAmount = originalPrice * originalShares;
        const adjustedShares = Math.floor(investmentAmount / adjustedPrice);
        const additionalShares = adjustedShares - originalShares;

        totalNewSharesFromAdjustment += additionalShares;

        return {
          provisionId: p.id,
          shareholderId: p.shareholderId,
          fundingRoundId: p.fundingRoundId,
          provisionType: p.provisionType,
          originalPriceNtd: originalPrice,
          originalShares,
          adjustedPriceNtd: Math.round(adjustedPrice * 1_000_000) / 1_000_000,
          adjustedShares,
          additionalShares,
          triggered: true,
        };
      });

      return {
        results,
        totalNewShares: totalNewSharesFromAdjustment,
        fullyDilutedBefore,
        fullyDilutedAfter: fullyDilutedBefore + newShares + totalNewSharesFromAdjustment,
      };
    }),

  // ── Trigger: apply simulator results to the DB ────────────────────────────
  // Writes adjusted price + shares, flips status to "triggered", and records
  // the triggering round id on each affected provision. Writes an audit log.
  trigger: companyEditorProcedure
    .input(z.object({
      triggerRoundId: z.number(),
      adjustments: z.array(z.object({
        provisionId: z.number(),
        adjustedPriceNtd: z.string(),
        adjustedShares: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      for (const adj of input.adjustments) {
        await updateAntiDilutionProvision(ctx.companyId, adj.provisionId, {
          adjustedPriceNtd: adj.adjustedPriceNtd,
          adjustedShares: adj.adjustedShares,
          triggerRoundId: input.triggerRoundId,
          status: "triggered",
        });
      }
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "anti_dilution",
        resourceName: `Down-round trigger on round #${input.triggerRoundId}`,
        changesAfter: JSON.stringify({
          triggerRoundId: input.triggerRoundId,
          adjustmentsCount: input.adjustments.length,
          adjustments: input.adjustments,
        }),
      });
      return { success: true, count: input.adjustments.length };
    }),
});

// ─── Import Router ────────────────────────────────────────────────────────────
const importRouter = router({
  logs: companyProcedure.query(({ ctx }) => getAllImportLogs(ctx.companyId)),
  excel: companyEditorProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { importExcelFile } = await import("./excel-import");
      const buffer = Buffer.from(input.fileBase64, "base64");
      return importExcelFile(buffer, input.fileName, ctx.companyId);
    }),
});

// ─── Analysis Router (placeholder - LLM removed) ────────────────────────────
const analysisRouter = router({
  analyze: protectedProcedure.use(requireFeature("analysis.valuation")).input(z.object({
    rounds: z.array(z.object({
      name: z.string(),
      pricePerShareNtd: z.string().nullable(),
      moneyRaisedNtd: z.string().nullable(),
      postMoneyValuationNtd: z.string().nullable(),
      roundDate: z.string().nullable().optional(),
    })),
    totalShares: z.number(),
    esopPoolShares: z.number().optional(),
    exchangeRate: z.number().default(0.0313),
    projections: z.array(z.object({
      name: z.string(),
      targetRaiseNtd: z.string().nullable(),
      postMoneyValuationNtd: z.string().nullable(),
      scenario: z.string(),
    })).optional(),
  })).mutation(async () => {
    // TODO: Integrate with OpenAI or Claude API for analysis
    return {
      analysis: "AI analysis feature coming soon. Please check back later.",
      generatedAt: new Date().toISOString(),
    };
  }),
});

// ─── Waterfall Router ───────────────────────────────────────────────────────────────────────
const waterfallRouter = router({
  compute: companyProcedure
    .use(requireFeature("analysis.waterfall"))
    .input(z.object({ exitValueNtd: z.number().positive() }))
    .query(({ input, ctx }) => computeWaterfall(ctx.companyId, input.exitValueNtd)),
  getLiquidationPreferences: companyProcedure.query(({ ctx }) => getLiquidationPreferences(ctx.companyId)),
  upsertLiquidationPreference: companyEditorProcedure.input(z.object({
    fundingRoundId: z.number(),
    preferenceType: z.enum(["non_participating","participating","capped_participating"]).default("non_participating"),
    liquidationMultiple: z.string().default("1.00"),
    participationCap: z.string().optional(),
    seniorityRank: z.number().default(1),
    notes: z.string().optional(),
  })).mutation(({ input, ctx }) => upsertLiquidationPreference({ ...input, companyId: ctx.companyId } as Parameters<typeof upsertLiquidationPreference>[0])),
});
// ─── Team / User Management Router ─────────────────────────────────────────
const teamRouter = router({
  // List members of the active company
  members: companyProcedure.query(({ ctx }) => listCompanyMembers(ctx.companyId)),

  // Update a member's role within the active company
  updateRole: companyOwnerAdminProcedure.input(z.object({
    userId: z.number(),
    appRole: z.enum(["owner", "admin", "cfo", "lawyer", "investor", "viewer"]),
  })).mutation(async ({ input, ctx }) => {
    await updateCompanyMemberRole(ctx.companyId, input.userId, input.appRole);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "user",
      resourceId: input.userId,
      resourceName: `User #${input.userId}`,
      changesAfter: JSON.stringify({ appRole: input.appRole }),
    });
    return { success: true };
  }),

  // Remove a member from the active company
  removeMember: companyOwnerAdminProcedure.input(z.object({
    userId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const currentUser = ctx.user!;
    // Can't remove yourself
    if (input.userId === currentUser.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself from the team. Use Transfer Ownership or have another Owner remove you." });
    }
    // Look up the target's membership in this company. listCompanyMembers
    // now returns UI-shape rows where `id` = users.id and `appRole` = the
    // company role.
    const members = await listCompanyMembers(ctx.companyId);
    const target = members.find(m => m.id === input.userId);
    if (!target || target.id == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
    }
    const targetUserId: number = target.id;
    // Owner cannot be removed (must transfer ownership first)
    if (target.appRole === "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "The Owner cannot be removed. Transfer ownership first." });
    }
    // Admins cannot remove other admins (only owner can)
    if (target.appRole === "admin" && ctx.companyRole !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the Owner can remove Admin members." });
    }
    // Log BEFORE removal so the record persists
    await createAuditLog({
      companyId: ctx.companyId,
      userId: currentUser.id,
      userName: currentUser.name ?? undefined,
      action: "delete",
      resourceType: "user",
      resourceId: targetUserId,
      resourceName: target.email ?? target.name ?? `User #${targetUserId}`,
      changesBefore: JSON.stringify({ email: target.email, name: target.name, role: target.appRole }),
    });
    await removeCompanyMember(ctx.companyId, targetUserId);
    return { success: true, removedId: targetUserId };
  }),

  // Transfer ownership of the active company to another member
  transferOwnership: companyOwnerProcedure.input(z.object({
    newOwnerId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const currentUser = ctx.user!;
    // Demote current owner to admin in this company
    await updateCompanyMemberRole(ctx.companyId, currentUser.id, "admin");
    // Promote new user to owner
    await updateCompanyMemberRole(ctx.companyId, input.newOwnerId, "owner");
    await createAuditLog({
      companyId: ctx.companyId,
      userId: currentUser.id,
      userName: currentUser.name ?? undefined,
      action: "update",
      resourceType: "user",
      resourceId: input.newOwnerId,
      resourceName: `Ownership Transfer → User #${input.newOwnerId}`,
      changesAfter: JSON.stringify({ from: currentUser.id, to: input.newOwnerId }),
    });
    return { success: true };
  }),
});

// ─── Invitations Router ───────────────────────────────────────────────────────
const invitationsRouter = router({
  list: companyProcedure.query(({ ctx }) => getAllInvitations(ctx.companyId)),
  create: companyOwnerAdminProcedure.input(z.object({
    email: z.string().email().optional(),
    appRole: z.enum(["admin", "cfo", "lawyer", "investor", "viewer"]).default("viewer"),
    notes: z.string().optional(),
    origin: z.string(),
  })).mutation(async ({ input, ctx }) => {
    // Usage limit check: team members
    const members = await listCompanyMembers(ctx.companyId);
    await checkUsageLimit(ctx.companyPlan, "teamMembers", members.length);
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const invitation = await createInvitation({
      companyId: ctx.companyId,
      token,
      email: input.email,
      appRole: input.appRole,
      invitedByUserId: ctx.user!.id,
      status: "pending",
      expiresAt,
      notes: input.notes,
    });
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "invite",
      resourceType: "invitation",
      resourceId: invitation?.id,
      resourceName: input.email ?? `Role: ${input.appRole}`,
      changesAfter: JSON.stringify({ appRole: input.appRole, email: input.email }),
    });
    const inviteUrl = `${input.origin}/join?token=${token}`;
    return { invitation, inviteUrl };
  }),
  revoke: companyOwnerAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    // Verify the invitation belongs to this company before revoking
    const invitations = await getAllInvitations(ctx.companyId);
    if (!invitations.find(i => i.id === input.id)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found in this company." });
    }
    const result = await updateInvitationStatus(input.id, "revoked");
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "invitation",
      resourceId: input.id,
      resourceName: `Invitation #${input.id}`,
      changesAfter: JSON.stringify({ status: "revoked" }),
    });
    return result;
  }),
  // Public — token holders can view; mutation for actually accepting requires auth.
  accept: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
    const inv = await getInvitationByToken(input.token);
    if (!inv) return { valid: false, reason: "not_found" as const };
    if (inv.status !== "pending") return { valid: false, reason: inv.status as "accepted" | "revoked" | "expired" };
    if (new Date() > new Date(inv.expiresAt)) {
      await updateInvitationStatus(inv.id, "expired");
      return { valid: false, reason: "expired" as const };
    }
    return { valid: true as const, invitation: inv };
  }),
  // Authenticated user accepts an invitation: marks accepted + adds them to the company
  acceptInvitation: protectedProcedure.input(z.object({ token: z.string() })).mutation(async ({ input, ctx }) => {
    const inv = await getInvitationByToken(input.token);
    if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
    if (inv.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: `Invitation is ${inv.status}.` });
    if (new Date() > new Date(inv.expiresAt)) {
      await updateInvitationStatus(inv.id, "expired");
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired." });
    }
    if (!inv.companyId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation is not linked to a company." });
    }
    // Add the accepting user as a member of the inviting company
    await addCompanyMember({
      companyId: inv.companyId,
      userId: ctx.user!.id,
      role: inv.appRole,
    });
    await updateInvitationStatus(inv.id, "accepted", ctx.user!.id);
    await createAuditLog({
      companyId: inv.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "invite",
      resourceType: "invitation",
      resourceId: inv.id,
      resourceName: `Accepted by User #${ctx.user!.id}`,
      changesAfter: JSON.stringify({ status: "accepted", role: inv.appRole }),
    });
    return { success: true, companyId: inv.companyId };
  }),
});

// ─── Audit Log Router ─────────────────────────────────────────────────────────
const auditLogRouter = router({
  list: companyProcedure.input(z.object({
    limit: z.number().default(100),
    offset: z.number().default(0),
  })).query(({ input, ctx }) => getAuditLogs(ctx.companyId, input.limit, input.offset)),
  byResource: companyProcedure.input(z.object({
    resourceType: z.string(),
    resourceId: z.number(),
  })).query(({ input, ctx }) => getAuditLogsByResource(ctx.companyId, input.resourceType, input.resourceId)),
});

// ─── Financial Projections Router (5-Year) ──────────────────────────────────
const financialProjectionsRouter = router({
  list: companyProcedure.use(requireFeature("analysis.projections")).query(({ ctx }) => getAllFinancialProjections(ctx.companyId)),
  get: companyProcedure.input(z.object({ id: z.number() })).query(({ input, ctx }) => getFinancialProjectionById(ctx.companyId, input.id)),
  create: companyEditorProcedure.input(z.object({
    name: z.string().min(1),
    startYear: z.number(),
    years: z.number().default(5),
    assumptions: ProjectionAssumptionsSchema,
  })).mutation(async ({ input, ctx }) => {
    const result = await createFinancialProjection({ ...input, companyId: ctx.companyId });
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "create", resourceType: "financial_projection", resourceName: input.name, changesAfter: JSON.stringify({ name: input.name, startYear: input.startYear }) });
    return result;
  }),
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().optional(),
      assumptions: ProjectionAssumptionsSchema.optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    await updateFinancialProjection(ctx.companyId, input.id, input.data);
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "update", resourceType: "financial_projection", resourceId: input.id, changesAfter: JSON.stringify(input.data) });
  }),
  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await deleteFinancialProjection(ctx.companyId, input.id);
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "delete", resourceType: "financial_projection", resourceId: input.id });
  }),
});

// ─── DCF Scenarios Router ───────────────────────────────────────────────────
const dcfRouter = router({
  listByProjection: companyProcedure.use(requireFeature("analysis.projections")).input(z.object({ projectionId: z.number() }))
    .query(({ input, ctx }) => getDcfScenariosByProjection(ctx.companyId, input.projectionId)),
  create: companyEditorProcedure.input(z.object({
    projectionId: z.number(),
    name: z.string().min(1),
    discountRate: z.number(),
    terminalGrowth: z.number(),
    netDebt: z.number().default(0),
    cash: z.number().default(0),
    targetRaise: z.number().nullable().optional(),
    targetPreMoney: z.number().nullable().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createDcfScenario({
      ...input,
      companyId: ctx.companyId,
      discountRate: String(input.discountRate),
      terminalGrowth: String(input.terminalGrowth),
      netDebt: String(input.netDebt),
      cash: String(input.cash),
      targetRaise: input.targetRaise != null ? String(input.targetRaise) : null,
      targetPreMoney: input.targetPreMoney != null ? String(input.targetPreMoney) : null,
    });
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "create", resourceType: "dcf_scenario", resourceName: input.name });
    return result;
  }),
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().optional(),
      discountRate: z.number().optional(),
      terminalGrowth: z.number().optional(),
      netDebt: z.number().optional(),
      cash: z.number().optional(),
      targetRaise: z.number().nullable().optional(),
      targetPreMoney: z.number().nullable().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const updateData: Record<string, unknown> = {};
    if (input.data.name !== undefined) updateData.name = input.data.name;
    if (input.data.discountRate !== undefined) updateData.discountRate = String(input.data.discountRate);
    if (input.data.terminalGrowth !== undefined) updateData.terminalGrowth = String(input.data.terminalGrowth);
    if (input.data.netDebt !== undefined) updateData.netDebt = String(input.data.netDebt);
    if (input.data.cash !== undefined) updateData.cash = String(input.data.cash);
    if (input.data.targetRaise !== undefined) updateData.targetRaise = input.data.targetRaise != null ? String(input.data.targetRaise) : null;
    if (input.data.targetPreMoney !== undefined) updateData.targetPreMoney = input.data.targetPreMoney != null ? String(input.data.targetPreMoney) : null;
    await updateDcfScenario(ctx.companyId, input.id, updateData as any);
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "update", resourceType: "dcf_scenario", resourceId: input.id, changesAfter: JSON.stringify(input.data) });
  }),
  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await deleteDcfScenario(ctx.companyId, input.id);
    await createAuditLog({ companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "delete", resourceType: "dcf_scenario", resourceId: input.id });
  }),
});

// ─── Companies Router ───────────────────────────────────────────────────────
const companiesRouter = router({
  // List companies the current user is a member of
  myCompanies: protectedProcedure.query(({ ctx }) => getUserCompanyMemberships(ctx.user!.id)),

  // Get the currently active company
  active: companyProcedure.query(async ({ ctx }) => {
    const company = await getCompanyById(ctx.companyId);
    return { company, role: ctx.companyRole };
  }),

  // Create a new company; caller becomes the owner
  create: protectedProcedure.input(z.object({
    name: z.string().min(1).max(255),
    slug: z.string().max(100).optional(),
  })).mutation(async ({ ctx, input }) => {
    // Usage limit check: companies
    const memberships = await getUserCompanyMemberships(ctx.user!.id);
    // Use the plan of the user's first company (or free if no company yet)
    const currentPlan = ctx.companyPlan ?? "starter";
    await checkUsageLimit(currentPlan, "companies", memberships.length);
    const company = await createCompany(input);
    await addCompanyMember({ companyId: company.id, userId: ctx.user!.id, role: "owner" });
    await createAuditLog({
      companyId: company.id,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "create",
      resourceType: "company",
      resourceId: company.id,
      resourceName: company.name,
      changesAfter: JSON.stringify(input),
    });
    return company;
  }),

  // Rename current company
  rename: companyOwnerProcedure.input(z.object({
    name: z.string().min(1).max(255),
  })).mutation(async ({ ctx, input }) => {
    await updateCompany(ctx.companyId, { name: input.name });
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "company",
      resourceId: ctx.companyId,
      resourceName: input.name,
    });
  }),

  // ── Company Settings (SPEC-company-settings.md) ─────────────────────────
  // Returns the full company row (all profile + branding fields) for the
  // currently active company.
  get: companyProcedure.query(async ({ ctx }) => {
    return (await getCompanyById(ctx.companyId)) ?? null;
  }),

  // Update any combination of profile / contact / representative fields.
  // Editors (owner / admin / cfo) only.
  update: companyEditorProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      nameEn: z.string().nullable().optional(),
      taxId: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      contactEmail: z.string().email().or(z.literal("")).nullable().optional(),
      website: z.string().url().or(z.literal("")).nullable().optional(),
      representativeName: z.string().nullable().optional(),
      representativeTitle: z.string().nullable().optional(),
      defaultCurrency: z.enum(["NTD", "USD"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Normalize empty strings to null so we don't persist "" values
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        data[k] = v === "" ? null : v;
      }
      await updateCompany(ctx.companyId, data as Parameters<typeof updateCompany>[1]);
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "company",
        resourceId: ctx.companyId,
        changesAfter: JSON.stringify(Object.keys(data)),
      });
      return (await getCompanyById(ctx.companyId)) ?? null;
    }),

  // Upload the company logo to Vercel Blob, persist its URL on the row.
  uploadLogo: companyEditorProcedure
    .input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      // Namespace blobs by companyId so multi-tenant uploads don't collide
      const key = `company/${ctx.companyId}/logo/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      await updateCompany(ctx.companyId, { logoUrl: url });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "company",
        resourceId: ctx.companyId,
        resourceName: "logo",
        changesAfter: JSON.stringify({ logoUrl: url }),
      });
      return { url };
    }),

  // Upload the representative signature (PNG, used by eSignature auto-sign).
  uploadSignature: companyEditorProcedure
    .input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `company/${ctx.companyId}/signature/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      await updateCompany(ctx.companyId, { signatureUrl: url });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "company",
        resourceId: ctx.companyId,
        resourceName: "signature",
        changesAfter: JSON.stringify({ signatureUrl: url }),
      });
      return { url };
    }),
});

// ─── V1 Investors Router ────────────────────────────────────────────────────
const v1InvestorsRouter = router({
  list: companyProcedure.query(({ ctx }) => getAllInvestors(ctx.companyId)),
  get: companyProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getInvestorById(ctx.companyId, input.id)),
  create: companyEditorProcedure.input(z.object({
    name: z.string().min(1).max(255),
    entityKind: z.enum(["individual", "entity"]).default("individual"),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    nationality: z.string().optional(),
    status: z.enum(["prospect", "meeting", "term_sheet", "invested", "passed"]).default("prospect"),
    aka: z.string().optional(),
    website: z.string().optional(),
    linkedinUrl: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Usage limit check: shareholders
    const existing = await getAllInvestors(ctx.companyId);
    await checkUsageLimit(ctx.companyPlan, "shareholders", existing.length);
    const created = await createInvestor({ ...input, companyId: ctx.companyId, ownerUserId: ctx.user!.id });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "investor", resourceId: created.id, resourceName: input.name,
    });
    return created;
  }),
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().min(1).optional(),
      entityKind: z.enum(["individual", "entity"]).optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      nationality: z.string().optional().nullable(),
      status: z.enum(["prospect", "meeting", "term_sheet", "invested", "passed"]).optional(),
      aka: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      linkedinUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  })).mutation(async ({ ctx, input }) => {
    await updateInvestor(ctx.companyId, input.id, input.data);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "investor", resourceId: input.id,
      changesAfter: JSON.stringify(input.data),
    });
  }),
  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await deleteInvestor(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "delete", resourceType: "investor", resourceId: input.id,
    });
  }),
});

// ─── V1 Allocations Router ──────────────────────────────────────────────────
const v1AllocationsRouter = router({
  list: companyProcedure.input(z.object({ roundId: z.number().optional() })).query(({ ctx, input }) => getAllocationsByCompany(ctx.companyId, input.roundId)),
  get: companyProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getAllocationById(ctx.companyId, input.id)),
  create: companyEditorProcedure.input(z.object({
    fundingRoundId: z.number(),
    investorId: z.number(),
    shareClass: z.string().min(1),
    amount: z.string().optional(),              // numeric-as-string
    currency: z.string().default("NTD"),
    fxToNtd: z.string().default("1"),
    sharesAllocated: z.number().optional(),
    pricePerShare: z.string().optional(),
    termSheetUrl: z.string().optional(),
    agreementUrl: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const created = await createAllocation({
      ...input, companyId: ctx.companyId,
      shareClass: input.shareClass as any,  // dynamic share class → pgEnum cast
      status: "planned",
      createdByUserId: ctx.user!.id,
    });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "allocation", resourceId: created.id,
      changesAfter: JSON.stringify({ fundingRoundId: input.fundingRoundId, investorId: input.investorId, amount: input.amount }),
    });
    return created;
  }),
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      amount: z.string().optional(),
      currency: z.string().optional(),
      fxToNtd: z.string().optional(),
      sharesAllocated: z.number().optional(),
      pricePerShare: z.string().optional(),
      termSheetUrl: z.string().optional().nullable(),
      agreementUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  })).mutation(async ({ ctx, input }) => {
    await updateAllocation(ctx.companyId, input.id, input.data);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "allocation", resourceId: input.id,
      changesAfter: JSON.stringify(input.data),
    });
  }),
  // The main event: advance through the lifecycle. When reaching "issued",
  // we write a register entry and a snapshot atomically-ish via writeRegisterEntry.
  advance: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const existing = await getAllocationById(ctx.companyId, input.id);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Allocation not found" });
    const result = advanceAllocation({
      status: existing.status as AllocationStatus,
      termSheetUrl: existing.termSheetUrl,
      agreementUrl: existing.agreementUrl,
      amount: existing.amount,
      sharesAllocated: existing.sharesAllocated,
      pricePerShare: existing.pricePerShare,
    });
    if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.errors.join("; ") });
    // Stamp status + timestamp
    const updateFields: Record<string, unknown> = {
      status: result.newStatus,
      [result.timestampField]: new Date(),
    };
    await updateAllocation(ctx.companyId, input.id, updateFields as any);

    // If reaching "issued", write the register entry
    let registerEntryId: number | null = null;
    let snapshotId: number | null = null;
    if (result.newStatus === "issued") {
      if (!existing.sharesAllocated || !existing.pricePerShare) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot issue without sharesAllocated and pricePerShare." });
      }
      const written = await writeRegisterEntry(ctx.companyId, ctx.user!.id, {
        investorId: existing.investorId,
        eventType: "issuance",
        shareClass: existing.shareClass as any,
        shares: existing.sharesAllocated,
        effectiveDate: new Date().toISOString().slice(0, 10),
        allocationId: existing.id,
        fundingRoundId: existing.fundingRoundId,
        pricePerShare: existing.pricePerShare,
        currency: existing.currency,
        fxToNtd: existing.fxToNtd,
        totalAmount: existing.amount,
      });
      registerEntryId = written.entry.id;
      snapshotId = written.snapshot.id;
    }
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "allocation", resourceId: input.id,
      changesAfter: JSON.stringify({ status: result.newStatus, registerEntryId, snapshotId }),
    });
    return { newStatus: result.newStatus, registerEntryId, snapshotId };
  }),
  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const existing = await getAllocationById(ctx.companyId, input.id);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Allocation not found" });
    if (existing.status === "issued") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete an issued allocation. Use a reversal register entry instead." });
    }
    await deleteAllocation(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "delete", resourceType: "allocation", resourceId: input.id,
    });
  }),
});

// ─── V1 Register Router ────────────────────────────────────────────────────
const v1RegisterRouter = router({
  list: companyProcedure.input(z.object({ investorId: z.number().optional() }).optional()).query(
    ({ ctx, input }) => getAllRegisterEntries(ctx.companyId, input)
  ),
  // Direct register write — for manual issuances, transfers, cancellations
  write: companyEditorProcedure.input(z.object({
    investorId: z.number(),
    eventType: z.enum(["issuance", "transfer_in", "transfer_out", "cancellation", "reversal", "esop_exercise"]),
    shareClass: z.string().min(1),
    shares: z.number().int().positive(),
    effectiveDate: z.string(),
    fundingRoundId: z.number().optional(),
    pricePerShare: z.string().optional(),
    currency: z.string().default("NTD"),
    fxToNtd: z.string().default("1"),
    totalAmount: z.string().optional(),
    reversedEntryId: z.number().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const result = await writeRegisterEntry(ctx.companyId, ctx.user!.id, input);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "register_entry", resourceId: result.entry.id,
      resourceName: `${input.eventType} — ${input.shares} ${input.shareClass}`,
      changesAfter: JSON.stringify(input),
    });
    return result;
  }),
  // Update an existing register entry (for corrections)
  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      effectiveDate: z.string().optional(),
      eventType: z.enum(["issuance", "transfer_in", "transfer_out", "cancellation", "reversal", "esop_exercise"]).optional(),
      shareClass: z.string().min(1).optional(),
      shares: z.number().int().optional(),
      pricePerShare: z.string().optional().nullable(),
      currency: z.string().optional(),
      totalAmount: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  })).mutation(async ({ ctx, input }) => {
    const { getDb } = await import("./db");
    const { shareRegisterEntries } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const [updated] = await db.update(shareRegisterEntries)
      .set({ ...input.data, shareClass: input.data.shareClass as any })
      .where(and(eq(shareRegisterEntries.id, input.id), eq(shareRegisterEntries.companyId, ctx.companyId)))
      .returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Register entry not found" });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "register_entry", resourceId: input.id,
      changesAfter: JSON.stringify(input.data),
    });
    return updated;
  }),
});

// ─── V1 Cap Table Router (derived view) ─────────────────────────────────────
const v1CapTableRouter = router({
  current: companyProcedure.query(({ ctx }) => deriveCapTable(ctx.companyId)),
});

// ─── V1 Snapshots Router (auto + manual) ────────────────────────────────────
const v1SnapshotsRouter = router({
  list: companyProcedure.use(requireFeature("snapshots")).query(({ ctx }) => getAllSnapshotsV1(ctx.companyId)),
  createManual: companyEditorProcedure.input(z.object({
    name: z.string().min(1).max(255),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    return createManualSnapshot(ctx.companyId, ctx.user!.id, input.name, input.notes ?? null);
  }),
});

// ─── V1 ESOP Router ─────────────────────────────────────────────────────────
const v1EsopRouter = router({
  // Pools
  pools: companyProcedure.query(({ ctx }) => getAllEsopPoolsV1(ctx.companyId)),
  getPool: companyProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getEsopPoolV1ById(ctx.companyId, input.id)),
  createPool: companyEditorProcedure.input(z.object({
    name: z.string().min(1).max(255),
    fundingRoundId: z.number().nullable().optional(),
    totalShares: z.number().positive(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const created = await createEsopPoolV1({ ...input, companyId: ctx.companyId });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "esop_pool_v1", resourceId: created.id, resourceName: input.name,
    });
    return created;
  }),
  updatePool: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().min(1).optional(),
      totalShares: z.number().positive().optional(),
      fundingRoundId: z.number().nullable().optional(),
      notes: z.string().optional().nullable(),
    }),
  })).mutation(async ({ ctx, input }) => {
    await updateEsopPoolV1(ctx.companyId, input.id, input.data);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "esop_pool_v1", resourceId: input.id,
      changesAfter: JSON.stringify(input.data),
    });
  }),
  deletePool: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    // Guard: can't delete a pool that still has grants
    const grants = await getAllEsopGrantsV1(ctx.companyId, input.id);
    if (grants.length > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot delete pool with ${grants.length} grant(s). Cancel or reassign grants first.` });
    }
    await deleteEsopPoolV1(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "delete", resourceType: "esop_pool_v1", resourceId: input.id,
    });
  }),

  // Grants
  grants: companyProcedure.input(z.object({ poolId: z.number().optional() }).optional())
    .query(({ ctx, input }) => getAllEsopGrantsV1(ctx.companyId, input?.poolId)),
  createGrant: companyEditorProcedure.input(z.object({
    poolId: z.number(),
    investorId: z.number(),
    grantDate: z.string(),                                  // YYYY-MM-DD
    sharesGranted: z.number().positive(),
    exercisePrice: z.string().optional(),                   // numeric-as-string
    currency: z.string().default("NTD"),
    vestingStartDate: z.string().optional(),
    vestingCliffMonths: z.number().default(12),
    vestingTotalMonths: z.number().default(48),
    expiryDate: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Guard: pool must have enough unallocated shares
    const pool = await getEsopPoolV1ById(ctx.companyId, input.poolId);
    if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "Pool not found" });
    const existingGrants = await getAllEsopGrantsV1(ctx.companyId, input.poolId);
    const allocated = existingGrants.reduce((s, g) => s + g.sharesGranted - g.sharesCancelled, 0);
    const remaining = pool.totalShares - allocated;
    if (input.sharesGranted > remaining) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Pool only has ${remaining.toLocaleString()} shares remaining; cannot grant ${input.sharesGranted.toLocaleString()}.` });
    }
    // Usage limit check: ESOP grants (company-wide count)
    const allGrants = await getAllEsopGrantsV1(ctx.companyId);
    await checkUsageLimit(ctx.companyPlan, "esopGrants", allGrants.length);
    const created = await createEsopGrantV1({ ...input, companyId: ctx.companyId });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "esop_grant_v1", resourceId: created.id,
      changesAfter: JSON.stringify({ poolId: input.poolId, investorId: input.investorId, sharesGranted: input.sharesGranted }),
    });
    return created;
  }),
  updateGrant: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      sharesVested: z.number().optional(),
      sharesExercised: z.number().optional(),
      sharesCancelled: z.number().optional(),
      exercisePrice: z.string().optional().nullable(),
      vestingStartDate: z.string().optional().nullable(),
      vestingCliffMonths: z.number().optional(),
      vestingTotalMonths: z.number().optional(),
      status: z.enum(["active", "fully_vested", "exercised", "cancelled"]).optional(),
      expiryDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  })).mutation(async ({ ctx, input }) => {
    await updateEsopGrantV1(ctx.companyId, input.id, input.data);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "esop_grant_v1", resourceId: input.id,
      changesAfter: JSON.stringify(input.data),
    });
  }),
  deleteGrant: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await deleteEsopGrantV1(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "delete", resourceType: "esop_grant_v1", resourceId: input.id,
    });
  }),

  // ── Exercise grant → write Common shares to register ─────────────────────
  exerciseGrant: companyEditorProcedure
    .input(z.object({
      grantId: z.number(),
      sharesToExercise: z.number().int().positive(),
      effectiveDate: z.string().optional(),  // defaults to today
    }))
    .mutation(async ({ ctx, input }) => {
      const grant = await getEsopGrantV1ById(ctx.companyId, input.grantId);
      if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });
      if (grant.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot exercise a cancelled grant" });
      if (grant.status === "exercised") throw new TRPCError({ code: "BAD_REQUEST", message: "Grant already fully exercised" });

      const exercisable = grant.sharesGranted - grant.sharesExercised - grant.sharesCancelled;
      if (input.sharesToExercise > exercisable) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Only ${exercisable} shares available to exercise` });
      }

      const newExercised = grant.sharesExercised + input.sharesToExercise;
      const fullyExercised = newExercised >= grant.sharesGranted - grant.sharesCancelled;
      const effectiveDate = input.effectiveDate || new Date().toISOString().slice(0, 10);

      // 1. Update grant record
      await updateEsopGrantV1(ctx.companyId, input.grantId, {
        sharesExercised: newExercised,
        status: fullyExercised ? "exercised" : "active",
      });

      // 2. Write Common shares to share register (ESOP exercises into Common)
      const { entry, snapshot } = await writeRegisterEntry(ctx.companyId, ctx.user!.id, {
        investorId: grant.investorId,
        eventType: "esop_exercise" as any,
        shareClass: "common" as any,
        shares: input.sharesToExercise,
        effectiveDate,
        pricePerShare: grant.exercisePrice,
        currency: grant.currency,
        totalAmount: grant.exercisePrice
          ? String(Number(grant.exercisePrice) * input.sharesToExercise)
          : undefined,
        notes: `ESOP exercise: ${input.sharesToExercise} shares from grant #${grant.id}`,
      });

      // 3. Audit log
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "esop_grant_v1", resourceId: input.grantId,
        resourceName: `Exercise ${input.sharesToExercise} shares`,
        changesAfter: JSON.stringify({
          sharesExercised: newExercised,
          status: fullyExercised ? "exercised" : "active",
          registerEntryId: entry.id,
        }),
      });

      return { grant: { ...grant, sharesExercised: newExercised }, entry, snapshot };
    }),

  // Pool + usage summary (for Cap Table + Dashboard)
  poolSummary: companyProcedure.query(async ({ ctx }) => {
    const pools = await getAllEsopPoolsV1(ctx.companyId);
    const grants = await getAllEsopGrantsV1(ctx.companyId);
    const totalPool = pools.reduce((s, p) => s + p.totalShares, 0);
    const totalAllocated = grants.reduce((s, g) => s + g.sharesGranted - g.sharesCancelled, 0);
    const totalVested = grants.reduce((s, g) => s + g.sharesVested, 0);
    const totalExercised = grants.reduce((s, g) => s + g.sharesExercised, 0);
    return {
      pools,
      totalPool,
      totalAllocated,
      totalUnallocated: totalPool - totalAllocated,
      totalVested,
      totalExercised,
      grantCount: grants.length,
    };
  }),
});

// ─── App Router ────────────────────────────────────────────────────────────────────────────────────
// ─── Instruments Router (V1) ────────────────────────────────────────────────
const instrumentsRouter = router({
  list: companyProcedure.use(requireFeature("fundraising.instruments")).query(({ ctx }) => getAllInstruments(ctx.companyId)),
  get: companyProcedure.input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getInstrumentById(ctx.companyId, input.id)),
  byInvestor: companyProcedure.input(z.object({ investorId: z.number() }))
    .query(({ ctx, input }) => getInstrumentsByInvestor(ctx.companyId, input.investorId)),
  byRound: companyProcedure.input(z.object({ fundingRoundId: z.number() }))
    .query(({ ctx, input }) => getInstrumentsByRound(ctx.companyId, input.fundingRoundId)),
  byType: companyProcedure.input(z.object({ type: z.enum(["safe", "convertible_note"]) }))
    .query(({ ctx, input }) => getInstrumentsByType(ctx.companyId, input.type)),
  activeConvertibles: companyProcedure.query(({ ctx }) => getActiveConvertibles(ctx.companyId)),

  create: companyEditorProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["safe", "convertible_note"]),
      investorId: z.number(),
      fundingRoundId: z.number().optional(),
      investmentAmountNtd: z.string(),
      investmentAmountUsd: z.string().optional(),
      // Equity
      pricePerShareNtd: z.string().optional(),
      sharesIssued: z.number().optional(),
      // SAFE
      valuationCapNtd: z.string().optional(),
      valuationCapUsd: z.string().optional(),
      discountRate: z.string().optional(),
      safeType: z.enum(["pre_money", "post_money", "mfn"]).optional(),
      // Convertible Note
      interestRate: z.string().optional(),
      maturityDate: z.string().optional(),
      // Meta
      notes: z.string().optional(),
      boardApprovalDate: z.string().optional(),
      documentUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const created = await createInstrument({
        ...input,
        companyId: ctx.companyId,
        createdByUserId: ctx.user!.id,
      });
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
        action: "create", resourceType: "instrument",
        resourceId: created.id, resourceName: input.name,
        changesAfter: JSON.stringify({ type: input.type, amount: input.investmentAmountNtd }),
      });
      return created;
    }),

  update: companyEditorProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().min(1).optional(),
        status: z.enum(["active", "converted", "cancelled", "matured"]).optional(),
        fundingRoundId: z.number().nullable().optional(),
        investmentAmountNtd: z.string().optional(),
        investmentAmountUsd: z.string().optional().nullable(),
        pricePerShareNtd: z.string().optional().nullable(),
        sharesIssued: z.number().optional().nullable(),
        valuationCapNtd: z.string().optional().nullable(),
        valuationCapUsd: z.string().optional().nullable(),
        discountRate: z.string().optional().nullable(),
        safeType: z.enum(["pre_money", "post_money", "mfn"]).optional().nullable(),
        interestRate: z.string().optional().nullable(),
        maturityDate: z.string().optional().nullable(),
        accruedInterestNtd: z.string().optional().nullable(),
        conversionRoundId: z.number().optional().nullable(),
        conversionDate: z.string().optional().nullable(),
        conversionPriceNtd: z.string().optional().nullable(),
        conversionShares: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        boardApprovalDate: z.string().optional().nullable(),
        documentUrl: z.string().optional().nullable(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateInstrument(ctx.companyId, input.id, input.data as any);
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "instrument",
        resourceId: input.id,
        changesAfter: JSON.stringify(input.data),
      });
    }),

  delete: companyEditorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getInstrumentById(ctx.companyId, input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Instrument not found" });
      if (existing.status === "converted") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete a converted instrument. Use cancellation instead." });
      }
      await deleteInstrument(ctx.companyId, input.id);
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
        action: "delete", resourceType: "instrument",
        resourceId: input.id,
      });
    }),

  // ─── Conversion simulator (read-only) ─────────────────────────────────
  simulateConversion: companyProcedure
    .input(z.object({
      nextRoundPricePerShareNtd: z.string(),
      nextRoundPreMoneyValuationNtd: z.string(),
      nextRoundPostMoneyValuationNtd: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const convertibles = await getActiveConvertibles(ctx.companyId);
      if (convertibles.length === 0) return { results: [], totalConversionShares: 0 };

      const nextPrice = parseFloat(input.nextRoundPricePerShareNtd);
      const preMoney = parseFloat(input.nextRoundPreMoneyValuationNtd);

      let totalConversionShares = 0;

      const results = convertibles.map((inst) => {
        const investmentAmount = Number(inst.investmentAmountNtd);
        const valCap = inst.valuationCapNtd ? Number(inst.valuationCapNtd) : null;
        const discount = inst.discountRate ? Number(inst.discountRate) : 0;
        const interestRate = inst.interestRate ? Number(inst.interestRate) : 0;

        let principal = investmentAmount;
        let accruedInterest = 0;
        if (inst.type === "convertible_note" && interestRate > 0 && inst.createdAt) {
          const daysSinceIssuance = Math.floor(
            (Date.now() - new Date(inst.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          const yearsElapsed = daysSinceIssuance / 365;
          accruedInterest = investmentAmount * interestRate * yearsElapsed;
          principal = investmentAmount + accruedInterest;
        }

        const discountPrice = discount > 0 ? nextPrice * (1 - discount) : nextPrice;
        let capPrice = nextPrice;
        if (valCap && preMoney > 0) {
          capPrice = nextPrice * (valCap / preMoney);
        }

        const conversionPrice = Math.min(discountPrice, capPrice);
        const conversionShares = Math.floor(principal / conversionPrice);
        totalConversionShares += conversionShares;

        const usedCap = capPrice <= discountPrice;
        const effectiveValuation = usedCap ? valCap : preMoney * (1 - discount);

        return {
          instrumentId: inst.id,
          instrumentName: inst.name,
          instrumentType: inst.type,
          investorId: inst.investorId,
          investmentAmount,
          principal: Math.round(principal * 100) / 100,
          accruedInterest: Math.round(accruedInterest * 100) / 100,
          valuationCap: valCap,
          discountRate: discount,
          interestRate,
          discountPrice: Math.round(discountPrice * 1_000_000) / 1_000_000,
          capPrice: Math.round(capPrice * 1_000_000) / 1_000_000,
          conversionPrice: Math.round(conversionPrice * 1_000_000) / 1_000_000,
          conversionMethod: usedCap ? "cap" as const : "discount" as const,
          effectiveValuation: effectiveValuation ? Math.round(effectiveValuation) : null,
          conversionShares,
        };
      });

      return { results, totalConversionShares };
    }),

  // ─── Execute conversion (writes status + fires audit) ─────────────────
  executeConversion: companyEditorProcedure
    .input(z.object({
      conversionRoundId: z.number(),
      conversions: z.array(z.object({
        instrumentId: z.number(),
        conversionPriceNtd: z.string(),
        conversionShares: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10);
      for (const conv of input.conversions) {
        await updateInstrument(ctx.companyId, conv.instrumentId, {
          status: "converted",
          conversionRoundId: input.conversionRoundId,
          conversionDate: today,
          conversionPriceNtd: conv.conversionPriceNtd,
          conversionShares: conv.conversionShares,
        });
      }
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "instrument",
        resourceName: `Conversion at round #${input.conversionRoundId}`,
        changesAfter: JSON.stringify({
          conversionRoundId: input.conversionRoundId,
          conversionsCount: input.conversions.length,
          conversions: input.conversions,
        }),
      });
      return { success: true, count: input.conversions.length };
    }),
});

// ─── Share Classes Router ────────────────────────────────────────────────────
const shareClassRouter = router({
  list: companyProcedure.query(({ ctx }) => getShareClasses(ctx.companyId)),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getShareClassById(ctx.companyId, input.id)),

  bySlug: companyProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ ctx, input }) => getShareClassBySlug(ctx.companyId, input.slug)),

  create: companyEditorProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      classType: z.enum(["common", "preferred"]),
      authorizedShares: z.number().optional(),
      parValue: z.string().optional(),
      pricePerShare: z.string().optional(),
      currency: z.string().optional(),
      liquidationMultiple: z.string().optional(),
      participationType: z.enum(["non_participating", "participating", "capped_participating"]).optional(),
      participationCap: z.string().optional(),
      seniorityRank: z.number().optional(),
      antiDilutionType: z.enum(["none", "full_ratchet", "broad_based_wa", "narrow_based_wa"]).optional(),
      isConvertible: z.boolean().optional(),
      conversionRatio: z.string().optional(),
      dividendType: z.enum(["none", "non_cumulative", "cumulative"]).optional(),
      dividendRate: z.string().optional(),
      votingMultiplier: z.string().optional(),
      boardSeats: z.number().optional(),
      protectiveProvisions: z.string().optional(),
      fundingRoundId: z.number().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await createShareClass({ companyId: ctx.companyId, ...input });
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "create", resourceType: "share_class",
        resourceName: input.name,
        changesAfter: JSON.stringify(input),
      });
      return row;
    }),

  update: companyEditorProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().optional(),
        slug: z.string().optional(),
        classType: z.enum(["common", "preferred"]).optional(),
        authorizedShares: z.number().nullable().optional(),
        parValue: z.string().nullable().optional(),
        pricePerShare: z.string().nullable().optional(),
        currency: z.string().optional(),
        liquidationMultiple: z.string().optional(),
        participationType: z.enum(["non_participating", "participating", "capped_participating"]).optional(),
        participationCap: z.string().nullable().optional(),
        seniorityRank: z.number().optional(),
        antiDilutionType: z.enum(["none", "full_ratchet", "broad_based_wa", "narrow_based_wa"]).optional(),
        isConvertible: z.boolean().optional(),
        conversionRatio: z.string().optional(),
        dividendType: z.enum(["none", "non_cumulative", "cumulative"]).optional(),
        dividendRate: z.string().nullable().optional(),
        votingMultiplier: z.string().optional(),
        boardSeats: z.number().optional(),
        protectiveProvisions: z.string().nullable().optional(),
        fundingRoundId: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        sortOrder: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateShareClass(ctx.companyId, input.id, input.data);
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "share_class",
        resourceId: input.id,
        changesAfter: JSON.stringify(input.data),
      });
      return { success: true };
    }),

  delete: companyEditorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteShareClass(ctx.companyId, input.id);
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "delete", resourceType: "share_class",
        resourceId: input.id,
      });
      return { success: true };
    }),

  seed: companyOwnerProcedure
    .mutation(async ({ ctx }) => {
      await seedDefaultShareClasses(ctx.companyId);
      return { success: true };
    }),
});

// ─── eSign Router (DocuSeal eSignature) ─────────────────────────────────────
const esignRouter = router({
  list: companyProcedure.use(requireFeature("esign")).query(({ ctx }) => getAllSigningRequests(ctx.companyId)),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getSigningRequestById(ctx.companyId, input.id)),

  byStatus: companyProcedure
    .input(z.object({ status: z.string() }))
    .query(({ ctx, input }) => getSigningRequestsByStatus(ctx.companyId, input.status)),

  create: companyEditorProcedure
    .input(z.object({
      docType: z.enum(["share_certificate", "safe_agreement", "convertible_note", "stock_option_grant", "board_resolution", "sha", "custom"]),
      title: z.string().min(1),
      description: z.string().optional(),
      linkedResourceType: z.string().optional(),
      linkedResourceId: z.number().optional(),
      sourceDocumentUrl: z.string().optional(),
      signers: z.string().optional(),
      expiresAt: z.string().optional(),
      docusealTemplateId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await createSigningRequest({
        companyId: ctx.companyId,
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdBy: ctx.user!.id,
      });
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "create", resourceType: "signing_request",
        resourceName: input.title,
        changesAfter: JSON.stringify(input),
      });
      return row;
    }),

  update: companyEditorProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "pending", "viewed", "completed", "declined", "expired"]).optional(),
        signers: z.string().optional(),
        signedDocumentUrl: z.string().optional(),
        completedAt: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateSigningRequest(ctx.companyId, input.id, {
        ...input.data,
        completedAt: input.data.completedAt ? new Date(input.data.completedAt) : undefined,
      });
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "signing_request",
        resourceId: input.id,
        changesAfter: JSON.stringify(input.data),
      });
      return { success: true };
    }),

  delete: companyEditorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSigningRequest(ctx.companyId, input.id);
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "delete", resourceType: "signing_request",
        resourceId: input.id,
      });
      return { success: true };
    }),

  // Upload PDF/DOCX → create DocuSeal template → link to signing_request
  createTemplate: companyEditorProcedure
    .input(z.object({
      signingRequestId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createTemplateFromPdf, createTemplateFromDocx } = await import("./docuseal");
      const ext = input.fileName.split(".").pop()?.toLowerCase();
      const createFn = ext === "docx" ? createTemplateFromDocx : createTemplateFromPdf;
      const template = await createFn(input.fileName, input.fileBase64, ctx.companyId);
      await updateSigningRequest(ctx.companyId, input.signingRequestId, {
        docusealTemplateId: template.id,
      });
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "signing_request",
        resourceId: input.signingRequestId,
        changesAfter: JSON.stringify({ docusealTemplateId: template.id }),
      });
      return { templateId: template.id, template };
    }),

  // Send signing request → DocuSeal create_submission → mark as pending
  send: companyEditorProcedure
    .input(z.object({
      signingRequestId: z.number(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const req = await getSigningRequestById(ctx.companyId, input.signingRequestId);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (!req.docusealTemplateId) throw new TRPCError({ code: "BAD_REQUEST", message: "No template — upload a document first" });

      const signers: Array<{ role: string; email: string; name?: string }> = req.signers ? JSON.parse(req.signers) : [];
      if (signers.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No signers defined" });

      const { createSubmission } = await import("./docuseal");
      const submission = await createSubmission(
        req.docusealTemplateId,
        signers.map(s => ({ role: s.role || "First Party", email: s.email, name: s.name })),
        {
          send_email: true,
          message: input.message,
          expire_at: req.expiresAt?.toISOString(),
        },
        ctx.companyId,
      );

      const submissionId = Array.isArray(submission) ? submission[0]?.submission_id : submission.id;

      await updateSigningRequest(ctx.companyId, input.signingRequestId, {
        docusealSubmissionId: submissionId,
        status: "pending",
        sentAt: new Date(),
      });
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update", resourceType: "signing_request",
        resourceId: input.signingRequestId,
        resourceName: req.title,
        changesAfter: JSON.stringify({ status: "pending", docusealSubmissionId: submissionId }),
      });
      return { submissionId, submission };
    }),

  // List DocuSeal templates (for reuse)
  listDocusealTemplates: companyProcedure.query(async ({ ctx }) => {
    const { listTemplates } = await import("./docuseal");
    return listTemplates(ctx.companyId);
  }),

  // ─── Template Library ───────────────────────────────────────────────────

  /** List templates visible to this company (platform + own) */
  templates: companyProcedure.query(({ ctx }) =>
    getSigningTemplatesForCompany(ctx.companyId)
  ),

  /** Platform templates only (for admin panel) */
  platformTemplates: protectedProcedure.query(() =>
    getPlatformSigningTemplates()
  ),

  /** Get single template */
  getTemplate: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => getSigningTemplateById(input.id)),

  /** Upload a template (company-scope) */
  uploadTemplate: companyEditorProcedure
    .input(z.object({
      docType: z.enum(["share_certificate", "safe_agreement", "convertible_note", "stock_option_grant", "board_resolution", "sha", "custom"]),
      name: z.string().min(1),
      description: z.string().optional(),
      fileName: z.string(),
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Store file in Vercel Blob
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() || "pdf";
      const contentType = ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
      const key = `company/${ctx.companyId}/templates/${Date.now()}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(key, buffer, contentType);

      // 2. Create DocuSeal template
      const { createTemplateFromPdf, createTemplateFromDocx } = await import("./docuseal");
      const createFn = ext === "docx" ? createTemplateFromDocx : createTemplateFromPdf;
      const dsTemplate = await createFn(input.name, input.fileBase64, ctx.companyId);

      // 3. Save to our DB
      const row = await createSigningTemplate({
        companyId: ctx.companyId,
        scope: "company",
        docType: input.docType,
        name: input.name,
        description: input.description,
        docusealTemplateId: dsTemplate.id,
        fileUrl,
        fileName: input.fileName,
        createdBy: ctx.user!.id,
      });

      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "create", resourceType: "signing_template",
        resourceName: input.name,
      });
      return row;
    }),

  /** Upload a platform template (admin only — uses protectedProcedure) */
  uploadPlatformTemplate: protectedProcedure
    .input(z.object({
      docType: z.enum(["share_certificate", "safe_agreement", "convertible_note", "stock_option_grant", "board_resolution", "sha", "custom"]),
      name: z.string().min(1),
      description: z.string().optional(),
      fileName: z.string(),
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only app admins can create platform templates
      if (ctx.user!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only platform admins can create platform templates" });
      }

      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() || "pdf";
      const contentType = ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
      const key = `platform/templates/${Date.now()}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(key, buffer, contentType);

      const { createTemplateFromPdf, createTemplateFromDocx } = await import("./docuseal");
      const createFn = ext === "docx" ? createTemplateFromDocx : createTemplateFromPdf;
      const dsTemplate = await createFn(input.name, input.fileBase64);

      const row = await createSigningTemplate({
        companyId: null,
        scope: "platform",
        docType: input.docType,
        name: input.name,
        description: input.description,
        docusealTemplateId: dsTemplate.id,
        fileUrl,
        fileName: input.fileName,
        createdBy: ctx.user!.id,
      });

      await createAuditLog({
        userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
        action: "create", resourceType: "signing_template",
        resourceName: `[Platform] ${input.name}`,
      });
      return row;
    }),

  /** Delete a template */
  deleteTemplate: companyEditorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tmpl = await getSigningTemplateById(input.id);
      if (!tmpl) throw new TRPCError({ code: "NOT_FOUND" });
      // Company templates: must belong to this company
      // Platform templates: must be app admin
      if (tmpl.scope === "company" && tmpl.companyId !== ctx.companyId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (tmpl.scope === "platform" && ctx.user!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only platform admins can delete platform templates" });
      }
      await deleteSigningTemplate(input.id);
      await createAuditLog({
        companyId: ctx.companyId, userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "delete", resourceType: "signing_template",
        resourceId: input.id,
      });
      return { success: true };
    }),

  // ─── DocuSeal Connection Management ───────────────────────────────────────

  /** Check whether the company has a connected DocuSeal account */
  connectionStatus: companyProcedure.query(async ({ ctx }) => {
    const { hasDocuSealConnection } = await import("./docuseal");
    const connected = await hasDocuSealConnection(ctx.companyId);
    return { connected };
  }),

  /** Save & validate a DocuSeal API key for this company */
  connect: companyEditorProcedure
    .input(z.object({ apiKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Validate the key with DocuSeal
      const { validateApiKey } = await import("./docuseal");
      const result = await validateApiKey(input.apiKey);
      if (!result.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Invalid DocuSeal API key",
        });
      }

      // 2. Save to DB
      await updateCompany(ctx.companyId, {
        docusealTenantApiKey: input.apiKey,
      });

      // 3. Audit log
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "company",
        resourceName: "DocuSeal API Key",
        changesAfter: JSON.stringify({ docusealConnected: true }),
      });

      return { success: true };
    }),

  /** Disconnect DocuSeal (remove the API key) */
  disconnect: companyEditorProcedure
    .mutation(async ({ ctx }) => {
      await updateCompany(ctx.companyId, {
        docusealTenantApiKey: null,
      });

      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        action: "update",
        resourceType: "company",
        resourceName: "DocuSeal API Key",
        changesAfter: JSON.stringify({ docusealConnected: false }),
      });

      return { success: true };
    }),
});

// ─── Investor Portal Router ──────────────────────────────────────────────────
// Read-only endpoints for users with role="investor". Matches the logged-in
// user's email to an investor record, then returns their holdings, grants, and docs.
const investorPortalRouter = router({
  /** Resolve the current user's investor record by email match */
  myProfile: companyProcedure.use(requireFeature("investorPortal")).query(async ({ ctx }) => {
    const db = await import("./db").then(m => m.getDb());
    if (!db) return null;
    const { investors: investorsTable } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const userEmail = ctx.user!.email;
    if (!userEmail) return null;
    const rows = await db.select().from(investorsTable)
      .where(and(eq(investorsTable.companyId, ctx.companyId), eq(investorsTable.email, userEmail)));
    return rows[0] ?? null;
  }),

  /** Holdings: shares by class from the cap table */
  myHoldings: companyProcedure.query(async ({ ctx }) => {
    const db = await import("./db").then(m => m.getDb());
    if (!db) return { holdings: [], totalShares: 0 };
    const { investors: investorsTable, shareRegisterEntries: sre } = await import("../drizzle/schema");
    const { eq, and, sum } = await import("drizzle-orm");
    // Find investor by email
    const userEmail = ctx.user!.email;
    if (!userEmail) return { holdings: [], totalShares: 0 };
    const [inv] = await db.select().from(investorsTable)
      .where(and(eq(investorsTable.companyId, ctx.companyId), eq(investorsTable.email, userEmail)));
    if (!inv) return { holdings: [], totalShares: 0 };

    // Aggregate register entries
    const rows = await db.select({
      shareClass: sre.shareClass,
      total: sum(sre.shares).as("total"),
    }).from(sre)
      .where(and(eq(sre.companyId, ctx.companyId), eq(sre.investorId, inv.id)))
      .groupBy(sre.shareClass);

    const holdings = rows
      .map(r => ({ shareClass: r.shareClass, shares: Number(r.total ?? 0) }))
      .filter(h => h.shares > 0);
    const totalShares = holdings.reduce((s, h) => s + h.shares, 0);

    return { investorId: inv.id, investorName: inv.name, holdings, totalShares };
  }),

  /** ESOP grants for this investor */
  myGrants: companyProcedure.query(async ({ ctx }) => {
    const db = await import("./db").then(m => m.getDb());
    if (!db) return [];
    const { investors: investorsTable, esopGrantsV1 } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const userEmail = ctx.user!.email;
    if (!userEmail) return [];
    const [inv] = await db.select().from(investorsTable)
      .where(and(eq(investorsTable.companyId, ctx.companyId), eq(investorsTable.email, userEmail)));
    if (!inv) return [];
    return db.select().from(esopGrantsV1)
      .where(and(eq(esopGrantsV1.companyId, ctx.companyId), eq(esopGrantsV1.investorId, inv.id)));
  }),

  /** Signing requests addressed to this investor */
  myDocuments: companyProcedure.query(async ({ ctx }) => {
    const db = await import("./db").then(m => m.getDb());
    if (!db) return [];
    const { signingRequests } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const userEmail = ctx.user!.email;
    if (!userEmail) return [];
    // Find signing requests where this user is a signer
    const all = await db.select().from(signingRequests)
      .where(eq(signingRequests.companyId, ctx.companyId));
    return all.filter(sr => {
      if (!sr.signers) return false;
      try {
        const signers = JSON.parse(sr.signers);
        return signers.some((s: any) => s.email === userEmail);
      } catch { return false; }
    });
  }),

  /** Register entries for this investor (for certificate download) */
  myRegisterEntries: companyProcedure.query(async ({ ctx }) => {
    const db = await import("./db").then(m => m.getDb());
    if (!db) return [];
    const { investors: investorsTable, shareRegisterEntries: sre } = await import("../drizzle/schema");
    const { eq, and, asc } = await import("drizzle-orm");
    const userEmail = ctx.user!.email;
    if (!userEmail) return [];
    const [inv] = await db.select().from(investorsTable)
      .where(and(eq(investorsTable.companyId, ctx.companyId), eq(investorsTable.email, userEmail)));
    if (!inv) return [];
    return db.select().from(sre)
      .where(and(eq(sre.companyId, ctx.companyId), eq(sre.investorId, inv.id)))
      .orderBy(asc(sre.effectiveDate));
  }),
});

// ─── 409A Valuation Router ───────────────────────────────────────────────────────
const valuation409aRouter = router({
  list: companyProcedure.use(requireFeature("compliance.409a")).query(({ ctx }) => get409aValuations(ctx.companyId)),

  get: companyProcedure.input(z.object({ id: z.number() })).query(({ input, ctx }) =>
    get409aValuationById(ctx.companyId, input.id)
  ),

  active: companyProcedure.query(({ ctx }) => getActive409aValuation(ctx.companyId)),

  create: companyEditorProcedure.input(z.object({
    valuationDate: z.string(),
    expiryDate: z.string().optional(),
    status: z.enum(["active", "expired", "superseded"]).default("active"),
    fmvPerShare: z.string().optional(),
    currency: z.string().default("USD"),
    fmvPerShareNtd: z.string().optional(),
    fmvPerShareUsd: z.string().optional(),
    commonStockValueNtd: z.string().optional(),
    preferredStockValueNtd: z.string().optional(),
    totalCompanyValueNtd: z.string().optional(),
    valuationFirm: z.string().optional(),
    reportUrl: z.string().optional(),
    method: z.enum(["dcf", "market_comparable", "asset_based", "409a_safe_harbor", "other"]).default("dcf"),
    relatedRoundId: z.number().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await create409aValuation({
      ...input,
      companyId: ctx.companyId,
      valuationDate: input.valuationDate as any,
      expiryDate: input.expiryDate as any,
    });
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "create",
      resourceType: "409a_valuation",
      resourceId: result?.id,
      resourceName: `409A Valuation - ${input.valuationDate}`,
      changesAfter: JSON.stringify(input),
    });
    return result;
  }),

  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      valuationDate: z.string().optional(),
      expiryDate: z.string().optional(),
      status: z.enum(["active", "expired", "superseded"]).optional(),
      fmvPerShare: z.string().optional(),
      currency: z.string().optional(),
      fmvPerShareNtd: z.string().optional(),
      fmvPerShareUsd: z.string().optional(),
      commonStockValueNtd: z.string().optional(),
      preferredStockValueNtd: z.string().optional(),
      totalCompanyValueNtd: z.string().optional(),
      valuationFirm: z.string().optional(),
      reportUrl: z.string().optional(),
      method: z.enum(["dcf", "market_comparable", "asset_based", "409a_safe_harbor", "other"]).optional(),
      relatedRoundId: z.number().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const updateData: any = { ...input.data };
    if (input.data.valuationDate) updateData.valuationDate = input.data.valuationDate as any;
    if (input.data.expiryDate) updateData.expiryDate = input.data.expiryDate as any;

    const result = await update409aValuation(ctx.companyId, input.id, updateData);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "409a_valuation",
      resourceId: input.id,
      resourceName: `409A Valuation #${input.id}`,
      changesAfter: JSON.stringify(input.data),
    });
    return result;
  }),

  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await delete409aValuation(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "delete",
      resourceType: "409a_valuation",
      resourceId: input.id,
      resourceName: `409A Valuation #${input.id}`,
    });
    return result;
  }),
});

// ─── 83(b) Election Router ───────────────────────────────────────────────────────
const election83bRouter = router({
  list: companyProcedure.use(requireFeature("compliance.83b")).query(({ ctx }) => get83bElections(ctx.companyId)),

  get: companyProcedure.input(z.object({ id: z.number() })).query(({ input, ctx }) =>
    get83bElectionById(ctx.companyId, input.id)
  ),

  pending: companyProcedure.query(({ ctx }) => getPending83bElections(ctx.companyId)),

  create: companyEditorProcedure.input(z.object({
    grantId: z.number().optional(),
    recipientName: z.string().min(1),
    recipientEmail: z.string().email().optional(),
    grantDate: z.string(),
    filingDeadline: z.string(),
    sharesSubject: z.number().min(1),
    fmvPerShare: z.string().optional(),
    amountPaid: z.string().optional(),
    currency: z.string().default("USD"),
    propertyDescription: z.string().optional(),
    status: z.enum(["pending", "filed", "confirmed", "missed"]).default("pending"),
    filedDate: z.string().optional(),
    irsConfirmationDate: z.string().optional(),
    employerCopyDate: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await create83bElection({
      ...input,
      companyId: ctx.companyId,
      grantDate: input.grantDate as any,
      filingDeadline: input.filingDeadline as any,
      filedDate: input.filedDate as any,
      irsConfirmationDate: input.irsConfirmationDate as any,
      employerCopyDate: input.employerCopyDate as any,
    });
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "create",
      resourceType: "83b_election",
      resourceId: result?.id,
      resourceName: `83(b) Election - ${input.recipientName}`,
      changesAfter: JSON.stringify(input),
    });
    return result;
  }),

  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      grantId: z.number().optional(),
      recipientName: z.string().min(1).optional(),
      recipientEmail: z.string().email().optional(),
      grantDate: z.string().optional(),
      filingDeadline: z.string().optional(),
      sharesSubject: z.number().min(1).optional(),
      fmvPerShare: z.string().optional(),
      amountPaid: z.string().optional(),
      currency: z.string().optional(),
      propertyDescription: z.string().optional(),
      status: z.enum(["pending", "filed", "confirmed", "missed"]).optional(),
      filedDate: z.string().optional(),
      irsConfirmationDate: z.string().optional(),
      employerCopyDate: z.string().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const updateData: any = { ...input.data };
    if (input.data.grantDate) updateData.grantDate = input.data.grantDate as any;
    if (input.data.filingDeadline) updateData.filingDeadline = input.data.filingDeadline as any;
    if (input.data.filedDate) updateData.filedDate = input.data.filedDate as any;
    if (input.data.irsConfirmationDate) updateData.irsConfirmationDate = input.data.irsConfirmationDate as any;
    if (input.data.employerCopyDate) updateData.employerCopyDate = input.data.employerCopyDate as any;

    const result = await update83bElection(ctx.companyId, input.id, updateData);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "83b_election",
      resourceId: input.id,
      resourceName: `83(b) Election #${input.id}`,
      changesAfter: JSON.stringify(input.data),
    });
    return result;
  }),

  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await delete83bElection(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "delete",
      resourceType: "83b_election",
      resourceId: input.id,
      resourceName: `83(b) Election #${input.id}`,
    });
    return result;
  }),
});

// ─── Notifications Router ────────────────────────────────────────────────────
const notificationsRouter = router({
  list: companyProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), offset: z.number().min(0).default(0) }).optional())
    .query(({ ctx, input }) => getNotifications(ctx.companyId, ctx.user!.id, input?.limit ?? 50, input?.offset ?? 0)),

  unreadCount: companyProcedure.query(({ ctx }) => getUnreadNotificationCount(ctx.companyId, ctx.user!.id)),

  create: companyEditorProcedure.input(z.object({
    userId: z.number().optional(),
    type: z.enum(["funding_round", "document_signing", "vesting_milestone", "valuation_409a", "election_83b", "share_transfer", "general"]),
    title: z.string().min(1),
    message: z.string().optional(),
    channel: z.enum(["in_app", "email", "both"]).default("both"),
    linkUrl: z.string().optional(),
    metadata: z.string().optional(),
  })).mutation(({ input, ctx }) => createNotification({ ...input, companyId: ctx.companyId })),

  markRead: companyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => markNotificationRead(ctx.companyId, input.id)),

  markAllRead: companyProcedure
    .mutation(({ ctx }) => markAllNotificationsRead(ctx.companyId, ctx.user!.id)),

  delete: companyEditorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => deleteNotification(ctx.companyId, input.id)),
});

// ─── Share Transfers Router ──────────────────────────────────────────────────
const shareTransfersRouter = router({
  list: companyProcedure.use(requireFeature("shareTransfers")).query(({ ctx }) => getShareTransfers(ctx.companyId)),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input, ctx }) => getShareTransferById(ctx.companyId, input.id)),

  create: companyEditorProcedure.input(z.object({
    sellerInvestorId: z.number(),
    buyerInvestorId: z.number().optional(),
    buyerName: z.string().optional(),
    buyerEmail: z.string().optional(),
    shareClass: z.string(),
    shares: z.number().int().positive(),
    pricePerShare: z.string().optional(),
    totalPrice: z.string().optional(),
    currency: z.string().default("USD"),
    transferDate: z.string(),
    status: z.enum(["pending", "rofr_notice", "approved", "completed", "rejected"]).default("pending"),
    hasRofr: z.boolean().default(false),
    rofrDeadline: z.string().optional(),
    boardApprovalDate: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createShareTransfer({ ...input, companyId: ctx.companyId });
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "create",
      resourceType: "share_transfer",
      resourceName: `Transfer: ${input.shares} ${input.shareClass} shares`,
      changesAfter: JSON.stringify(input),
    });
    return result;
  }),

  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      buyerInvestorId: z.number().optional(),
      buyerName: z.string().optional(),
      buyerEmail: z.string().optional(),
      shareClass: z.string().optional(),
      shares: z.number().int().positive().optional(),
      pricePerShare: z.string().optional(),
      totalPrice: z.string().optional(),
      currency: z.string().optional(),
      transferDate: z.string().optional(),
      status: z.enum(["pending", "rofr_notice", "approved", "completed", "rejected"]).optional(),
      hasRofr: z.boolean().optional(),
      rofrDeadline: z.string().optional(),
      rofrWaivedAt: z.string().optional(),
      boardApprovalDate: z.string().optional(),
      registerEntryId: z.number().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const result = await updateShareTransfer(ctx.companyId, input.id, input.data as any);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "share_transfer",
      resourceId: input.id,
      resourceName: `Share Transfer #${input.id}`,
      changesAfter: JSON.stringify(input.data),
    });
    return result;
  }),

  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await deleteShareTransfer(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId,
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "delete",
      resourceType: "share_transfer",
      resourceId: input.id,
      resourceName: `Share Transfer #${input.id}`,
    });
    return { success: true };
  }),
});

// ─── Tech Share Tax Router (台灣法規) ────────────────────────────────────────
const techShareTaxRouter = router({
  list: companyProcedure.use(requireFeature("compliance.techShareTax")).query(({ ctx }) => getTechShareTaxRecords(ctx.companyId)),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input, ctx }) => getTechShareTaxRecordById(ctx.companyId, input.id)),

  expiring: companyProcedure
    .input(z.object({ withinDays: z.number().default(60) }).optional())
    .query(({ input, ctx }) => getDeferralExpiringRecords(ctx.companyId, input?.withinDays ?? 60)),

  create: companyEditorProcedure.input(z.object({
    grantId: z.number().optional(),
    holderName: z.string().min(1),
    shareType: z.enum(["tech_share", "rsa"]),
    acquisitionDate: z.string(),
    sharesAcquired: z.number().int().positive(),
    acquisitionFmv: z.string().optional(),
    paidAmount: z.string().optional(),
    isDeferralEligible: z.boolean().default(false),
    deferralStartDate: z.string().optional(),
    deferralExpiryDate: z.string().optional(),
    holdingPeriodMet: z.boolean().default(false),
    vestingDate: z.string().optional(),
    vestingFmv: z.string().optional(),
    dispositionDate: z.string().optional(),
    dispositionFmv: z.string().optional(),
    dispositionType: z.enum(["transfer", "resignation", "ipo", "other"]).optional(),
    taxableIncome: z.string().optional(),
    estimatedTax: z.string().optional(),
    taxStatus: z.enum(["deferred", "taxable", "filed", "exempt"]).default("deferred"),
    filingDeadline: z.string().optional(),
    filingDate: z.string().optional(),
    filingReference: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createTechShareTaxRecord({ ...input, companyId: ctx.companyId });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "tech_share_tax",
      resourceName: `${input.shareType === "rsa" ? "RSA" : "技術股"}: ${input.holderName}`,
      changesAfter: JSON.stringify(input),
    });
    return result;
  }),

  update: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      holderName: z.string().optional(),
      shareType: z.enum(["tech_share", "rsa"]).optional(),
      acquisitionDate: z.string().optional(),
      sharesAcquired: z.number().int().positive().optional(),
      acquisitionFmv: z.string().optional(),
      paidAmount: z.string().optional(),
      isDeferralEligible: z.boolean().optional(),
      deferralStartDate: z.string().optional(),
      deferralExpiryDate: z.string().optional(),
      holdingPeriodMet: z.boolean().optional(),
      vestingDate: z.string().optional(),
      vestingFmv: z.string().optional(),
      dispositionDate: z.string().optional(),
      dispositionFmv: z.string().optional(),
      dispositionType: z.enum(["transfer", "resignation", "ipo", "other"]).optional(),
      taxableIncome: z.string().optional(),
      estimatedTax: z.string().optional(),
      taxStatus: z.enum(["deferred", "taxable", "filed", "exempt"]).optional(),
      filingDeadline: z.string().optional(),
      filingDate: z.string().optional(),
      filingReference: z.string().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const result = await updateTechShareTaxRecord(ctx.companyId, input.id, input.data as any);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "tech_share_tax", resourceId: input.id,
      resourceName: `Tech Share Tax #${input.id}`, changesAfter: JSON.stringify(input.data),
    });
    return result;
  }),

  delete: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await deleteTechShareTaxRecord(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "delete", resourceType: "tech_share_tax", resourceId: input.id,
      resourceName: `Tech Share Tax #${input.id}`,
    });
    return { success: true };
  }),
});

// ─── Closed Company Router (閉鎖性公司 — 台灣法規) ───────────────────────────
const closedCompanyRouter = router({
  // Company-level provisions (single record per company)
  getProvision: companyProcedure.use(requireFeature("compliance.closedCompany")).query(({ ctx }) => getClosedCompanyProvision(ctx.companyId)),

  upsertProvision: companyEditorProcedure.input(z.object({
    isClosedCompany: z.boolean(),
    parValueType: z.enum(["par", "no_par"]).default("par"),
    transferRestriction: z.enum(["none", "board_approval", "shareholder_approval", "custom"]).default("none"),
    transferDescription: z.string().optional(),
    articlesUrl: z.string().optional(),
    effectiveDate: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await upsertClosedCompanyProvision({ ...input, companyId: ctx.companyId });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "closed_company_provision",
      resourceName: "閉鎖性公司設定", changesAfter: JSON.stringify(input),
    });
    return result;
  }),

  // Share class rights (multiple records)
  listRights: companyProcedure.query(({ ctx }) => getClosedCompanyShareRights(ctx.companyId)),

  getRight: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input, ctx }) => getClosedCompanyShareRightById(ctx.companyId, input.id)),

  createRight: companyEditorProcedure.input(z.object({
    shareClassId: z.number().optional(),
    shareClassName: z.string().min(1),
    votesPerShare: z.string().default("1.00"),
    hasVetoRight: z.boolean().default(false),
    vetoMatters: z.string().optional(),
    guaranteedBoardSeats: z.number().int().default(0),
    boardObserverRights: z.boolean().default(false),
    dividendPriority: z.enum(["cumulative", "non_cumulative", "participating", "none"]).default("none"),
    dividendRate: z.string().optional(),
    liquidationPriority: z.number().int().default(1),
    liquidationMultiple: z.string().optional(),
    isConvertible: z.boolean().default(false),
    conversionRatio: z.string().optional(),
    conversionTrigger: z.string().optional(),
    customProvisions: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createClosedCompanyShareRight({ ...input, companyId: ctx.companyId });
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "create", resourceType: "closed_company_share_right",
      resourceName: `特別股條款: ${input.shareClassName}`, changesAfter: JSON.stringify(input),
    });
    return result;
  }),

  updateRight: companyEditorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      shareClassId: z.number().optional(),
      shareClassName: z.string().optional(),
      votesPerShare: z.string().optional(),
      hasVetoRight: z.boolean().optional(),
      vetoMatters: z.string().optional(),
      guaranteedBoardSeats: z.number().int().optional(),
      boardObserverRights: z.boolean().optional(),
      dividendPriority: z.enum(["cumulative", "non_cumulative", "participating", "none"]).optional(),
      dividendRate: z.string().optional(),
      liquidationPriority: z.number().int().optional(),
      liquidationMultiple: z.string().optional(),
      isConvertible: z.boolean().optional(),
      conversionRatio: z.string().optional(),
      conversionTrigger: z.string().optional(),
      customProvisions: z.string().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const result = await updateClosedCompanyShareRight(ctx.companyId, input.id, input.data as any);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "update", resourceType: "closed_company_share_right", resourceId: input.id,
      resourceName: `特別股條款 #${input.id}`, changesAfter: JSON.stringify(input.data),
    });
    return result;
  }),

  deleteRight: companyEditorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await deleteClosedCompanyShareRight(ctx.companyId, input.id);
    await createAuditLog({
      companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
      action: "delete", resourceType: "closed_company_share_right", resourceId: input.id,
      resourceName: `特別股條款 #${input.id}`,
    });
    return { success: true };
  }),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      const memberships = await getUserCompanyMemberships(opts.ctx.user.id);
      const user = opts.ctx.user;

      // Auto-promote platform owner to super_admin if not already set
      if (user.role === "admin" && user.email === PLATFORM_OWNER_EMAIL && user.adminRole !== "super_admin") {
        try { await adminUpdateAdminRole(user.id, "super_admin"); } catch { /* ignore if column missing */ }
        (user as any).adminRole = "super_admin";
      }

      // Spread user fields so existing frontend code (me.id, me.name, me.email, me.appRole)
      // keeps working; add `companies` for the company switcher.
      // `companyRole` = the role for the currently active company (from context).
      return {
        ...user,
        companies: memberships,
        companyRole: opts.ctx.companyRole,
      };
    }),
  }),
  companies: companiesRouter,
  fundingRounds: fundingRoundsRouter,
  import: importRouter,
  analysis: analysisRouter,
  antiDilution: antiDilutionRouter,
  instruments: instrumentsRouter,
  esign: esignRouter,
  shareClasses: shareClassRouter,
  investorPortal: investorPortalRouter,
  waterfall: waterfallRouter,
  team: teamRouter,
  invitations: invitationsRouter,
  auditLog: auditLogRouter,
  financialProjections: financialProjectionsRouter,
  dcf: dcfRouter,
  valuation409a: valuation409aRouter,
  election83b: election83bRouter,
  notifications: notificationsRouter,
  shareTransfers: shareTransfersRouter,
  techShareTax: techShareTaxRouter,
  closedCompany: closedCompanyRouter,
  v1: router({
    investors: v1InvestorsRouter,
    allocations: v1AllocationsRouter,
    register: v1RegisterRouter,
    capTable: v1CapTableRouter,
    snapshots: v1SnapshotsRouter,
    esop: v1EsopRouter,
  }),
  admin: router({
    // ─── Danger Zone: Clear All Business Data for the active company ──────
    clearAllData: companyOwnerProcedure
      .input(z.object({ confirmationPhrase: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (input.confirmationPhrase !== "CLEAR ALL DATA") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmation phrase does not match." });
        }
        const counts = await truncateAllBusinessData(ctx.companyId);
        await createAuditLog({
          companyId: ctx.companyId, userId: ctx.user!.id, userName: ctx.user!.name ?? undefined,
          action: "delete", resourceType: "system", resourceName: "All business data (truncated)",
          changesBefore: JSON.stringify(counts),
        });
        return { success: true, cleared: counts };
      }),

    // ─── Platform Admin: Dashboard stats ──────────────────────────────────
    platformStats: adminProcedure.query(async () => {
      return adminGetPlatformStats();
    }),

    // ─── Platform Admin: List all companies ───────────────────────────────
    listCompanies: adminProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const all = await adminListCompanies();
        if (!input?.search) return all;
        const q = input.search.toLowerCase();
        return all.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.nameEn?.toLowerCase().includes(q) ||
          c.contactEmail?.toLowerCase().includes(q)
        );
      }),

    // ─── Platform Admin: Company detail ───────────────────────────────────
    companyDetail: adminProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const detail = await adminGetCompanyDetail(input.companyId);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
        // Log this view
        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: "view_company",
          targetCompanyId: input.companyId,
          targetCompanyName: detail.company.name,
        });
        return detail;
      }),

    // ─── Platform Admin: View company audit logs ──────────────────────────
    companyAuditLogs: adminProcedure
      .input(z.object({
        companyId: z.number(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const logs = await adminGetCompanyAuditLogs(input.companyId, input.limit, input.offset);
        // Log this access
        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: "view_audit_log",
          targetCompanyId: input.companyId,
          details: JSON.stringify({ limit: input.limit, offset: input.offset }),
        });
        return logs;
      }),

    // ─── Platform Admin: Update company plan ──────────────────────────────
    updatePlan: adminCompanyProcedure
      .input(z.object({
        companyId: z.number(),
        plan: z.enum(["starter", "standard", "plus", "enterprise"]).optional(),
        planNote: z.string().optional(),
        isSuspended: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { companyId, ...updates } = input;
        const before = await adminGetCompanyDetail(companyId);
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

        await adminUpdateCompanyPlan(companyId, updates);

        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: updates.isSuspended !== undefined
            ? (updates.isSuspended ? "suspend_company" : "reactivate_company")
            : "update_plan",
          targetCompanyId: companyId,
          targetCompanyName: before.company.name,
          details: JSON.stringify({
            before: { plan: before.company.plan, planNote: before.company.planNote, isSuspended: before.company.isSuspended },
            after: updates,
          }),
        });
        return { success: true };
      }),

    // ─── Platform Admin: Admin activity log ───────────────────────────────
    adminAuditLogs: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        return getAdminAuditLogs(input?.limit ?? 100, input?.offset ?? 0);
      }),

    // ─── Platform Admin: Support ticket management ──────────────────────
    adminTickets: adminProcedure.query(async () => {
      return getAllSupportTickets();
    }),

    adminUpdateTicket: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      adminNotes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const updates: Record<string, unknown> = {};
      if (input.status) {
        updates.status = input.status;
        if (input.status === "resolved" || input.status === "closed") {
          updates.resolvedAt = new Date();
        }
      }
      if (input.adminNotes !== undefined) updates.adminNotes = input.adminNotes;
      return updateSupportTicket(input.id, updates);
    }),

    // ─── Platform Admin: FAQ management ─────────────────────────────────
    adminCreateFaq: adminProcedure.input(z.object({
      category: z.enum(["account", "subscription", "equity", "technical", "general"]),
      questionEn: z.string().min(1),
      questionZh: z.string().min(1),
      answerEn: z.string().min(1),
      answerZh: z.string().min(1),
      sortOrder: z.number().default(0),
    })).mutation(async ({ input }) => {
      return createSupportFaq(input);
    }),

    adminUpdateFaq: adminProcedure.input(z.object({
      id: z.number(),
      data: z.object({
        category: z.enum(["account", "subscription", "equity", "technical", "general"]).optional(),
        questionEn: z.string().optional(),
        questionZh: z.string().optional(),
        answerEn: z.string().optional(),
        answerZh: z.string().optional(),
        sortOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }),
    })).mutation(async ({ input }) => {
      return updateSupportFaq(input.id, input.data);
    }),

    adminDeleteFaq: adminProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await deleteSupportFaq(input.id);
      return { success: true };
    }),

    // ─── Platform Admin: Team management ─────────────────────────────────

    /** List all platform admin accounts */
    listAdminTeam: adminProcedure.query(async () => {
      return adminListTeamMembers();
    }),

    /** Update an admin's role (super_admin only) */
    updateAdminRole: superAdminProcedure
      .input(z.object({
        userId: z.number(),
        adminRole: z.enum(["super_admin", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        // Prevent self-demotion for super_admin
        if (input.userId === ctx.user!.id && input.adminRole !== "super_admin") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot demote yourself. Transfer super_admin first." });
        }
        await adminUpdateAdminRole(input.userId, input.adminRole);
        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: "update_admin_role",
          details: JSON.stringify({ targetUserId: input.userId, newRole: input.adminRole }),
        });
        return { success: true };
      }),

    /** Add a user as platform admin (by email) */
    addAdmin: superAdminProcedure
      .input(z.object({
        email: z.string().email(),
        adminRole: z.enum(["admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const target = await getUserByEmail(input.email);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found with this email." });
        if (target.role === "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "User is already a platform admin." });
        await adminPromoteUser(target.id, input.adminRole);
        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: "add_admin",
          details: JSON.stringify({ targetEmail: input.email, targetUserId: target.id, role: input.adminRole }),
        });
        return { success: true };
      }),

    /** Remove a user from platform admin (demote to regular user) */
    removeAdmin: superAdminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user!.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove yourself from admin." });
        }
        await adminDemoteUser(input.userId);
        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: "remove_admin",
          details: JSON.stringify({ targetUserId: input.userId }),
        });
        return { success: true };
      }),

    /** Transfer super_admin role to another admin */
    transferSuperAdmin: superAdminProcedure
      .input(z.object({ targetUserId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.targetUserId === ctx.user!.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You are already the super admin." });
        }
        await adminTransferSuperAdmin(ctx.user!.id, input.targetUserId);
        await createAdminAuditLog({
          adminUserId: ctx.user!.id,
          adminUserName: ctx.user!.name ?? undefined,
          adminUserEmail: ctx.user!.email ?? undefined,
          action: "transfer_super_admin",
          details: JSON.stringify({ targetUserId: input.targetUserId }),
        });
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  SUPPORT — tickets & FAQ (user-facing)
  // ═══════════════════════════════════════════════════════════════════════════
  support: router({
    // Submit a support ticket (feedback, bug, billing, feature request)
    createTicket: protectedProcedure.input(z.object({
      type: z.enum(["feedback", "bug", "billing", "feature_request", "general"]),
      subject: z.string().min(1).max(512),
      message: z.string().min(1).max(5000),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
    })).mutation(async ({ ctx, input }) => {
      const ticket = await createSupportTicket({
        userId: ctx.user!.id,
        userName: ctx.user!.name ?? undefined,
        userEmail: ctx.user!.email ?? undefined,
        companyId: (ctx as { companyId?: number }).companyId ?? undefined,
        ...input,
      });
      return ticket;
    }),

    // List user's own tickets
    myTickets: protectedProcedure.query(async ({ ctx }) => {
      return getSupportTicketsByUser(ctx.user!.id);
    }),

    // Get a single ticket (only owner can view)
    getTicket: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const ticket = await getSupportTicketById(input.id);
      if (!ticket || ticket.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }
      return ticket;
    }),

    // List published FAQs
    faqs: publicProcedure.query(async () => {
      return getAllSupportFaqs();
    }),
  }),
});
export type AppRouter = typeof appRouter;
