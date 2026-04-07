# App: Web (Storefront)

Next.js 15, App Router, SSR + ISR. Tailwind CSS 4, Radix UI, Stripe Elements.

## Test

```bash
pnpm test:project web              # Unit tests
pnpm --filter @trottistore/web e2e # Playwright E2E (needs dev server)
```

## Key pages

| Route | Description |
|-------|-------------|
| / | Homepage |
| /produits, /produits/[slug] | Product listing + detail |
| /panier | Cart |
| /checkout | Stripe checkout flow |
| /reparation | SAV intake form |
| /mon-compte | Customer dashboard |
| /mon-compte/suivi/[token] | Repair tracking |
| /diagnostic | Scooter diagnostic tool |
| /pro | B2B area |
| /atelier | Workshop services |

## API integration (lib/api.ts)

- `apiFetch(path, options)` — unified client
- Browser: relative URLs → Next.js rewrites → services
- Server (SSR): direct service URLs (localhost:300x)
- JWT from localStorage, session ID tracking

## Rewrites (next.config.ts)

`/api/v1/products/*` → ecommerce:3001, `/api/v1/customers/*` → crm:3002, `/api/v1/analytics/*` → analytics:3003, `/api/v1/repairs/*` → sav:3004

## Theme system

- `data-theme` attribute on `<html>`, 6+ themes
- Config in `lib/themes.ts`, switcher in `ThemeSwitcher.tsx`
- Anti-flash script in `layout.tsx` (reads localStorage before paint)

## White-label

Env vars `NEXT_PUBLIC_BRAND_*` control branding (name, domain, colors, SEO).

## Build

- Docker: `DOCKER_BUILD=true` → standalone output
- Dev: `pnpm --filter @trottistore/web dev`
