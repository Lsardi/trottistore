# Incontournables web — mise en route (config externe)

Ce lot (branche `claude/web-essentials-hardening`) ajoute 7 chantiers transverses. Le **code est en place et dégradé proprement** : sans credentials, chaque brique est un no-op (l'app tourne comme avant). Pour activer en prod, fournis les variables ci-dessous (toutes dans `.env.example`).

## 1. Sentry (error monitoring + perf)
1. Crée un projet **Node** (services) et un projet **Next.js** (web) sur sentry.io.
2. Renseigne `SENTRY_DSN` (backend) et `NEXT_PUBLIC_SENTRY_DSN` (frontend).
3. Optionnel : `SENTRY_ORG`/`SENTRY_PROJECT` pour l'upload des source-maps au build ; `SENTRY_TRACES_SAMPLE_RATE` (défaut 0.1).
- Sans DSN → Sentry désactivé. Les erreurs 5xx des 4 services sont remontées automatiquement ; les Web Vitals partent vers Sentry si actif.

## 2. Anti-bot Cloudflare Turnstile
1. Dashboard Cloudflare → Turnstile → crée un widget pour ton domaine.
2. Renseigne `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (clé publique) et `TURNSTILE_SECRET_KEY` (clé secrète).
- Sans secret → vérification ignorée côté backend, widget masqué côté front (les flux register/login/forgot continuent de marcher).
- Une fois activé : register, login et forgot-password exigent un token valide.

## 3. 2FA (TOTP)
- Aucune config externe. `TOTP_ISSUER` (défaut `TrottiStore`) = nom affiché dans Google Authenticator/Authy.
- Parcours utilisateur : compte → activer 2FA → scan QR → confirmer code → **codes de secours affichés une seule fois**. Au login, si la 2FA est active, un code est demandé (ou un code de secours).
- Migration DB : la table `users` reçoit `two_factor_enabled`, `two_factor_secret`, `two_factor_backup_codes` (migration `20260616120000_web_essentials_2fa_email_logs`).

## 4. Déliverabilité email (Brevo)
1. **DNS (critique)** : configure **SPF**, **DKIM** et **DMARC** pour ton domaine d'envoi (sinon les mails de commande partent en spam). À faire côté registrar + dashboard Brevo.
2. **Webhook bounce/complaint** : Brevo → Transactional → Settings → Webhook :
   - URL : `https://<api-host>/api/v1/webhooks/brevo?token=<BREVO_WEBHOOK_SECRET>`
   - Évènements : `delivered`, `hard_bounce`, `soft_bounce`, `blocked`, `spam`, `opened`
3. Renseigne `BREVO_WEBHOOK_SECRET` (même valeur que dans l'URL).
- Chaque envoi crée une ligne `email_logs` (PENDING → SENT/FAILED) ; le webhook met à jour en DELIVERED/BOUNCED/COMPLAINED.
- En prod, le webhook **refuse** les requêtes sans secret configuré (503).

## 5. JWT en cookie httpOnly (durcissement XSS) — ⚠️ à tester manuellement
Le token d'accès n'est plus en `localStorage` : il est posé en **cookie httpOnly `access_token`** par l'API (login/refresh), lu par `@fastify/jwt` et par le middleware Next (server-side). Le header `Bearer` n'est plus généré côté JS ; tout passe par le cookie (`credentials: "include"`).

**QA manuelle recommandée avant merge** (non couverte par les tests mock) :
- Login client + admin, navigation /mon-compte et /admin, refresh de token, logout, export/suppression RGPD, exports CSV admin, upload factures, sync garage.

## 6. CSP durcie (nonce + strict-dynamic) — ⚠️ vérif runtime
La CSP est désormais **par-requête dans `middleware.ts`** : `script-src 'self' 'nonce-<…>' 'strict-dynamic'` — **plus de `unsafe-inline` ni `unsafe-eval`** sur les scripts (en prod). Le nonce est propagé via le header `x-nonce` (lu par le root layout) et appliqué au script anti-flash de thème ; Next l'applique automatiquement à ses propres scripts.
- **Tradeoff** : lire `headers()` dans le root layout rend les pages dynamiques (le storefront est déjà majoritairement SSR, impact limité).
- `style-src 'unsafe-inline'` est **conservé** (Tailwind/Radix émettent du style inline).
- **À vérifier en runtime** (les violations CSP ne se voient qu'au navigateur) : ouvrir la console sur homepage, produit, checkout (Stripe), admin → aucune erreur `Content-Security-Policy`. En cas de souci Stripe, vérifier que `js.stripe.com` se charge bien via `strict-dynamic`.

## Vérifications passées
`pnpm lint` (10/10), `pnpm test` (375 passed, 1 skipped), `pnpm test:smoke` (23/23), build web OK.
