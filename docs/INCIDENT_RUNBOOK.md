# Incident Runbook — TrottiStore

Procedures for common production incidents. Each section: symptoms, diagnosis, fix, verification.

## 1. Stripe Payment Down

### Symptoms
- Alert: PaymentFailureSpike
- Customers see "Erreur de paiement" at checkout
- `trottistore_payments_failed_total` increasing

### Diagnosis
```bash
# Check Stripe status
curl https://status.stripe.com/api/v2/status.json | jq .status

# Check webhook delivery in Stripe dashboard
# https://dashboard.stripe.com/webhooks

# Check ecommerce logs
docker compose -f docker-compose.prod.yml logs ecommerce --tail 50 | grep -i "stripe\|payment\|webhook"

# Check PaymentIntent errors
docker compose -f docker-compose.prod.yml logs ecommerce --tail 100 | grep "STRIPE_REFUND_FAILED\|payment_failed"
```

### Fix
- **Stripe outage**: Nothing to do. Orders stay PENDING. Webhook will fire when Stripe recovers.
- **Webhook secret mismatch**: Update `STRIPE_WEBHOOK_SECRET` in env, restart ecommerce.
- **Key expired**: Rotate keys in Stripe dashboard, update `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY`.

### Verification
```bash
# After fix: place a test order with Stripe test card 4242 4242 4242 4242
# Verify order transitions: PENDING -> CONFIRMED
# Verify email confirmation received
curl https://trottistore.fr/api/v1/checkout/config
# Should return: { success: true, data: { publishableKey: "pk_live_..." } }
```

---

## 2. Webhook Down / Not Receiving

### Symptoms
- Alert: WebhookProcessingError
- Orders stay PENDING indefinitely after payment
- No `trottistore_stripe_webhook_events_total` increase

### Diagnosis
```bash
# Check if webhook endpoint is reachable
curl -X POST https://trottistore.fr/api/v1/checkout/webhook -H "Content-Type: application/json" -d '{}'
# Expected: 400 (missing signature) — means endpoint is reachable

# Check Stripe webhook dashboard for delivery failures
# https://dashboard.stripe.com/webhooks

# Check if STRIPE_WEBHOOK_SECRET is set
docker compose -f docker-compose.prod.yml exec ecommerce env | grep STRIPE_WEBHOOK
```

### Fix
- **Endpoint unreachable**: Check Caddy reverse proxy, restart if needed.
- **Signature mismatch**: Re-copy webhook secret from Stripe dashboard.
- **Backlog of unprocessed events**: Stripe retries automatically up to 3 days. Once webhook is fixed, events will replay.

### Manual confirmation (if webhook was down for extended period)
```bash
# List PENDING orders that should have been confirmed
# In Stripe dashboard: find PaymentIntents with status=succeeded
# For each: manually update order status via admin
curl -X PUT https://trottistore.fr/api/v1/admin/orders/{orderId}/status \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONFIRMED","note":"Manual confirmation — webhook was down"}'
```

---

## 3. Redis Down / Cart Loss

### Symptoms
- Alert: DatabaseUnhealthy (Redis probe fails)
- Customers see "Le panier est vide" unexpectedly
- Cart operations return 500

### Diagnosis
```bash
# Check Redis connectivity
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
# Expected: PONG

# Check Redis memory
docker compose -f docker-compose.prod.yml exec redis redis-cli info memory | grep used_memory_human

# Check ecommerce logs for Redis errors
docker compose -f docker-compose.prod.yml logs ecommerce --tail 50 | grep -i "redis\|ECONNREFUSED"
```

### Fix
- **Redis container crashed**: `docker compose -f docker-compose.prod.yml restart redis`
- **Out of memory**: Increase memory limit in docker-compose.prod.yml or flush expired keys.
- **Data loss**: Carts are ephemeral (session-based). Customers can re-add items. No permanent data loss.

### Impact
- Carts in Redis are lost on Redis restart.
- Orders already created are safe (PostgreSQL).
- No financial impact — only UX disruption.

---

## 4. Database Down

### Symptoms
- Alert: ServiceDown (all services)
- Alert: DatabaseUnhealthy
- All API calls return 500

### Diagnosis
```bash
# Check PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U trottistore
# Expected: accepting connections

# Check disk space
docker compose -f docker-compose.prod.yml exec postgres df -h /var/lib/postgresql/data
```

### Fix
- **Container crashed**: `docker compose -f docker-compose.prod.yml restart postgres`
- **Disk full**: Expand volume or clean old backups.
- **Corrupted data**: Restore from latest backup.

### Restore from backup
```bash
# List available backups
ls -la /backups/postgres/

# Stop services
docker compose -f docker-compose.prod.yml stop ecommerce crm sav analytics

# Restore
docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U trottistore -d trottistore --clean --if-exists /backups/postgres/latest.dump

# Restart
docker compose -f docker-compose.prod.yml start ecommerce crm sav analytics

# Verify
curl https://trottistore.fr/api/v1/products?limit=1
```

---

## 5. Refund Failed

### Symptoms
- Alert: RefundFailure
- Admin sees "Le remboursement Stripe a echoue"
- `trottistore_refunds_total{result="stripe_error"}` increasing

### Diagnosis
```bash
# Check Stripe refund status
# https://dashboard.stripe.com/payments/{payment_intent_id}

# Check ecommerce logs
docker compose -f docker-compose.prod.yml logs ecommerce --tail 50 | grep "refund"
```

### Fix
- **Insufficient balance**: Add funds to Stripe account.
- **Payment already refunded**: Check Stripe dashboard — refund may already exist.
- **Manual refund**: Process directly in Stripe dashboard if API fails. Then update order status manually.

```bash
# After manual Stripe refund, update order status
curl -X PUT https://trottistore.fr/api/v1/admin/orders/{orderId}/status \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"status":"REFUNDED","note":"Manual refund via Stripe dashboard"}'
```

---

## Escalation Contacts

| Level | Who | When |
|---|---|---|
| L1 | Admin on duty | First response, follow runbook |
| L2 | Lyes (tech lead) | If runbook doesnt resolve in 15min |
| L3 | Stripe support | Payment/webhook issues not resolved by config |
