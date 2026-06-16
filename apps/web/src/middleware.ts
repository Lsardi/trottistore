import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware.
 *
 * 1. Emits a per-request **nonce-based Content-Security-Policy** so inline
 *    scripts no longer need `'unsafe-inline'`. The nonce is forwarded to the
 *    render via the `x-nonce` request header (read by the root layout) and Next
 *    automatically applies it to its own bootstrap scripts.
 * 2. Protects /admin/* routes by checking the JWT access token, read from the
 *    httpOnly `access_token` cookie (set by the API on login/refresh). Edge runs
 *    server-side so it can read httpOnly cookies; we only decode the `role`
 *    claim (no signature check — secret not available at the edge).
 */

const ADMIN_ROLES = new Set(["SUPERADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "STAFF"]);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Generate a base64 nonce using the Edge-available Web Crypto API. */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // strict-dynamic: trust scripts loaded by nonce'd scripts; host allowlist is
    // kept as a CSP1 fallback. 'unsafe-eval' allowed only in dev (React refresh).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind/Radix emit inline styles — keep unsafe-inline for style-src only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.trottistore.fr https://wattiz.fr https://www.wattiz.fr",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://*.sentry.io",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. CSP nonce ──────────────────────────────────────────
  const nonce = makeNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  // ── 2. Admin route protection ────────────────────────────
  if (pathname.startsWith("/admin")) {
    const token =
      request.cookies.get("access_token")?.value ||
      request.cookies.get("accessToken")?.value ||
      request.headers.get("x-access-token") ||
      null;

    const redirectToLogin = () => {
      const loginUrl = new URL("/mon-compte", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    };

    if (!token) return redirectToLogin();

    const payload = decodeJwtPayload(token);
    if (!payload) return redirectToLogin();

    const role = payload.role as string | undefined;
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.redirect(new URL("/mon-compte", request.url));
    }

    const exp = payload.exp as number | undefined;
    if (exp && exp * 1000 < Date.now()) return redirectToLogin();
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|map)$).*)",
  ],
};
