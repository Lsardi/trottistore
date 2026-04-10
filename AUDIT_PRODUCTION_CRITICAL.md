# Audit production-critical — TrottiStore

Date: 2026-04-10  
Méthode: 3 agents Claude focalisés (checkout/payment, auth/RBAC, data integrity), zéro faux positif accepté, code quoté pour chaque finding et vérifié manuellement.

## Sévérités

- **P0** : exploitable immédiatement / perte d'argent / corruption de données / fuite multi-utilisateurs.
- **P1** : exploitable sous condition réaliste, dégradation sévère sous charge.

## Statut des findings

| ID | Sévérité | Domaine | Statut |
|---|---|---|---|
| P0-1 | P0 | checkout — IDOR guest order payment intent | ✅ **fixé dans commit `78196c8`** (PR #89) |
| P0-2 | P0 | checkout — double stock decrement Stripe | ✅ **fixé dans commit `78196c8`** (PR #89) |
| P0-3 | P0 | crm — auth bypass via `x-internal-cron` | ⛔ à fixer (PR séparée) |
| P0-4 | P0 | crm — customer merge transaction split + loyaltyLog perdu | ⛔ à fixer (PR séparée) |
| P1-1 | P1 | auth — JWT en localStorage (XSS-vulnérable) | ⛔ à planifier |
| P1-2 | P1 | auth — pas de rate limit per-user sur reset-password / login | ⛔ à planifier |
| P1-3 | P1 | auth — refresh token sans device binding | ⛔ à planifier |
| P1-4 | P1 | auth — race condition sur reset password token | ⛔ à planifier |
| P1-5 | P1 | auth — ADMIN peut promouvoir vers SUPERADMIN/ADMIN | ⛔ à planifier |
| P1-6 | P1 | sav — token tracking public sans signature HMAC | ⛔ à planifier |
| P1-7 | P1 | checkout — prix recalculé live en cart-first (drift possible) | ⛔ à planifier |
| P1-8 | P1 | data — `OrderItem.productId` sans index | ⛔ à planifier |

**Findings écartés (faux positifs ou hors scope) :**
- Schemas Prisma sans `onDelete` sur Shipment / NotificationLog → besoin de vérifier que `prisma.order.delete` et `prisma.automatedTrigger.delete` sont effectivement appelés en production avant de classer P0.
- JWT HS256 vs RS256 : architectural, pas un bug ; HS256 reste acceptable si le secret est bien protégé.
- CSRF sur `/auth/logout` : `sameSite=strict` est suffisant en pratique.
- Cart duplicates Redis : nécessite vérification du endpoint `/cart/add` qui n'a pas été lu par l'agent.

---

## P0 fixés dans PR #89 (commit `78196c8`)

### P0-1 — IDOR sur `POST /checkout/payment-intent` (guest order-first)

**Fichier:** `services/ecommerce/src/routes/checkout/index.ts:121`

Avant fix (ramené du merge de `main`) :
```ts
if (user && order.customerId !== user.userId) {
  return reply.status(403).send({...});
}
```

**Bug:** Le check n'était exécuté que si `user` est défini. Pour un guest (`!user`), il était skip — n'importe quel client non authentifié pouvait appeler `POST /checkout/payment-intent` avec un `orderId` arbitraire et récupérer le `clientSecret` + `amount` du PaymentIntent d'une commande d'un autre client.

**Vérifié:** Le binding session ↔ orderId existe pour les guests : `services/ecommerce/src/routes/orders/index.ts:853` écrit `redis.set('checkout:guest-order:' + orderId, sessionId, 'EX', 1800)` à la création de l'order guest. Ce binding était utilisé par la version PR #89 originale mais a été supprimé dans le commit `5377f8d` de main.

**Fix appliqué:** Restauration de la branche guest qui exige `redis.get('checkout:guest-order:' + orderId) === sessionId`.

### P0-2 — Double stock decrement sur paiements Stripe

**Fichiers:** `services/ecommerce/src/routes/orders/index.ts:485`, `services/ecommerce/src/routes/checkout/index.ts:399-406`

```ts
// orders/index.ts:485 — création de l'order
} else {
  // For immediate payments, decrement stock
  await tx.productVariant.update({
    where: { id: item.variantId },
    data: { stockQuantity: { decrement: item.quantity } },
  });
}
```
```ts
// checkout/index.ts:399-406 — webhook Stripe
for (const item of items) {
  if (item.variantId) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stockQuantity: { decrement: item.quantity } },
    });
  }
}
```

**Bug:** Pour les méthodes Stripe (CARD/APPLE_PAY/GOOGLE_PAY/LINK), le stock est décrémenté à la création de l'order ET au webhook `payment_intent.succeeded`. Sur chaque paiement carte réussi, le stock est divisé par 2.

**Production impact:** À 10 unités en stock, après 5 commandes Stripe payées, le compteur affiche 0 mais seulement 5 unités ont réellement été vendues. Les 5 autres deviennent du stock fantôme inaccessible.

**Fix appliqué:** Suppression du decrement dans `handlePaymentSuccess`. Le stock est désormais géré exclusivement à la création de l'order (immédiat) ou via le flow de confirmation des installments. Le webhook ne touche plus qu'au statut de l'order et au record de paiement.

---

## P0 à fixer (PRs séparées)

### P0-3 — Auth bypass via `x-internal-cron` dans CRM

**Fichier:** `services/crm/src/routes/triggers/index.ts:85-98`

```ts
app.post("/triggers/run", async (request, reply) => {
  const isInternalCron = request.headers["x-internal-cron"] === "true";

  if (!isInternalCron) {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT" || user.role === "TECHNICIAN" || user.role === "STAFF") {
      return reply.status(403).send({ ... });
    }
  }
  // ... exécute tous les triggers actifs (envoi emails/SMS)
```

**Bug:** Le hook `onRequest` du service CRM authentifie tous les appels (`services/crm/src/index.ts:88`), donc `request.user` est défini si un JWT valide est fourni. Mais le check de rôle MANAGER+ est complètement bypassable en envoyant simplement `x-internal-cron: true` dans les headers — un header **client-controllable**. Un user CLIENT authentifié peut donc déclencher tous les triggers automatisés (envoi de campagnes email/SMS, rappels, demandes d'avis) à tous les utilisateurs.

**Vérifié:** 
- `services/crm/src/index.ts:184` confirme que le cron interne utilise `app.inject({ headers: { "x-internal-cron": "true" } })`.
- `services/crm/src/routes/triggers/triggers.integration.test.ts:94,105` confirme que le test d'intégration passe ce header en clair.

**Production impact:** Privilege escalation + spam massif vers tous les clients depuis n'importe quel compte CLIENT (quota Brevo brûlé, plaintes, blacklist domaine).

**Fix recommandé:** Au boot du service, générer un secret aléatoire en mémoire (`crypto.randomBytes(32).toString('hex')`), le stocker sur `app.cronSecret`. La route compare le header à ce secret. Le secret n'est jamais exposé en dehors du process (pas d'env var, pas de réseau). L'`app.inject()` du cron lit `app.cronSecret`.

```ts
// dans crm/src/index.ts (boot)
app.decorate('cronSecret', crypto.randomBytes(32).toString('hex'));

// dans triggers/index.ts
const isInternalCron = request.headers["x-internal-cron"] === app.cronSecret;
```

### P0-4 — Customer merge : transaction split + loyaltyLog jamais migré

**Fichier:** `services/crm/src/routes/customers/index.ts:663-724`

```ts
// Premier $transaction (lignes 663-707) : orders, tickets, addresses, interactions, reviews
await app.prisma.$transaction([
  app.prisma.order.updateMany({ where: { customerId: body.mergeId }, data: { customerId: body.keepId } }),
  // ... 6 autres updateMany
]);

// HORS transaction (lignes 710-723) : merge des points de fidélité
const [keepProfile, mergeProfile] = await Promise.all([...]);
if (keepProfile && mergeProfile) {
  await app.prisma.customerProfile.update({
    where: { id: keepProfile.id },
    data: {
      loyaltyPoints: keepProfile.loyaltyPoints + mergeProfile.loyaltyPoints,
      // ...
    },
  });
}
```

**Bugs:**
1. Les 2 phases sont dans des transactions séparées : un crash entre les deux laisse un état incohérent (commandes/tickets transférés mais points non).
2. Les enregistrements `loyaltyLog` (table `loyalty_points`) du profil source ne sont jamais migrés — seul le total agrégé est ajouté. L'historique est perdu / orphelin.
3. Le profil source n'est jamais supprimé ni désactivé après merge.

**Production impact:** Merge de comptes corrompt l'historique de fidélité, points perdus, audit trail cassé. Sous reprise après crash, états zombies.

**Fix recommandé:** Tout dans un seul `$transaction` (callback form), inclure `loyaltyPoint.updateMany({ where: { profileId: mergeProfile.id }, data: { profileId: keepProfile.id } })`, et supprimer/désactiver le profil source.

---

## P1 à planifier

### P1-1 — JWT en localStorage côté front
`apps/web/src/lib/api.ts:59-75`. XSS = vol immédiat du token. **Fix:** cookie `httpOnly + Secure + SameSite=Strict` pour l'access token (le refresh l'est déjà).

### P1-2 — Pas de rate limit per-user sur `/auth/reset-password` ni `/auth/login`
`services/ecommerce/src/routes/auth/index.ts:678`. Permet brute force / énumération. **Fix:** rate limit par email avec backoff exponentiel + lockout temporaire.

### P1-3 — Refresh token sans device binding
`services/ecommerce/src/routes/auth/index.ts:79-100`. Le param `deviceInfo` existe mais aucun caller ne le passe. Token volé = persistent. **Fix:** binder à User-Agent + IP /24 ou fingerprint à `/auth/refresh`.

### P1-4 — Race condition sur reset password token
`services/ecommerce/src/routes/auth/index.ts:703-734`. Le `usedAt` est marqué après l'update du password. Deux requêtes simultanées avec le même token peuvent toutes les deux passer le check → la dernière gagne. **Fix:** marquer `usedAt` dans la même transaction que l'update du password ou utiliser une contrainte unique conditionnelle.

### P1-5 — ADMIN peut créer/promouvoir vers SUPERADMIN
`services/ecommerce/src/routes/admin-users/index.ts:24-30,263`. Pas de hiérarchie de rôles vérifiée. **Fix:** seul SUPERADMIN peut assigner ADMIN/SUPERADMIN ; pas d'auto-promotion ; log de tous les changements de rôle.

### P1-6 — Token tracking SAV public sans signature
`services/sav/src/index.ts:85-104`. `GET /api/v1/repairs/tracking/:token` est public. Si le token est faible (UUID énumérable, séquentiel), IDOR sur tous les tickets. **Fix:** token signé HMAC ou random ≥ 32 octets + rate limit serré.

### P1-7 — Prix recalculé live en cart-first checkout
`services/ecommerce/src/routes/checkout/index.ts:162-186`. En flow cart-first (sans `orderId`), le total est recalculé depuis les `Product.priceHt` actuels au moment du PaymentIntent. Si le prix change entre l'ajout au panier et le checkout, le client est facturé au nouveau prix. **Fix:** snapshotter les prix dans le cart Redis lors de l'ajout, ou créer un OrderDraft immuable avant le PaymentIntent.

### P1-8 — `OrderItem.productId` sans index
`packages/database/prisma/schema.prisma:389-406`. Seul `orderId` est indexé. Toute requête "trouve les commandes ayant le produit X" est un full scan. **Fix:** ajouter `@@index([productId])`.

---

## Recommandations d'ordre

1. **Pousser PR #89** (merge + P0-1 + P0-2) — fix immédiat des 2 fuites les plus graves liées au merge.
2. Ouvrir PR `fix(crm)/cron-bypass` — P0-3, isolé, ~30 lignes.
3. Ouvrir PR `fix(crm)/customer-merge-tx` — P0-4, ~80 lignes, doit être testé soigneusement.
4. Planifier les P1 dans le sprint en cours (priorité P1-1 et P1-7 = exposition argent/comptes).

## Faux positifs à noter dans le rapport LLM précédent

`AUDIT_REPORT.md` contenait 2 "SQL injection" P0 qui sont en réalité des `prisma.$queryRaw` avec template literals (paramétrés automatiquement par Prisma). Ces 2 findings sont à retirer du rapport :
- `services/ecommerce/src/routes/stock/index.ts:214` (validé Zod en plus)
- `services/analytics/src/routes/sales.ts:63` (validé en `z.enum()`)
