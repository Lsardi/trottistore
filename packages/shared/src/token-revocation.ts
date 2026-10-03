import type { JwtAccessPayload } from "./auth.js";

interface AuthUser {
  id: string;
  status: string;
  role: string;
  tokenVersion: number;
}
interface AuthStore {
  prisma: { user: { findUnique(args: {
    where: { id: string };
    select: { id: true; status: true; role: true; tokenVersion: true };
  }): Promise<AuthUser | null> } };
  redis?: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, expiry: "EX", seconds: number): Promise<unknown>;
    del(key: string): Promise<unknown>;
  };
}

export async function validateAccessUser(app: AuthStore, payload: JwtAccessPayload): Promise<AuthUser | null> {
  const key = `auth:user:${payload.sub}`;
  let user: AuthUser | null = null;
  try {
    const cached = await app.redis?.get(key);
    if (cached) user = JSON.parse(cached) as AuthUser;
  } catch { /* Redis unavailable: read the database. */ }
  if (!user) {
    user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, role: true, tokenVersion: true },
    });
    if (user) {
      try { await app.redis?.set(key, JSON.stringify(user), "EX", 60); }
      catch { /* Authentication remains available without Redis. */ }
    }
  }
  return user && user.id === payload.sub && user.status === "ACTIVE"
    && Number.isInteger(payload.tokenVersion) && user.tokenVersion === payload.tokenVersion
    && user.role === payload.role ? user : null;
}

export async function invalidateAccessUser(app: Pick<AuthStore, "redis">, id: string): Promise<void> {
  // A failed deletion must be visible to callers; cached entries expire after 60 seconds.
  await app.redis?.del(`auth:user:${id}`);
}
