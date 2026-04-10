export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
