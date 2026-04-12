# Incident Drill Report — TrottiStore

## Drill Date: Pre-production (run before first deploy)

## Objective
Verify RTO/RPO for 3 critical failure scenarios and validate the incident runbook.

---

## Drill 1: Stripe Payment Down

### Simulation
```bash
# Temporarily set invalid Stripe key
# In .env: STRIPE_SECRET_KEY=sk_test_INVALID
# Restart ecommerce service
```

### Expected Behavior
- Checkout returns 503 (STRIPE_NOT_CONFIGURED or Stripe API error)
- Existing orders unaffected (already in DB)
- Cart preserved in Redis
- Alert: PaymentFailureSpike fires within 5 minutes

### Recovery
- Fix STRIPE_SECRET_KEY in env
- Restart ecommerce service
- Pending PaymentIntents resolve when Stripe is back

### RTO/RPO
- **RTO**: ~2 minutes (config change + restart)
- **RPO**: 0 data loss (orders are DB-backed, carts are Redis-backed)

### Runbook Reference
See docs/INCIDENT_RUNBOOK.md section 1

---

## Drill 2: Redis Down

### Simulation
```bash
# Stop Redis container
podman stop trottistore-redis
# Wait 2 minutes, observe behavior
```

### Expected Behavior
- Cart operations fail (500)
- Order creation fails (can't read cart from Redis)
- Idempotency locks fail (checkout Redis NX lock)
- Auth still works (JWT + PostgreSQL refresh tokens)
- Product browsing still works (PostgreSQL)
- Alert: DatabaseUnhealthy fires within 1 minute

### Recovery
```bash
podman start trottistore-redis
# Wait for healthcheck (5 seconds)
```

### Impact Assessment
- **Carts lost**: Yes — Redis is ephemeral. Customers must re-add items.
- **Orders lost**: No — already in PostgreSQL.
- **Sessions lost**: No — JWT is stateless, refresh tokens in PostgreSQL.

### RTO/RPO
- **RTO**: ~30 seconds (container restart)
- **RPO**: Cart data lost (ephemeral by design). No financial data loss.

### Runbook Reference
See docs/INCIDENT_RUNBOOK.md section 3

---

## Drill 3: PostgreSQL Down

### Simulation
```bash
# Stop PostgreSQL container
podman stop trottistore-postgres
# Wait 2 minutes, observe behavior
```

### Expected Behavior
- ALL API calls return 500 (no DB connection)
- Frontend static pages still render (Next.js SSG)
- Cart reads from Redis still work (but can't create orders)
- Alert: ServiceDown fires within 2 minutes
- Alert: DatabaseUnhealthy fires within 1 minute

### Recovery
```bash
podman start trottistore-postgres
# Wait for pg_isready (~10 seconds)
# Services auto-reconnect via Prisma connection pool
```

### If Recovery Fails — Full Restore
```bash
# Stop all services
podman compose -f docker-compose.prod.yml stop ecommerce crm sav analytics

# Restore from backup
podman compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U trottistore -d trottistore --clean --if-exists /backups/latest.dump

# Restart services
podman compose -f docker-compose.prod.yml start ecommerce crm sav analytics

# Verify
curl http://localhost:3001/health
curl http://localhost:3001/ready
```

### RTO/RPO
- **RTO simple restart**: ~30 seconds
- **RTO full restore**: ~5-10 minutes (depends on DB size)
- **RPO**: Last backup (every 6 hours via docker-compose backup cron)

### Runbook Reference
See docs/INCIDENT_RUNBOOK.md section 4

---

## Drill Checklist (run on each environment)

```
PRE-DRILL
  [ ] Backup exists and is recent (< 6h)
  [ ] Monitoring/alerting is active
  [ ] All services healthy (/health green)
  [ ] Test order can be placed

DRILL EXECUTION
  [ ] Drill 1: Stripe down — checkout returns error, alert fires
  [ ] Drill 1: Recovery — checkout works again, test order passes
  [ ] Drill 2: Redis down — cart fails, orders safe, alert fires
  [ ] Drill 2: Recovery — carts work again (empty but functional)
  [ ] Drill 3: DB down — all APIs 500, alert fires
  [ ] Drill 3: Recovery — services reconnect, data intact

POST-DRILL
  [ ] All alerts resolved
  [ ] RTO measured and documented
  [ ] RPO verified (no data loss beyond expected)
  [ ] Runbook gaps identified and updated
  [ ] Drill report signed off by tech lead
```

---

## RTO/RPO Summary

| Scenario | RTO | RPO | Financial Impact |
|---|---|---|---|
| Stripe down | 2 min | 0 | Orders paused, no loss |
| Redis down | 30 sec | Carts lost | UX only, no financial |
| PostgreSQL restart | 30 sec | 0 | All data intact |
| PostgreSQL restore | 5-10 min | Up to 6h | Orders in gap lost |

## Recommendation
- Reduce backup frequency to every 1 hour for production (currently 6h)
- Consider Redis persistence (AOF) if cart loss is business-critical
- Set up Stripe webhook retry monitoring in Stripe dashboard
