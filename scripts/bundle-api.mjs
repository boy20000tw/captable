/**
 * Bundle every Vercel serverless entry under api/ that imports project code.
 *
 * Why: package.json is "type": "module", and Vercel's TypeScript compile keeps
 * relative imports extensionless (`../../server/db`). Node ESM can't resolve
 * those at runtime → ERR_MODULE_NOT_FOUND → FUNCTION_INVOCATION_FAILED.
 * The tRPC entry was already esbuild-bundled inline in vercel.json; this
 * script does the same for ALL api entries so /api/upload, /api/import,
 * /api/webhooks and /api/cron actually work in production (v2.67.1).
 *
 * Runs at the end of the Vercel buildCommand; rewrites each entry in place
 * (same trick as before: bundle → move back over the .ts filename so Vercel's
 * function detection is unchanged). Node built-ins and node_modules stay
 * external, so cold-start size doesn't balloon.
 */
import { build } from "esbuild";
import { readdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") && !name.startsWith("_")) out.push(p);
  }
  return out;
}

const entries = walk("api");
for (const entry of entries) {
  const tmp = entry.replace(/\.ts$/, "._bundled.js");
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: tmp,
    logLevel: "warning",
  });
  renameSync(tmp, entry);
  console.log(`[bundle-api] ${entry}`);
}
