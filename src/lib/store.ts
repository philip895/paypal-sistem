import { prisma } from "./db";

/**
 * This is a single-store private app: one Shopify store per deployment.
 * getCurrentStore() returns that store's row, creating no assumptions
 * about multi-tenancy.
 */
export async function getCurrentStore() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) {
    throw new Error("No store configured — run `npm run db:seed` first.");
  }
  return store;
}
