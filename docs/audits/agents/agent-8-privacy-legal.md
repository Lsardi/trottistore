# Agent 8 — Privacy / Consent / Legal / Trust

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent

## Scope effectif

- `apps/web/src/app/(shop)/mentions-legales/page.tsx`
- `apps/web/src/app/(shop)/cgv/page.tsx`
- `apps/web/src/app/(shop)/politique-confidentialite/page.tsx`
- `apps/web/src/app/(shop)/cookies/page.tsx`
- `apps/web/src/components/CookieBanner.tsx`
- `apps/web/src/components/ConsentCheckbox.tsx`
- `apps/web/src/components/Footer.tsx`
- `services/ecommerce/src/routes/admin-invoices/index.ts`

## Findings supplémentaires (au-delà des 11 connus)

### 1. P1 — DPO contact = `brand.email` (mélange RGPD et SAV) 🟡

**Réf :** `mentions-legales/page.tsx:55` et `politique-confidentialite/page.tsx:52`

**Symptôme :** L'email du DPO pointe vers `brand.email` (le contact général). Une demande RGPD (DPA, contestation, droit d'accès) ne doit pas être confondue avec le SAV.

**Risque :** Demandes RGPD perdues dans la queue contact générale. Délai légal de réponse art. 12 RGPD = 1 mois (extensible 2 mois max). Si la demande se perd, l'utilisateur peut saisir la CNIL.

**Fix proposé :**
1. Créer un alias email dédié `dpo@trottistore.fr` ou `rgpd@trottistore.fr` (forward vers le contact actuel temporairement)
2. Ajouter `brand.dpoEmail` dans `lib/brand.ts`
3. Pointer les pages mentions/politique vers ce champ distinct

### 2. P2 — Durée de conservation flou dans politique de confidentialité

**Réf :** `politique-confidentialite/page.tsx:38`

**Symptôme :** Le texte dit "pendant la durée nécessaire à la finalité et aux obligations légales" sans détailler. Or les durées légales sont précises et différentes par finalité :
- Factures : 10 ans (art. L102 B LPF)
- Données client après commande : 3 ans glissants (recommandation CNIL)
- Données SAV : durée garantie + 1 an (art. 1648 Code civil)
- Cookies analytics : 13 mois max
- Logs techniques : 12 mois max

**Risque :** Manque de précision exigée par art. 13.2.a RGPD (information sur la durée).

**Fix proposé :** Tableau structuré dans la page :

```
| Catégorie de données | Finalité | Durée |
|---|---|---|
| Compte client | Gestion commande | 3 ans glissants après dernière activité |
| Factures | Comptable légal | 10 ans (L102 B LPF) |
| Tickets SAV | Garantie + suivi | 2 ans + 1 an post-clôture |
| Cookies analytics | Statistiques | 13 mois max |
| Logs techniques | Sécurité | 12 mois |
```

### 3. P2 — Politique cookies incomplète

**Réf :** `cookies/page.tsx`

**Symptôme :** Liste seulement `refresh_token` JWT (lignes 18-23). Ne mentionne pas si Google Analytics / Mixpanel / autres outils third-party utilisent des cookies. Si `analytics=true` est activé via le banner, quel script est lancé exactement ?

**Risque :** Manque de traçabilité des cookies tiers exigée par CNIL.

**Fix proposé :** Liste exhaustive :
- Cookie name + Type (essentiel / fonctionnel / analytique / publicitaire)
- Émetteur (TrottiStore / Stripe / Brevo / etc.)
- Durée
- Finalité
- Comment refuser

Et explicit "Aucun script analytics n'est chargé sans consentement préalable explicite via le bandeau cookie" (defense in depth pour la CNIL).

### 4. P2 — `ConsentCheckbox` utilisation non vérifiée partout

**Réf :** `components/ConsentCheckbox.tsx` + audit hors scope

**Symptôme :** Le composant existe et pointe vers `/politique-confidentialite`, mais on ne sait pas où il est instancié. Si certains formulaires critiques (checkout, formulaire SAV intake, contact) ne l'utilisent pas, **violation art. 7 RGPD** (consentement explicite requis pour la collecte).

**Fix proposé :** Audit complet : `grep -r "ConsentCheckbox" apps/web/src/`. Si absent de :
- `/checkout` (collecte adresse, email)
- `/reparation` (formulaire SAV intake)
- `/urgence` (form d'urgence)
- `/pro` (form B2B)

→ ajouter le composant.

### 5. P0 — Aucun envoi auto de facture par email après paiement (rappel)

**Réf :** `services/ecommerce/src/routes/admin-invoices/index.ts:119`

**Symptôme :** Les factures sont uniquement générées à la demande via `GET /orders/:id/invoice`. Aucun déclenchement auto au moment du `payment_intent.succeeded` Stripe webhook.

**Risque :** Art. 289 CGI exige la remise de facture au client (au plus tard à la livraison). Sans envoi auto, on ne respecte cette obligation que si l'admin clique manuellement, ce qui n'est pas une garantie.

**Note :** ce finding est déjà listé comme L5 dans le tech-debt registry et B5 dans le go-live readiness, mais Agent 8 le **confirme et ré-affirme la sévérité légale**.

**Fix proposé :** Voir [go-live-readiness.md section B5](../2026-04-11-go-live-readiness.md). Hook après `assignInvoiceNumber` dans `handlePaymentSuccess` du webhook Stripe.

## Non-findings (vérifié, OK)

- ✓ Footer liens présents et corrects (`Footer.tsx:26-29`) : mentions, CGV, politique, cookies
- ✓ Médiation FEVAD mentionnée (`cgv/page.tsx:57-62`) — conforme art. L611-1 Code conso
- ✓ CookieBanner sans pre-check analytics (`analyticsEnabled=false` au départ)
- ✓ Bouton "TOUT REFUSER" présent et fonctionnel (`CookieBanner.tsx:127`)
- ✓ Railway mentionné comme hébergeur (`mentions-legales/page.tsx:37-40`)
- ✓ Anti-énumération newsletter (retourne 200 même si email déjà CONFIRMED)

## Angles non vérifiés

- Où `ConsentCheckbox` est réellement instancié (audit grep hors scope strict)
- Si Google Analytics / Brevo charge un script tiers avant consentement
- Archivage factures 10 ans mis en place (Prisma TTL, dump annuel S3, etc.)
- Email DPO réellement reçu et traité (test fonctionnel)

## Recommandations

### Quick wins (< 30 min)
- Créer `brand.dpoEmail` distinct + alias forward
- Détailler durées de conservation dans la politique

### Structurants (1-2h)
- Audit grep `ConsentCheckbox` complet, ajouter sur les forms manquants
- Compléter `cookies.tsx` avec liste exhaustive des cookies tiers
- **P0 envoi auto facture** (cf [go-live-readiness B5](../2026-04-11-go-live-readiness.md))
