import { protectedProcedure, publicProcedure, router, editorProcedure, ownerAdminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAllShareholders, getShareholderById, createShareholder, updateShareholder, deleteShareholder,
  getAllFundingRounds, getFundingRoundById, createFundingRound, updateFundingRound, deleteFundingRound,
  getAllShareHoldings, getShareHoldingsByRound, getShareHoldingsByShareholder, upsertShareHolding, updateShareHolding, deleteShareHolding,
  getAllTransactions, getTransactionsByShareholder, createTransaction, updateTransaction, deleteTransaction,
  getAllEsopPools, createEsopPool, updateEsopPool,
  getAllGrants, getGrantsByPool, createGrant, updateGrant, deleteGrant,
  getAllProjections, createProjection, updateProjection, deleteProjection,
  getAllImportLogs,
  getAllSnapshots, getSnapshotById, createSnapshot, deleteSnapshot,
  getAllAntiDilutionProvisions, getProvisionsByShareholder, createAntiDilutionProvision, updateAntiDilutionProvision, deleteAntiDilutionProvision,
  getAllShareholderDocuments, getDocumentsByShareholder, createShareholderDocument, updateShareholderDocument, deleteShareholderDocument,
  getUpcomingLockupExpirations, getTaxDeductionInfo,
  getAll409aValuations, create409aValuation, update409aValuation, delete409aValuation,
  getLiquidationPreferences, upsertLiquidationPreference,
  computeWaterfall,
  getAllUsers, updateUserAppRole,
  getAllInvitations, createInvitation, getInvitationByToken, updateInvitationStatus,
  createAuditLog, getAuditLogs, getAuditLogsByResource,
} from "./db";

// ─── Shareholders Router ──────────────────────────────────────────────────────
const shareholdersRouter = router({
  list: protectedProcedure.query(() => getAllShareholders()),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => getShareholderById(input.id)),
  create: editorProcedure.input(z.object({
    name: z.string().min(1),
    aka: z.string().optional(),
    type: z.enum(["founder","angel","seed","seed_plus","pre_a","bridge","series_a","pre_b","series_b","pre_c","series_c","esop","other"]).default("other"),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    nationality: z.string().optional(),
    isEntity: z.boolean().default(false),
    notes: z.string().optional(),
    lockupPeriod: z.string().optional(),
    taxBenefits: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createShareholder(input);
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "create", resourceType: "shareholder", resourceName: input.name, changesAfter: JSON.stringify(input) });
    return result;
  }),
  update: editorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().min(1).optional(),
      aka: z.string().optional(),
      type: z.enum(["founder","angel","seed","seed_plus","pre_a","bridge","series_a","pre_b","series_b","pre_c","series_c","esop","other"]).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      nationality: z.string().optional(),
      isEntity: z.boolean().optional(),
      notes: z.string().optional(),
      lockupPeriod: z.string().optional(),
      taxBenefits: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const result = await updateShareholder(input.id, input.data);
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "update", resourceType: "shareholder", resourceId: input.id, changesAfter: JSON.stringify(input.data) });
    return result;
  }),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await deleteShareholder(input.id);
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "delete", resourceType: "shareholder", resourceId: input.id });
    return result;
  }),
});

// ─── Funding Rounds Router ────────────────────────────────────────────────────
const fundingRoundsRouter = router({
  list: protectedProcedure.query(() => getAllFundingRounds()),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => getFundingRoundById(input.id)),
  create: editorProcedure.input(z.object({
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
    const result = await createFundingRound({ ...input, roundDate: input.roundDate ?? undefined });
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "create", resourceType: "funding_round", resourceName: input.name, changesAfter: JSON.stringify(input) });
    return result;
  }),
  update: editorProcedure.input(z.object({
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
    const result = await updateFundingRound(input.id, { ...input.data, roundDate: input.data.roundDate ?? undefined });
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "update", resourceType: "funding_round", resourceId: input.id, changesAfter: JSON.stringify(input.data) });
    return result;
  }),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await deleteFundingRound(input.id);
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "delete", resourceType: "funding_round", resourceId: input.id });
    return result;
  }),
});

// ─── Share Holdings Router ────────────────────────────────────────────────────
const holdingsRouter = router({
  all: protectedProcedure.query(() => getAllShareHoldings()),
  byRound: protectedProcedure.input(z.object({ fundingRoundId: z.number() })).query(({ input }) => getShareHoldingsByRound(input.fundingRoundId)),
  byShareholder: protectedProcedure.input(z.object({ shareholderId: z.number() })).query(({ input }) => getShareHoldingsByShareholder(input.shareholderId)),
  upsert: editorProcedure.input(z.object({
    shareholderId: z.number(),
    fundingRoundId: z.number(),
    commonShares: z.number().default(0),
    seedShares: z.number().default(0),
    seedPlusShares: z.number().default(0),
    preAShares: z.number().default(0),
    bridgeShares: z.number().default(0),
    seriesAShares: z.number().default(0),
    esopShares: z.number().default(0),
    totalShares: z.number().default(0),
    ownershipPct: z.string().optional(),
    paidInCapitalNtd: z.string().optional(),
    investmentDate: z.string().optional(),
  })).mutation(({ input }) => {
    const data: Parameters<typeof upsertShareHolding>[0] = { ...input } as any;
    if (input.investmentDate) {
      // Keep as YYYY-MM-DD string for MySQL date column (do not convert to Date object)
      data.investmentDate = input.investmentDate.slice(0, 10) as any;
    }
    return upsertShareHolding(data);
  }),
  update: editorProcedure.input(z.object({
    id: z.number(),
    fundingRoundId: z.number().optional(),
    commonShares: z.number().optional(),
    seedShares: z.number().optional(),
    seedPlusShares: z.number().optional(),
    preAShares: z.number().optional(),
    bridgeShares: z.number().optional(),
    seriesAShares: z.number().optional(),
    esopShares: z.number().optional(),
    totalShares: z.number().optional(),
    ownershipPct: z.string().optional(),
    paidInCapitalNtd: z.string().optional(),
    investmentDate: z.string().optional(),
  })).mutation(({ input }) => {
    const { id, ...rest } = input;
    const data: any = { ...rest };
    if (rest.investmentDate) {
      // Keep as YYYY-MM-DD string for MySQL date column (do not convert to Date object)
      data.investmentDate = rest.investmentDate.slice(0, 10);
    }
    return updateShareHolding(id, data);
  }),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteShareHolding(input.id)),
});

// ─── Transactions Router ──────────────────────────────────────────────────────
const transactionsRouter = router({
  list: protectedProcedure.query(() => getAllTransactions()),
  byShareholder: protectedProcedure.input(z.object({ shareholderId: z.number() })).query(({ input }) => getTransactionsByShareholder(input.shareholderId)),
  create: editorProcedure.input(z.object({
    shareholderId: z.number(),
    fundingRoundId: z.number().optional(),
    transactionDate: z.string().optional(),
    transactionType: z.enum(["issuance","transfer_in","transfer_out","esop_grant","esop_exercise","esop_cancel"]),
    shareClass: z.enum(["common","seed","seed_plus","pre_a","bridge","series_a","pre_b","series_b","pre_c","series_c","esop"]),
    sharesAmount: z.number(),
    pricePerShareNtd: z.string().optional(),
    totalAmountNtd: z.string().optional(),
    taxQualified: z.boolean().default(false),
    taxCapNtd: z.string().optional(),
    lockUpEndDate: z.string().optional(),
    taxDeductionYear: z.number().optional(),
    taxDeductionAmountNtd: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => {
    const data: any = { ...input };
    if (input.lockUpEndDate) {
      data.lockUpEndDate = input.lockUpEndDate;
    }
    if (input.transactionDate) {
      data.transactionDate = input.transactionDate as any;
    }
    return createTransaction(data);
  }),
  update: editorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      transactionDate: z.string().optional(),
      sharesAmount: z.number().optional(),
      pricePerShareNtd: z.string().optional(),
      totalAmountNtd: z.string().optional(),
      taxQualified: z.boolean().optional(),
      taxCapNtd: z.string().optional(),
      lockUpEndDate: z.string().optional(),
      taxDeductionYear: z.number().optional(),
      taxDeductionAmountNtd: z.string().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input }) => {
    const data: any = { ...input.data };
    if (input.data.lockUpEndDate) {
      data.lockUpEndDate = input.data.lockUpEndDate;
    }
    if (input.data.transactionDate) {
      data.transactionDate = input.data.transactionDate as any;
    }
    return updateTransaction(input.id, data);
  }),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteTransaction(input.id)),
});

// ─── ESOP Router ──────────────────────────────────────────────────────────────
const esopRouter = router({
  pools: protectedProcedure.query(() => getAllEsopPools()),
  createPool: protectedProcedure.input(z.object({
    fundingRoundId: z.number().optional(),
    poolName: z.string().default("ESOP Pool"),
    totalShares: z.number(),
    allocatedShares: z.number().default(0),
    notes: z.string().optional(),
  })).mutation(({ input }) => createEsopPool(input)),
  updatePool: protectedProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      totalShares: z.number().optional(),
      allocatedShares: z.number().optional(),
      vestedShares: z.number().optional(),
      exercisedShares: z.number().optional(),
      cancelledShares: z.number().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input }) => updateEsopPool(input.id, input.data)),
  grants: protectedProcedure.query(() => getAllGrants()),
  grantsByPool: protectedProcedure.input(z.object({ poolId: z.number() })).query(({ input }) => getGrantsByPool(input.poolId)),
  createGrant: protectedProcedure.input(z.object({
    esopPoolId: z.number(),
    shareholderId: z.number().optional(),
    granteeName: z.string().optional(),
    grantDate: z.string().optional(),
    sharesGranted: z.number(),
    exercisePriceNtd: z.string().optional(),
    vestingStartDate: z.string().optional(),
    vestingCliffMonths: z.number().default(12),
    vestingTotalMonths: z.number().default(48),
    expiryDate: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createGrant({ ...input, grantDate: input.grantDate ?? undefined, vestingStartDate: input.vestingStartDate ?? undefined, expiryDate: input.expiryDate ?? undefined });
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "create", resourceType: "esop_grant", resourceName: input.granteeName ?? `Grant #${input.esopPoolId}`, changesAfter: JSON.stringify(input) });
    return result;
  }),
  updateGrant: protectedProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      sharesVested: z.number().optional(),
      sharesExercised: z.number().optional(),
      sharesCancelled: z.number().optional(),
      status: z.enum(["active","fully_vested","cancelled","exercised"]).optional(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(async ({ input, ctx }) => {
    const result = await updateGrant(input.id, { ...input.data, expiryDate: input.data.expiryDate ?? undefined });
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "update", resourceType: "esop_grant", resourceId: input.id, changesAfter: JSON.stringify(input.data) });
    return result;
  }),
  deleteGrant: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await deleteGrant(input.id);
    await createAuditLog({ userId: ctx.user!.id, userName: ctx.user!.name ?? undefined, action: "delete", resourceType: "esop_grant", resourceId: input.id });
    return result;
  }),

  // Vesting schedule calculation
  vestingSchedule: protectedProcedure.input(z.object({ grantId: z.number() })).query(async ({ input }) => {
    const grants = await getAllGrants();
    const grant = grants.find(g => g.id === input.grantId);
    if (!grant) throw new Error('Grant not found');
    const startDate = grant.vestingStartDate ? new Date(grant.vestingStartDate) : (grant.grantDate ? new Date(grant.grantDate) : new Date());
    const cliffMonths = grant.vestingCliffMonths ?? 12;
    const totalMonths = grant.vestingTotalMonths ?? 48;
    const totalShares = grant.sharesGranted;
    const schedule: { month: number; date: string; sharesUnlocked: number; cumulative: number; isCliff: boolean }[] = [];
    let cumulative = 0;
    for (let m = 1; m <= totalMonths; m++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + m);
      const isCliff = m === cliffMonths;
      let sharesUnlocked = 0;
      if (m < cliffMonths) {
        sharesUnlocked = 0;
      } else if (m === cliffMonths) {
        sharesUnlocked = Math.floor((totalShares * cliffMonths) / totalMonths);
      } else {
        sharesUnlocked = Math.floor(totalShares / totalMonths);
      }
      cumulative += sharesUnlocked;
      schedule.push({ month: m, date: d.toISOString().split('T')[0], sharesUnlocked, cumulative, isCliff });
    }
    return { grant, schedule, totalShares, cliffMonths, totalMonths };
  }),

  // Exercise simulation
  exerciseSimulation: protectedProcedure.input(z.object({
    grantId: z.number(),
    sharesToExercise: z.number(),
    currentFmvNtd: z.string(),
    taxRate: z.number().default(0.2),
  })).query(async ({ input }) => {
    const grants = await getAllGrants();
    const grant = grants.find(g => g.id === input.grantId);
    if (!grant) throw new Error('Grant not found');
    const exercisePrice = parseFloat(grant.exercisePriceNtd ?? '0');
    const fmv = parseFloat(input.currentFmvNtd);
    const shares = input.sharesToExercise;
    const exerciseCost = exercisePrice * shares;
    const spread = (fmv - exercisePrice) * shares;
    const taxLiability = spread > 0 ? spread * input.taxRate : 0;
    const netGain = spread - taxLiability;
    const totalShares = grant.sharesGranted;
    const dilutionPct = (shares / totalShares) * 100;
    return {
      grantId: input.grantId,
      sharesToExercise: shares,
      exercisePrice,
      currentFmv: fmv,
      exerciseCost,
      spread,
      taxLiability,
      netGain,
      dilutionPct,
      totalCost: exerciseCost + taxLiability,
    };
  }),

  // Expiring grants (within N days)
  expiringGrants: protectedProcedure.input(z.object({ withinDays: z.number().default(90) })).query(async ({ input }) => {
    const grants = await getAllGrants();
    const now = new Date();
    const cutoff = new Date(now.getTime() + input.withinDays * 24 * 60 * 60 * 1000);
    return grants
      .filter(g => g.expiryDate && g.status === 'active')
      .map(g => ({
        ...g,
        daysUntilExpiry: Math.ceil((new Date(g.expiryDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .filter(g => g.daysUntilExpiry <= input.withinDays && g.daysUntilExpiry >= 0)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }),
});

// ─── Projections Router ───────────────────────────────────────────────────────
const projectionsRouter = router({
  list: protectedProcedure.query(() => getAllProjections()),
  create: editorProcedure.input(z.object({
    name: z.string().min(1),
    projectionDate: z.string().optional(),
    pricePerShareNtd: z.string().optional(),
    targetRaiseNtd: z.string().optional(),
    preMoneyValuationNtd: z.string().optional(),
    postMoneyValuationNtd: z.string().optional(),
    newSharesIssued: z.number().optional(),
    exchangeRate: z.string().optional(),
    scenario: z.enum(["base","optimistic","conservative"]).default("base"),
    notes: z.string().optional(),
  })).mutation(({ input }) => createProjection({
    ...input,
    projectionDate: input.projectionDate ?? undefined,
  })),
  update: editorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      name: z.string().optional(),
      pricePerShareNtd: z.string().optional(),
      targetRaiseNtd: z.string().optional(),
      preMoneyValuationNtd: z.string().optional(),
      postMoneyValuationNtd: z.string().optional(),
      newSharesIssued: z.number().optional(),
      scenario: z.enum(["base","optimistic","conservative"]).optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input }) => updateProjection(input.id, input.data)),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteProjection(input.id)),
});

// ─── Snapshots Router ────────────────────────────────────────────────────────
const snapshotsRouter = router({
  list: protectedProcedure.query(() => getAllSnapshots()),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => getSnapshotById(input.id)),
  create: editorProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    snapshotDate: z.string(),
    triggerEvent: z.string().optional(),
    fundingRoundId: z.number().optional(),
    totalShares: z.number().default(0),
    totalShareholders: z.number().default(0),
    esopPoolTotal: z.number().default(0),
    esopAllocated: z.number().default(0),
    postMoneyValuationNtd: z.string().optional(),
    snapshotData: z.string().optional(),
  })).mutation(({ input }) => createSnapshot({
    ...input,
    snapshotDate: new Date(input.snapshotDate),
  })),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteSnapshot(input.id)),
  // Auto-snapshot: takes current cap table state and saves it
  autoSnapshot: editorProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    triggerEvent: z.string().optional(),
    fundingRoundId: z.number().optional(),
  })).mutation(async ({ input }) => {
    const [shareholders, rounds, holdings, esopPools] = await Promise.all([
      (await import('./db')).getAllShareholders(),
      (await import('./db')).getAllFundingRounds(),
      (await import('./db')).getAllShareHoldings(),
      (await import('./db')).getAllEsopPools(),
    ]);
    const latestRound = rounds[rounds.length - 1];
    // Sum all holdings per shareholder across all rounds
    const holdingMap = new Map<number, number>();
    for (const h of holdings) {
      holdingMap.set(h.shareholderId, (holdingMap.get(h.shareholderId) || 0) + h.totalShares);
    }
    const totalShares = Array.from(holdingMap.values()).reduce((s, v) => s + v, 0);
    const esopTotal = esopPools.reduce((s, p) => s + p.totalShares, 0);
    const esopAllocated = esopPools.reduce((s, p) => s + p.allocatedShares, 0);
    const shareholderBreakdown = Array.from(holdingMap.entries()).map(([shareholderId, sharesTotal]) => {
      const sh = shareholders.find(s => s.id === shareholderId);
      return {
        id: shareholderId,
        name: sh?.name,
        type: sh?.type,
        totalShares: sharesTotal,
        ownershipPct: totalShares > 0 ? ((sharesTotal / totalShares) * 100).toFixed(4) : "0",
      };
    });
    return createSnapshot({
      name: input.name,
      description: input.description,
      snapshotDate: new Date(),
      triggerEvent: input.triggerEvent,
      fundingRoundId: input.fundingRoundId,
      totalShares,
      totalShareholders: shareholderBreakdown.length,
      esopPoolTotal: esopTotal,
      esopAllocated,
      postMoneyValuationNtd: latestRound?.postMoneyValuationNtd ?? undefined,
      snapshotData: JSON.stringify(shareholderBreakdown),
    });
  }),
});

// ─── Anti-Dilution Router ─────────────────────────────────────────────────────
const antiDilutionRouter = router({
  list: protectedProcedure.query(() => getAllAntiDilutionProvisions()),
  byShareholder: protectedProcedure.input(z.object({ shareholderId: z.number() })).query(({ input }) => getProvisionsByShareholder(input.shareholderId)),
  create: editorProcedure.input(z.object({
    shareholderId: z.number(),
    fundingRoundId: z.number(),
    provisionType: z.enum(["full_ratchet", "broad_based_wa", "narrow_based_wa", "none"]).default("broad_based_wa"),
    originalPriceNtd: z.string(),
    originalShares: z.number(),
    notes: z.string().optional(),
  })).mutation(({ input }) => createAntiDilutionProvision(input)),
  update: editorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      adjustedPriceNtd: z.string().optional(),
      adjustedShares: z.number().optional(),
      triggerRoundId: z.number().optional(),
      status: z.enum(["active", "triggered", "waived", "expired"]).optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input }) => updateAntiDilutionProvision(input.id, input.data)),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteAntiDilutionProvision(input.id)),
});

// ─── Import Router ────────────────────────────────────────────────────────────
const importRouter = router({
  logs: protectedProcedure.query(() => getAllImportLogs()),
  excel: editorProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { importExcelFile } = await import("./excel-import");
      const buffer = Buffer.from(input.fileBase64, "base64");
      return importExcelFile(buffer, input.fileName);
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
  })).mutation(async ({ input }) => {
    // TODO: Integrate with OpenAI or Claude API for analysis
    return {
      analysis: "AI analysis feature coming soon. Please check back later.",
      generatedAt: new Date().toISOString(),
    };
  }),
});

// ─── Cap Table Summary ────────────────────────────────────────────────────────
const capTableRouter = router({
   summary: protectedProcedure.query(async () => {
    const [shareholders, rounds, holdings, esopPools] = await Promise.all([
      getAllShareholders(),
      getAllFundingRounds(),
      getAllShareHoldings(),
      getAllEsopPools(),
    ]);
     const latestRound = rounds[rounds.length - 1];
    // Sum all holdings per shareholder across all rounds (each row = new shares in that round)
    const holdingByShareholder = new Map<number, {
      totalShares: number;
      paidInCapitalNtd: string | null;
      commonShares: number;
      seedShares: number;
      seedPlusShares: number;
      preAShares: number;
      bridgeShares: number;
      seriesAShares: number;
      esopShares: number;
    }>();
    for (const h of holdings) {
      const existing = holdingByShareholder.get(h.shareholderId);
      if (!existing) {
        holdingByShareholder.set(h.shareholderId, {
          totalShares: h.totalShares,
          paidInCapitalNtd: h.paidInCapitalNtd,
          commonShares: h.commonShares,
          seedShares: h.seedShares,
          seedPlusShares: h.seedPlusShares,
          preAShares: h.preAShares,
          bridgeShares: h.bridgeShares,
          seriesAShares: h.seriesAShares,
          esopShares: h.esopShares,
        });
      } else {
        existing.totalShares += h.totalShares;
        existing.commonShares += h.commonShares;
        existing.seedShares += h.seedShares;
        existing.seedPlusShares += h.seedPlusShares;
        existing.preAShares += h.preAShares;
        existing.bridgeShares += h.bridgeShares;
        existing.seriesAShares += h.seriesAShares;
        existing.esopShares += h.esopShares;
        const existingPaid = parseFloat(existing.paidInCapitalNtd || "0");
        const newPaid = parseFloat(h.paidInCapitalNtd || "0");
        existing.paidInCapitalNtd = (existingPaid + newPaid).toFixed(2);
      }
    }
    const latestHoldings = Array.from(holdingByShareholder.entries()).map(([shareholderId, h]) => ({ shareholderId, ...h }));
    const totalShares = latestHoldings.reduce((sum, h) => sum + h.totalShares, 0);
    const esopTotal = esopPools.reduce((sum, p) => sum + p.totalShares, 0);
    const esopAllocated = esopPools.reduce((sum, p) => sum + p.allocatedShares, 0);
    const shareholderSummary = latestHoldings.map(h => {
      const sh = shareholders.find(s => s.id === h.shareholderId);
      // Recalculate ownershipPct based on current totalShares across all shareholders
      const pct = totalShares > 0 ? ((h.totalShares / totalShares) * 100).toFixed(4) : "0";
      return {
        id: h.shareholderId,
        name: sh?.name || "Unknown",
        aka: sh?.aka,
        type: sh?.type,
        totalShares: h.totalShares,
        ownershipPct: pct,
        paidInCapitalNtd: h.paidInCapitalNtd,
        commonShares: h.commonShares,
        seedShares: h.seedShares,
        seedPlusShares: h.seedPlusShares,
        preAShares: h.preAShares,
        bridgeShares: h.bridgeShares,
        seriesAShares: h.seriesAShares,
        esopShares: h.esopShares,
      };
    }).sort((a, b) => b.totalShares - a.totalShares);

    return {
      shareholders: shareholderSummary,
      rounds,
      latestRound,
      totalShares,
      esopPool: { total: esopTotal, allocated: esopAllocated, unallocated: esopTotal - esopAllocated },
    };
  }),
});

// ─── Documents Router ───────────────────────────────────────────────────────────
const documentsRouter = router({
  list: protectedProcedure.query(() => getAllShareholderDocuments()),
  listByShareholder: protectedProcedure
    .input(z.object({ shareholderId: z.number() }))
    .query(({ input }) => getDocumentsByShareholder(input.shareholderId)),
  create: editorProcedure.input(z.object({
    shareholderId: z.number(),
    documentType: z.enum(["sha","subscription","nda","board_consent","side_letter","warrant","other"]),
    documentName: z.string().min(1),
    status: z.enum(["pending","signed","expired","waived"]).default("pending"),
    signedDate: z.string().optional(),
    expiryDate: z.string().optional(),
    fundingRoundId: z.number().optional(),
    fileUrl: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => {
    const data: Record<string, unknown> = { ...input };
    if (input.signedDate) data.signedDate = new Date(input.signedDate);
    if (input.expiryDate) data.expiryDate = new Date(input.expiryDate);
    return createShareholderDocument(data as Parameters<typeof createShareholderDocument>[0]);
  }),
  update: editorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      documentType: z.enum(["sha","subscription","nda","board_consent","side_letter","warrant","other"]).optional(),
      documentName: z.string().optional(),
      status: z.enum(["pending","signed","expired","waived"]).optional(),
      signedDate: z.string().optional(),
      expiryDate: z.string().optional(),
      fundingRoundId: z.number().optional(),
      fileUrl: z.string().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input }) => {
    const data: Record<string, unknown> = { ...input.data };
    if (input.data.signedDate) data.signedDate = new Date(input.data.signedDate);
    if (input.data.expiryDate) data.expiryDate = new Date(input.data.expiryDate);
    return updateShareholderDocument(input.id, data as Parameters<typeof updateShareholderDocument>[1]);
  }),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteShareholderDocument(input.id)),
});

// ─── Compliance Router ────────────────────────────────────────────────────────
const complianceRouter = router({
  upcomingLockups: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(180) }))
    .query(({ input }) => getUpcomingLockupExpirations(input.daysAhead)),
  taxDeductions: protectedProcedure.query(() => getTaxDeductionInfo()),
});
// ─── 409A Valuations Router ─────────────────────────────────────────────────────────────
const valuations409aRouter = router({
  list: protectedProcedure.query(() => getAll409aValuations()),
  create: editorProcedure.input(z.object({
    valuationDate: z.string(),
    fmvPerShareNtd: z.string().optional(),
    fmvPerShareUsd: z.string().optional(),
    commonStockValueNtd: z.string().optional(),
    preferredStockValueNtd: z.string().optional(),
    totalCompanyValueNtd: z.string().optional(),
    valuationFirm: z.string().optional(),
    reportUrl: z.string().optional(),
    method: z.enum(["dcf","market_comparable","asset_based","409a_safe_harbor","other"]).optional(),
    relatedRoundId: z.number().optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => {
    const data: Record<string, unknown> = { ...input };
    data.valuationDate = new Date(input.valuationDate);
    return create409aValuation(data as Parameters<typeof create409aValuation>[0]);
  }),
  update: editorProcedure.input(z.object({
    id: z.number(),
    data: z.object({
      valuationDate: z.string().optional(),
      fmvPerShareNtd: z.string().optional(),
      fmvPerShareUsd: z.string().optional(),
      commonStockValueNtd: z.string().optional(),
      preferredStockValueNtd: z.string().optional(),
      totalCompanyValueNtd: z.string().optional(),
      valuationFirm: z.string().optional(),
      reportUrl: z.string().optional(),
      method: z.enum(["dcf","market_comparable","asset_based","409a_safe_harbor","other"]).optional(),
      relatedRoundId: z.number().optional(),
      notes: z.string().optional(),
    }),
  })).mutation(({ input }) => {
    const data: Record<string, unknown> = { ...input.data };
    if (input.data.valuationDate) data.valuationDate = new Date(input.data.valuationDate);
    return update409aValuation(input.id, data as Parameters<typeof update409aValuation>[1]);
  }),
  delete: editorProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => delete409aValuation(input.id)),
});
// ─── Waterfall Router ───────────────────────────────────────────────────────────────────────
const waterfallRouter = router({
  compute: protectedProcedure
    .input(z.object({ exitValueNtd: z.number().positive() }))
    .query(({ input }) => computeWaterfall(input.exitValueNtd)),
  getLiquidationPreferences: protectedProcedure.query(() => getLiquidationPreferences()),
  upsertLiquidationPreference: protectedProcedure.input(z.object({
    fundingRoundId: z.number(),
    preferenceType: z.enum(["non_participating","participating","capped_participating"]).default("non_participating"),
    liquidationMultiple: z.string().default("1.00"),
    participationCap: z.string().optional(),
    seniorityRank: z.number().default(1),
    notes: z.string().optional(),
  })).mutation(({ input }) => upsertLiquidationPreference(input as Parameters<typeof upsertLiquidationPreference>[0])),
});
// ─── Team / User Management Router ─────────────────────────────────────────
const teamRouter = router({
  members: protectedProcedure.query(() => getAllUsers()),
  updateRole: ownerAdminProcedure.input(z.object({
    userId: z.number(),
    appRole: z.enum(["owner", "admin", "cfo", "lawyer", "investor", "viewer"]),
  })).mutation(async ({ input, ctx }) => {
    const updated = await updateUserAppRole(input.userId, input.appRole);
    await createAuditLog({
      userId: ctx.user!.id,
      userName: ctx.user!.name ?? undefined,
      action: "update",
      resourceType: "user",
      resourceId: input.userId,
      resourceName: `User #${input.userId}`,
      changesAfter: JSON.stringify({ appRole: input.appRole }),
    });
    return updated;
  }),
  transferOwnership: ownerAdminProcedure.input(z.object({
    newOwnerId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const currentUser = ctx.user!;
    // Verify current user is owner
    if (currentUser.appRole !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the current owner can transfer ownership" });
    }
    // Demote current owner to admin
    await updateUserAppRole(currentUser.id, "admin");
    // Promote new owner
    await updateUserAppRole(input.newOwnerId, "owner");
    await createAuditLog({
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
  list: protectedProcedure.query(() => getAllInvitations()),
  create: ownerAdminProcedure.input(z.object({
    email: z.string().email().optional(),
    appRole: z.enum(["admin", "cfo", "lawyer", "investor", "viewer"]).default("viewer"),
    notes: z.string().optional(),
    origin: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const invitation = await createInvitation({
      token,
      email: input.email,
      appRole: input.appRole,
      invitedByUserId: ctx.user!.id,
      status: "pending",
      expiresAt,
      notes: input.notes,
    });
    await createAuditLog({
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
  revoke: ownerAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const result = await updateInvitationStatus(input.id, "revoked");
    await createAuditLog({
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
  accept: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
    const inv = await getInvitationByToken(input.token);
    if (!inv) return { valid: false, reason: "not_found" };
    if (inv.status !== "pending") return { valid: false, reason: inv.status };
    if (new Date() > new Date(inv.expiresAt)) {
      await updateInvitationStatus(inv.id, "expired");
      return { valid: false, reason: "expired" };
    }
    return { valid: true, invitation: inv };
  }),
});

// ─── Audit Log Router ─────────────────────────────────────────────────────────
const auditLogRouter = router({
  list: protectedProcedure.input(z.object({
    limit: z.number().default(100),
    offset: z.number().default(0),
  })).query(({ input }) => getAuditLogs(input.limit, input.offset)),
  byResource: protectedProcedure.input(z.object({
    resourceType: z.string(),
    resourceId: z.number(),
  })).query(({ input }) => getAuditLogsByResource(input.resourceType, input.resourceId)),
});

// ─── App Router ────────────────────────────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
  }),
  shareholders: shareholdersRouter,
  fundingRounds: fundingRoundsRouter,
  holdings: holdingsRouter,
  transactions: transactionsRouter,
  esop: esopRouter,
  projections: projectionsRouter,
  import: importRouter,
  analysis: analysisRouter,
  capTable: capTableRouter,
  snapshots: snapshotsRouter,
   antiDilution: antiDilutionRouter,
  documents: documentsRouter,
  compliance: complianceRouter,
  valuations409a: valuations409aRouter,
  waterfall: waterfallRouter,
  team: teamRouter,
  invitations: invitationsRouter,
  auditLog: auditLogRouter,
});
export type AppRouter = typeof appRouter;
