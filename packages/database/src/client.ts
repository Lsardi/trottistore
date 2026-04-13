import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const DEFAULT_PRISMA_POOL_SIZE = 10;

function resolvePoolSize(): number {
  const raw = process.env.PRISMA_POOL_SIZE;
  if (!raw) return DEFAULT_PRISMA_POOL_SIZE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PRISMA_POOL_SIZE;
  return parsed;
}

function withConnectionLimit(databaseUrl: string, poolSize: number): string {
  // Respect an explicit connection_limit already present in the URL.
  if (/connection_limit=/i.test(databaseUrl)) return databaseUrl;

  try {
    const url = new URL(databaseUrl);
    url.searchParams.set("connection_limit", String(poolSize));
    return url.toString();
  } catch {
    const separator = databaseUrl.includes("?") ? "&" : "?";
    return `${databaseUrl}${separator}connection_limit=${poolSize}`;
  }
}

const configuredDatabaseUrl = process.env.DATABASE_URL
  ? withConnectionLimit(process.env.DATABASE_URL, resolvePoolSize())
  : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(configuredDatabaseUrl
      ? { datasources: { db: { url: configuredDatabaseUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export default prisma;
