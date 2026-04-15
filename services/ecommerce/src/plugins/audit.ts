import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Admin audit middleware — writes one row in shared.audit_logs for every
// mutating request against /api/v1/admin/* (POST, PUT, PATCH, DELETE).
// Runs as an onResponse hook so we capture the final status code.
// Failures inside the audit pipeline must NEVER block the actual response.

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Field names we redact before storing the request body in details.
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "stripeSecretKey",
  "authorization",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

// Extract "resource" and "resourceId" from a URL like
//   /api/v1/admin/orders/123e4567-.../tracking
// → resource: "orders", resourceId: "123e4567-..."
function parseResourceFromUrl(url: string): { resource: string; resourceId: string | null } {
  const path = url.split("?")[0];
  const match = path.match(/^\/api\/v1\/admin\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return { resource: "unknown", resourceId: null };
  const resource = match[1] ?? "unknown";
  const secondSegment = match[2] ?? null;
  const looksLikeId =
    secondSegment !== null &&
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secondSegment) ||
      /^\d+$/.test(secondSegment));
  return {
    resource,
    resourceId: looksLikeId ? secondSegment : null,
  };
}

async function writeAudit(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { resource, resourceId } = parseResourceFromUrl(request.url);
    const user = request.user;
    const bodyMeta =
      request.body && typeof request.body === "object"
        ? redact(request.body)
        : null;

    const details = JSON.stringify({
      method: request.method,
      path: request.url.slice(0, 500),
      statusCode: reply.statusCode,
      userAgent: (request.headers["user-agent"] ?? "").slice(0, 500) || null,
      body: bodyMeta,
    }).slice(0, 4000); // hard cap to keep details column bounded

    await app.prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user ? `${user.email} (${user.role})`.slice(0, 200) : null,
        action: request.method,
        resource,
        resourceId,
        details,
        ipAddress: request.ip,
      },
    });
  } catch (err) {
    app.log.warn({ err }, "admin audit log write failed");
  }
}

export const auditPlugin = fp(async (app: FastifyInstance) => {
  app.addHook("onResponse", async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    if (!request.url.startsWith("/api/v1/admin/")) return;
    await writeAudit(app, request, reply);
  });
});
