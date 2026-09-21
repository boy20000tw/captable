import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// v2.68: DATABASE_URL points at self-hosted Postgres (Zeabur Tokyo). drizzle-kit
// connects with the `postgres` (postgres-js) driver from dependencies. The server
// has TLS on with a self-signed cert, so require TLS but skip CA verification
// unless the URL says otherwise.
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: /sslmode=disable/.test(connectionString) ? false : { rejectUnauthorized: false },
  },
});
