import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_ROLES = new Set(["SUPERADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "STAFF"]);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value || request.headers.get("x-access-token");
  const secret = process.env.JWT_ACCESS_SECRET;
  const loginUrl = new URL("/mon-compte", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  if (!secret) {
    console.error("[admin middleware] JWT_ACCESS_SECRET missing: access denied");
    return NextResponse.redirect(loginUrl);
  }
  if (!token) return NextResponse.redirect(loginUrl);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    });
    if (typeof payload.role !== "string" || !ADMIN_ROLES.has(payload.role)) {
      return NextResponse.redirect(new URL("/mon-compte", request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = { matcher: ["/admin/:path*"] };
