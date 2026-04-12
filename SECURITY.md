# Security Policy — TrottiStore

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

- **Email**: dpo@trottistore.fr
- **Response time**: We aim to acknowledge within 48 hours
- **Do NOT** open a public GitHub issue for security vulnerabilities

## Supported Versions

| Version | Supported |
|---|---|
| main (latest) | Yes |
| Older branches | No |

## Security Measures

### Authentication
- JWT access tokens (15min expiry, HS256)
- Refresh token rotation with reuse detection
- Bcrypt password hashing (12 rounds)
- Rate-limiting on auth endpoints (register 5/min, login 10/min, forgot-password 3/15min)
- Timing-attack prevention on forgot-password (constant-time jitter)

### Authorization
- 6-role RBAC (SUPERADMIN, ADMIN, MANAGER, TECHNICIAN, STAFF, CLIENT)
- Permission-based access control (requireRole + requirePermission middleware)
- IDOR protection on all resource endpoints

### Data Protection
- All passwords hashed with bcrypt
- Refresh tokens stored as SHA-256 hashes
- Password reset tokens: single-use, 1h expiry, hashed storage
- RGPD: data export + account deletion endpoints
- Separate DPO contact (dpo@trottistore.fr)

### Infrastructure
- Helmet HTTP headers (HSTS, X-Frame-Options, CSP)
- Rate limiting (100 req/min global, per-endpoint on sensitive routes)
- Input validation via Zod on all route handlers
- XSS prevention: sanitize-html + DOMPurify on product HTML, esc() on email templates
- Stripe webhook signature verification
- Redis distributed locks for cron jobs (prevent duplicate execution)

### Monitoring
- Prometheus metrics for payment failures, webhook errors, checkout errors
- Alerting: ServiceDown, PaymentFailureSpike, WebhookProcessingError, DatabaseUnhealthy
- Financial reconciliation (orders vs payments vs Stripe)
- Audit trail (AuditLog + FinancialLedger append-only)

## Dependency Management

- pnpm audit run in CI (Security Scan job)
- Gitleaks secret scanning on every PR
- Semgrep SAST rules for TrottiStore-specific patterns
