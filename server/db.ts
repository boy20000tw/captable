import { eq, desc, asc, and, isNotNull, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  InsertUser, users,
  shareholders, InsertShareholder,
  fundingRounds, InsertFundingRound,
  shareHoldings, InsertShareHolding,
  shareTransactions, InsertShareTransaction,
  esopPool, InsertEsopPool,
  esopGrants, InsertEsopGrant,
  valuationProjections, InsertValuationProjection,
  importLogs, InsertImportLog,
  capTableSnapshots, InsertCapTableSnapshot,
  antiDilutionProvisions, InsertAntiDilutionProvision,
  shareholderDocuments, InsertShareholderDocument,
  valuations409a, InsertValuation409a,
  liquidationPreferences, InsertLiquidationPreference,
  userInvitations, InsertUserInvitation,
  auditLogs, InsertAuditLog,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const sqlClient = neon(process.env.DATABASE_URL);
      _db = drizzle({ client: sqlClient });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Shareholders ─────────────────────────────────────────────────────────────
export async function getAllShareholders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareholders).orderBy(asc(shareholders.id));
}

export async function getShareholderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareholders).where(eq(shareholders.id, id)).limit(1);
  return result[0];
}

export async function createShareholder(data: InsertShareholder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shareholders).values(data).returning({ id: shareholders.id });
  if (!result[0]) throw new Error("Failed to create shareholder: no result returned");
  const rows = await db.select().from(shareholders).where(eq(shareholders.id, result[0].id)).limit(1);
  if (!rows[0]) throw new Error("Failed to fetch created shareholder");
  return rows[0];
}

export async function updateShareholder(id: number, data: Partial<InsertShareholder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareholders).set(data).where(eq(shareholders.id, id));
}

export async function deleteShareholder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareholders).where(eq(shareholders.id, id));
}

// ─── Funding Rounds ───────────────────────────────────────────────────────────
export async function getAllFundingRounds() {
  const db = await getDb();
  if (!db) return [];

  // Get all rounds ordered by date
  const rounds = await db.select().from(fundingRounds).orderBy(
    asc(fundingRounds.roundDate),
    asc(fundingRounds.sortOrder),
    asc(fundingRounds.id)
  );

  // Aggregate shares issued per round from shareTransactions (issuance type only)
  const txAgg = await db
    .select({
      fundingRoundId: shareTransactions.fundingRoundId,
      sharesIssued: sql<number>`COALESCE(SUM(${shareTransactions.sharesAmount}), 0)`,
      totalInvestedNtd: sql<string>`COALESCE(SUM(${shareTransactions.totalAmountNtd}), 0)`,
    })
    .from(shareTransactions)
    .where(eq(shareTransactions.transactionType, "issuance"))
    .groupBy(shareTransactions.fundingRoundId);

  const txMap = new Map(txAgg.map(t => [t.fundingRoundId, t]));

  // Compute cumulative total shares before each round for pre-money calculation
  // and auto-derive pre/post money if price_per_share is set
  let cumulativeShares = 0;
  return rounds.map(r => {
    const agg = txMap.get(r.id);
    const sharesIssuedThisRound = agg ? Number(agg.sharesIssued) : 0;
    const totalInvestedNtd = agg ? Number(agg.totalInvestedNtd) : 0;

    // Auto-calculate pre/post money if price per share is available
    const price = r.pricePerShareNtd ? Number(r.pricePerShareNtd) : null;
    const moneyRaised = r.moneyRaisedNtd ? Number(r.moneyRaisedNtd) : null;

    let preMoneyCalc: number | null = null;
    let postMoneyCalc: number | null = null;
    let sharesIssuedCalc: number | null = null;

    if (price && price > 0) {
      // Pre-money = price × shares before this round
      preMoneyCalc = price * cumulativeShares;
      if (moneyRaised) {
        // Shares issued = money raised / price per share
        sharesIssuedCalc = Math.round(moneyRaised / price);
        postMoneyCalc = preMoneyCalc + moneyRaised;
      }
    }

    // Prefer formula-calculated values when price is available (most accurate);
    // fall back to stored DB values only when formula can't compute
    const preMoney = preMoneyCalc !== null ? preMoneyCalc : (r.preMoneyValuationNtd ? Number(r.preMoneyValuationNtd) : null);
    const postMoney = postMoneyCalc !== null ? postMoneyCalc : (r.postMoneyValuationNtd ? Number(r.postMoneyValuationNtd) : null);
    const sharesIssued = sharesIssuedThisRound > 0 ? sharesIssuedThisRound : (sharesIssuedCalc ?? 0);

    cumulativeShares += sharesIssued;

    return {
      ...r,
      sharesIssued,
      sharesBeforeRound: cumulativeShares - sharesIssued,
      cumulativeSharesAfter: cumulativeShares,
      preMoneyCalc: preMoney,
      postMoneyCalc: postMoney,
      totalInvestedNtd: totalInvestedNtd > 0 ? totalInvestedNtd : (moneyRaised ?? 0),
    };
  });
}

export async function getFundingRoundById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fundingRounds).where(eq(fundingRounds.id, id)).limit(1);
  return result[0];
}

export async function createFundingRound(data: InsertFundingRound) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(fundingRounds).values(data);
}

export async function updateFundingRound(id: number, data: Partial<InsertFundingRound>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(fundingRounds).set(data).where(eq(fundingRounds.id, id));
}

export async function deleteFundingRound(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(fundingRounds).where(eq(fundingRounds.id, id));
}

// ─── Share Holdings ───────────────────────────────────────────────────────────
export async function getShareHoldingsByRound(fundingRoundId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareHoldings).where(eq(shareHoldings.fundingRoundId, fundingRoundId));
}

export async function getShareHoldingsByShareholder(shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareHoldings).where(eq(shareHoldings.shareholderId, shareholderId));
}

export async function upsertShareHolding(data: InsertShareHolding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareHoldings).values(data);
}

export async function updateShareHolding(id: number, data: Partial<InsertShareHolding>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareHoldings).set(data).where(eq(shareHoldings.id, id));
}

export async function deleteShareHolding(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareHoldings).where(eq(shareHoldings.id, id));
}

export async function getAllShareHoldings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareHoldings);
}

// ─── Share Transactions ───────────────────────────────────────────────────────
export async function getAllTransactions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareTransactions).orderBy(desc(shareTransactions.transactionDate));
}

export async function getTransactionsByShareholder(shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareTransactions)
    .where(eq(shareTransactions.shareholderId, shareholderId))
    .orderBy(desc(shareTransactions.transactionDate));
}

export async function createTransaction(data: InsertShareTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareTransactions).values(data);
}

export async function updateTransaction(id: number, data: Partial<InsertShareTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareTransactions).set(data).where(eq(shareTransactions.id, id));
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareTransactions).where(eq(shareTransactions.id, id));
}

// ─── ESOP Pool ────────────────────────────────────────────────────────────────
export async function getAllEsopPools() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopPool).orderBy(desc(esopPool.createdAt));
}

export async function createEsopPool(data: InsertEsopPool) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(esopPool).values(data);
}

export async function updateEsopPool(id: number, data: Partial<InsertEsopPool>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(esopPool).set(data).where(eq(esopPool.id, id));
}

// ─── ESOP Grants ──────────────────────────────────────────────────────────────
export async function getGrantsByPool(poolId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopGrants).where(eq(esopGrants.esopPoolId, poolId));
}

export async function getAllGrants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopGrants).orderBy(desc(esopGrants.grantDate));
}

export async function createGrant(data: InsertEsopGrant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(esopGrants).values(data);
}

export async function updateGrant(id: number, data: Partial<InsertEsopGrant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(esopGrants).set(data).where(eq(esopGrants.id, id));
}

export async function deleteGrant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(esopGrants).where(eq(esopGrants.id, id));
}

// ─── Valuation Projections ────────────────────────────────────────────────────
export async function getAllProjections() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(valuationProjections).orderBy(asc(valuationProjections.projectionDate));
}

export async function createProjection(data: InsertValuationProjection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(valuationProjections).values(data);
}

export async function updateProjection(id: number, data: Partial<InsertValuationProjection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(valuationProjections).set(data).where(eq(valuationProjections.id, id));
}

export async function deleteProjection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(valuationProjections).where(eq(valuationProjections.id, id));
}

// ─── Import Logs ──────────────────────────────────────────────────────────────
export async function createImportLog(data: InsertImportLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(importLogs).values(data).returning({ id: importLogs.id });
  return result;
}

export async function updateImportLog(id: number, data: Partial<InsertImportLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(importLogs).set(data).where(eq(importLogs.id, id));
}

export async function getAllImportLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importLogs).orderBy(desc(importLogs.createdAt));
}

// ─── Cap Table Snapshots ──────────────────────────────────────────────────────
export async function getAllSnapshots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(capTableSnapshots).orderBy(desc(capTableSnapshots.snapshotDate));
}

export async function getSnapshotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(capTableSnapshots).where(eq(capTableSnapshots.id, id)).limit(1);
  return result[0];
}

export async function createSnapshot(data: InsertCapTableSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(capTableSnapshots).values(data).returning({ id: capTableSnapshots.id });
  return result;
}

export async function deleteSnapshot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(capTableSnapshots).where(eq(capTableSnapshots.id, id));
}

// ─── Anti-Dilution Provisions ─────────────────────────────────────────────────
export async function getAllAntiDilutionProvisions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(antiDilutionProvisions).orderBy(desc(antiDilutionProvisions.createdAt));
}

export async function getProvisionsByShareholder(shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(antiDilutionProvisions).where(eq(antiDilutionProvisions.shareholderId, shareholderId));
}

export async function createAntiDilutionProvision(data: InsertAntiDilutionProvision) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(antiDilutionProvisions).values(data);
}

export async function updateAntiDilutionProvision(id: number, data: Partial<InsertAntiDilutionProvision>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(antiDilutionProvisions).set(data).where(eq(antiDilutionProvisions.id, id));
}

export async function deleteAntiDilutionProvision(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(antiDilutionProvisions).where(eq(antiDilutionProvisions.id, id));
}

// ─── Shareholder Documents ─────────────────────────────────────────────────────
export async function getAllShareholderDocuments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareholderDocuments).orderBy(asc(shareholderDocuments.shareholderId), asc(shareholderDocuments.documentType));
}

export async function getDocumentsByShareholder(shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareholderDocuments).where(eq(shareholderDocuments.shareholderId, shareholderId)).orderBy(asc(shareholderDocuments.documentType));
}

export async function createShareholderDocument(data: InsertShareholderDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareholderDocuments).values(data);
}

export async function updateShareholderDocument(id: number, data: Partial<InsertShareholderDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareholderDocuments).set(data).where(eq(shareholderDocuments.id, id));
}

export async function deleteShareholderDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareholderDocuments).where(eq(shareholderDocuments.id, id));
}

// ─── Compliance Queries ────────────────────────────────────────────────────────
// Get all share transactions with lockUpEndDate in the future (for lock-up countdown)
export async function getUpcomingLockupExpirations(daysAhead = 180) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  return db.select().from(shareTransactions)
    .where(
      and(
        sql`${shareTransactions.lockUpEndDate} >= ${today}`,
        sql`${shareTransactions.lockUpEndDate} <= ${cutoffStr}`
      )
    )
    .orderBy(asc(shareTransactions.lockUpEndDate));
}

// Get all share transactions with taxDeductionYear set (for tax expiry tracking)
export async function getTaxDeductionInfo() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareTransactions)
    .where(
      and(
        isNotNull(shareTransactions.taxDeductionYear),
        eq(shareTransactions.taxQualified, true)
      )
    )
    .orderBy(asc(shareTransactions.taxDeductionYear));
}

// ─── 409A Valuations ─────────────────────────────────────────────────────────
// (valuations409a, liquidationPreferences already imported above via schema)

export async function getAll409aValuations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(valuations409a).orderBy(asc(valuations409a.valuationDate));
}

export async function create409aValuation(data: InsertValuation409a) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(valuations409a).values(data).returning({ id: valuations409a.id });
  return result[0];
}

export async function update409aValuation(id: number, data: Partial<InsertValuation409a>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(valuations409a).set(data).where(eq(valuations409a.id, id));
}

export async function delete409aValuation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(valuations409a).where(eq(valuations409a.id, id));
}

// ─── Liquidation Preferences ─────────────────────────────────────────────────
export async function getLiquidationPreferences() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(liquidationPreferences).orderBy(asc(liquidationPreferences.seniorityRank));
}

export async function upsertLiquidationPreference(data: InsertLiquidationPreference) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(liquidationPreferences).values(data).onConflictDoUpdate({
    target: liquidationPreferences.fundingRoundId,
    set: {
      preferenceType: data.preferenceType,
      liquidationMultiple: data.liquidationMultiple,
      participationCap: data.participationCap,
      seniorityRank: data.seniorityRank,
      notes: data.notes,
    },
  });
}

// ─── Waterfall Calculation ────────────────────────────────────────────────────
export async function computeWaterfall(exitValueNtd: number) {
  const db = await getDb();
  if (!db) return { tranches: [], common: [], totalDistributed: 0 };

  // Get all funding rounds with their holdings and preferences
  const rounds = await db.select().from(fundingRounds).orderBy(asc(fundingRounds.sortOrder));
  const prefs = await getLiquidationPreferences();
  const allHoldings = await db.select().from(shareHoldings);
  const allShareholders = await db.select().from(shareholders);

  const prefMap = new Map(prefs.map(p => [p.fundingRoundId, p]));

  let remaining = exitValueNtd;
  const tranches: Array<{
    roundId: number; roundName: string; preferenceType: string;
    liquidationMultiple: number; paidIn: number; preferenceAmount: number;
    distributed: number; shareholders: Array<{ name: string; shares: number; amount: number }>;
  }> = [];

  // Sort rounds by seniority (most senior first)
  const preferredRounds = rounds
    .filter(r => prefMap.has(r.id))
    .sort((a, b) => {
      const pa = prefMap.get(a.id)!.seniorityRank;
      const pb = prefMap.get(b.id)!.seniorityRank;
      return pa - pb;
    });

  // Phase 1: Liquidation preferences
  for (const round of preferredRounds) {
    const pref = prefMap.get(round.id)!;
    const roundHoldings = allHoldings.filter(h => h.fundingRoundId === round.id);
    const paidIn = roundHoldings.reduce((sum, h) => sum + parseFloat(h.paidInCapitalNtd || "0"), 0);
    const multiple = parseFloat(String(pref.liquidationMultiple));
    const preferenceAmount = paidIn * multiple;
    const distributed = Math.min(preferenceAmount, remaining);
    remaining -= distributed;

    const shDetails = roundHoldings.map(h => {
      const sh = allShareholders.find(s => s.id === h.shareholderId);
      const shPaidIn = parseFloat(h.paidInCapitalNtd || "0");
      const shAmount = paidIn > 0 ? (shPaidIn / paidIn) * distributed : 0;
      return { name: sh?.name || `#${h.shareholderId}`, shares: h.totalShares, amount: shAmount };
    });

    tranches.push({
      roundId: round.id, roundName: round.name,
      preferenceType: pref.preferenceType,
      liquidationMultiple: multiple,
      paidIn, preferenceAmount, distributed,
      shareholders: shDetails,
    });
  }

  // Phase 2: Participating preferred + common
  const commonHoldings = allHoldings.filter(h => {
    const round = rounds.find(r => r.id === h.fundingRoundId);
    const pref = round ? prefMap.get(round.id) : undefined;
    return !pref || pref.preferenceType !== "non_participating";
  });

  const totalCommonShares = commonHoldings.reduce((s, h) => s + h.totalShares, 0);
  const commonDistributions = commonHoldings.map(h => {
    const sh = allShareholders.find(s => s.id === h.shareholderId);
    const amount = totalCommonShares > 0 ? (h.totalShares / totalCommonShares) * remaining : 0;
    return { name: sh?.name || `#${h.shareholderId}`, shares: h.totalShares, amount };
  });

  const totalDistributed = exitValueNtd - remaining + remaining;

  return { tranches, common: commonDistributions, totalDistributed, remainingForCommon: remaining };
}


// ─── User Management ──────────────────────────────────────────────────────────
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}

export async function updateUserAppRole(id: number, appRole: "owner" | "admin" | "cfo" | "lawyer" | "investor" | "viewer") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ appRole, updatedAt: new Date() }).where(eq(users.id, id));
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0];
}

// ─── User Invitations ─────────────────────────────────────────────────────────
export async function getAllInvitations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userInvitations).orderBy(desc(userInvitations.createdAt));
}

export async function createInvitation(data: InsertUserInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userInvitations).values(data).returning({ id: userInvitations.id });
  const rows = await db.select().from(userInvitations).where(eq(userInvitations.id, result[0].id));
  return rows[0];
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userInvitations).where(eq(userInvitations.token, token));
  return rows[0] ?? null;
}

export async function updateInvitationStatus(id: number, status: "pending" | "accepted" | "revoked" | "expired", acceptedByUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userInvitations).set({
    status,
    ...(acceptedByUserId ? { acceptedByUserId, acceptedAt: new Date() } : {}),
  }).where(eq(userInvitations.id, id));
  const rows = await db.select().from(userInvitations).where(eq(userInvitations.id, id));
  return rows[0];
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
}

export async function getAuditLogsByResource(resourceType: string, resourceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs)
    .where(and(eq(auditLogs.resourceType, resourceType), eq(auditLogs.resourceId, resourceId)))
    .orderBy(desc(auditLogs.createdAt));
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────
/**
 * Truncate all business-data tables. Preserves: users, user_invitations.
 * Resets auto-increment sequences. Cascades through FKs.
 * Returns table-name -> row count deleted (best effort).
 */
export async function truncateAllBusinessData(): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Gather counts first (for audit + response)
  const counts: Record<string, number> = {};
  const countable: Array<[string, any]> = [
    ["shareholders", shareholders],
    ["funding_rounds", fundingRounds],
    ["share_holdings", shareHoldings],
    ["share_transactions", shareTransactions],
    ["esop_pool", esopPool],
    ["esop_grants", esopGrants],
    ["valuation_projections", valuationProjections],
    ["import_logs", importLogs],
    ["cap_table_snapshots", capTableSnapshots],
    ["anti_dilution_provisions", antiDilutionProvisions],
    ["shareholder_documents", shareholderDocuments],
    ["valuations_409a", valuations409a],
    ["liquidation_preferences", liquidationPreferences],
    ["audit_logs", auditLogs],
  ];
  for (const [name, table] of countable) {
    try {
      const rows = await db.select().from(table);
      counts[name] = rows.length;
    } catch {
      counts[name] = -1;
    }
  }

  // TRUNCATE — single statement, CASCADE handles FKs, RESTART IDENTITY resets sequences
  await db.execute(sql`TRUNCATE TABLE
    audit_logs,
    share_transactions,
    share_holdings,
    shareholder_documents,
    shareholders,
    valuation_projections,
    valuations_409a,
    liquidation_preferences,
    anti_dilution_provisions,
    esop_grants,
    esop_pool,
    funding_rounds,
    cap_table_snapshots,
    import_logs
    RESTART IDENTITY CASCADE`);

  return counts;
}
