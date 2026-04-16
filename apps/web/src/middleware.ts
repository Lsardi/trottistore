import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware — runs BEFORE every matching request.
 *
 * Protects /admin/* routes by checking the JWT access token.
 * The token is read from the `accessToken` cookie (set by the frontend
 * after login) and decoded (base64, no signature check — Edge has no
 * access to JWT_ACCESS_SECRET). We only check the `role` claim.
 *
 * This replaces the unreliable client-side useEffect guard that was
 * causing redirect loops due to race conditions and rate-limiting.
 */

const ADMIN_ROLES = new Set(["SUPERADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "STAFF"]);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Try cookie first, then Authorization header (for API-like requests)
  const token =
    request.cookies.get("accessToken")?.value ||
    request.headers.get("x-access-token") ||
    null;

  if (!token) {
    const loginUrl = new URL("/mon-compte", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    const loginUrl = new URL("/mon-compte", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check role
  const role = payload.role as string | undefined;
  if (!role || !ADMIN_ROLES.has(role)) {
    // Not an admin — redirect to customer dashboard
    return NextResponse.redirect(new URL("/mon-compte", request.url));
  }

  // Check expiry
  const exp = payload.exp as number | undefined;
  if (exp && exp * 1000 < Date.now()) {
    const loginUrl = new URL("/mon-compte", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
