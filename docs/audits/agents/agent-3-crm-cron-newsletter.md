# Agent 3 — CRM / Cron / Newsletter

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent
> **Scope :** services/crm/src/{routes,index.ts,plugins,lib}

## Scope effectif

- `services/crm/src/routes/*` (triggers, newsletter, customers, segments, campaigns)
- `services/crm/src/index.ts` (cron, auth bypass, rateLimit)
- `services/crm/src/lib/cron-auth.ts` (constant-time secret verification)
- `services/crm/src/plugins/auth.ts` (JWT verification)

## Findings supplémentaires

### 1. P1 — Trigger cron sans protection d'overlap distribué (architectural) 🔴

**Réf :** `services/crm/src/index.ts:224-241`

**Symptôme :** Cron `node-cron` "execute automated triggers every hour" (`0 * * * *`). Exécution via `app.inject()` : OK tant qu'on a 1 instance Railway. Mais **risque réel si scaling à 2+ instances** : le cron tourne 2x simultanément → doublons d'envois, duplicata `notificationLog`.

**Pattern manquant :** Redis distributed lock (ex. `SETNX` avec TTL) pour garantir 1 exécution par run sur l'ensemble du cluster.

**Mitigation existante :** Idempotence par ticket couverte (`notificationLog.findFirst()` ligne 220 triggers), mais lock prévient la race condition au niveau process.

**Fix proposé :** Wrapper le handler cron avec un Redis lock :

```typescript
cron.schedule("0 * * * *", async () => {
  const lockKey = "cron:triggers:lock";
  const acquired = await app.redis.set(lockKey, "1", "EX", 70, "NX");
  if (!acquired) {
    app.log.info("[cron] another instance is running, skipping");
    return;
  }
  try {
    // ... existing trigger logic
  } finally {
    await app.redis.del(lockKey);
  }
});
```

### 2. P2 — Newsletter export CSV sans pagination ni streaming (DoS potential)

**Réf :** `services/crm/src/routes/newsletter/index.ts:223-269`

**Symptôme :** `findMany()` sans limit sur `/admin/export.csv` → charge **tous les subscribers en mémoire** avant de générer le CSV.

**Risque :** Si 100k+ subscribers, OOM sur serveur (buffer massive en mémoire). Connait correspond au B7 du tech debt registry mais détaillé ici.

**Fix proposé :**
- Soit ajouter une limit (`max: 50_000`) avec un message "trop d'abonnés, affinez le filtre"
- Soit implémenter streaming CSV via `fastify reply.raw` + `pipe(csvStringify)`. Pattern recommandé pour des exports > 10k lignes.

### 3. P2 — Pas de rate-limit dédié sur `POST /campaigns/:id/preview`

**Réf :** `services/crm/src/routes/campaigns/index.ts:227-263`

**Symptôme :** Endpoint admin (non public), mais peut envoyer des emails de test sans limite. Le `rateLimit` global (100 req/min) couvre techniquement, mais un admin pourrait spammer 100 previews/min.

**Risque :** Pas d'exploitation évidente car SMTP rate-limited côté Brevo, mais pas de protection logique côté backend.

**Fix proposé :** Per-admin rate-limit dédié (5 previews/5min) ou logging systématique de chaque preview avec audit log.

### 4. P3 — Trigger error handling : `console.log/error` au lieu de `app.log`

**Réf :** `services/crm/src/routes/triggers/index.ts:290, 294`

```typescript
console.error(`[triggers] Error executing ${trigger.type}:`, err);
console.log(`[triggers] ${trigger.type}: processed=${processed} sent=${sent} errors=${errors}`);
```

**Symptôme :** Logs directs `console` au lieu de `app.log` → perte en production (pas captés par Pino JSON, donc pas indexés / cherchables).

**Risque :** Debugging opérationnel dégradé si crash cron.

**Fix proposé :** Remplacer par `app.log.error({ err }, '[triggers] Error executing ...')` et `app.log.info({ processed, sent, errors }, '[triggers] complete')`.

### 5. P3 — Token newsletter entropie suffisante mais pas hashé en DB

**Réf :** `services/crm/src/routes/newsletter/index.ts:20-21`

**Symptôme :** Token généré via `randomBytes(24).toString("hex")` = 48 chars hex = 192 bits d'entropie. Acceptable cryptographiquement pour un usage URL unique (double opt-in / unsubscribe), MAIS stocké en clair dans `confirmToken` et `unsubscribeToken` columns.

**Risque :** Si dump DB leak, tous les tokens sont exposés et peuvent être utilisés pour des unsubscribe massifs ou des confirmations malicieuses (spam list poisoning).

**Fix proposé :** Pattern password reset : stocker `crypto.createHash("sha256").update(token).digest("hex")` au lieu du token brut. L'URL contient le token brut, le DB lookup hash le token reçu pour matcher.

## Non-findings

- **CSRF sur newsletter endpoints** : Endpoints publics POST (form-encoded ou JSON), Fastify n'a pas CSRF par défaut. Acceptable pour POST public sans side-effect critique au-delà de l'inscription.
- **SQL injection via segments** : Zod parsing strict (numbers, enums, tags array) → Prisma query building sécurisé. `buildProfileWhere()` n'injecte que des champs Prisma typés.
- **Leakage `BREVO_API_KEY`** : Lu dans `index.ts:28` validation et `triggers/index.ts:378` pour SMS. Pas loggé, utilisé only dans nodemailer (privé).
- **Timeline accessible par clients** : `/customers/:id/timeline` requiert ADMIN+ via le hook global `onRequest:136-144` qui rejette CLIENT en 403.

## Angles non vérifiés

- Compression / streaming du CSV large (implémentation `sendEmail` de la shared lib)
- Résilience Brevo SMS API retry (codé fire-and-forget, pas de queue)
- Webhook Brevo delivery status updates (pas vu dans ce périmètre)

## Recommandations

1. **[P1 priority]** Ajouter Redis distributed lock pour cron (pattern SETNX avec TTL 70s, release après execution)
2. **[P2 priority]** Remplacer `console.log/error` par `app.log` dans triggers executor
3. **[P2 priority]** Limit (50k) ou streaming pour `/admin/export.csv`
4. **[P2 priority]** Per-admin rate-limit dédié sur preview send + audit log
5. **Monitoring :** Alerter si cron execution > 30 sec (indicateur de scaling collision)
