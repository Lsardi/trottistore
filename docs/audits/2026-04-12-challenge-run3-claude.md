# Challenge Audit Run 3 — Claude — 2026-04-12

## Scope
- Authz + compliance + code-level cross-cutting
- Verify Codex's doubts on R2-CL-05 et R2-CL-07

## Vérifications demandées par Codex

| Finding | Verdict |
|---|---|
| R2-CL-05 (newsletter confirm URL cassée) | **CONFIRMÉ BUG** — URL `/newsletter/confirm` au lieu de `/api/v1/newsletter/confirm` |
| R2-CL-07 (staff invitation 72h vs 1h) | **INVALIDÉ** — le code utilise bien `INVITATION_EXPIRY_HOURS = 72` dans admin-users/index.ts:22. Pas de mismatch. |

## Nouveaux bugs (Run 3)

### CRITIQUE (2)

| ID | Bug | Fichier:Ligne |
|---|---|---|
| R3-CL-01 | DELETE /auth/account ne supprime PAS les records NewsletterSubscriber → données persistent après demande RGPD | auth/index.ts:664-708 |
| R3-CL-02 | Campaign send ignore le statut opt-in newsletter (envoie aux UNSUBSCRIBED) | campaigns/index.ts:302-309 |

Note : R3-CL-02 reconfirme R2-12 de Codex avec preuve additionnelle.

### HIGH (3)

| ID | Bug | Fichier:Ligne |
|---|---|---|
| R3-CL-03 | Prisma : aucun pool size configuré. Default = CPU*2+1. Sous charge → pool exhaustion → 503 | database/src/client.ts:7 |
| R3-CL-04 | Pas de handler SIGTERM/SIGINT → Prisma disconnect mid-transaction si Docker kill | ecommerce/src/plugins/prisma.ts:14-16 |
| R3-CL-05 | Cron lock TTL 5min mais si job prend >5min → lock expiré → exécution concurrente | crm/index.ts:244 |

### MEDIUM (8)

| ID | Bug | Fichier:Ligne |
|---|---|---|
| R3-CL-06 | Order totalTtc : pas de CHECK >= 0 en DB | schema.prisma:413 |
| R3-CL-07 | Payment amount : pas de CHECK, peut être 0 ou NULL | schema.prisma:483 |
| R3-CL-08 | Review rating : pas de CHECK 1-5 en DB (accepte 0, 6, 999) | schema.prisma:286 |
| R3-CL-09 | lowStockThreshold : pas de CHECK >= 0 (peut être négatif) | schema.prisma:315 |
| R3-CL-10 | LoyaltyPoint points : pas de CHECK, accepte INT_MAX ou négatif extrême | schema.prisma:644 |
| R3-CL-11 | Email orderConfirmation : Number(Decimal).toFixed(2) perd la précision | orders/index.ts:702-706 |
| R3-CL-12 | Webhook DLQ entries évincées silencieusement si Redis maxmemory (pas d'alerte) | checkout/index.ts:590 |
| R3-CL-13 | SAV SMS templates : productModel interpolé sans échappement | sav/notifications/engine.ts:104-106 |

### LOW (1)

| ID | Bug | Fichier:Ligne |
|---|---|---|
| R3-CL-14 | GET /products/:slug retourne createdAt/updatedAt/IDs internes (info disclosure mineure) | products/index.ts:240-269 |

## Score Run 3

| Sévérité | Count |
|---|---|
| CRITIQUE | 2 |
| HIGH | 3 |
| MEDIUM | 8 |
| LOW | 1 |
| **Total nouveau** | **14** |
| R2-CL-07 invalidé | -1 |

## Score cumulé 3 runs — Claude

| Run | Bugs |
|---|---|
| Run 1 | 12 |
| Run 2 | 21 (-1 invalidé = 20) |
| Run 3 | 14 |
| **Total Claude** | **46** |

## Status
Non corrigés — en attente décision Lyes.
