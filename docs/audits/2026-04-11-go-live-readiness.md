# Go-Live Commercial Readiness — TrottiStore — 2026-04-11

> **Type :** Checklist actionnable pour go-live commercial réel (vraies cartes, vraies factures, vrais clients).
> **État :** **NO-GO** au 2026-04-11 19:30 — bloqueurs P0 listés ci-dessous.
> **Auditeur :** Claude Opus 4.6 (1M context).

## TL;DR

| Scénario | Verdict |
|---|---|
| **Démo "vitrine"** (montrer le site, fake purchase) | ✅ **GO** |
| **Pilot commercial limité** (1-5 clients réels, factures patchées à la main) | 🟡 **GO sous conditions** (cf section 2) |
| **Go-live commercial public** (vraies cartes + vraies factures + vrais clients sans garde-fou manuel) | ❌ **NO-GO** — 4 bloqueurs P0 (cf section 1) |

**Estimation pour passer au GO :** ~1 jour-homme dev + récupération assets (Stripe + SIRET) côté @Lsardi.

---

## 1. Bloqueurs P0 (rien ne fonctionne sans)

### B1 — Stripe en mode TEST sur prod 🔴🔴🔴

**Symptôme :** `STRIPE_SECRET_KEY=sk_test_51TKEJ6...` sur Railway env production.
**Conséquence :** Aucune carte réelle ne peut être chargée. Le checkout marche techniquement (création Order + PaymentIntent), mais l'argent ne bouge pas. Si un client teste l'achat avec sa vraie carte → la carte est rejetée par Stripe TEST.
**Action :**
1. Aller sur https://dashboard.stripe.com → toggle Test/Live en haut → mode **Live**
2. Section Developers → API keys → copier la `Secret key (sk_live_...)` et la `Publishable key (pk_live_...)`
3. Section Developers → Webhooks → créer un endpoint `https://trottistoreservice-ecommerce-production.up.railway.app/api/v1/checkout/webhook` avec les events `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` → copier le `Signing secret (whsec_...)`
4. Sur Railway, service `@trottistore/service-ecommerce`, rotate les 3 env vars :
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
5. Redéployer ecommerce
6. Smoke test : passer une vraie commande de 1€ avec ta carte personnelle, vérifier que le paiement est capturé sur Stripe live, refund-toi via le dashboard

**Effort :** 5 min côté tech + récupération assets côté @Lsardi (pas dans la jurisdiction de Claude).
**Bloquant 100%.**

### B2 — Mentions légales placeholder `[À COMPLÉTER]` 🔴

**Symptôme :** `apps/web/src/app/(shop)/mentions-legales/page.tsx:19-31`

```
SIRET: [SIRET À COMPLÉTER]
RCS: [RCS À COMPLÉTER]
Capital social: [À COMPLÉTER]
Directeur de publication: [À COMPLÉTER]
```

**Conséquence :** Violation **LCEN art. 6** (obligation pour tout éditeur de service en ligne français). Sanction : amende jusqu'à 75 000 €.
**Action :** voir B3 pour la stratégie data-driven via env vars qui débloque B2 + B3 + B5 d'un coup.

### B3 — Footer facture lit env vars non-set → "SIRET non renseigné" 🔴

**Symptôme :** `services/ecommerce/src/routes/admin-invoices/index.ts:18` (après refactor F5)

```typescript
const siret = process.env.NEXT_PUBLIC_LEGAL_SIRET || "SIRET non renseigné";
```

**Conséquence :** une facture émise actuellement contient "SIRET non renseigné" → **non valide juridiquement** (CGI art. 289). Risque DGCCRF + invalidité comptable.

**Action :** voir B5 pour la stratégie complète.

### B4 — Numérotation facture non conforme art. 289 CGI 🔴

**Symptôme :** `services/ecommerce/src/routes/admin-invoices/index.ts:62`

```typescript
doc.text(`N° ${order.orderNumber}`, ...);
```

**Conséquence :** La facture utilise `orderNumber` qui est la séquence des **commandes**, pas une séquence dédiée aux **factures**. Or :
- L'art. 289-VII CGI exige une séquence facture **dédiée**, **séquentielle**, **continue**, **sans rupture**, **propre par exercice fiscal**.
- Une commande annulée (CANCELLED) crée un trou dans la séquence orders, ce qui contamine la séquence facture.
- Pas de format conforme (typique : `FAC-2026-000001`).

**Action :** voir B5.

### B5 — Stratégie corrective unifiée pour B2 + B3 + B4

**Plan d'attaque (2-4h dev) :**

#### Étape 1 — Env vars légales (5 min)

Sur Railway, service ecommerce + web, set ces 6 env vars :

```bash
NEXT_PUBLIC_LEGAL_COMPANY_NAME="TrottiStore SAS"
NEXT_PUBLIC_LEGAL_SIRET="123 456 789 00012"
NEXT_PUBLIC_LEGAL_TVA_INTRACOM="FR12 123456789"
NEXT_PUBLIC_LEGAL_RCS="Bobigny B 123 456 789"
NEXT_PUBLIC_LEGAL_CAPITAL="5 000 €"
NEXT_PUBLIC_LEGAL_DIRECTOR="Lyes Sardi"
```

(Valeurs à remplacer par les vraies extraites du Kbis et statuts.)

#### Étape 2 — Lecture côté frontend (30 min)

Modifier `apps/web/src/app/(shop)/mentions-legales/page.tsx` pour lire les env vars au lieu des `[À COMPLÉTER]`.

```tsx
const SIRET = process.env.NEXT_PUBLIC_LEGAL_SIRET;
const RCS = process.env.NEXT_PUBLIC_LEGAL_RCS;
// ...
{SIRET ? `SIRET : ${SIRET}` : "SIRET : non renseigné"}
```

#### Étape 3 — Lecture côté facture PDF (10 min)

Le helper `legalFooter()` lit déjà `process.env.NEXT_PUBLIC_LEGAL_SIRET` et `NEXT_PUBLIC_LEGAL_TVA_INTRACOM` (refactor F5). Quand les env vars seront set, le footer affichera les vraies valeurs.

#### Étape 4 — Numérotation facture conforme (1-2h dev)

**Schema :** ajouter un model `InvoiceCounter` dans `packages/database/prisma/schema.prisma` :

```prisma
model InvoiceCounter {
  id           String   @id @default(uuid()) @db.Uuid
  fiscalYear   Int      @unique @map("fiscal_year")
  lastNumber   Int      @default(0) @map("last_number")
  prefix       String   @default("FAC") @db.VarChar(10)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  @@map("invoice_counters")
  @@schema("ecommerce")
}
```

Et ajouter `invoiceNumber String? @unique` sur `Order` pour stocker le numéro de facture une fois assigné.

**Migration :** créer `20260412NNNN_invoice_counter/migration.sql`.

**Logique d'attribution (helper) :** dans `packages/shared/src/invoice-numbering.ts`

```typescript
export async function assignInvoiceNumber(
  tx: PrismaTransactionClient,
  orderId: string,
): Promise<string> {
  const fiscalYear = new Date().getFullYear();

  // Increment atomique du counter de l'année courante
  const counter = await tx.invoiceCounter.upsert({
    where: { fiscalYear },
    create: { fiscalYear, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const invoiceNumber = `FAC-${fiscalYear}-${String(counter.lastNumber).padStart(6, "0")}`;

  await tx.order.update({
    where: { id: orderId },
    data: { invoiceNumber },
  });

  return invoiceNumber;
}
```

**Hook :** appeler `assignInvoiceNumber` au moment de `handlePaymentSuccess` Stripe webhook (`services/ecommerce/src/routes/checkout/index.ts`), et pas à la création de l'order. Comme ça :
- Une commande PENDING n'a pas de numéro facture
- Une commande CANCELLED avant paiement n'a pas de numéro
- Seules les commandes effectivement payées consomment un numéro de facture
- La séquence reste continue dans le temps (pas de trous)

**Côté PDF :** modifier `buildInvoicePdf` pour utiliser `order.invoiceNumber || \`#${order.orderNumber} (PROVISOIRE)\``. Pour les commandes PENDING, le PDF affiche un draft non-conforme avec un watermark "PROVISOIRE".

**Tests :** 5 tests
- Order paid → invoiceNumber assigné FAC-2026-000001
- 2 orders paid concurrent → 000001 et 000002 sans collision (concurrency test)
- Order cancelled avant payment → pas de numéro
- Year transition → restart à 2027/000001
- Idempotence : ré-appel `handlePaymentSuccess` n'incrémente pas 2x

**Effort :** ~2h dev + 30 min tests.

#### Étape 5 — Envoi auto facture par email (1h)

Hook après `assignInvoiceNumber` dans `handlePaymentSuccess` :

```typescript
const invoiceNumber = await assignInvoiceNumber(tx, orderId);
// ... fin de la transaction ...

// Hors transaction (fire-and-forget pattern, comme F1 shipped email)
const pdfBuffer = await buildInvoicePdf(app, orderId, /* mode: send */);
const html = invoiceEmailTemplate(orderNumber, invoiceNumber, customerName, totalTtc);
sendEmailWithAttachment(customerEmail, subject, html, [
  { filename: `facture-${invoiceNumber}.pdf`, content: pdfBuffer },
]).catch((e) => app.log.warn({ orderId, err: e }, "invoice-email send failed"));
```

**Nouveau helper requis :** `sendEmailWithAttachment` dans `packages/shared/src/notifications/email.ts` (le current `sendEmail` ne supporte pas les attachments).

**Effort :** 1h.

### Total B5

- 5 min env vars
- 30 min frontend mentions légales
- 10 min footer PDF
- 2h numérotation conforme + tests
- 1h envoi auto facture
- **= 4h dev + récupération données légales (Kbis + statuts) côté @Lsardi**

---

## 2. Conditions du pilot commercial limité (mode "GO sous conditions")

Si le go-live complet (B1-B5) prend trop de temps et qu'un pilot doit démarrer **avant**, voici les garde-fous manuels acceptables pour 1-5 clients réels :

### Conditions

1. **Stripe live keys set** → pas optionnel, B1 doit être fait
2. **Mentions légales avec SIRET réel hardcodé temporairement** dans `mentions-legales/page.tsx` (avant le refactor env vars). Cohérent avec ce que la facture affichera.
3. **Footer facture avec SIRET réel hardcodé** dans `admin-invoices/index.ts:18` directement (pas via env var pour l'instant)
4. **Numérotation facture acceptée temporairement comme `orderNumber`** (non-conforme strict mais documenté comme dette)
5. **Envoi facture manuel** par l'admin via le bouton de download après chaque commande payée (suivi via tableau de bord)
6. **Volume max 5-10 commandes/semaine** pour que le suivi manuel reste tenable
7. **Communication CGV au client** par email à la commande (clause "vous avez accepté nos CGV") avec lien vers la page (pas conforme strict mais opérationnellement OK)
8. **Refund manuel** via Stripe dashboard si problème (pas de bouton client)

Cette voie permet de **commencer à vendre dès B1 fait** (5 min), avec un risque légal limité tant que le volume reste petit. Mais c'est une rustine, pas une solution.

---

## 3. Bloqueurs P1 (à corriger sous 2-4 semaines)

### B6 — CGV minimales

**Symptôme :** 8 sections d'une ligne dans `apps/web/src/app/(shop)/cgv/page.tsx`.

**Action :** rédiger une CGV pro 3000-5000 mots couvrant les 14 obligations légales (cf full project audit section 5.2). Soit avocat (~500-1500€), soit template juridique adapté. Pour démarrer un pilot, un draft solide suffit.

**Effort :** 1-2h pour un draft, 1-2 semaines de back-and-forth avocat pour validation.

### B7 — Stock integrity 3 P1

Voir [2026-04-11-stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md) pour le détail.

**Effort :** 2-3h dev.
**Risque sans fix :** sous concurrence forte (Black Friday / launch buzz), oversell garanti.

### B8 — Pas de slow query log Postgres

Activer côté Railway Postgres : `log_min_duration_statement = 500ms`. Permet de détecter les requêtes lentes en prod avant que ça impacte UX.

**Effort :** 5 min config.

### B9 — Pas de Sentry / monitoring d'erreurs

Sans Sentry, on ne sait pas qu'une erreur s'est produite chez un client tant qu'il ne nous prévient pas. Pour un go-live commercial, c'est aveugle.

**Action :** intégrer `@sentry/node` sur les 4 services Fastify + `@sentry/nextjs` sur web.

**Effort :** 2-3h dev + setup compte Sentry.

---

## 4. Bloqueurs P2 (à corriger semaine 1-3 après go-live)

### B10 — Pas d'archivage légal facture 10 ans

L'art. L102 B LPF impose la conservation des factures pendant **10 ans**. Aujourd'hui les PDF sont générés à la volée, pas stockés.

**Action :** stockage S3-compatible (Cloudflare R2 / Backblaze B2) déclenché à l'attribution du numéro de facture. Format : `invoices/{fiscal_year}/{invoice_number}.pdf`.

**Effort :** 2-3h dev.

### B11 — Pas de page "Mes données" RGPD dans l'espace client

Les routes existent (`GET /auth/export`, `DELETE /auth/account`) mais pas d'UI. Conformité art. 12 RGPD : faciliter l'exercice des droits.

**Effort :** 1h.

### B12 — Brevo absent de la politique de confidentialité

Brevo est sous-traitant pour les emails transactionnels et marketing. Doit apparaître dans la liste des sous-traitants RGPD.

**Effort :** 30 min de doc.

### B13 — DPO pas nommé

Si plus de 250 employés ou traitement à grande échelle de données sensibles → DPO obligatoire. Pour TrottiStore, **pas obligatoire** légalement (taille raisonnable, pas de données ultra-sensibles), mais nommer un référent RGPD est recommandé.

**Action :** au minimum un email dédié `rgpd@trottistore.fr` (forward vers le contact actuel).

---

## 5. Checklist GO/NO-GO finale

À cocher avant d'annoncer le go-live commercial public :

**Bloqueurs P0 (obligatoires) :**
- [ ] Stripe live keys set (B1)
- [ ] Mentions légales avec SIRET / RCS / Capital / Directeur réels (B2)
- [ ] Facture PDF avec SIRET / TVA intracom réels (B3)
- [ ] Numérotation facture séquence dédiée FAC-YYYY-NNNNNN (B4)
- [ ] Tests : passer 1 commande réelle avec ma carte → facture reçue par email avec le bon numéro et les bonnes mentions

**Bloqueurs P1 (fortement recommandés) :**
- [ ] CGV draft solide (B6)
- [ ] Stock integrity 3 P1 fixés (B7)
- [ ] Slow query log activé (B8)
- [ ] Sentry intégré + alerting configuré (B9)

**Bloqueurs P2 (1-3 semaines après) :**
- [ ] Archivage facture 10 ans S3 (B10)
- [ ] Page "Mes données" RGPD (B11)
- [ ] Brevo dans politique confidentialité (B12)

**Tests intégration finaux :**
- [ ] Smoke prod 5/5 services healthchecks 200
- [ ] E2E checkout réel avec carte 4242 puis vraie carte 1€ + refund
- [ ] Email de confirmation reçu
- [ ] Email de tracking (SHIPPED) reçu
- [ ] Facture PDF reçue par email
- [ ] Login admin OK
- [ ] Login client + commande + suivi commande + download facture OK
- [ ] /mon-compte/commandes affiche la commande
- [ ] /admin/commandes affiche la commande
- [ ] /admin/newsletter affiche les abonnés
- [ ] Quiz → recommandations en stock
- [ ] /compatibilite affiche les modèles SAV + statiques
- [ ] /reparation flow ticket SAV OK
- [ ] CGV / Mentions légales / Politique conf / Cookies pages servies en 200
- [ ] Mobile iPhone : pas de zoom auto au focus inputs, pas de overflow horizontal

---

## 6. Ce qui peut attendre après le go-live

(non bloquant, juste de la dette acceptable)

- Stock integrity finalisé avec Testcontainers (chantier S2)
- CSP / HSTS / X-Frame-Options
- Visual regression tests
- Load testing k6
- Threat model formalisé
- Page admin newsletter (✓ déjà fait F3)
- Audit a11y axe-core
- Centralisation logs
- APM avancé (DataDog au lieu de Sentry)
- Crawler suppliers complet (Wattiz ✓, Volt Corp en attente accès B2B)

---

*Doc rédigé en remplacement de l'audit codex. La checklist GO/NO-GO est l'outil opérationnel de référence pour la décision go-live.*
