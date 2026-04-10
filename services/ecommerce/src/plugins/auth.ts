import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Role, Permission, JwtAccessPayload } from "@trottistore/shared";
import { ROLES, hasPermission } from "@trottistore/shared";

// ─── Type augmentation ─────────────────────────────────────
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: Omit<JwtAccessPayload, "iat" | "exp">;
    user: {
      id: string;
      userId: string;
      email: string;
      role: Role;
    };
  }
}

// ─── Plugin ────────────────────────────────────────────────

export const authPlugin = fp(async (app: FastifyInstance) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET env variable is required");
  }

  // Register @fastify/cookie for refresh token cookie
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || secret,
    parseOptions: {},
  });

  // Register @fastify/jwt for access token verification
  await app.register(fjwt, {
    secret,
    sign: {
      algorithm: "HS256",
      expiresIn: "15m",
    },
    cookie: {
      cookieName: "refresh_token",
      signed: false,
    },
  });

  // Decorator: verifies access token from Authorization header
  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = await request.jwtVerify<JwtAccessPayload>();
        request.user = {
          id: payload.sub,
          userId: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      } catch (err) {
        return reply.status(401).send({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Token invalide ou expiré",
          },
        });
      }
    },
  );
});

// ─── RBAC preHandler factory ───────────────────────────────

/**
 * Creates a Fastify preHandler that checks if the authenticated user
 * has one of the required roles.
 *
 * Usage:
 *   { preHandler: [app.authenticate, requireRole('ADMIN', 'MANAGER')] }
 */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    if (!roles.includes(user.role as Role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Permissions insuffisantes",
        },
      });
    }
  };
}

/**
 * Creates a preHandler that checks if the user has one of the required permissions.
 * Uses the ROLE_PERMISSIONS matrix from @trottistore/shared.
 *
 * Usage:
 *   { preHandler: [app.authenticate, requirePermission('orders:write', 'orders:manage')] }
 */
export function requirePermission(...permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    const role = user.role as Role;
    const hasAccess = permissions.some((p) => hasPermission(role, p));

    if (!hasAccess) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Permission requise : ${permissions.join(" ou ")}`,
        },
      });
    }
  };
}
