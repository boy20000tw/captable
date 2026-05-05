// Allocation lifecycle state machine (SPEC-mvp-split.md §2 V1)
//
// Statuses form a linear pipeline; transitions are validated and produce
// timestamps on the allocation row. `issued` is terminal — when reached, a
// share_register_entries row must be written (handled by the router, not here).
//
// This module is PURE: no DB access. Input = current state + requested
// transition + allocation fields. Output = { ok, errors[] } + the fields to
// update (timestamp + status).
//
// Per the spec:
//   Planned → Committed   — needs term sheet uploaded
//   Committed → Signed    — needs signed agreement
//   Signed → Funded       — needs actual received amount
//   Funded → Issued       — needs share count (→ triggers register write)

export type AllocationStatus =
  | "planned"
  | "committed"
  | "signed"
  | "funded"
  | "issued";

export type AllocationSnapshot = {
  status: AllocationStatus;
  // Required for transitions (from DB row)
  termSheetUrl?: string | null;
  skipTermSheet?: boolean;
  agreementUrl?: string | null;
  amount?: string | number | null;          // in allocation currency
  sharesAllocated?: number | null;
  pricePerShare?: string | number | null;
};

export type TransitionResult =
  | { ok: true; newStatus: AllocationStatus; timestampField: string }
  | { ok: false; errors: string[] };

// Allowed forward transitions (strictly linear; no skipping; no going backwards).
const FORWARD: Record<AllocationStatus, AllocationStatus | null> = {
  planned:   "committed",
  committed: "signed",
  signed:    "funded",
  funded:    "issued",
  issued:    null, // terminal
};

// Which timestamp field to stamp when entering each status.
const TIMESTAMP_FIELD: Record<AllocationStatus, string> = {
  planned:   "plannedAt",
  committed: "committedAt",
  signed:    "signedAt",
  funded:    "fundedAt",
  issued:    "issuedAt",
};

// Returns the next legal status, or null if none.
export function nextStatus(current: AllocationStatus): AllocationStatus | null {
  return FORWARD[current];
}

// Is the proposed transition legal (one-step forward only)?
export function isLegalTransition(from: AllocationStatus, to: AllocationStatus): boolean {
  return FORWARD[from] === to;
}

// Run pre-conditions for advancing from current status to the next. Returns
// the newStatus + which timestamp column to set, or a list of errors.
//
// Usage in router:
//   const r = advanceAllocation(row);
//   if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.errors.join("; ") });
//   await db.update(allocations).set({ status: r.newStatus, [r.timestampField]: new Date() })
export function advanceAllocation(a: AllocationSnapshot): TransitionResult {
  const target = FORWARD[a.status];
  if (target == null) {
    return { ok: false, errors: [`Allocation is already at terminal status "${a.status}" and cannot advance further.`] };
  }

  const errors: string[] = [];

  // Per-transition preconditions.
  switch (target) {
    case "committed": {
      if (!a.skipTermSheet && (!a.termSheetUrl || !a.termSheetUrl.trim())) {
        errors.push("Cannot move to Committed: term sheet URL is required (or check 'Skip Term Sheet').");
      }
      if (a.amount == null || Number(a.amount) <= 0) {
        errors.push("Cannot move to Committed: allocation amount must be set and greater than 0.");
      }
      break;
    }
    case "signed": {
      if (!a.agreementUrl || !a.agreementUrl.trim()) {
        errors.push("Cannot move to Signed: signed agreement URL is required.");
      }
      break;
    }
    case "funded": {
      if (a.amount == null || Number(a.amount) <= 0) {
        errors.push("Cannot move to Funded: received amount must be set and greater than 0.");
      }
      break;
    }
    case "issued": {
      if (a.sharesAllocated == null || a.sharesAllocated <= 0) {
        errors.push("Cannot move to Issued: share count must be set and greater than 0.");
      }
      if (a.pricePerShare == null || Number(a.pricePerShare) <= 0) {
        errors.push("Cannot move to Issued: price per share must be set and greater than 0.");
      }
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    newStatus: target,
    timestampField: TIMESTAMP_FIELD[target],
  };
}

// Explicit transition to a specific target (still strictly one-step forward).
// Useful if the UI needs to skip from, say, Planned straight to Issued for
// back-dated founder shares — in which case we'd pass all fields and iterate
// through every precondition. For V1 we DON'T allow skipping.
export function requestTransition(
  a: AllocationSnapshot,
  requestedStatus: AllocationStatus
): TransitionResult {
  if (!isLegalTransition(a.status, requestedStatus)) {
    return {
      ok: false,
      errors: [`Illegal transition: "${a.status}" → "${requestedStatus}". Only forward one-step transitions are allowed in V1.`],
    };
  }
  return advanceAllocation(a);
}

// Used when canceling / reversing — V1 doesn't support cancellation yet, but
// export a hook so future callers can import the same state machine.
export function isTerminal(status: AllocationStatus): boolean {
  return FORWARD[status] === null;
}

// All valid statuses, in order. For UI progress indicators.
export const ALLOCATION_STATUSES: AllocationStatus[] = [
  "planned",
  "committed",
  "signed",
  "funded",
  "issued",
];

export function statusIndex(s: AllocationStatus): number {
  return ALLOCATION_STATUSES.indexOf(s);
}
