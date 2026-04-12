# Challenge Audit Run 2 — Claude — 2026-04-12

## Scope
- Angles : email content, loyalty edge cases, newsletter flow, appointments, admin orders, stock alerts, merchant feed, config/infra, test gaps
- Bugs non présents dans Run 1

## Findings (21 bugs)

### MAJEUR (7)

| ID | Bug | Fichier:Ligne | Impact |
|---|---|---|---|
| R2-CL-01 | UNIQUE constraint LoyaltyPoint permet unlimited ADJUSTMENT avec NULL referenceId (SQL NULL≠NULL) | schema.prisma (loyalty_points) | Admin peut créer des points infinis |
| R2-CL-02 | POST /appointments accepte des dates dans le passé (pas de validation startsAt > now) | tickets/index.ts:454-476 | RDV hier possible |
| R2-CL-03 | Timezone mismatch : parisLocalDate() pour slots vs atParisTime() pour booking | tickets/index.ts:421,458 | Slots et bookings décalés |
| R2-CL-04 | Newsletter double opt-in sauté si email send fail → subscriber confirmé sans clic | newsletter/index.ts:69-70 | Violation RGPD |
| R2-CL-05 | Confirmation URL newsletter pointe vers /newsletter/confirm au lieu de /api/v1/newsletter/confirm | newsletter/index.ts:29 | Lien cassé, impossible de confirmer |
| R2-CL-06 | orderConfirmationEmail utilise l'adresse actuelle DB, pas l'adresse sauvée sur la commande | orders/index.ts:708 | Mauvaise adresse dans l'email |
| R2-CL-07 | staffInvitationEmail promet 72h mais token créé avec PASSWORD_RESET_EXPIRY_HOURS (1h) | templates.ts:168 + admin-users/index.ts | Invitation expire avant l'heure annoncée |

### MOYEN (9)

| ID | Bug | Fichier:Ligne | Impact |
|---|---|---|---|
| R2-CL-08 | Race condition booking : count() non transactionnel, double-book possible | tickets/index.ts:461-476 | Deux clients sur le même créneau |
| R2-CL-09 | POST /admin/orders ne send pas de confirmation email au client | orders/index.ts:1963-2100 | Client pas notifié de la commande manuelle |
| R2-CL-10 | POST /admin/orders ne crée pas d'entrée FinancialLedger | orders/index.ts:2050-2097 | Audit trail financier incomplet |
| R2-CL-11 | POST /stock-alerts stocke l'alerte mais aucun worker ne les traite | leads/index.ts:56-136 | Feature fantôme — alertes jamais envoyées |
| R2-CL-12 | Review approval awards points silencieusement ignoré si pas de customerProfile | reviews/index.ts:272-295 | Récompense perdue sans trace |
| R2-CL-13 | Guest profile creation error swallowed (.catch(() => {})) | orders/index.ts:927 | CRM incomplet silencieusement |
| R2-CL-14 | Cron lock cleanup .catch(() => {}) → lock peut rester si Redis flaky | crm/index.ts:258 | Triggers bloqués |
| R2-CL-15 | Checkout tests mock prix en float au lieu de Decimal | checkout.integration.test.ts:74 | Decimal math pas réellement testée |
| R2-CL-16 | Merchant feed link assume /produits/:slug — peut être 404 | merchant/index.ts:101 | Google Merchant feed cassé |

### MINEUR (5)

| ID | Bug | Fichier:Ligne | Impact |
|---|---|---|---|
| R2-CL-17 | Missing /api/v1/reviews rewrite dans next.config.ts | next.config.ts | Reviews 404 côté browser |
| R2-CL-18 | Duplicate rewrite /api/v1/checkout dans next.config.ts | next.config.ts:29-30 | Dead code |
| R2-CL-19 | passwordResetEmail hardcode "1 heure" mais constante configurable | templates.ts:141 | Fragile |
| R2-CL-20 | Pas de flow re-subscribe après unsubscribe newsletter | newsletter/index.ts:125-154 | UX friction |
| R2-CL-21 | ClickHouse pas dans depends_on analytics | docker-compose.prod.yml:96-119 | Fail silencieux |

## Dead code confirmé
- Shipment model : jamais utilisé (schema.prisma:524)
- ProductRanking model : jamais utilisé (schema.prisma:557)

## Status
Non corrigés — en attente décision Lyes.
