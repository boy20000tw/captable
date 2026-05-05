/**
 * Seed Allocations for All Rounds
 * ────────────────────────────────
 * Run: source .env && npx tsx scripts/seed-all-rounds-allocations.ts
 *
 * Finds all funding rounds that have NO allocations, then creates
 * realistic demo allocations using existing investors. For completed
 * rounds, all allocations are set to "issued". For open rounds, a mix
 * of statuses is used.
 *
 * The A Round is skipped if it already has allocations (seeded by
 * seed-allocation-funnel.ts).
 *
 * Register entries for issued allocations are auto-synced by the
 * backend when the Share Register page loads.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required.");
  console.error("   Run: source .env && npx tsx scripts/seed-all-rounds-allocations.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🔍 Querying rounds and investors...\n");

  // 1. Get all funding rounds
  const rounds = await sql`
    SELECT id, name, status, "moneyRaisedNtd", "pricePerShareNtd",
           "roundDate", "shareClass"
    FROM funding_rounds
    ORDER BY "roundDate" ASC, id ASC
  `;

  if (rounds.length === 0) {
    console.log("❌ No funding rounds found.");
    return;
  }
  console.log(`Found ${rounds.length} round(s):`);
  for (const r of rounds) {
    console.log(`  id=${r.id} | ${r.name} | status=${r.status} | NT$${Number(r.moneyRaisedNtd ?? 0).toLocaleString()} | price=${r.pricePerShareNtd}`);
  }

  // 2. Get all investors (non-employee, individual or entity)
  const investors = await sql`
    SELECT id, name, "entityKind", "companyId"
    FROM investors
    WHERE "entityKind" IN ('individual', 'entity')
    ORDER BY id
  `;

  if (investors.length === 0) {
    console.log("❌ No investors found.");
    return;
  }
  const companyId = investors[0].companyId;
  console.log(`\nFound ${investors.length} investor(s) for company ${companyId}\n`);

  // 3. Check which rounds already have allocations
  const allocCounts = await sql`
    SELECT "fundingRoundId", COUNT(*) as cnt
    FROM allocations
    WHERE "companyId" = ${companyId}
    GROUP BY "fundingRoundId"
  `;
  const allocCountMap = new Map<number, number>();
  for (const ac of allocCounts) {
    allocCountMap.set(ac.fundingRoundId, Number(ac.cnt));
  }

  // 4. For each round without allocations, create them
  for (const round of rounds) {
    const existing = allocCountMap.get(round.id) ?? 0;
    if (existing > 0) {
      console.log(`⏭️  ${round.name} — already has ${existing} allocation(s), skipping`);
      continue;
    }

    const roundTarget = Number(round.moneyRaisedNtd ?? 0);
    const pricePerShare = Number(round.pricePerShareNtd ?? 0);
    const shareClass = round.shareClass || "common";
    const isCompleted = round.status === "completed";
    const roundDate = round.roundDate ? new Date(round.roundDate).toISOString().slice(0, 10) : "2026-01-01";

    if (roundTarget <= 0 || pricePerShare <= 0) {
      console.log(`⏭️  ${round.name} — no target amount or price, skipping`);
      continue;
    }

    console.log(`\n━━━ ${round.name} (id=${round.id}, target=NT$${roundTarget.toLocaleString()}, price=NT$${pricePerShare}) ━━━`);

    // Pick 3-5 investors for this round (rotate through available investors)
    // For smaller rounds, fewer investors; for larger rounds, more
    const numInvestors = roundTarget >= 50_000_000 ? 5 : roundTarget >= 20_000_000 ? 4 : 3;
    const roundInvestors = pickInvestors(investors, numInvestors, round.id);

    // Distribute the round target across investors
    const distributions = distributeAmount(roundTarget, roundInvestors.length);

    for (let i = 0; i < roundInvestors.length; i++) {
      const inv = roundInvestors[i];
      const amount = distributions[i];
      const shares = Math.floor(amount / pricePerShare);

      // For completed rounds: all issued
      // For open rounds: mix of statuses
      const status = isCompleted ? "issued" : ["planned", "committed", "signed"][i % 3];

      // Generate timeline dates relative to round date
      const baseDate = new Date(roundDate);
      const plannedAt = shiftDate(baseDate, -90 + i * 5);
      const committedAt = shiftDate(baseDate, -60 + i * 3);
      const signedAt = shiftDate(baseDate, -30 + i * 2);
      const fundedAt = shiftDate(baseDate, -14 + i);
      const issuedAt = shiftDate(baseDate, -7 + i);

      const [alloc] = await sql`
        INSERT INTO allocations (
          "companyId", "fundingRoundId", "investorId", "shareClass",
          amount, currency, "fxToNtd", "sharesAllocated", "pricePerShare",
          status,
          "plannedAt", "committedAt", "signedAt", "fundedAt", "issuedAt",
          notes,
          "createdAt", "updatedAt"
        ) VALUES (
          ${companyId}, ${round.id}, ${inv.id}, ${shareClass},
          ${amount}, 'NTD', 1, ${shares}, ${pricePerShare},
          ${status},
          ${plannedAt},
          ${["committed", "signed", "funded", "issued"].includes(status) ? committedAt : null},
          ${["signed", "funded", "issued"].includes(status) ? signedAt : null},
          ${["funded", "issued"].includes(status) ? fundedAt : null},
          ${status === "issued" ? issuedAt : null},
          ${`Demo allocation for ${round.name}`},
          NOW(), NOW()
        )
        RETURNING id
      `;
      console.log(`  ✅ [${status.padEnd(9)}] ${inv.name} — NT$${amount.toLocaleString()} / ${shares.toLocaleString()} shares (id=${alloc.id})`);
    }
  }

  // 5. Summary
  console.log("\n━━━ Final Summary ━━━");
  const totalAllocs = await sql`
    SELECT "fundingRoundId", COUNT(*) as cnt, SUM(amount)::numeric as total
    FROM allocations
    WHERE "companyId" = ${companyId}
    GROUP BY "fundingRoundId"
    ORDER BY "fundingRoundId"
  `;
  for (const row of totalAllocs) {
    const r = rounds.find((rr: any) => rr.id === row.fundingRoundId);
    console.log(`  ${r?.name ?? `Round #${row.fundingRoundId}`}: ${row.cnt} alloc(s), NT$${Number(row.total).toLocaleString()}`);
  }

  console.log("\n🎉 Done! Refresh browser. Register entries will auto-sync for issued allocations.");
}

/** Pick N investors from the list, rotating based on roundId to avoid always picking the same ones */
function pickInvestors(allInvestors: any[], count: number, roundId: number): any[] {
  const offset = (roundId * 3) % allInvestors.length;
  const picked: any[] = [];
  for (let i = 0; i < count && i < allInvestors.length; i++) {
    picked.push(allInvestors[(offset + i) % allInvestors.length]);
  }
  return picked;
}

/** Distribute totalAmount across N investors with realistic uneven splits */
function distributeAmount(total: number, count: number): number[] {
  // Weights: first investor gets largest share, rest decreasing
  const weights = [35, 25, 20, 12, 8].slice(0, count);
  const weightSum = weights.reduce((s, w) => s + w, 0);

  const amounts = weights.map((w) => {
    // Round to nearest 100,000
    return Math.round((total * w) / weightSum / 100_000) * 100_000;
  });

  // Adjust last investor to make total exact
  const currentSum = amounts.reduce((s, a) => s + a, 0);
  amounts[amounts.length - 1] += total - currentSum;

  return amounts;
}

/** Shift a date by N days, return YYYY-MM-DD string */
function shiftDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
