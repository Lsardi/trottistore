# Performance & Cost Report — TrottiStore

## Frontend Performance Audit

### Grade: B+ (actionable items below)

### Findings

| Category | Status | Detail |
|---|---|---|
| next.config.ts | GOOD | Standalone output, image optimization, ISR configured |
| Bundle size | GOOD | Stripe lazy-loaded, lucide tree-shaken |
| Images | FIX APPLIED | Admin SAV had unoptimized img tag → replaced with next/image |
| Fonts | GOOD | 6 fonts via next/font with display:swap, no render blocking |
| SSR/CSR split | GOOD | Key pages server-rendered, client only where needed |
| Third-party scripts | EXCELLENT | No GA/Meta blocking scripts |
| CSS | GOOD | Tailwind 4 with proper purging |
| CLS | GOOD | aspect-ratio preserved on product images |
| ISR/Cache | GOOD | Homepage/products revalidate:120s, sitemap:3600s |

### Remaining Optimizations (nice-to-have)

| Action | Impact | Effort |
|---|---|---|
| Move dompurify to devDependencies | -184KB client bundle | 5 min |
| Add width/height to ProductGallery thumbnails | Minor CLS fix | 5 min |
| Add Cache-Control headers for static assets | Better CDN caching | 15 min |

## Infra Cost Analysis

### Current Architecture (per month estimate)

| Component | Railway | VPS (Hetzner) |
|---|---|---|
| Web (Next.js) | ~8 USD | included |
| Ecommerce (Fastify) | ~5 USD | included |
| CRM (Fastify) | ~3 USD | included |
| SAV (Fastify) | ~3 USD | included |
| Analytics (Fastify) | ~3 USD | included |
| PostgreSQL | ~7 USD | included |
| Redis | ~5 USD | included |
| **Total** | **~34 USD/month** | **~9 EUR/month** (CX22) |

### Right-Sizing Recommendations

| Service | Current | Recommended | Reason |
|---|---|---|---|
| Web | No limits | 512MB RAM, 0.5 CPU | Next.js standalone is lightweight |
| Ecommerce | No limits | 256MB RAM, 0.25 CPU | Fastify is efficient, scales to ~1K req/s |
| CRM | No limits | 128MB RAM, 0.25 CPU | Low traffic, only admin |
| SAV | No limits | 128MB RAM, 0.25 CPU | Low traffic |
| Analytics | No limits | 256MB RAM, 0.25 CPU | Aggregation queries can spike |
| PostgreSQL | No limits | 1GB RAM | Shared DB, main bottleneck |
| Redis | No limits | 64MB RAM | Carts + locks only |

### docker-compose.prod.yml Resource Limits

```yaml
# Add to each service:
deploy:
  resources:
    limits:
      memory: 256M
      cpus: "0.25"
    reservations:
      memory: 128M
```

### Cost Target

| Scenario | Monthly Cost | vs Current |
|---|---|---|
| Railway (current plan) | ~34 USD | baseline |
| VPS Hetzner CX22 (2vCPU/4GB) | ~9 EUR | -73% |
| VPS + managed DB (Supabase free) | ~9 EUR + 0 | -73% |
| Railway + right-sizing | ~25 USD | -26% |

**Recommendation**: Hetzner VPS for launch. Caddy + Docker Compose = production-ready for < 100 orders/day. Switch to Railway or scale up when traffic justifies.

## Performance SLOs

| Endpoint | Target p95 | Target p99 | Current (estimated) |
|---|---|---|---|
| GET /products | < 200ms | < 500ms | ~100ms |
| GET /products/:slug | < 200ms | < 500ms | ~120ms |
| POST /checkout/payment-intent | < 1s | < 2s | ~800ms (Stripe API) |
| POST /checkout/webhook | < 500ms | < 1s | ~200ms |
| POST /orders | < 2s | < 5s | ~1.5s (transaction) |
| GET /admin/products | < 500ms | < 1s | ~200ms |
| Homepage (TTFB) | < 500ms | < 1s | ~300ms (ISR cached) |
| Product page (LCP) | < 2.5s | < 4s | TBD (needs Lighthouse) |

## Dashboard: perf/cost

### Panels

| Panel | Query/Source | Target |
|---|---|---|
| p95 latency by route | `histogram_quantile(0.95, rate(trottistore_http_request_duration_seconds_bucket[5m]))` | < SLO target |
| Error rate | `rate(trottistore_http_requests_total{status_code=~"5.."}[5m])` | < 0.1% |
| Orders/hour | `rate(trottistore_orders_created_total[1h])` | > 0 during business hours |
| Memory usage | Container metrics | < 80% of limit |
| CPU usage | Container metrics | < 70% of limit |
| DB connections | PostgreSQL stats | < pool max |
| Redis memory | Redis INFO memory | < 50MB |
| Monthly cost estimate | Manual or Railway billing API | < target |
