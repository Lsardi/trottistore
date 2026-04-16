# Email Architecture

## Current state

All transactional emails are **fire-and-forget** — sent via `sendEmail()` with `.catch()` error logging.
There is no persistent email status tracking (PENDING/SENT/FAILED) in the database.

## Sender addresses

| Service | Sender | Env var | Fallback |
|---------|--------|---------|----------|
| Ecommerce (orders, auth, invoices) | `commandes@trottistore.fr` | — | From `@trottistore/shared/notifications` default |
| SAV (repair notifications, quotes) | `sav@trottistore.fr` | `BREVO_SENDER_EMAIL` | Hardcoded in `services/sav/src/notifications/engine.ts` |
| CRM (campaigns) | `marketing@trottistore.fr` | — | Hardcoded in `services/crm/src/routes/campaigns/index.ts` |
| CRM (newsletter) | Uses shared sendEmail | — | Same as ecommerce |
| RGPD (DPO contact) | `dpo@trottistore.fr` | `DPO_EMAIL` | In RGPD export document |

## Risks

- **A9-01**: Failed email sends are only logged, never retried or tracked. A customer may never receive their order confirmation or invoice.
- **A9-02**: Three different sender addresses across services. SPF/DKIM must cover all of them.

## Recommended improvements

1. **Short-term**: Ensure all `sendEmail()` calls log success/failure with orderId/ticketId for traceability.
2. **Medium-term**: Add an `email_log` table (recipient, subject, status, sentAt, error) and write to it on every send attempt.
3. **Long-term**: Unify senders under a single domain with Brevo sub-accounts or routing rules.

## Transport

- **Production**: Brevo API (`BREVO_API_KEY` env var). Falls back to SMTP if configured.
- **Dev/Staging**: Mailpit (localhost:1025) — captures all emails without sending.
