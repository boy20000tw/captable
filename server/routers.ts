import {
  protectedProcedure, publicProcedure, router,
  companyProcedure, companyEditorProcedure, companyOwnerAdminProcedure, companyOwnerProcedure,
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
  // V1
  getAllInvestors, getInvestorById, createInvestor, updateInvestor, deleteInvestor,
  getAllocationsByCompany, getAllocationById, createAllocation, updateAllocation, deleteAllocation,
  getAllRegisterEntries, getAllSnapshotsV1,
  getAllEsopPoolsV1, getEsopPoolV1ById, createEsopPoolV1, updateEsopPoolV1, deleteEsopPoolV1,
  getAllEsopGrantsV1, getEsopGrantV1ById, createEsopGrantV1, updateEsopGrantV1, deleteEsopGrantV1,
} from "./db";
import { ProjectionAssumptionsSchema } from "../shared/projectionTypes";
import { advanceAllocation, type AllocationStatus } from "../shared/allocationLifecycle";
import { writeRegisterEntry, createManualSnapshot } from "./v1/registerWrite";
import { deriveCapTable } from "./v1/capTable";


// ─── Funding Rounds Router ────────────────────────────────────────────────────
const fundingRoundsRouter = router({
  list: companyProcedure.query(({ ctx }) => getAllFundingRounds(ctx.companyId)),
  get: companyProcedure.input(z.object({ id: z.number() })).query(({ input, ctx }) => getFundingRoundById(ctx.companyId, input.id)),
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
  list: companyProcedure.query(({ ctx }) => getAllAntiDilutionProvisions(ctx.companyId)),
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
  analyze: protectedProcedure.input(z.object({
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
  list: companyProcedure.query(({ ctx }) => getAllFinancialProjections(ctx.companyId)),
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
  listByProjection: companyProcedure.input(z.object({ projectionId: z.number() }))
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
    shareClass: z.enum(["common","seed","seed_plus","pre_a","bridge","series_a","pre_b","series_b","pre_c","series_c","esop"]),
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

// ─── V1 Register Router (read-only; writes go via allocation advance) ──────
const v1RegisterRouter = router({
  list: companyProcedure.input(z.object({ investorId: z.number().optional() }).optional()).query(
    ({ ctx, input }) => getAllRegisterEntries(ctx.companyId, input)
  ),
});

// ─── V1 Cap Table Router (derived view) ─────────────────────────────────────
const v1CapTableRouter = router({
  current: companyProcedure.query(({ ctx }) => deriveCapTable(ctx.companyId)),
});

// ─── V1 Snapshots Router (auto + manual) ────────────────────────────────────
const v1SnapshotsRouter = router({
  list: companyProcedure.query(({ ctx }) => getAllSnapshotsV1(ctx.companyId)),
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
export const appRouter = router({
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      const memberships = await getUserCompanyMemberships(opts.ctx.user.id);
      // Spread user fields so existing frontend code (me.id, me.name, me.email, me.appRole)
      // keeps working; add `companies` for the company switcher.
      return { ...opts.ctx.user, companies: memberships };
    }),
  }),
  companies: companiesRouter,
  fundingRounds: fundingRoundsRouter,
  import: importRouter,
  analysis: analysisRouter,
  antiDilution: antiDilutionRouter,
  waterfall: waterfallRouter,
  team: teamRouter,
  invitations: invitationsRouter,
  auditLog: auditLogRouter,
  financialProjections: financialProjectionsRouter,
  dcf: dcfRouter,
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
    // Owner-only. Deletes all rows scoped to ctx.companyId across business tables.
    // Preserves: users, companies, company_members.
    clearAllData: companyOwnerProcedure
      .input(z.object({
        confirmationPhrase: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Require exact confirmation phrase to prevent accidental invocation
        if (input.confirmationPhrase !== "CLEAR ALL DATA") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Confirmation phrase does not match. Type exactly: CLEAR ALL DATA",
          });
        }
        const counts = await truncateAllBusinessData(ctx.companyId);
        // Re-create an audit log of this action (audit_logs was just truncated for this company)
        await createAuditLog({
          companyId: ctx.companyId,
          userId: ctx.user!.id,
          userName: ctx.user!.name ?? undefined,
          action: "delete",
          resourceType: "system",
          resourceName: "All business data (truncated)",
          changesBefore: JSON.stringify(counts),
        });
        return { success: true, cleared: counts };
      }),
  }),
});
export type AppRouter = typeof appRouter;
