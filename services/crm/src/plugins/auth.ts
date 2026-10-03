import { validateAccessUser } from "@trottistore/shared";
import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JwtAccessPayload, Role, Permission } from "@trottistore/shared";
import { ROLES, hasPermission } from "@trottistore/shared";

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
    payload: JwtAccessPayload;
    user: {
      id: string;
      userId: string;
      email: string;
      role: Role;
    };
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET env variable is required");
  }

  await app.register(fjwt, {
    secret,
    sign: { algorithm: "HS256", expiresIn: "15m" },
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = await request.jwtVerify<JwtAccessPayload>();
        if (!ROLES.includes(payload.role)) {
          return reply.status(401).send({
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Role invalide dans le token",
            },
          });
        }
        const currentUser = await validateAccessUser(app, payload);
        if (!currentUser) {
          return reply.status(401).send({
            success: false,
            error: { code: "TOKEN_REVOKED", message: "Session révoquée — reconnectez-vous" },
          });
        }
        request.user = {
          id: payload.sub,
          userId: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      } catch {
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
