# A1-02: accessToken in localStorage

## Risk

The JWT access token is stored in `localStorage`, which exposes it to any XSS vulnerability in the application. An attacker who injects JavaScript can steal the token and impersonate the user.

## Current mitigations

- Access token is short-lived (15 min default)
- Refresh token is in an httpOnly cookie (not accessible via JS)
- CSP headers limit script sources
- Email templates use `esc()` to prevent stored XSS (CL-03 fix)

## Recommended migration (future)

Move the access token to an httpOnly cookie:
1. Set `accessToken` as `httpOnly; Secure; SameSite=Strict` cookie alongside the refresh token
2. Remove `localStorage.getItem("accessToken")` from `apps/web/src/lib/api.ts`
3. The browser will automatically send the cookie on same-origin requests
4. Update CORS to not require `Authorization` header

This is a medium-effort change affecting `api.ts`, `auth/index.ts`, and all admin/client pages that read the token directly.

## Decision

Accepted as P2 risk — short token lifetime + refresh rotation + no known XSS vectors limit exploitability. Scheduled for the auth hardening sprint.
