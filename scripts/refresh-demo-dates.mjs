// One-off / manual run of the Demo Room date refresh against DATABASE_URL in .env
//   node scripts/refresh-demo-dates.mjs            (uses DEMO_COMPANY_IDS or company 1)
// Node ≥ 22.18 strips TS types natively, so server/demo-refresh.ts is imported directly.
import fs from "node:fs";
if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const { refreshAllDemoCompanies } = await import("../server/demo-refresh.ts");
const results = await refreshAllDemoCompanies(process.env.DATABASE_URL);
console.log(JSON.stringify(results, null, 2));
