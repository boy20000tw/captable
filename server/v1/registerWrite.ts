// Register write + auto-snapshot hook (SPEC-mvp-split.md Phase 1 step 3)
//
// The share_register_entries table is append-only. Every write goes through
// `writeRegisterEntry()` which also creates a `snapshots` row capturing the
// derived cap table at that moment. This enforces the SPEC invariant that
// nothing can touch the register without leaving an auditable snapshot.
//
// Usage from routers (when an allocation reaches Issued, or for founder
// back-entries):
//   const entry = await writeRegisterEntry(companyId, userId, {
//     investorId, eventType: "issuance", shareClass, shares, ...
//   });
//
// Returns { entry, snapshot } so the caller can reference the snapshot id
// (e.g. for audit log).

import { eq, and } from "drizzle-orm";
import { getDb, resolveCompanyDek } from "../db";
import { encryptField } from "../encryption";
import { deriveCapTable } from "./capTable";
import {
  shareRegisterEntries,
  snapshots,
  investors,
  type InsertShareRegisterEntry,
} from "../../drizzle/schema";

export type RegisterEntryInput = {
  // Required
  investorId: number;
  eventType: "issuance" | "transfer_in" | "transfer_out" | "cancellation" | "reversal" | "esop_exercise" | "rsu_settlement";
  shareClass: string;
  shares: number;               // positive integer; sign convention handled per event type
  effectiveDate: string;        // YYYY-MM-DD

  // Optional
  allocationId?: number | null;
  fundingRoundId?: number | null;
  pricePerShare?: string | null;   // as string per drizzle numeric convention
  currency?: string | null;
  fxToNtd?: string | null;
  totalAmount?: string | null;
  reversedEntryId?: number | null; // required iff eventType === "reversal"
  notes?: string | null;
};

export type RegisterWriteResult = {
  entry: typeof shareRegisterEntries.$inferSelect;
  snapshot: typeof snapshots.$inferSelect;
};

/**
 * Write a register entry and immediately create a snapshot of the resulting
 * cap table. Throws on validation or DB errors. Never mutates an existing
 * register row (append-only).
 */
export async function writeRegisterEntry(
  companyId: number,
  userId: number | null,
  input: RegisterEntryInput
): Promise<RegisterWriteResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ─── Validation ──────────────────────────────────────────────────────────
  if (!Number.isInteger(input.shares) || input.shares <= 0) {
    throw new Error("shares must be a positive integer; use eventType to encode direction");
  }
  if (input.eventType === "reversal" && !input.reversedEntryId) {
    throw new Error("eventType=reversal requires reversedEntryId");
  }
  if (input.reversedEntryId && input.eventType !== "reversal") {
    throw new Error("reversedEntryId can only be set when eventType=reversal");
  }

  // Translate external "always positive shares" into the signed value stored
  // in the register. Convention: outflows are negative so that a simple SUM
  // of the column gives the net holding.
  const signed = signedShareCount(input.eventType, input.shares);

  // ─── Write register entry ───────────────────────────────────────────────
  const values: InsertShareRegisterEntry = {
    companyId,
    investorId: input.investorId,
    eventType: input.eventType,
    shareClass: input.shareClass as any,  // dynamic share class → pgEnum cast
    shares: signed,
    effectiveDate: input.effectiveDate,
    allocationId: input.allocationId ?? null,
    fundingRoundId: input.fundingRoundId ?? null,
    pricePerShare: input.pricePerShare ?? null,
    currency: input.currency ?? "NTD",
    fxToNtd: input.fxToNtd ?? "1",
    totalAmount: input.totalAmount ?? null,
    reversedEntryId: input.reversedEntryId ?? null,
    notes: input.notes ?? null,
    createdByUserId: userId,
  };

  // Phase 3 dual-write: encrypt financial fields
  const encValues: Record<string, any> = { ...values };
  try {
    const dek = await resolveCompanyDek(companyId);
    const finFields = ["shares", "pricePerShare", "fxToNtd", "totalAmount"];
    for (const f of finFields) {
      if (encValues[f] != null) encValues[`${f}Enc`] = encryptField(String(encValues[f]), dek);
    }
  } catch { /* encryption not configured — skip */ }

  const [entry] = await db.insert(shareRegisterEntries).values(encValues as InsertShareRegisterEntry).returning();
  if (!entry) throw new Error("Failed to write register entry");

  // ─── Derive cap table + create snapshot ─────────────────────────────────
  const capTable = await deriveCapTable(companyId);
  const snapshotName = await buildSnapshotName(entry.id, input, companyId);

  const [snap] = await db.insert(snapshots).values({
    companyId,
    name: snapshotName,
    triggerType: "register_write",
    registerEntryId: entry.id,
    capTableData: capTable as unknown as Record<string, unknown>,
    totalShares: capTable.totalShares,
    totalInvestors: capTable.holdings.length,
    createdByUserId: userId,
  }).returning();

  if (!snap) throw new Error("Register entry written but snapshot failed — manual cleanup required");

  return { entry, snapshot: snap };
}

/**
 * Convert positive share count + event type to signed integer for storage.
 */
function signedShareCount(
  eventType: RegisterEntryInput["eventType"],
  shares: number
): number {
  switch (eventType) {
    case "issuance":
    case "transfer_in":
    case "esop_exercise":
    case "rsu_settlement":
      return shares;
    case "transfer_out":
    case "cancellation":
      return -shares;
    case "reversal":
      // The caller sets eventType=reversal and passes `shares` equal in
      // magnitude to the row being reversed. The reversal negates it.
      // We store as -shares; caller is responsible for using the correct
      // magnitude to undo the original.
      return -shares;
  }
}

async function buildSnapshotName(
  entryId: number,
  input: RegisterEntryInput,
  companyId: number
): Promise<string> {
  const db = await getDb();
  if (!db) return `Register entry #${entryId}`;
  const [inv] = await db.select({ name: investors.name })
    .from(investors)
    .where(and(eq(investors.id, input.investorId), eq(investors.companyId, companyId)))
    .limit(1);
  const who = inv?.name ?? `Investor #${input.investorId}`;
  const verb: string = ({
    issuance:      "Issuance to",
    transfer_in:   "Transfer to",
    transfer_out:  "Transfer from",
    cancellation:  "Cancellation for",
    reversal:      "Reversal for",
    esop_exercise: "ESOP exercise for",
  } as Record<string, string>)[input.eventType] ?? input.eventType;
  return `${verb} ${who} (${input.shares.toLocaleString()} ${input.shareClass}) on ${input.effectiveDate}`;
}

/**
 * Create a manual snapshot (not triggered by a register write). Used e.g.
 * before a risky operation or for end-of-period bookkeeping.
 */
export async function createManualSnapshot(
  companyId: number,
  userId: number | null,
  name: string,
  notes?: string | null
): Promise<typeof snapshots.$inferSelect> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const capTable = await deriveCapTable(companyId);
  const [snap] = await db.insert(snapshots).values({
    companyId,
    name,
    triggerType: "manual",
    registerEntryId: null,
    capTableData: capTable as unknown as Record<string, unknown>,
    totalShares: capTable.totalShares,
    totalInvestors: capTable.holdings.length,
    notes: notes ?? null,
    createdByUserId: userId,
  }).returning();
  if (!snap) throw new Error("Failed to create snapshot");
  return snap;
}
