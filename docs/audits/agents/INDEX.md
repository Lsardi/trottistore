# Index agents audit — 2026-04-11

> **Audit lancé par :** Claude Opus 4.6 (1M context) en remplacement de codex (sandbox cassé / limites atteintes)
> **Méthodologie :** 10 sub-agents Explore lancés en 3 batchs parallèles, prompts améliorés avec contexte injecté
> **Résultat :** 10 rapports indépendants + cet index agrégé

## Liste des rapports

| Agent | Domaine | Fichier | Findings nouveaux |
|---|---|---|---|
| 1 | Security / Auth / RBAC | [agent-1-security-auth.md](./agent-1-security-auth.md) | 5 (1 P1 critique) |
| 2 | Stock / Orders / Checkout / SAV | [agent-2-stock-orders.md](./agent-2-stock-orders.md) | 5 (1 P1 + 4 P2) |
| 3 | CRM / Cron / Newsletter | [agent-3-crm-cron-newsletter.md](./agent-3-crm-cron-newsletter.md) | 5 (1 P1 + 4 P2/P3) |
| 4 | Build / Run / Deploy / Infra | [agent-4-build-deploy-infra.md](./agent-4-build-deploy-infra.md) | 5 (1 P1 + 4 P2) |
| 5 | DB / Scripts / Data Integrity | [agent-5-db-scripts.md](./agent-5-db-scripts.md) | 5 (3 P2 + 2 P3) |
| 6 | Frontend / UX / Accessibility | [agent-6-frontend-ux-a11y.md](./agent-6-frontend-ux-a11y.md) | 5 P2 |
| 7 | SEO / Performance | [agent-7-seo-performance.md](./agent-7-seo-performance.md) | 5 (2 P2 + 3 P3) |
| 8 | Privacy / Consent / Legal / Trust | [agent-8-privacy-legal.md](./agent-8-privacy-legal.md) | 5 (1 P1 + 1 P0 rappel + 3 P2) |
| 9 | Email / Messaging | [agent-9-email-messaging.md](./agent-9-email-messaging.md) | 5 (1 P1 critique + 4 P2/P3) |
| 10 | Reliability / Load / Ops | [agent-10-reliability-ops.md](./agent-10-reliability-ops.md) | 5 (1 P1 critique + 4 P2) |

**Total :** 50 nouveaux findings (au-delà de ce qui était déjà connu et fixé pendant la session 2026-04-11).

---

## Top findings P0/P1 critiques (à fixer en urgence)

### 🔴 P1 — Action immédiate (< 1 jour de dev cumulé)

| # | Finding | Agent | Effort | Impact |
|---|---|---|---|---|
| **A1.1** | **IDOR sur `GET /orders/:id` : MANAGER/TECHNICIAN bypass ownership** | 1 | 5 min (1 ligne) | ADMIN-only au lieu de role check faible |
| **A9.1** | **XSS dans templates email ecommerce** (interpolation `${i.name}` non échappée) | 9 | 30 min | Tous les emails transactionnels exposés |
| **A10.1** | **Alerting `probe_success` cassée** — l'alerte DB unhealthy ne se déclenche jamais | 10 | 1h | Aveugle sur les pannes DB en prod |
| **A4.1** | **`deploy-staging.yml` mauvais service naming** — staging probablement cassé | 4 | 5 min | Validation pré-prod inutilisable |
| **A3.1** | **Cron CRM sans Redis distributed lock** | 3 | 30 min | Doublons d'envois si scaling 2+ instances |
| **A2.1** | **Race condition loyaltyPoints double-attribution** | 2 | 1h (UNIQUE constraint + upsert) | Tier client incorrect, fraude potentielle |
| **A1.2** | **Brute-force trackingToken `/quote/accept-client` sans rate-limit dédié** | 1 | 15 min | Acceptation devis sans permission |
| **A1.3** | **Timing attack `/auth/forgot-password`** | 1 | 5 min | Énumération emails users |
| **A8.1** | **DPO contact = `brand.email`** (mélange RGPD et SAV) | 8 | 15 min | Demandes RGPD perdues, sanction CNIL |

**Total effort P1 : ~3-4h**

### 🔴 P0 — Bloqueurs go-live commercial (rappels)

Rappelés par les agents mais déjà connus dans `2026-04-11-go-live-readiness.md` :

- **B1** Stripe en mode TEST sur prod
- **B2** Mentions légales placeholder `[À COMPLÉTER]`
- **B3** Footer facture lit env vars non-set
- **B4** Numérotation facture non conforme art. 289 CGI
- **L5/B5** Pas d'envoi auto facture par email après paiement (Agent 8 a réaffirmé la sévérité)

---

## Findings P2 agrégés (à traiter sous 2-4 semaines)

### Sécurité / Privacy
- A1.4 XSS stocké via repair notes / visitReason / issueDescription
- A1.5 Cart Bearer fallback silencieux vers anonyme
- A8.2 Durée de conservation flou dans politique de confidentialité
- A8.3 Politique cookies incomplète (pas de liste des cookies tiers)
- A8.4 `ConsentCheckbox` utilisation non vérifiée partout

### Stock / Intégrité
- A2.2 Race condition status transitions (`fromStatus` stale)
- A2.3 Idempotence webhook Stripe fragile si `orderId` absent
- A2.4 Boucles N+1 dans cancel / refund
- A2.5 TVA divergence à 3 endroits

### Frontend / UX
- A6.1 Typos accents sur formulaire `/reparation`
- A6.2 Calcul TVA hardcodé 20% au lieu d'utiliser `tvaRate`
- A6.3 Newsletter form sans `aria-label`
- A6.4 Pas de skeleton loader cohérent panier/checkout
- A6.5 Subtotal "TTC" panier vs livraison hors TVA confusion

### CRM / Cron
- A3.2 Newsletter export CSV sans pagination ni streaming (DoS)
- A3.3 Pas de rate-limit dédié sur preview send

### DB / Scripts
- A5.1 `simulate-month.ts` exécutable sans guard NODE_ENV (risque prod)
- A5.2 `sync-woocommerce.ts` efface toutes les images à chaque sync
- A5.3 `crawl-suppliers.ts` délai REQUEST_DELAY_MS trop court

### Build / Deploy
- A4.2 Deployment sans timeout défini
- A4.3 `deploy-staging.yml` hardcoded Railway project ID
- A4.4 Healthcheck accepte HTTP 308
- A4.5 Turbo cache externe non configuré

### Email
- A9.2 Pas de plaintext fallback sur emails ecommerce
- A9.3 URLs de base / sender dispersées
- A9.4 Pas de logging / audit emails ecommerce hors SAV

### Reliability / Ops
- A10.2 Healthcheck `/health` trivial (pas de vrai check)
- A10.3 Backup DB restore jamais testé
- A10.4 Runbook ne dit pas comment détecter un incident
- A10.5 `SECURITY.md` est un template vide

### SEO
- A7.1 Robots.txt incomplet (pas de `Disallow: /admin`)
- A7.2 Canonical URLs manquantes sur catalogue filtré

---

## Findings P3 (nice-to-have)

- A3.4 Trigger error handling : `console.log/error` au lieu de `app.log`
- A3.5 Token newsletter pas hashé en DB
- A5.4 Decimal precision incohérente (10,2 vs 12,2)
- A5.5 `seed-demo.ts` hardcode `demo1234` password
- A7.3 JSON-LD Product schema sans `aggregateRating`
- A7.4 Sitemap `lastModified` systématiquement `now`
- A7.5 Meta description par défaut > 100 chars
- A9.5 Newsletter confirmation email manque plaintext

---

## Recommandations d'action

### Sprint immédiat (1-2 jours dev)

**Priorité 1 — Sécurité critique (qui aurait dû être pris dans le batch P0/P1 du jour) :**
1. A1.1 Fix IDOR `GET /orders/:id` (1 ligne, 5 min)
2. A9.1 Helper `htmlEscape()` + appliquer dans templates email (30 min)
3. A10.1 Métrique `trottistore_database_healthy` exposée + correction alerting rule (1h)
4. A1.2 Rate-limit dédié `/quote/accept-client` + hash trackingToken (1h)
5. A1.3 Timing delay `/auth/forgot-password` (5 min)
6. A8.1 `brand.dpoEmail` distinct + alias `dpo@trottistore.fr` (15 min)
7. A4.1 Fix `deploy-staging.yml` service naming (5 min)
8. A2.1 UNIQUE constraint loyaltyPoint + upsert (1h)
9. A3.1 Redis distributed lock cron CRM (30 min)

**Total : ~4-5h dev pour purger toute la dette P1 nouvelle.**

### Sprint go-live (1-2 jours dev en plus)

10. Bloqueurs P0 go-live (B1 Stripe live, B5 factures conformes) — voir [go-live-readiness.md](../2026-04-11-go-live-readiness.md)
11. Stock integrity 3 P1 codex (déjà briefé dans [stock-integrity-audit.md](../2026-04-11-stock-integrity-audit.md))

### Sprint 2 (2-4 semaines)

12. Tous les P2 listés ci-dessus, par priorité métier
13. Chantier Testcontainers S2 (cf [test-coverage-gap-analysis.md](../2026-04-11-test-coverage-gap-analysis.md))

---

## Cohérence avec les autres docs d'audit

Ces 10 rapports d'agents complètent et **enrichissent** les 6 docs Claude écrits plus tôt aujourd'hui :

- **Confirmé / déjà couvert :** la plupart des P0 go-live (Stripe live, factures, mentions légales) et les 3 P1 stock du codex audit
- **Nouveaux par les agents :** A1.1 IDOR orders (manqué !), A9.1 XSS email (manqué !), A10.1 alerting cassée (manqué !), A4.1 staging service naming (manqué !), A8.1 DPO email (manqué !), A2.1 race loyaltyPoints (manqué !), A3.1 cron lock distribué (manqué !)
- **Précisé / approfondi :** la section TVA (#A2.5 backend + A6.2 frontend), les durées de conservation (A8.2), les XSS templates email (A9.1)

**Verdict :** **les 10 sub-agents ont apporté ~9 nouveaux P1/P0 qui n'étaient pas dans mes 6 docs principaux.** L'audit codex split par domaine était une bonne idée méthodologique — un audit "généraliste" rate facilement les bugs spécialisés. À industrialiser dans un futur audit récurrent.

---

*Index généré le 2026-04-11. Pour ajouter un nouvel agent, créer `agent-N-{slug}.md` dans ce dossier et mettre à jour ce fichier.*
