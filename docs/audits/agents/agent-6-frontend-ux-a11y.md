# Agent 6 — Frontend / UX / Accessibility

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent
> **Scope :** apps/web/src — sample 22 fichiers critiques

## Scope effectif

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/(shop)/page.tsx` (homepage)
- `apps/web/src/app/(shop)/panier/page.tsx`
- `apps/web/src/app/(shop)/checkout/page.tsx`
- `apps/web/src/app/(shop)/mon-compte/page.tsx`
- `apps/web/src/app/(shop)/mon-compte/commandes/page.tsx`
- `apps/web/src/app/(shop)/reparation/page.tsx`
- `apps/web/src/app/(shop)/quiz/page.tsx`
- `apps/web/src/app/(shop)/compatibilite/page.tsx`
- `apps/web/src/components/Header.tsx`
- `apps/web/src/components/Footer.tsx`
- `apps/web/src/components/SOSButton.tsx`
- `apps/web/src/components/NewsletterForm.tsx`
- `apps/web/src/lib/garage.ts`
- `apps/web/src/components/StructuredData.tsx`

## Findings supplémentaires

### 1. P2 — Typos accents sur formulaire `/reparation` (UI dégradée FR)

**Réf :** `apps/web/src/app/(shop)/reparation/page.tsx:192, 195`

**Symptôme :**
```tsx
<h2 className="heading-md text-neon mb-2">Ticket cree avec succes</h2>
<button>Deposer une autre demande</button>
<p>Numero de ticket</p>
```

**Risque :** Utilisateurs francophones voient du texte sans accents (mauvaise UX FR pro). À corriger en `Créé`, `succès`, `Déposer`, `Numéro`.

**Fix proposé :** Sweep des fichiers `.tsx` pour `cree|deposer|numero|reparation|recuperation|fevrier|recu` et ajouter les accents manquants.

### 2. P2 — Calcul TVA hardcodé 20% au lieu d'utiliser `tvaRate` backend

**Réf :** `apps/web/src/app/(shop)/panier/page.tsx:79` et `checkout/page.tsx:171`

**Symptôme :**
```typescript
// panier
const subtotal = items.reduce((sum, item) => sum + item.lineTotalHt * 1.2, 0);
// checkout
const totalTtc = useMemo(() => totalHt * 1.2, [totalHt]);
```

**Risque :** Si TVA change ou si certains produits ont une TVA différente (ex: 5.5% pour les vélos électriques, 10% pour les services réparation), l'affichage est incorrect. Le backend retourne `item.tvaRate` mais il n'est pas utilisé pour le calcul client.

**Fix proposé :** Utiliser `item.tvaRate` (ou `product.tvaRate`) émis par l'API pour chaque ligne, sommer les `tvaAmount` itemisés au lieu de re-multiplier par 1.2 globalement. Voir aussi finding #5 Agent 2 sur la TVA divergence backend.

### 3. P2 — Newsletter form sans `aria-label` sur input / bouton

**Réf :** `apps/web/src/components/NewsletterForm.tsx:56-77`

**Symptôme :** Input email n'a pas d'`aria-label` ou `aria-describedby`, juste un placeholder. Button sans `aria-label` (seulement le texte `{buttonText}` qui change entre "S'INSCRIRE", "INSCRIT ✓", "ERREUR").

**Risque a11y :** Lecteurs d'écran lisent "S'INSCRIRE" sans contexte, "email" pas explicite. WCAG 2.1 niveau A.

**Fix proposé :**
```tsx
<input
  aria-label="Adresse email pour la newsletter"
  type="email"
  ...
/>
<button aria-label={`${buttonText} à la newsletter`}>{buttonText}</button>
```

### 4. P2 — Pas de skeleton loader pulse cohérent panier/checkout

**Réf :** `apps/web/src/app/(shop)/panier/page.tsx:64-76` et `checkout/page.tsx:368-375`

**Symptôme :** Pendant `loading = true`, panier affiche des `<div className="h-8 bg-surface w-48" />` (sans `animate-pulse`), checkout a un mini loader minimal. Incohérence visuelle entre les 2 pages adjacentes du même flow.

**Fix proposé :** Créer un composant `<CartSkeleton />` réutilisable avec `animate-pulse` cohérent + l'utiliser dans panier ET checkout. Effort ~30 min.

### 5. P2 — Subtotal "TTC" en panier vs livraison ajoutée hors TVA → confusion possible

**Réf :** `apps/web/src/app/(shop)/panier/page.tsx:78-80` (calcul) et `:182` (affichage)

**Symptôme :** Le panier calcule `subtotal = HT * 1.2` (TTC), affiche "Sous-total TTC X €", puis indique "livraison calculée à l'étape suivante". Si le checkout ajoute une livraison qui inclut elle-même de la TVA, le total final affiché au checkout peut différer du sous-total panier (sans expliquer pourquoi).

**Risque UX :** Confusion client à l'étape checkout, sentiment de "frais cachés".

**Fix proposé :** Soit afficher "Sous-total HT" + "TVA estimée" + "Total estimé hors livraison", soit montrer un breakdown explicite au moment où la livraison est ajoutée au checkout.

## Non-findings (vérifié, OK)

- **`dangerouslySetInnerHTML`** : seulement dans `StructuredData.tsx` (JSON-LD safe) et `layout.tsx` (script de thème safe avant hydration).
- **`localStorage` sans try/catch** : `garage.ts` wrap correctement (lignes 23-28, 32-34, 102-110, 142-154). Pas de crash en mode privé Safari.
- **Images sans `alt`** : Toutes les images Next.js utilisent `alt`. Hero `alt="Trottinette électrique Teverun Tetra"`.
- **Touch targets < 44px** : Boutons et liens > 40px (cart icon 40×40, header icons 40×40). Pas optimal mais acceptable.
- **Mobile responsive** : safe-area appliqué (SOSButton, layout.tsx `viewport-fit cover`). PR #104 + #121 validés.
- **Font-size 16px inputs** : appliqué (`globals.css:507-524`), iOS auto-zoom prévenu.
- **Modals/dialogs avec focus trap** : Header (38-60) et SOSButton (35-56) ont trap + Escape key handler.

## Angles non vérifiés

- Pages admin `/admin/*` : sample limité, vérifier tous les formulaires admin
- `/diagnostic`, `/guide`, `/avis` : pas lus (sample sélectif)
- `/pro`, `/atelier`, `/urgence` : similaire
- Error boundaries globales (`layout.tsx` pas d'`error.tsx` visible dans le scope lu, mais `global-error.tsx` existe)
- Pagination sur `/mon-compte/commandes` (pagination via API mais UI pas vérifiée pour navigation)

## Recommandations

### Quick wins
- **Corriger typos accentués** sur `/reparation/page.tsx` avant déploiement (UX dégradée FR)
- **Ajouter aria-label** sur inputs critiques (newsletter, checkout adresse) pour a11y

### Structurants
- **Utiliser `item.tvaRate`** au lieu de 20% hardcodé sur panier/checkout pour robustesse multi-TVA
- **Unifier les skeletons loading** panier/checkout avec composant `<CartSkeleton />` réutilisable
- **Documenter le calcul de TVA livraison** au checkout pour éviter décalage TTC avec panier
