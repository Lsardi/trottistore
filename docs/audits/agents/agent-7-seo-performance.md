# Agent 7 — SEO / Performance

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent

## Scope effectif

- `apps/web/next.config.ts` — images, rewrites
- `apps/web/src/app/layout.tsx` — metadata globale, fonts, viewport, structured data
- `apps/web/src/components/StructuredData.tsx` — JSON-LD LocalBusiness + FAQPage
- `apps/web/src/lib/brand.ts` — defaults SEO
- `apps/web/src/app/sitemap.ts` — sitemap dynamique
- `apps/web/src/app/robots.ts` — robots.txt
- `apps/web/src/app/(shop)/page.tsx` — homepage
- `apps/web/src/app/(shop)/produits/page.tsx` — catalogue
- `apps/web/src/app/(shop)/produits/[slug]/page.tsx` — fiche produit metadata + JSON-LD

## Findings supplémentaires

### 1. P2 — Robots.txt incomplet, pas de `Disallow: /admin`

**Réf :** `apps/web/src/app/robots.ts:8-12`

**Symptôme :** Permet tout (`allow: "/"`) sans exclure le path admin.

**Risque :** Les pages `/admin/*` peuvent être crawlées et indexées par Google → duplicate content + risque SEO + surface d'attaque exposée publiquement.

**Fix proposé :** Ajouter dans le retour de `robots.ts` :
```typescript
{
  userAgent: "*",
  allow: "/",
  disallow: ["/admin", "/api", "/_next", "/mon-compte", "/checkout"],
}
```

### 2. P2 — Canonical URLs manquantes sur catalogue filtré

**Réf :** `apps/web/src/app/(shop)/produits/page.tsx`

**Symptôme :** Aucun `generateMetadata()` exporté. Les URLs avec filtres `?sort=`, `?search=`, `?categorySlug=` génèrent des variations différentes du même contenu sans canonical.

**Risque :** Duplicate content, dilution de PageRank, signaux SEO fragmentés sur les pages catalogue.

**Fix proposé :** Ajouter `generateMetadata()` qui retourne `alternates: { canonical: '/produits' }` (sans les query params).

### 3. P3 — JSON-LD Product schema basique, manque `aggregateRating`

**Réf :** `apps/web/src/app/(shop)/produits/[slug]/page.tsx:251-267`

**Symptôme :** `productJsonLd` n'inclut pas d'`aggregateRating` ni de `review[]` array. Le composant `ProductReviews` existe mais n'est pas intégré au structured data.

**Note :** PR #103 a retiré l'`aggregateRating` côté `LocalBusiness` (faux Google reviews) — c'était volontaire. Mais sur les **fiches produit**, on peut tout à fait alimenter `aggregateRating` depuis les **vrais avis vérifiés** internes via `reviewsApi.forProduct()`.

**Fix proposé :** Dans `generateMetadata()` ou un wrapper, fetch `reviewsApi.forProduct(slug)` server-side, injecter dans `productJsonLd`. Permet rich snippets "note moyenne" en SERP.

### 4. P3 — Sitemap `lastModified` systématiquement `now`

**Réf :** `apps/web/src/app/sitemap.ts:51-52`

**Symptôme :** Pages statiques (FAQ, A-Propos, etc.) ont toutes `lastModified: now`, donc Google ne peut pas optimiser le crawl budget.

**Fix proposé :** Hardcoder une date stable (date du dernier déploiement, ou date de modif réelle de la page) au lieu de `now` regénéré à chaque request.

### 5. P3 — Meta description par défaut > 100 chars (sera tronquée)

**Réf :** `apps/web/src/lib/brand.ts:107`

**Symptôme :** "Boutique spécialisée trottinettes électriques, pièces détachées et réparation SAV. Livraison France." = 106 chars. Recommandation Google = max 160 chars affichés mais visuellement coupée à ~155 sur mobile.

**Risque :** Description coupée en SERP → moins d'info → CTR potentiellement réduit.

**Fix proposé :** Réduire à ~155 chars en français, optimiser les mots-clés en début. Ex: "Trottinettes électriques, pièces détachées et atelier de réparation toutes marques. Boutique pro à L'Île-Saint-Denis. Livraison France." (137 chars).

## Non-findings (vérifié, OK)

- ✓ Metadata OG/Twitter configurées (`layout.tsx`)
- ✓ Sitemap généré dynamiquement avec produits (fetch API ecommerce)
- ✓ BreadcrumbList JSON-LD sur fiche produit
- ✓ LocalBusiness + FAQPage schema présents
- ✓ Canonical URL sur fiches produit (`/produits/[slug]`)
- ✓ Images `remotePatterns` autorisées (`trottistore.fr`, `www.trottistore.fr`)
- ✓ Hero image avec `priority` (LCP optimisé)

## Angles non vérifiés

- Fonts : fichier `lib/fonts.ts` non lu (out of scope strict)
- Performance budgets : pas de `next.config.ts` avec `experimental.webpackMemoryOptimizations`
- Analytics SEO (Plausible / Vercel / Fathom) : configuration backend pas visible
- HSTS / Security headers : pas dans ce scope (cf S6 tech debt)

## Recommandations

### Quick wins (< 30 min)
- **P2 Robots.txt** : ajouter `Disallow: /admin, /api, /_next, /mon-compte, /checkout`
- **P3 Meta description** : réduire à ~155 chars

### Structurants (1-2h)
- **P2 Canonical catalogue filtré** : `generateMetadata()` sur `/produits` avec canonical fixe
- **P3 Product JSON-LD aggregateRating** : injecter depuis `reviewsApi.forProduct()` server-side
- **P3 Sitemap lastModified** : dates stables, pas `now`
