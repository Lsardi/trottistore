import { describe, it, expect } from "vitest";
import {
  ROLES,
  hasPermission,
  hasAnyPermission,
  ROLE_PERMISSIONS,
} from "./auth.js";
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  paginate,
} from "./errors.js";

// ── RBAC / Auth ───────────────────────────────────────────────────

describe("ROLES", () => {
  it("contains 6 roles in hierarchical order", () => {
    expect(ROLES).toHaveLength(6);
    expect(ROLES).toContain("SUPERADMIN");
    expect(ROLES).toContain("CLIENT");
  });
});

describe("hasPermission", () => {
  it("grants SUPERADMIN all permissions", () => {
    expect(hasPermission("SUPERADMIN", "products:read")).toBe(true);
    expect(hasPermission("SUPERADMIN", "settings:write")).toBe(true);
    expect(hasPermission("SUPERADMIN", "users:manage")).toBe(true);
  });

  it("denies CLIENT any permission (empty list)", () => {
    expect(hasPermission("CLIENT", "products:read")).toBe(false);
    expect(hasPermission("CLIENT", "orders:read")).toBe(false);
  });

  it("grants TECHNICIAN ticket permissions but not order management", () => {
    expect(hasPermission("TECHNICIAN", "tickets:read")).toBe(true);
    expect(hasPermission("TECHNICIAN", "tickets:write")).toBe(true);
    expect(hasPermission("TECHNICIAN", "orders:write")).toBe(false);
  });

  it("grants STAFF orders:write but not orders:manage", () => {
    expect(hasPermission("STAFF", "orders:write")).toBe(true);
    expect(hasPermission("STAFF", "orders:manage")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true if role has at least one of the listed permissions", () => {
    expect(
      hasAnyPermission("TECHNICIAN", ["orders:manage", "tickets:read"]),
    ).toBe(true);
  });

  it("returns false if role has none of the listed permissions", () => {
    expect(
      hasAnyPermission("CLIENT", ["products:read", "orders:read"]),
    ).toBe(false);
  });

  it("returns false for an empty permissions list", () => {
    expect(hasAnyPermission("SUPERADMIN", [])).toBe(false);
  });
});

// ── Error classes ─────────────────────────────────────────────────

describe("AppError", () => {
  it("sets statusCode, code, and message", () => {
    const err = new AppError(418, "I am a teapot", "TEAPOT");
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("TEAPOT");
    expect(err.message).toBe("I am a teapot");
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
  });

  it("optionally includes details", () => {
    const err = new AppError(400, "Bad", "BAD", { field: "email" });
    expect(err.details).toEqual({ field: "email" });
  });
});

describe("NotFoundError", () => {
  it("creates a 404 error with resource context", () => {
    const err = new NotFoundError("User", "abc-123");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toContain("User");
    expect(err.message).toContain("abc-123");
  });
});

describe("ValidationError", () => {
  it("creates a 400 error with details", () => {
    const details = [{ field: "email", message: "required" }];
    const err = new ValidationError(details);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual(details);
  });
});

describe("UnauthorizedError", () => {
  it("defaults to 401 with a standard message", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Non authentifié");
  });

  it("accepts a custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("defaults to 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });
});

describe("ConflictError", () => {
  it("creates a 409 error", () => {
    const err = new ConflictError("Email already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});

// ── Pagination ────────────────────────────────────────────────────

describe("paginate", () => {
  it("calculates pagination metadata correctly", () => {
    const items = ["a", "b", "c"];
    const result = paginate(items, 25, { page: 2, limit: 10 });

    expect(result.data).toEqual(items);
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("sets hasNext=false on the last page", () => {
    const result = paginate(["x"], 3, { page: 3, limit: 1 });
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("sets hasPrev=false on the first page", () => {
    const result = paginate(["x", "y"], 5, { page: 1, limit: 2 });
    expect(result.pagination.hasPrev).toBe(false);
    expect(result.pagination.hasNext).toBe(true);
  });

  it("handles zero total items", () => {
    const result = paginate([], 0, { page: 1, limit: 10 });
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("handles exact page boundaries", () => {
    const result = paginate(["a", "b"], 10, { page: 5, limit: 2 });
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.hasNext).toBe(false);
  });
});
