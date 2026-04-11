import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JwtAccessPayload, Role } from "@trottistore/shared";
import { ROLES } from "@trottistore/shared";

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
