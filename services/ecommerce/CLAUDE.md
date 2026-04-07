# Service: Ecommerce

Port 3001. Core commerce engine — products, cart, orders, checkout, auth, Stripe payments.

## Test

```bash
pnpm test:project ecommerce      # 37 tests
pnpm vitest run --project ecommerce -- src/routes/orders  # Subset
```

## Routes (/api/v1)

| Route | Auth | Description |
|-------|------|-------------|
| /products | public | Catalog (list, get by slug, featured) |
| /categories | public | Category tree |
| /cart | session | Redis-based cart (session ID or user ID) |
| /auth | mixed | Register, login, refresh, logout |
| /orders | required | Checkout, order history |
| /checkout | required | Stripe PaymentIntent flow |
| /addresses | required | User address CRUD |
| /admin | ADMIN+ | Admin panel endpoints |
| /stock | ADMIN+ | Stock movements |
| /merchant | public | Google Merchant feed |
| /leads | public | Pro lead capture |

## Plugins (registered in index.ts)

cors, helmet, rate-limit (100/min), prisma, redis, auth (JWT + cookie)

## Auth flow

- `app.authenticate(request, reply)` — global decorator, verifies JWT from Authorization header
- `requireAuth(request, reply)` — inline check returning 401 if no user
- `requireRole(...roles)` — preHandler for RBAC

## Key patterns

- Cart stored in Redis (key: `cart:{userId}` or `cart:anon:{sessionId}`)
- Checkout: validate cart → create order in `$transaction` → create payment → clear cart
- Stripe webhook at POST /checkout/webhook (verify signature with STRIPE_WEBHOOK_SECRET)
- Stock decremented atomically in transaction on order creation

## Env vars

DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET (required). STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BASE_URL (optional).
