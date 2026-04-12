# Tickets — 67 bugs (Challenge Audit 3 runs)

Priorisés par sévérité. Split recommandé : Codex (code), Claude (docs/config/infra).

---

## P0 — CRITIQUE (7 tickets)

| # | Bug | Source | Fichier | Assigné |
|---|---|---|---|---|
| T-01 | TVA hardcodée 20% — ignore tvaRate par produit. Totaux commande/checkout faux. | C2 | orders/index.ts + checkout/index.ts | Codex |
| T-02 | ADMIN peut créer/promouvoir un SUPERADMIN (escalation verticale) | R3-06 | admin-users/index.ts:21,50,183,263 | Codex |
| T-03 | POST /customers/merge permet fusionner des comptes backoffice (pas limité CLIENT) | R3-02 | customers/index.ts:637-653 | Codex |
| T-04 | STAFF/TECHNICIAN peut bannir n'importe quel utilisateur via PUT /customers/:id/status | R3-01 | customers/index.ts:595-618 | Codex |
| T-05 | DELETE /auth/account ne supprime PAS les records NewsletterSubscriber (RGPD art. 17) | R3-CL-01 | auth/index.ts:664-708 | Codex |
| T-06 | Campaign send ignore le statut opt-in newsletter → envoie aux UNSUBSCRIBED (RGPD) | R2-12 / R3-CL-02 | campaigns/index.ts:302-309 | Codex |
| T-07 | Guest login bcrypt crash — passwordHash invalide → 500 si guest tente login direct | C1 | orders/index.ts:908 + auth/index.ts:254 | Codex |

## P1 — HIGH (14 tickets)

| # | Bug | Source | Fichier | Assigné |
|---|---|---|---|---|
| T-08 | CLIENT peut modifier disponibilité technicien (PUT /technicians/:id/availability) | R2-04 | technicians/index.ts:116-141 | Codex |
| T-09 | CLIENT peut lire roster technicien + schedules | R2-05 | technicians/index.ts:18-114 | Codex |
| T-10 | CLIENT peut lire stats SAV business (coûts, KPIs) | R2-06 | stats/index.ts:7-99 | Codex |
| T-11 | CRM envoi campagne ouvert à tous les non-CLIENT (pas ADMIN+ only) | R3-04 | campaigns/index.ts:266 | Codex |
| T-12 | CRM écriture segments ouverte à tous les non-CLIENT | R3-03 | segments/index.ts:76,99 | Codex |
| T-13 | CRM export newsletter accessible sans RBAC fin | R3-05 | newsletter/index.ts:156,224 | Codex |
| T-14 | STAFF peut créer des triggers (escalation privilège) | R2-11 | triggers/index.ts:67-74 | Codex |
| T-15 | Refund sur commande PENDING (pas de validation state machine) | M1 | orders/index.ts:1827 | Codex |
| T-16 | Refund non borné au montant commande (amount > totalTtc → 502) | M2 | orders/index.ts:1757,1804 | Codex |
| T-17 | Facture PDF affiche TVA du 1er item uniquement (multi-taux faux) | M3 | admin-invoices/index.ts:123 | Codex |
| T-18 | RGPD suppression : interactions supprimées avec profile.id au lieu de user.id | R3-08 | auth/index.ts:682 | Codex |
| T-19 | Guest checkout double-compte totalOrders/totalSpent (webhook ré-incrémente) | R3-09 | orders/index.ts:918-924 + checkout/index.ts:782-783 | Codex |
| T-20 | Prisma : aucun pool size configuré → pool exhaustion sous charge | R3-CL-03 | database/src/client.ts:7 | Codex |
| T-21 | Pas de handler SIGTERM → Prisma disconnect mid-transaction au restart | R3-CL-04 | plugins/prisma.ts:14-16 | Claude |

## P2 — MEDIUM (24 tickets)

| # | Bug | Source | Fichier | Assigné |
|---|---|---|---|---|
| T-22 | /admin/equipe pas dans le sidebar (page orpheline) | B1 | layout.tsx:23-34 | Claude |
| T-23 | /admin/parametres pas dans le sidebar | B2 | layout.tsx:23-34 | Claude |
| T-24 | Pas de settingsApi dans lib/api.ts (raw fetch) | B3 | parametres/page.tsx:30,59 | Claude |
| T-25 | Pas de adminUsersApi dans lib/api.ts (raw fetch) | B4 | equipe/page.tsx:61 | Claude |
| T-26 | Settings admin pas reflétées dans mentions légales + factures | B5 | parametres + mentions-legales + admin-invoices | Claude |
| T-27 | Rewrite missing /api/v1/addresses | R2-01 | next.config.ts | Claude |
| T-28 | Rewrite missing /api/v1/leads/pro + /api/v1/stock-alerts | R2-02 | next.config.ts | Claude |
| T-29 | Rewrite missing /api/v1/reviews | R2-03 / R2-CL-17 | next.config.ts | Claude |
| T-30 | Newsletter confirm URL cassée (/newsletter/confirm au lieu de /api/v1/...) | R2-CL-05 | newsletter/index.ts:29 | Codex |
| T-31 | orderConfirmationEmail utilise adresse actuelle DB, pas celle sauvée sur la commande | R2-CL-06 | orders/index.ts:708 | Codex |
| T-32 | Appointment booking race condition (count non transactionnel) | R2-CL-08 / R2-08 | tickets/index.ts:461-476 | Codex |
| T-33 | POST /appointments accepte dates dans le passé | R2-CL-02 / R2-09 | tickets/index.ts:454-476 | Codex |
| T-34 | Timezone mismatch slots vs booking (parisLocalDate vs atParisTime) | R2-CL-03 | tickets/index.ts:421,458 | Codex |
| T-35 | POST /admin/orders ne send pas de confirmation email | R2-CL-09 | orders/index.ts:1963-2100 | Codex |
| T-36 | POST /admin/orders ne crée pas de FinancialLedger entry | R2-CL-10 | orders/index.ts:2050-2097 | Codex |
| T-37 | Stock alerts jamais envoyées (feature fantôme) | R2-CL-11 | leads/index.ts:56-136 | Codex |
| T-38 | SAV audit log spoofing : performedBy injectable depuis body | R2-10 | tickets/index.ts:57-60,640-647 | Codex |
| T-39 | Trigger idempotence non atomique (pas de UNIQUE triggerId+ticketId) | R2-13 | triggers/index.ts:219-223 | Codex |
| T-40 | SAV priority sort après pagination (résultats incohérents) | R2-07 | tickets/index.ts:312-318 | Codex |
| T-41 | Commande manuelle DELIVERY avec adresses vides {} | R3-10 | orders/index.ts:1981,2060-2061 | Codex |
| T-42 | deploy.sh health check port 3001 pour tous les services | R3-11 | deploy.sh:27 | Claude |
| T-43 | Invoice number gaps si ordre supprimé (CGI art. 289) | M4 | admin-invoices/index.ts:56 | Codex |
| T-44 | Cron lock TTL 5min — job >5min → double exécution | R3-CL-05 | crm/index.ts:244 | Codex |
| T-45 | Checkout silent auth downgrade → guest sans avertissement | U1 | checkout/page.tsx:133-154 | Claude |

## P3 — MINOR (22 tickets)

| # | Bug | Source | Fichier | Assigné |
|---|---|---|---|---|
| T-46 | SIRET sans validation format 14 chiffres | U2 | parametres/page.tsx:132 | Claude |
| T-47 | SUPERADMIN dans labels mais pas dans select création | U3 | equipe/page.tsx:177-182 | Claude |
| T-48 | Homepage ISR 120s → produit archivé visible 2 min | U4 | page.tsx:55 | Claude |
| T-49 | Checkout pas de validation cart vide côté front | U5 | checkout/page.tsx:255 | Claude |
| T-50 | RCS annoncé dans commentaire facture mais pas affiché | U6 | admin-invoices/index.ts:9,23 | Claude |
| T-51 | Newsletter double opt-in sauté si email send fail | R2-CL-04 | newsletter/index.ts:69-70 | Codex |
| T-52 | Guest profile creation error swallowed .catch(() => {}) | R2-CL-13 | orders/index.ts:927 | Codex |
| T-53 | Cron lock cleanup .catch(() => {}) | R2-CL-14 | crm/index.ts:258 | Codex |
| T-54 | Checkout tests mock float au lieu de Decimal | R2-CL-15 | checkout.integration.test.ts:74 | Claude |
| T-55 | Merchant feed link assume /produits/:slug | R2-CL-16 | merchant/index.ts:101 | Claude |
| T-56 | Duplicate rewrite /api/v1/checkout | R2-CL-18 | next.config.ts:29-30 | Claude |
| T-57 | passwordResetEmail hardcode "1 heure" | R2-CL-19 | templates.ts:141 | Claude |
| T-58 | Pas de flow re-subscribe newsletter | R2-CL-20 | newsletter/index.ts:125-154 | Codex |
| T-59 | ClickHouse pas dans depends_on analytics | R2-CL-21 | docker-compose.prod.yml | Claude |
| T-60 | Order totalTtc pas de CHECK >= 0 | R3-CL-06 | schema.prisma:413 | Codex |
| T-61 | Payment amount pas de CHECK | R3-CL-07 | schema.prisma:483 | Codex |
| T-62 | Review rating pas de CHECK 1-5 | R3-CL-08 | schema.prisma:286 | Codex |
| T-63 | lowStockThreshold pas de CHECK >= 0 | R3-CL-09 | schema.prisma:315 | Codex |
| T-64 | LoyaltyPoint points pas de CHECK overflow | R3-CL-10 | schema.prisma:644 | Codex |
| T-65 | Email Number(Decimal).toFixed(2) perd précision | R3-CL-11 | orders/index.ts:702-706 | Codex |
| T-66 | Webhook DLQ évincé silencieusement si Redis plein | R3-CL-12 | checkout/index.ts:590 | Claude |
| T-67 | SAV SMS productModel interpolé sans échappement | R3-CL-13 | engine.ts:104-106 | Codex |

---

## Répartition

| Assigné | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Codex | 7 | 12 | 14 | 12 | **45** |
| Claude | 0 | 1 | 7 | 9 | **17** |
| Équipe | 0 | 1 | 3 | 1 | **5** |
| **Total** | **7** | **14** | **24** | **22** | **67** |
