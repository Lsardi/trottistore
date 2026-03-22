/**
 * Types d'authentification et RBAC — partagés entre tous les services.
 */

export const ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "STAFF",
  "CLIENT",
] as const;

export type Role = (typeof ROLES)[number];

export interface JwtAccessPayload {
  sub: string; // user ID (UUID)
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string; // refresh token ID pour révocation
  iat: number;
  exp: number;
}

// ─── PERMISSIONS PAR RÔLE ──────────────────────────────────

export type Permission =
  // E-commerce
  | "products:read"
  | "products:write"
  | "orders:read"
  | "orders:write"
  | "orders:manage"
  | "payments:read"
  | "payments:manage"
  // CRM
  | "customers:read"
  | "customers:write"
  | "campaigns:read"
  | "campaigns:write"
  | "segments:read"
  | "segments:write"
  // SAV
  | "tickets:read"
  | "tickets:write"
  | "tickets:assign"
  | "tickets:manage"
  | "technicians:read"
  | "technicians:manage"
  // Analytics
  | "analytics:read"
  | "analytics:export"
  // Admin
  | "users:read"
  | "users:write"
  | "users:manage"
  | "settings:read"
  | "settings:write";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [
    "products:read", "products:write",
    "orders:read", "orders:write", "orders:manage",
    "payments:read", "payments:manage",
    "customers:read", "customers:write",
    "campaigns:read", "campaigns:write",
    "segments:read", "segments:write",
    "tickets:read", "tickets:write", "tickets:assign", "tickets:manage",
    "technicians:read", "technicians:manage",
    "analytics:read", "analytics:export",
    "users:read", "users:write", "users:manage",
    "settings:read", "settings:write",
  ],
  ADMIN: [
    "products:read", "products:write",
    "orders:read", "orders:write", "orders:manage",
    "payments:read", "payments:manage",
    "customers:read", "customers:write",
    "campaigns:read", "campaigns:write",
    "segments:read", "segments:write",
    "tickets:read", "tickets:write", "tickets:assign", "tickets:manage",
    "technicians:read", "technicians:manage",
    "analytics:read", "analytics:export",
    "users:read",
    "settings:read",
  ],
  MANAGER: [
    "products:read", "products:write",
    "orders:read", "orders:write",
    "payments:read",
    "customers:read", "customers:write",
    "campaigns:read",
    "segments:read",
    "tickets:read", "tickets:write", "tickets:assign",
    "technicians:read",
    "analytics:read",
  ],
  TECHNICIAN: [
    "tickets:read", "tickets:write",
    "technicians:read",
    "products:read",
  ],
  STAFF: [
    "products:read",
    "orders:read", "orders:write",
    "payments:read",
    "customers:read",
    "tickets:read", "tickets:write",
  ],
  CLIENT: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => ROLE_PERMISSIONS[role].includes(p));
}
