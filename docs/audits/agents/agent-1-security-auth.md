# Agent 1 — Security / Auth / RBAC

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent
> **Scope :** routes services + plugins auth + apps/web/lib/api.ts

## Scope effectif

- `services/ecommerce/src/routes/auth/index.ts` (831 lignes)
- `services/ecommerce/src/routes/orders/index.ts` (1812 lignes)
- `services/ecommerce/src/routes/cart/index.ts` (411 lignes)
- `services/ecommerce/src/routes/admin/index.ts` (733 lignes)
- `services/ecommerce/src/routes/admin-users/index.ts`
- `services/sav/src/routes/tickets/index.ts` (1138 lignes)
- `services/crm/src/routes/customers/index.ts`
- `services/*/src/plugins/auth.ts` (4 fichiers)
- `services/*/src/index.ts` (4 fichiers)
- `apps/web/src/lib/api.ts`

## Findings supplémentaires (au-delà des fixes du jour)

### 1. P1 — IDOR sur `GET /orders/:id` : MANAGER/TECHNICIAN bypass ownership 🔴

**Réf :** `services/ecommerce/src/routes/orders/index.ts:1340`

**Symptôme :** `if (order.customerId !== userId && user.role !== "ADMIN")` rejette seulement si role != ADMIN. Les MANAGER + TECHNICIAN peuvent lire les commandes de tous les clients via cette route.

**Vecteur d'attaque :** `GET /api/v1/orders/uuid-of-rival-customer` avec JWT d'un MANAGER → accès à toutes les commandes, adresses, paiements.

**Fix proposé :** `if (order.customerId !== userId && !["SUPERADMIN", "ADMIN"].includes(user.role))` (seul ADMIN peut court-circuiter, pas MANAGER/TECHNICIAN qui n'ont pas vocation à voir les commandes user-facing).

**Note :** ce finding est **nouveau** et n'apparaît pas dans le tech debt registry ou les audits précédents. **À ajouter immédiatement au backlog P1.**

### 2. P1 — Race condition trackingToken brute-force sur `/quote/accept-client`

**Réf :** `services/sav/src/routes/tickets/index.ts:926`

**Symptôme :** `const hasValidToken = !!body.trackingToken && body.trackingToken === ticket.trackingToken;` compare directement la string contre `ticket.trackingToken` stocké en clair. **Pas de rate-limit** sur ce endpoint public.

**Vecteur d'attaque :** Brute-force du UUID de trackingToken (théoriquement 2^128, mais si pattern prévisible ou fuité via logs / referrers), puis accepter la quote sans permission.

**Fix proposé :**
1. Ajouter rate-limit spécifique : `config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }`
2. Hasher le trackingToken en BD (comme password reset token)
3. Invalider le token après 1ère utilisation (set `acceptedAt` non-null)

### 3. P1 — Timing attack sur `/auth/forgot-password`

**Réf :** `services/ecommerce/src/routes/auth/index.ts:691-737`

**Symptôme :** Renvoie 200 + même message pour email trouvé vs non trouvé (anti-énumération basique OK), MAIS si email existe il y a une transaction Prisma + sendEmail (async). Un attaquant peut mesurer `Date.now()` avant/après pour énumérer les emails valides.

**Vecteur d'attaque :** 1000 requests avec emails connus vs aléatoires, corrélation des temps de réponse → énumération.

**Fix proposé :** Ajouter `await new Promise(r => setTimeout(r, randomInt(100, 500)))` avant le return final, dans **les deux branches** (email trouvé ET non trouvé), pour aplatir la courbe de timing.

### 4. P2 — XSS stocké via repair notes / visitReason / issueDescription

**Réf :** `services/sav/src/routes/tickets/index.ts:214, 237`

**Symptôme :** `visitReason` (string max 300) et `issueDescription` stockés en BD sans validation contre HTML, retournés au frontend. Si un futur composant les rend via `dangerouslySetInnerHTML` (ou si l'admin SAV le copie-colle ailleurs sans échappement)…

**Vecteur d'attaque :** `POST /repairs { "issueDescription": "<img src=x onerror='alert(1)'>" }` → stocké, puis tout backoffice qui consulte le ticket exécute le JS si rendu non échappé.

**Fix proposé :** Validation Zod `.refine()` qui rejette les balises HTML dangereuses (`<script>`, `<iframe>`, attributs `on*`). Ou DOMPurify côté backend avant insert. React échappe par défaut donc impact limité aujourd'hui mais à fixer en defense in depth.

### 5. P2 — Cart Bearer fallback silencieux vers anonyme

**Réf :** `services/ecommerce/src/routes/cart/index.ts:169-183`

**Symptôme :** Si un JWT invalide ou expiré est envoyé dans Authorization header, le code `catch { }` silencieusement l'ignore et procède comme anonyme. L'attaquant ne sait pas si le token a été rejeté ou traité.

**Vecteur d'attaque :** Confusion utilisateur principalement (panier d'un user authentifié "saute" vers session anon quand son token expire). Aussi : impossible de distinguer "token volé invalide" de "anon legit" dans les logs.

**Fix proposé :** Log le JWT error (`app.log.debug({ err }, 'cart bearer invalid, falling back to anon')`). Optionnel : retourner 401 explicite si Bearer header présent mais invalide, obligeant le client à refresh.

## Non-findings (vérifié, OK — defense in depth confirmé)

- **JWT signature & expiry :** Plugin `@fastify/jwt` valide `jwtVerify()`, `app.authenticate` throw en cas d'erreur, et check `ROLES.includes(payload.role)` avant assignment (fix F2 du PR #89).
- **Refresh token rotation :** Implémentation atomique (`auth/index.ts:384-391`). Ancien token révoqué PUIS nouveau créé dans `Promise.all`, pas de race entre revoke et issue.
- **Ownership orders :** GET /orders/:id (authenticated customer) bien protégé par check `customerId === userId` MAIS bypass MANAGER/TECHNICIAN identifié comme finding P1 #1.
- **Cron bypass scopé :** Per-process nonce `app.cronSecret`, constant-time compare, scope strict à POST /triggers/run (PR #106).
- **SAV quote accept assignedTo guard :** Ligne 869 check technicien (PR #110).
- **Password reset atomicity :** Claim pattern ligne 799-805, abort si `usedAt != null`, force retry (PR #109).
- **Cookies httpOnly + sameSite=strict :** Refresh token cookie `auth/index.ts:110-114`. OK.

## Angles non vérifiés

- **SQL injection :** Prisma ORM échappe par défaut. Pas de `$queryRaw` avec interpolation brute détectée. Approfondir sur les `findMany({ where: ... })` dynamiques dans crm/customers et sav/tickets — paraissent sûrs avec parsing Zod.
- **CSRF token :** Fastify + cors + sameSite=strict + credentials:include mitigent déjà. Pas de endpoint mutation acceptant form-data encoded (tout JSON). Anti-CSRF token absent mais pas critique vu l'architecture.
- **Full headers audit (CSP, HSTS, X-Frame, X-Content-Type-Options) :** Helmet utilisé `services/*/src/index.ts:74` (chaque service) mais config par défaut. Déjà identifié S6 dans tech-debt.

## Recommandations

### Quick wins (< 30 min)
- **Fix P1 IDOR orders** (1 ligne : remplacer `user.role !== "ADMIN"` par `!["SUPERADMIN", "ADMIN"].includes(user.role)`)
- Rate-limit dédié POST `/repairs/:id/quote/accept-client` (ajouter `config: { rateLimit: ... }`)
- Add timing delay `/auth/forgot-password` : `await new Promise(r => setTimeout(r, Math.random() * 400))`

### Structurants (1-2h)
- Hasher + invalider trackingToken repair intake (comme password reset token)
- XSS audit : ajouter validation string via `.refine()` Zod pour visitReason, notes, issueDescription
- Cart Bearer fallback : log JWT errors (debug level), optionnel retourner 401
