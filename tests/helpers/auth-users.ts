import type { FastifyInstance } from "fastify";

/** Existing route tests use active accounts; keep auth reads separate from route fixtures. */
export function mockActiveAuthUsers(app: FastifyInstance): void {
  let account: { id: string; role: string; status: string; tokenVersion: number } | null = null;
  if (!app.hasDecorator("prisma")) app.decorate("prisma", {});
  if (app.hasDecorator("redis")) {
    const get = app.redis.get;
    app.redis.get = new Proxy(get, {
      apply(target, thisArg, args: [string]) {
        if (args[0].startsWith("auth:user:")) return Promise.resolve(null);
        return Reflect.apply(target, thisArg, args);
      },
    });
  }
  const database = app.prisma;
  const userDelegate = database.user ?? {};
  const findUnique = userDelegate.findUnique ?? (() => Promise.resolve(null));
  const authFindUnique = new Proxy(findUnique, {
    apply(target, thisArg, args: [{ select?: { tokenVersion?: boolean } }]) {
      if (args[0].select?.tokenVersion) return Promise.resolve(account);
      return Reflect.apply(target, thisArg, args);
    },
  });
  Object.defineProperty(database, "user", {
    configurable: true,
    value: new Proxy(userDelegate, {
      get(target, key, receiver) {
        return key === "findUnique" ? authFindUnique : Reflect.get(target, key, receiver);
      },
    }),
  });
  app.addHook("onRequest", async (request) => {
    account = null;
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const payload = app.jwt.verify<{ sub: string; role: string }>(header.slice(7));
        account = { id: payload.sub, role: payload.role, status: "ACTIVE", tokenVersion: 0 };
      } catch { /* Invalid tokens are rejected by the real auth plugin. */ }
    }
  });
}
