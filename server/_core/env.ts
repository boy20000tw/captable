export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? "",
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
