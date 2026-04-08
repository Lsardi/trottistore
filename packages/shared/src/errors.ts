/**
 * Erreurs API standardisées — partagées entre tous les services.
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, `${resource} '${id}' introuvable`, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "Données invalides", "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Non authentifié") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Accès interdit") {
    super(403, message, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
  }
}

type PrismaLikeError = {
  name?: unknown;
  code?: unknown;
  meta?: unknown;
};

function isPrismaKnownRequestError(error: unknown): error is PrismaLikeError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as PrismaLikeError;
  return candidate.name === "PrismaClientKnownRequestError" && typeof candidate.code === "string";
}

function extractMetaTarget(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "resource";
  const target = (meta as { target?: unknown }).target;
  if (Array.isArray(target) && target.length > 0) return target.join(", ");
  if (typeof target === "string" && target.length > 0) return target;
  return "resource";
}

/**
 * Map Prisma known request errors to stable API errors.
 * Returns undefined when the error is not a Prisma known request error.
 */
export function mapPrismaError(error: unknown): AppError | undefined {
  if (!isPrismaKnownRequestError(error)) return undefined;

  const code = error.code as string;
  const target = extractMetaTarget(error.meta);

  switch (code) {
    case "P2000":
      return new ValidationError({ prismaCode: code, message: "Value too long for column" });
    case "P2001":
      return new NotFoundError("Resource", target);
    case "P2002":
      return new ConflictError(`Duplicate value for unique field(s): ${target}`);
    case "P2003":
      return new ValidationError({ prismaCode: code, message: "Invalid relation reference" });
    case "P2025":
      return new NotFoundError("Resource", target);
    default:
      return undefined;
  }
}

// ─── PAGINATION ────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

// ─── PARAM PARSING ─────────────────────────────────────────

/**
 * Safely extract and validate a UUID `id` from request params.
 * Returns the id string, or throws a 400 error.
 */
export function parseIdParam(params: unknown): string {
  const p = params as Record<string, unknown>;
  const id = typeof p?.id === "string" ? p.id.trim() : "";
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError({ id: "Invalid or missing UUID" });
  }
  return id;
}

/**
 * Safely extract a slug from request params.
 */
export function parseSlugParam(params: unknown): string {
  const p = params as Record<string, unknown>;
  const slug = typeof p?.slug === "string" ? p.slug.trim() : "";
  if (!slug || slug.length > 200) {
    throw new ValidationError({ slug: "Invalid or missing slug" });
  }
  return slug;
}

/**
 * Safely extract a productId from request params.
 */
export function parseProductIdParam(params: unknown): string {
  const p = params as Record<string, unknown>;
  const productId = typeof p?.productId === "string" ? p.productId.trim() : "";
  if (!productId) {
    throw new ValidationError({ productId: "Invalid or missing productId" });
  }
  return productId;
}

// ─── API RESPONSE ──────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
