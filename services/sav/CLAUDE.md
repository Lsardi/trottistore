# Service: SAV (After-Sales)

Port 3004. Repair tickets, appointments, technician management, notifications.

## Test

```bash
pnpm test:project sav
```

## Routes (/api/v1)

Hybrid auth: some endpoints are public (guest repair intake), others require JWT.

| Route | Auth | Description |
|-------|------|-------------|
| POST /repairs | public | Create repair ticket (guest or authenticated) |
| GET /repairs/tracking/:token | public | Track repair status |
| GET /appointments/slots | public | Available appointment slots |
| POST /appointments | public | Book appointment |
| PUT /**/quote/accept-client | public | Accept quote |
| Everything else | required | List/update tickets, technicians, stats |

## Repair status machine

```
RECU → DIAGNOSTIC → DEVIS_ENVOYE → DEVIS_ACCEPTE → EN_REPARATION → EN_ATTENTE_PIECE → PRET → RECUPERE
                                  → REFUS_CLIENT
                   → IRREPARABLE
```

Transitions validated in `utils/status-machine.ts`. Don't skip states.

## Key patterns

- Ticket types: GARANTIE, REPARATION, RETOUR, RECLAMATION
- Priority: LOW, NORMAL, HIGH, URGENT
- Notification engine in `notifications/engine.ts` (email via Nodemailer/Brevo)
- Quote generation with parts + labor cost

## Env vars

SMTP_HOST (optional, defaults to localhost:1025 for Mailpit). BREVO_API_KEY (optional).
