import { eq, desc, asc, and, isNotNull, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  InsertUser, users,
  companies, InsertCompany, Company,
  companyMembers, InsertCompanyMember, CompanyMember,
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
  financialProjections, InsertFinancialProjection,
  dcfScenarios, InsertDcfScenario,
  investors, InsertInvestor,
  allocations, InsertAllocation,
  shareRegisterEntries, InsertShareRegisterEntry,
  snapshots as snapshotsV1, InsertSnapshot,
  esopPoolsV1, InsertEsopPoolV1,
  esopGrantsV1, InsertEsopGrantV1,
  instruments, InsertInstrument,
  signingRequests, InsertSigningRequest,
  signingTemplates, InsertSigningTemplate,
  shareClasses, InsertShareClass,
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

// ─── Companies ──────────────────────────────────────────────────────────────
export async function getCompanyById(id: number): Promise<Company | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return rows[0];
}

export async function createCompany(data: InsertCompany): Promise<Company> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companies).values(data).returning();
  return result[0];
}

export async function updateCompany(id: number, data: Partial<InsertCompany>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set({ ...data, updatedAt: new Date() }).where(eq(companies.id, id));
}

// ─── Company Members ────────────────────────────────────────────────────────
export async function getUserCompanyMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: companyMembers.id,
    companyId: companyMembers.companyId,
    userId: companyMembers.userId,
    role: companyMembers.role,
    createdAt: companyMembers.createdAt,
    companyName: companies.name,
    companySlug: companies.slug,
  })
    .from(companyMembers)
    .leftJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, userId))
    .orderBy(asc(companyMembers.createdAt));
}

export async function resolveCompanyMembership(userId: number, companyId: number): Promise<CompanyMember | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(companyMembers)
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listCompanyMembers(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  // Returns the shape the Team UI expects: id = user.id (NOT membership id),
  // appRole = company_members.role for the active company. The membership
  // bookkeeping fields (membershipId, joinedAt) are also exposed for power
  // users.
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    appRole: companyMembers.role,
    createdAt: companyMembers.createdAt,   // join date for THIS company
    lastSignedIn: users.lastSignedIn,
    // bookkeeping
    membershipId: companyMembers.id,
    companyId: companyMembers.companyId,
  })
    .from(companyMembers)
    .leftJoin(users, eq(companyMembers.userId, users.id))
    .where(eq(companyMembers.companyId, companyId))
    .orderBy(asc(companyMembers.createdAt));
}

export async function addCompanyMember(data: InsertCompanyMember): Promise<CompanyMember> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Avoid duplicate membership
  const existing = await resolveCompanyMembership(data.userId, data.companyId);
  if (existing) return existing;
  const result = await db.insert(companyMembers).values(data).returning();
  return result[0];
}

export async function updateCompanyMemberRole(
  companyId: number,
  userId: number,
  role: "owner" | "admin" | "cfo" | "lawyer" | "investor" | "viewer"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companyMembers).set({ role })
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
}

export async function removeCompanyMember(companyId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
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
export async function getAllShareholders(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareholders)
    .where(eq(shareholders.companyId, companyId))
    .orderBy(asc(shareholders.id));
}

export async function getShareholderById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareholders)
    .where(and(eq(shareholders.id, id), eq(shareholders.companyId, companyId)))
    .limit(1);
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

export async function updateShareholder(companyId: number, id: number, data: Partial<InsertShareholder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareholders).set(data)
    .where(and(eq(shareholders.id, id), eq(shareholders.companyId, companyId)));
}

export async function deleteShareholder(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareholders)
    .where(and(eq(shareholders.id, id), eq(shareholders.companyId, companyId)));
}

// ─── Funding Rounds ───────────────────────────────────────────────────────────
export async function getAllFundingRounds(companyId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all rounds for this company, ordered by date
  const rounds = await db.select().from(fundingRounds)
    .where(eq(fundingRounds.companyId, companyId))
    .orderBy(
      asc(fundingRounds.roundDate),
      asc(fundingRounds.sortOrder),
      asc(fundingRounds.id)
    );

  // Aggregate shares issued per round from shareTransactions (issuance type only) for this company
  const txAgg = await db
    .select({
      fundingRoundId: shareTransactions.fundingRoundId,
      sharesIssued: sql<number>`COALESCE(SUM(${shareTransactions.sharesAmount}), 0)`,
      totalInvestedNtd: sql<string>`COALESCE(SUM(${shareTransactions.totalAmountNtd}), 0)`,
    })
    .from(shareTransactions)
    .where(and(
      eq(shareTransactions.transactionType, "issuance"),
      eq(shareTransactions.companyId, companyId),
    ))
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

export async function getFundingRoundById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fundingRounds)
    .where(and(eq(fundingRounds.id, id), eq(fundingRounds.companyId, companyId)))
    .limit(1);
  return result[0];
}

export async function createFundingRound(data: InsertFundingRound) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(fundingRounds).values(data);
}

export async function updateFundingRound(companyId: number, id: number, data: Partial<InsertFundingRound>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(fundingRounds).set(data)
    .where(and(eq(fundingRounds.id, id), eq(fundingRounds.companyId, companyId)));
}

export async function deleteFundingRound(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(fundingRounds)
    .where(and(eq(fundingRounds.id, id), eq(fundingRounds.companyId, companyId)));
}

// ─── Share Holdings ───────────────────────────────────────────────────────────
export async function getShareHoldingsByRound(companyId: number, fundingRoundId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareHoldings)
    .where(and(
      eq(shareHoldings.fundingRoundId, fundingRoundId),
      eq(shareHoldings.companyId, companyId),
    ));
}

export async function getShareHoldingsByShareholder(companyId: number, shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareHoldings)
    .where(and(
      eq(shareHoldings.shareholderId, shareholderId),
      eq(shareHoldings.companyId, companyId),
    ));
}

export async function upsertShareHolding(data: InsertShareHolding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareHoldings).values(data);
}

export async function updateShareHolding(companyId: number, id: number, data: Partial<InsertShareHolding>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareHoldings).set(data)
    .where(and(eq(shareHoldings.id, id), eq(shareHoldings.companyId, companyId)));
}

export async function deleteShareHolding(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareHoldings)
    .where(and(eq(shareHoldings.id, id), eq(shareHoldings.companyId, companyId)));
}

export async function getAllShareHoldings(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareHoldings)
    .where(eq(shareHoldings.companyId, companyId));
}

// ─── Share Transactions ───────────────────────────────────────────────────────
export async function getAllTransactions(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareTransactions)
    .where(eq(shareTransactions.companyId, companyId))
    .orderBy(desc(shareTransactions.transactionDate));
}

export async function getTransactionsByShareholder(companyId: number, shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareTransactions)
    .where(and(
      eq(shareTransactions.shareholderId, shareholderId),
      eq(shareTransactions.companyId, companyId),
    ))
    .orderBy(desc(shareTransactions.transactionDate));
}

export async function createTransaction(data: InsertShareTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareTransactions).values(data);
}

export async function updateTransaction(companyId: number, id: number, data: Partial<InsertShareTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareTransactions).set(data)
    .where(and(eq(shareTransactions.id, id), eq(shareTransactions.companyId, companyId)));
}

export async function deleteTransaction(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareTransactions)
    .where(and(eq(shareTransactions.id, id), eq(shareTransactions.companyId, companyId)));
}

// ─── ESOP Pool ────────────────────────────────────────────────────────────────
export async function getAllEsopPools(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopPool)
    .where(eq(esopPool.companyId, companyId))
    .orderBy(desc(esopPool.createdAt));
}

export async function createEsopPool(data: InsertEsopPool) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(esopPool).values(data);
}

export async function updateEsopPool(companyId: number, id: number, data: Partial<InsertEsopPool>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(esopPool).set(data)
    .where(and(eq(esopPool.id, id), eq(esopPool.companyId, companyId)));
}

// ─── ESOP Grants ──────────────────────────────────────────────────────────────
export async function getGrantsByPool(companyId: number, poolId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopGrants)
    .where(and(
      eq(esopGrants.esopPoolId, poolId),
      eq(esopGrants.companyId, companyId),
    ));
}

export async function getAllGrants(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopGrants)
    .where(eq(esopGrants.companyId, companyId))
    .orderBy(desc(esopGrants.grantDate));
}

export async function createGrant(data: InsertEsopGrant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(esopGrants).values(data);
}

export async function updateGrant(companyId: number, id: number, data: Partial<InsertEsopGrant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(esopGrants).set(data)
    .where(and(eq(esopGrants.id, id), eq(esopGrants.companyId, companyId)));
}

export async function deleteGrant(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(esopGrants)
    .where(and(eq(esopGrants.id, id), eq(esopGrants.companyId, companyId)));
}

// ─── Valuation Projections ────────────────────────────────────────────────────
export async function getAllProjections(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(valuationProjections)
    .where(eq(valuationProjections.companyId, companyId))
    .orderBy(asc(valuationProjections.projectionDate));
}

export async function createProjection(data: InsertValuationProjection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(valuationProjections).values(data);
}

export async function updateProjection(companyId: number, id: number, data: Partial<InsertValuationProjection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(valuationProjections).set(data)
    .where(and(eq(valuationProjections.id, id), eq(valuationProjections.companyId, companyId)));
}

export async function deleteProjection(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(valuationProjections)
    .where(and(eq(valuationProjections.id, id), eq(valuationProjections.companyId, companyId)));
}

// ─── Import Logs ──────────────────────────────────────────────────────────────
export async function createImportLog(data: InsertImportLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(importLogs).values(data).returning({ id: importLogs.id });
  return result;
}

export async function updateImportLog(companyId: number, id: number, data: Partial<InsertImportLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(importLogs).set(data)
    .where(and(eq(importLogs.id, id), eq(importLogs.companyId, companyId)));
}

export async function getAllImportLogs(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importLogs)
    .where(eq(importLogs.companyId, companyId))
    .orderBy(desc(importLogs.createdAt));
}

// ─── Cap Table Snapshots ──────────────────────────────────────────────────────
export async function getAllSnapshots(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(capTableSnapshots)
    .where(eq(capTableSnapshots.companyId, companyId))
    .orderBy(desc(capTableSnapshots.snapshotDate));
}

export async function getSnapshotById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(capTableSnapshots)
    .where(and(eq(capTableSnapshots.id, id), eq(capTableSnapshots.companyId, companyId)))
    .limit(1);
  return result[0];
}

export async function createSnapshot(data: InsertCapTableSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(capTableSnapshots).values(data).returning({ id: capTableSnapshots.id });
  return result;
}

export async function deleteSnapshot(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(capTableSnapshots)
    .where(and(eq(capTableSnapshots.id, id), eq(capTableSnapshots.companyId, companyId)));
}

// ─── Anti-Dilution Provisions ─────────────────────────────────────────────────
export async function getAllAntiDilutionProvisions(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(antiDilutionProvisions)
    .where(eq(antiDilutionProvisions.companyId, companyId))
    .orderBy(desc(antiDilutionProvisions.createdAt));
}

export async function getProvisionsByShareholder(companyId: number, shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(antiDilutionProvisions)
    .where(and(
      eq(antiDilutionProvisions.shareholderId, shareholderId),
      eq(antiDilutionProvisions.companyId, companyId),
    ));
}

export async function createAntiDilutionProvision(data: InsertAntiDilutionProvision) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(antiDilutionProvisions).values(data);
}

export async function updateAntiDilutionProvision(companyId: number, id: number, data: Partial<InsertAntiDilutionProvision>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(antiDilutionProvisions).set(data)
    .where(and(eq(antiDilutionProvisions.id, id), eq(antiDilutionProvisions.companyId, companyId)));
}

export async function deleteAntiDilutionProvision(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(antiDilutionProvisions)
    .where(and(eq(antiDilutionProvisions.id, id), eq(antiDilutionProvisions.companyId, companyId)));
}

// ─── Shareholder Documents ─────────────────────────────────────────────────────
export async function getAllShareholderDocuments(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareholderDocuments)
    .where(eq(shareholderDocuments.companyId, companyId))
    .orderBy(asc(shareholderDocuments.shareholderId), asc(shareholderDocuments.documentType));
}

export async function getDocumentsByShareholder(companyId: number, shareholderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareholderDocuments)
    .where(and(
      eq(shareholderDocuments.shareholderId, shareholderId),
      eq(shareholderDocuments.companyId, companyId),
    ))
    .orderBy(asc(shareholderDocuments.documentType));
}

export async function createShareholderDocument(data: InsertShareholderDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareholderDocuments).values(data);
}

export async function updateShareholderDocument(companyId: number, id: number, data: Partial<InsertShareholderDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareholderDocuments).set(data)
    .where(and(eq(shareholderDocuments.id, id), eq(shareholderDocuments.companyId, companyId)));
}

export async function deleteShareholderDocument(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(shareholderDocuments)
    .where(and(eq(shareholderDocuments.id, id), eq(shareholderDocuments.companyId, companyId)));
}

// ─── Compliance Queries ────────────────────────────────────────────────────────
// Get all share transactions with lockUpEndDate in the future (for lock-up countdown)
export async function getUpcomingLockupExpirations(companyId: number, daysAhead = 180) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  return db.select().from(shareTransactions)
    .where(
      and(
        eq(shareTransactions.companyId, companyId),
        sql`${shareTransactions.lockUpEndDate} >= ${today}`,
        sql`${shareTransactions.lockUpEndDate} <= ${cutoffStr}`
      )
    )
    .orderBy(asc(shareTransactions.lockUpEndDate));
}

// Get all share transactions with taxDeductionYear set (for tax expiry tracking)
export async function getTaxDeductionInfo(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareTransactions)
    .where(
      and(
        eq(shareTransactions.companyId, companyId),
        isNotNull(shareTransactions.taxDeductionYear),
        eq(shareTransactions.taxQualified, true)
      )
    )
    .orderBy(asc(shareTransactions.taxDeductionYear));
}

// ─── 409A Valuations ─────────────────────────────────────────────────────────
export async function getAll409aValuations(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(valuations409a)
    .where(eq(valuations409a.companyId, companyId))
    .orderBy(asc(valuations409a.valuationDate));
}

export async function create409aValuation(data: InsertValuation409a) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(valuations409a).values(data).returning({ id: valuations409a.id });
  return result[0];
}

export async function update409aValuation(companyId: number, id: number, data: Partial<InsertValuation409a>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(valuations409a).set(data)
    .where(and(eq(valuations409a.id, id), eq(valuations409a.companyId, companyId)));
}

export async function delete409aValuation(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(valuations409a)
    .where(and(eq(valuations409a.id, id), eq(valuations409a.companyId, companyId)));
}

// ─── Liquidation Preferences ─────────────────────────────────────────────────
export async function getLiquidationPreferences(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(liquidationPreferences)
    .where(eq(liquidationPreferences.companyId, companyId))
    .orderBy(asc(liquidationPreferences.seniorityRank));
}

export async function upsertLiquidationPreference(data: InsertLiquidationPreference) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // NOTE: The unique key is on fundingRoundId alone (table-level unique). Since
  // each fundingRound is already scoped to a single company, this is fine —
  // a fundingRoundId implicitly identifies the company.
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

// ─── Waterfall Calculation (V1 — derives from share_register_entries + investors) ──
// Replaces the legacy version that read share_holdings + shareholders. Now sums
// register entries by (investorId, fundingRoundId) and looks up names from
// investors. The legacy "ESOP placeholder shareholder" no longer appears.
export async function computeWaterfall(companyId: number, exitValueNtd: number) {
  const db = await getDb();
  if (!db) return { tranches: [], common: [], totalDistributed: 0, remainingForCommon: 0 };

  const rounds = await db.select().from(fundingRounds)
    .where(eq(fundingRounds.companyId, companyId))
    .orderBy(asc(fundingRounds.sortOrder));
  const prefs = await getLiquidationPreferences(companyId);

  // Aggregate register entries by (investorId, fundingRoundId)
  // - shares = SUM(shares) for that (investor, round)
  // - paidIn = SUM(totalAmount in NTD-equivalent) for that (investor, round)
  const entries = await db.select().from(shareRegisterEntries)
    .where(eq(shareRegisterEntries.companyId, companyId));

  const investorRows = await db.select().from(investors)
    .where(eq(investors.companyId, companyId));

  type Holding = {
    investorId: number;
    fundingRoundId: number | null;
    totalShares: number;
    paidInNtd: number;
  };
  const holdingMap = new Map<string, Holding>();
  for (const e of entries) {
    if (e.shares === 0) continue;
    const key = `${e.investorId}:${e.fundingRoundId ?? "null"}`;
    const existing = holdingMap.get(key) ?? {
      investorId: e.investorId,
      fundingRoundId: e.fundingRoundId ?? null,
      totalShares: 0,
      paidInNtd: 0,
    };
    existing.totalShares += e.shares;
    const amount = parseFloat(e.totalAmount ?? "0");
    const fx = parseFloat(e.fxToNtd ?? "1");
    existing.paidInNtd += amount * fx;
    holdingMap.set(key, existing);
  }
  const allHoldings = Array.from(holdingMap.values()).filter(h => h.totalShares > 0);
  const investorMap = new Map(investorRows.map(i => [i.id, i]));
  const prefMap = new Map(prefs.map(p => [p.fundingRoundId, p]));

  let remaining = exitValueNtd;
  const tranches: Array<{
    roundId: number; roundName: string; preferenceType: string;
    liquidationMultiple: number; paidIn: number; preferenceAmount: number;
    distributed: number; shareholders: Array<{ name: string; shares: number; amount: number }>;
  }> = [];

  // Phase 1: Liquidation preferences (most senior first)
  const preferredRounds = rounds
    .filter(r => prefMap.has(r.id))
    .sort((a, b) => prefMap.get(a.id)!.seniorityRank - prefMap.get(b.id)!.seniorityRank);

  for (const round of preferredRounds) {
    const pref = prefMap.get(round.id)!;
    const roundHoldings = allHoldings.filter(h => h.fundingRoundId === round.id);
    const paidIn = roundHoldings.reduce((s, h) => s + h.paidInNtd, 0);
    const multiple = parseFloat(String(pref.liquidationMultiple));
    const preferenceAmount = paidIn * multiple;
    const distributed = Math.min(preferenceAmount, remaining);
    remaining -= distributed;

    const shDetails = roundHoldings.map(h => {
      const inv = investorMap.get(h.investorId);
      const shAmount = paidIn > 0 ? (h.paidInNtd / paidIn) * distributed : 0;
      return { name: inv?.name ?? `Investor #${h.investorId}`, shares: h.totalShares, amount: shAmount };
    });

    tranches.push({
      roundId: round.id, roundName: round.name,
      preferenceType: pref.preferenceType,
      liquidationMultiple: multiple,
      paidIn, preferenceAmount, distributed,
      shareholders: shDetails,
    });
  }

  // Phase 2: common + participating preferred share the residual pro rata
  const commonHoldings = allHoldings.filter(h => {
    const round = h.fundingRoundId != null ? rounds.find(r => r.id === h.fundingRoundId) : null;
    const pref = round ? prefMap.get(round.id) : undefined;
    return !pref || pref.preferenceType !== "non_participating";
  });

  const totalCommonShares = commonHoldings.reduce((s, h) => s + h.totalShares, 0);
  // Combine multiple holdings of the same investor into one row
  const commonByInvestor = new Map<number, { name: string; shares: number; amount: number }>();
  for (const h of commonHoldings) {
    const inv = investorMap.get(h.investorId);
    const name = inv?.name ?? `Investor #${h.investorId}`;
    const amount = totalCommonShares > 0 ? (h.totalShares / totalCommonShares) * remaining : 0;
    const existing = commonByInvestor.get(h.investorId);
    if (existing) {
      existing.shares += h.totalShares;
      existing.amount += amount;
    } else {
      commonByInvestor.set(h.investorId, { name, shares: h.totalShares, amount });
    }
  }
  const commonDistributions = Array.from(commonByInvestor.values())
    .sort((a, b) => b.amount - a.amount);

  // Total distributed = exit - leftover. With pro-rata residual that is full exit.
  const totalDistributed = exitValueNtd;

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
export async function getAllInvitations(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userInvitations)
    .where(eq(userInvitations.companyId, companyId))
    .orderBy(desc(userInvitations.createdAt));
}

export async function createInvitation(data: InsertUserInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userInvitations).values(data).returning({ id: userInvitations.id });
  const rows = await db.select().from(userInvitations).where(eq(userInvitations.id, result[0].id));
  return rows[0];
}

// Token-based lookup is global (an invitation token is unique across the app
// and the accept flow runs before the user is in any company context).
export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userInvitations).where(eq(userInvitations.token, token));
  return rows[0] ?? null;
}

// Invitation status updates happen by id (also during accept flow before any
// company context is established) — not scoped by companyId.
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

export async function getAuditLogs(companyId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs)
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
}

export async function getAuditLogsByResource(companyId: number, resourceType: string, resourceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs)
    .where(and(
      eq(auditLogs.companyId, companyId),
      eq(auditLogs.resourceType, resourceType),
      eq(auditLogs.resourceId, resourceId),
    ))
    .orderBy(desc(auditLogs.createdAt));
}

export async function deleteUserById(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, userId));
}

// ─── Financial Projections (5-Year) ─────────────────────────────────────────
export async function getAllFinancialProjections(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialProjections)
    .where(eq(financialProjections.companyId, companyId))
    .orderBy(desc(financialProjections.createdAt));
}

export async function getFinancialProjectionById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(financialProjections)
    .where(and(eq(financialProjections.id, id), eq(financialProjections.companyId, companyId)))
    .limit(1);
  return result[0];
}

export async function createFinancialProjection(data: InsertFinancialProjection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(financialProjections).values(data).returning();
  return result[0];
}

export async function updateFinancialProjection(companyId: number, id: number, data: Partial<InsertFinancialProjection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(financialProjections).set({ ...data, updatedAt: new Date() })
    .where(and(eq(financialProjections.id, id), eq(financialProjections.companyId, companyId)));
}

export async function deleteFinancialProjection(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(financialProjections)
    .where(and(eq(financialProjections.id, id), eq(financialProjections.companyId, companyId)));
}

// ─── DCF Scenarios ──────────────────────────────────────────────────────────
export async function getDcfScenariosByProjection(companyId: number, projectionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dcfScenarios)
    .where(and(
      eq(dcfScenarios.projectionId, projectionId),
      eq(dcfScenarios.companyId, companyId),
    ));
}

export async function createDcfScenario(data: InsertDcfScenario) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(dcfScenarios).values(data).returning();
  return result[0];
}

export async function updateDcfScenario(companyId: number, id: number, data: Partial<InsertDcfScenario>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dcfScenarios).set(data)
    .where(and(eq(dcfScenarios.id, id), eq(dcfScenarios.companyId, companyId)));
}

export async function deleteDcfScenario(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(dcfScenarios)
    .where(and(eq(dcfScenarios.id, id), eq(dcfScenarios.companyId, companyId)));
}

// ─── V1: Investors ──────────────────────────────────────────────────────────
export async function getAllInvestors(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investors).where(eq(investors.companyId, companyId)).orderBy(asc(investors.name));
}
export async function getInvestorById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(investors).where(and(eq(investors.id, id), eq(investors.companyId, companyId))).limit(1);
  return rows[0];
}
export async function createInvestor(data: InsertInvestor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(investors).values(data).returning();
  return rows[0];
}
export async function updateInvestor(companyId: number, id: number, data: Partial<InsertInvestor>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(investors).set({ ...data, updatedAt: new Date() })
    .where(and(eq(investors.id, id), eq(investors.companyId, companyId)));
}
export async function deleteInvestor(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(investors).where(and(eq(investors.id, id), eq(investors.companyId, companyId)));
}

// ─── V1: Allocations ────────────────────────────────────────────────────────
export async function getAllocationsByCompany(companyId: number, roundId?: number) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = roundId != null
    ? and(eq(allocations.companyId, companyId), eq(allocations.fundingRoundId, roundId))
    : eq(allocations.companyId, companyId);
  return db.select().from(allocations).where(whereClause).orderBy(asc(allocations.createdAt));
}
export async function getAllocationById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(allocations).where(and(eq(allocations.id, id), eq(allocations.companyId, companyId))).limit(1);
  return rows[0];
}
export async function createAllocation(data: InsertAllocation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(allocations).values(data).returning();
  return rows[0];
}
export async function updateAllocation(companyId: number, id: number, data: Partial<InsertAllocation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(allocations).set({ ...data, updatedAt: new Date() })
    .where(and(eq(allocations.id, id), eq(allocations.companyId, companyId)));
}
export async function deleteAllocation(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(allocations).where(and(eq(allocations.id, id), eq(allocations.companyId, companyId)));
}

// ─── V1: Register + Snapshots ──────────────────────────────────────────────
export async function getAllRegisterEntries(companyId: number, opts?: { issuedOnly?: boolean; investorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const where = [eq(shareRegisterEntries.companyId, companyId)];
  if (opts?.investorId) where.push(eq(shareRegisterEntries.investorId, opts.investorId));
  // SPEC says Register default view is "Issued only" but our eventType has issuance/transfer/etc — all are "issued" facts.
  // For V1 we show all entries; future Phase 2+ can add eventType filter via opts.
  return db.select().from(shareRegisterEntries).where(and(...where)).orderBy(desc(shareRegisterEntries.effectiveDate), desc(shareRegisterEntries.id));
}
export async function getAllSnapshotsV1(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(snapshotsV1).where(eq(snapshotsV1.companyId, companyId)).orderBy(desc(snapshotsV1.createdAt));
}

// ─── V1 ESOP Pools ──────────────────────────────────────────────────────────
export async function getAllEsopPoolsV1(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(esopPoolsV1).where(eq(esopPoolsV1.companyId, companyId)).orderBy(desc(esopPoolsV1.createdAt));
}
export async function getEsopPoolV1ById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(esopPoolsV1).where(and(eq(esopPoolsV1.id, id), eq(esopPoolsV1.companyId, companyId))).limit(1);
  return rows[0];
}
export async function createEsopPoolV1(data: InsertEsopPoolV1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(esopPoolsV1).values(data).returning();
  return rows[0];
}
export async function updateEsopPoolV1(companyId: number, id: number, data: Partial<InsertEsopPoolV1>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(esopPoolsV1).set({ ...data, updatedAt: new Date() })
    .where(and(eq(esopPoolsV1.id, id), eq(esopPoolsV1.companyId, companyId)));
}
export async function deleteEsopPoolV1(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(esopPoolsV1).where(and(eq(esopPoolsV1.id, id), eq(esopPoolsV1.companyId, companyId)));
}

// ─── V1 ESOP Grants ─────────────────────────────────────────────────────────
export async function getAllEsopGrantsV1(companyId: number, poolId?: number) {
  const db = await getDb();
  if (!db) return [];
  const where = poolId != null
    ? and(eq(esopGrantsV1.companyId, companyId), eq(esopGrantsV1.poolId, poolId))
    : eq(esopGrantsV1.companyId, companyId);
  return db.select().from(esopGrantsV1).where(where).orderBy(desc(esopGrantsV1.grantDate));
}
export async function getEsopGrantV1ById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(esopGrantsV1).where(and(eq(esopGrantsV1.id, id), eq(esopGrantsV1.companyId, companyId))).limit(1);
  return rows[0];
}
export async function createEsopGrantV1(data: InsertEsopGrantV1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(esopGrantsV1).values(data).returning();
  return rows[0];
}
export async function updateEsopGrantV1(companyId: number, id: number, data: Partial<InsertEsopGrantV1>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(esopGrantsV1).set({ ...data, updatedAt: new Date() })
    .where(and(eq(esopGrantsV1.id, id), eq(esopGrantsV1.companyId, companyId)));
}
export async function deleteEsopGrantV1(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(esopGrantsV1).where(and(eq(esopGrantsV1.id, id), eq(esopGrantsV1.companyId, companyId)));
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────
/**
 * Delete all business-data rows belonging to a single company. Preserves: users,
 * companies, company_members. Token-based invitations to this company are also
 * deleted. Uses scoped DELETE statements (TRUNCATE can't filter by companyId).
 * Returns table-name -> row count deleted (best effort).
 */
export async function truncateAllBusinessData(companyId: number): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Gather counts first (for audit + response)
  const counts: Record<string, number> = {};
  const countable: Array<[string, any, any]> = [
    ["shareholders", shareholders, shareholders.companyId],
    ["funding_rounds", fundingRounds, fundingRounds.companyId],
    ["share_holdings", shareHoldings, shareHoldings.companyId],
    ["share_transactions", shareTransactions, shareTransactions.companyId],
    ["esop_pool", esopPool, esopPool.companyId],
    ["esop_grants", esopGrants, esopGrants.companyId],
    ["valuation_projections", valuationProjections, valuationProjections.companyId],
    ["import_logs", importLogs, importLogs.companyId],
    ["cap_table_snapshots", capTableSnapshots, capTableSnapshots.companyId],
    ["anti_dilution_provisions", antiDilutionProvisions, antiDilutionProvisions.companyId],
    ["shareholder_documents", shareholderDocuments, shareholderDocuments.companyId],
    ["valuations_409a", valuations409a, valuations409a.companyId],
    ["liquidation_preferences", liquidationPreferences, liquidationPreferences.companyId],
    ["audit_logs", auditLogs, auditLogs.companyId],
    ["financial_projections", financialProjections, financialProjections.companyId],
    ["dcf_scenarios", dcfScenarios, dcfScenarios.companyId],
    ["user_invitations", userInvitations, userInvitations.companyId],
    ["snapshots", snapshotsV1, snapshotsV1.companyId],
    ["share_register_entries", shareRegisterEntries, shareRegisterEntries.companyId],
    ["allocations", allocations, allocations.companyId],
    ["instruments", instruments, instruments.companyId],
    ["signing_requests", signingRequests, signingRequests.companyId],
    ["signing_templates", signingTemplates, signingTemplates.companyId],
    ["share_classes", shareClasses, shareClasses.companyId],
    ["investors", investors, investors.companyId],
    ["esop_grants_v1", esopGrantsV1, esopGrantsV1.companyId],
    ["esop_pools_v1", esopPoolsV1, esopPoolsV1.companyId],
  ];
  for (const [name, table, companyIdCol] of countable) {
    try {
      const rows = await db.select().from(table).where(eq(companyIdCol, companyId));
      counts[name] = rows.length;
    } catch {
      counts[name] = -1;
    }
  }

  // DELETE by companyId for each table — order matters so child rows go before parents.
  // Tables without inter-table FKs can go in any order.
  await db.delete(auditLogs).where(eq(auditLogs.companyId, companyId));
  await db.delete(shareTransactions).where(eq(shareTransactions.companyId, companyId));
  await db.delete(shareHoldings).where(eq(shareHoldings.companyId, companyId));
  await db.delete(shareholderDocuments).where(eq(shareholderDocuments.companyId, companyId));
  await db.delete(antiDilutionProvisions).where(eq(antiDilutionProvisions.companyId, companyId));
  await db.delete(esopGrants).where(eq(esopGrants.companyId, companyId));
  await db.delete(esopPool).where(eq(esopPool.companyId, companyId));
  await db.delete(liquidationPreferences).where(eq(liquidationPreferences.companyId, companyId));
  await db.delete(valuations409a).where(eq(valuations409a.companyId, companyId));
  await db.delete(valuationProjections).where(eq(valuationProjections.companyId, companyId));
  await db.delete(capTableSnapshots).where(eq(capTableSnapshots.companyId, companyId));
  await db.delete(importLogs).where(eq(importLogs.companyId, companyId));
  await db.delete(dcfScenarios).where(eq(dcfScenarios.companyId, companyId));
  await db.delete(financialProjections).where(eq(financialProjections.companyId, companyId));
  // V1 tables — delete in FK-safe order: snapshots → register entries → allocations → investors.
  await db.delete(snapshotsV1).where(eq(snapshotsV1.companyId, companyId));
  await db.delete(shareRegisterEntries).where(eq(shareRegisterEntries.companyId, companyId));
  await db.delete(allocations).where(eq(allocations.companyId, companyId));
  // V1 ESOP — grants before pools (grants reference pools)
  await db.delete(esopGrantsV1).where(eq(esopGrantsV1.companyId, companyId));
  await db.delete(esopPoolsV1).where(eq(esopPoolsV1.companyId, companyId));
  // Signing templates + requests + Instruments reference investors — delete BEFORE investors.
  await db.delete(signingTemplates).where(eq(signingTemplates.companyId, companyId));
  await db.delete(signingRequests).where(eq(signingRequests.companyId, companyId));
  await db.delete(shareClasses).where(eq(shareClasses.companyId, companyId));
  await db.delete(instruments).where(eq(instruments.companyId, companyId));
  await db.delete(investors).where(eq(investors.companyId, companyId));
  await db.delete(shareholders).where(eq(shareholders.companyId, companyId));
  await db.delete(fundingRounds).where(eq(fundingRounds.companyId, companyId));
  await db.delete(userInvitations).where(eq(userInvitations.companyId, companyId));

  return counts;
}

// ─── Instruments (V1) ────────────────────────────────────────────────────────
export async function getAllInstruments(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(instruments)
    .where(eq(instruments.companyId, companyId))
    .orderBy(desc(instruments.createdAt));
}

export async function getInstrumentById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(instruments)
    .where(and(eq(instruments.id, id), eq(instruments.companyId, companyId)))
    .limit(1);
  return rows[0];
}

export async function getInstrumentsByInvestor(companyId: number, investorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(instruments)
    .where(and(eq(instruments.companyId, companyId), eq(instruments.investorId, investorId)))
    .orderBy(desc(instruments.createdAt));
}

export async function getInstrumentsByRound(companyId: number, fundingRoundId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(instruments)
    .where(and(eq(instruments.companyId, companyId), eq(instruments.fundingRoundId, fundingRoundId)))
    .orderBy(desc(instruments.createdAt));
}

export async function getInstrumentsByType(companyId: number, type: "safe" | "convertible_note") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(instruments)
    .where(and(eq(instruments.companyId, companyId), eq(instruments.type, type)))
    .orderBy(desc(instruments.createdAt));
}

export async function getActiveConvertibles(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(instruments)
    .where(
      and(
        eq(instruments.companyId, companyId),
        eq(instruments.status, "active"),
        sql`${instruments.type} IN ('safe', 'convertible_note')`
      )
    )
    .orderBy(desc(instruments.createdAt));
}

export async function createInstrument(data: InsertInstrument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(instruments).values(data).returning();
  return rows[0];
}

export async function updateInstrument(companyId: number, id: number, data: Partial<InsertInstrument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(instruments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(instruments.id, id), eq(instruments.companyId, companyId)));
}

export async function deleteInstrument(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(instruments)
    .where(and(eq(instruments.id, id), eq(instruments.companyId, companyId)));
}

// ─── Signing Requests (DocuSeal eSignature) ─────────────────────────────────

export async function getAllSigningRequests(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signingRequests)
    .where(eq(signingRequests.companyId, companyId))
    .orderBy(desc(signingRequests.createdAt));
}

export async function getSigningRequestById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(signingRequests)
    .where(and(eq(signingRequests.companyId, companyId), eq(signingRequests.id, id)))
    .limit(1);
  return rows[0];
}

export async function getSigningRequestsByStatus(companyId: number, status: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signingRequests)
    .where(and(eq(signingRequests.companyId, companyId), eq(signingRequests.status, status as any)))
    .orderBy(desc(signingRequests.createdAt));
}

export async function getSigningRequestBySubmissionId(submissionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(signingRequests)
    .where(eq(signingRequests.docusealSubmissionId, submissionId));
  return rows[0];
}

export async function createSigningRequest(data: InsertSigningRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(signingRequests).values(data).returning();
  return rows[0];
}

export async function updateSigningRequest(companyId: number, id: number, data: Partial<InsertSigningRequest>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(signingRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(signingRequests.id, id), eq(signingRequests.companyId, companyId)));
}

export async function deleteSigningRequest(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(signingRequests)
    .where(and(eq(signingRequests.id, id), eq(signingRequests.companyId, companyId)));
}

// ─── Signing Templates ──────────────────────────────────────────────────────

/** Get templates visible to a company: platform-scope + company's own */
export async function getSigningTemplatesForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signingTemplates)
    .where(
      sql`${signingTemplates.scope} = 'platform' OR ${signingTemplates.companyId} = ${companyId}`
    )
    .orderBy(asc(signingTemplates.scope), asc(signingTemplates.name));
}

/** Get platform-only templates (for admin views) */
export async function getPlatformSigningTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signingTemplates)
    .where(eq(signingTemplates.scope, "platform"))
    .orderBy(asc(signingTemplates.name));
}

export async function getSigningTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(signingTemplates)
    .where(eq(signingTemplates.id, id)).limit(1);
  return rows[0];
}

export async function createSigningTemplate(data: InsertSigningTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(signingTemplates).values(data).returning();
  return rows[0];
}

export async function updateSigningTemplate(id: number, data: Partial<InsertSigningTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(signingTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(signingTemplates.id, id));
}

export async function deleteSigningTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(signingTemplates).where(eq(signingTemplates.id, id));
}

// ─── Share Classes ──────────────────────────────────────────────────────────
export async function getShareClasses(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareClasses)
    .where(eq(shareClasses.companyId, companyId))
    .orderBy(asc(shareClasses.sortOrder), asc(shareClasses.id));
}

export async function getShareClassById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(shareClasses)
    .where(and(eq(shareClasses.companyId, companyId), eq(shareClasses.id, id)));
  return rows[0] ?? null;
}

export async function getShareClassBySlug(companyId: number, slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(shareClasses)
    .where(and(eq(shareClasses.companyId, companyId), eq(shareClasses.slug, slug)));
  return rows[0] ?? null;
}

export async function createShareClass(data: InsertShareClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(shareClasses).values(data).returning();
  return rows[0];
}

export async function updateShareClass(companyId: number, id: number, data: Partial<InsertShareClass>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shareClasses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(shareClasses.companyId, companyId), eq(shareClasses.id, id)));
}

export async function deleteShareClass(companyId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(shareClasses)
    .where(and(eq(shareClasses.companyId, companyId), eq(shareClasses.id, id)));
}

/** Seed default share classes for a new company (Common + ESOP). */
export async function seedDefaultShareClasses(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const defaults: InsertShareClass[] = [
    { companyId, name: "Common", slug: "common", classType: "common", sortOrder: 0 },
    { companyId, name: "ESOP", slug: "esop", classType: "common", sortOrder: 100 },
  ];
  await db.insert(shareClasses).values(defaults);
}
