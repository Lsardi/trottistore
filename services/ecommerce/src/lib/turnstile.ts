/**
 * Cloudflare Turnstile server-side verification.
 *
 * Bot protection for public auth endpoints (register, login, forgot-password).
 * Enforcement is opt-in: when TURNSTILE_SECRET_KEY is unset (dev/test), the
 * verifier returns `skipped`, so existing flows and tests run unchanged.
 *
 * Frontend widget site key: NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: string };

/** Whether Turnstile enforcement is active (secret configured). */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Verify a Turnstile token. Returns `{ ok: true, skipped: true }` when no
 * secret is configured so callers can treat that as a pass in dev/test.
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };

  if (!token) return { ok: false, reason: "missing-token" };

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    if (!res.ok) return { ok: false, reason: `siteverify-http-${res.status}` };

    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] || ["failed"]).join(",") };
  } catch (err) {
    return { ok: false, reason: `verify-error:${(err as Error).message}` };
  }
}
