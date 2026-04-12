# Changelog — TrottiStore

## [Unreleased] — 2026-04-12

### Security
- **TVA per-item** — calcul TVA par produit au lieu de 20% hardcodé (#150)
- **RBAC SAV** — CLIENT ne peut plus accéder aux techniciens, stats, disponibilité (#150)
- **RBAC CRM** — Customer status/merge restreints à ADMIN+, campaign send filtre opt-in newsletter (#150)
- **SUPERADMIN escalation** — ADMIN ne peut plus créer/promouvoir un SUPERADMIN (#149)
- **Guest bcrypt crash** — passwordHash null au lieu de faux hash (#149)
- **Refund PENDING bloqué** — impossible de rembourser une commande non payée (#149)
- **Refund clampé** — montant remboursement plafonné au total commande (#149)
- **XSS email** — helper esc() appliqué à tous les templates (#130)
- **Timing attack** — délai constant sur forgot-password (#129)
- **Auth hardening** — COOKIE_SECRET obligatoire, logout-all, RBAC smoke tests (#136)
- **Checkout idempotence** — Redis NX lock, Decimal precision, webhook status guard (#137)
- **Fulfillment state machine** — transitions strictes, refund/cancel idempotency (#138)
- **Stock integrity** — guard atomique sur SAV parts, stock movements, double-restock (#144)
- **Rate-limits** — forgot-password 3/15min, quote accept 5/15min, reviews 5/min, newsletter 5/min (#143, #144)
- **Loyalty idempotence** — UNIQUE constraint + findFirst avant create (#143)
- **Cron distributed lock** — Redis NX lock empêche double-exécution (#143)

### RGPD
- **DELETE account** — supprime newsletter subscribers, reviews, interactions, loyalty (#150)
- **Campaign opt-in** — envoi uniquement aux abonnés CONFIRMED (#150)
- **DPO email** — séparé de l'email SAV dans brand config (#143)

### Features
- **Admin settings panel** — /admin/parametres pour éditer infos légales depuis le back-office (#147)
- **Admin équipe** — /admin/equipe pour gérer les employés (invitation email, rôles, suspension) (#148)
- **Mentions légales** — lues depuis DB (admin-editable) avec fallback env vars (#146)
- **Invoice conforme CGI** — numérotation séquentielle FAC-2026-000001, RCS dans footer (#144, #149)
- **Reviews** — système complet (model, 7 routes, page dynamique, fiche produit, modération) (#86)
- **Password reset** — flow complet (model, routes, email, 2 pages frontend) (#86)
- **Profil éditable** — PUT /auth/profile + formulaire inline (#86)
- **Adresses CRUD** — composant AddressSection (create/edit/delete) (#86)
- **Loyalty auto** — points sur achat + tier (BRONZE/SILVER/GOLD) (#86)
- **Diagnostic réel** — stats SAV (coût/durée moyens par catégorie de panne) (#86)
- **Campaign send** — envoi, preview, CRUD complet, segment resolution (#86)
- **Notifications SAV** — activées par défaut (FEATURE_AUTO_NOTIFICATIONS=true) (#86)
- **Cron triggers** — exécution automatique toutes les heures (#86)
- **FAQ recherche** — filtre client-side multi-termes (#86)
- **Employee management** — CRUD employés + invitation email + activité + reset password (#86)
- **Order refund** — remboursement Stripe partiel/total + restockage (#86)
- **Manual orders** — commande admin (vente boutique/téléphone) (#86)
- **Invoice PDF** — génération PDFKit avec données commande (#86)
- **Audit trail** — AuditLog + FinancialLedger append-only (#140)
- **Newsletter** — double opt-in, confirmation email, unsubscribe (#114)
- **Garage sync** — localStorage ↔ server via CustomerProfile.scooterModels (#116)

### Ops & Infrastructure
- **Shared notifications** — package unifié email/SMS (@trottistore/shared/notifications) (#86)
- **Distributed tracing** — request-context middleware (x-request-id) sur 4 services (#141)
- **SLOs** — recording rules checkout availability/latency + error budget (#141)
- **Alerting** — 15 rules Prometheus (service down, payment failures, webhook errors, refund, DB/Redis health, reconciliation, checkout errors) (#138, #140, #144)
- **Dashboards** — 3 specs Grafana (payments, fulfillment, finance) (#141)
- **Chaos drills** — programme mensuel, scorecard MTTD/MTTR/RTO/RPO (#141)
- **Incident runbook** — 5 scénarios (Stripe, webhook, Redis, DB, refund) (#138)
- **Financial controls** — reconciliation job, ledger immutable, contraintes DB (#140)
- **Backup/restore** — scripts vérifiés, restore test en environnement isolé (#139)
- **Webhook DLQ** — retry avec backoff + replay admin endpoint (#139)
- **Performance** — query optimization, DB indexes, image next/image fix (#142)
- **SECURITY.md** — politique de sécurité réelle (#145)
- **robots.txt** — Disallow /admin, /api, /checkout (#149)
- **deploy.sh** — health check ports corrigés (#149)
- **Next.js rewrites** — ajout addresses, reviews, leads, stock-alerts, merchant (#149)

### Tests
- 133 → 372 tests (+239)
- 0 modules sans test
- 0 façades
- 67 bugs identifiés par audit challenge (3 runs), 22 fixés

### Bug Fixes
- Checkout JSON parser Buffer fix (#86)
- Admin categories backend ajouté (#86)
- Newsletter confirm URL fix (pending)
- Appointment past date validation (pending)
- 45 tickets restants documentés dans docs/TICKETS_67_BUGS.md
