# Alert Routing & Escalation Policy — TrottiStore

## On-Call Destinations

### Channel Configuration

| Channel | Tool | Target | When |
|---|---|---|---|
| Primary | Slack #ops-alerts | All P1/P2 alerts | 24/7 |
| SMS | Brevo transactional SMS | CRITICAL alerts only | 24/7 |
| Email | ops@trottistore.fr | All alerts (digest) | Business hours |
| Dashboard | Grafana on-call | Visual triage | Always available |

### Prometheus Alertmanager Config

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: "${SLACK_WEBHOOK_URL}"

route:
  receiver: slack-default
  group_by: [alertname, job]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # Critical: immediate SMS + Slack
    - match:
        severity: critical
      receiver: critical-multi
      repeat_interval: 30m

    # Warning: Slack only
    - match:
        severity: warning
      receiver: slack-default
      repeat_interval: 4h

receivers:
  - name: slack-default
    slack_configs:
      - channel: "#ops-alerts"
        title: "[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}"
        text: "{{ .CommonAnnotations.description }}"
        send_resolved: true

  - name: critical-multi
    slack_configs:
      - channel: "#ops-critical"
        title: "CRITICAL: {{ .CommonLabels.alertname }}"
        text: "{{ .CommonAnnotations.description }}\n\nRunbook: docs/INCIDENT_RUNBOOK.md"
        send_resolved: true
    # SMS via webhook to Brevo (or any SMS gateway)
    webhook_configs:
      - url: "${ALERT_SMS_WEBHOOK_URL}"
        send_resolved: false
```

### Environment Variables Required

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx
ALERT_SMS_WEBHOOK_URL=https://your-sms-gateway/alert  (optional)
```

## Escalation Policy

| Time | Action | Who |
|---|---|---|
| T+0 | Alert fires → Slack + SMS (if critical) | Automated |
| T+5min | No ack → re-notify Slack | Automated |
| T+15min | No resolution → escalate to Lyes (tech lead) | Manual or PagerDuty |
| T+30min | Still unresolved → page external support if needed | Lyes decision |
| T+1h | Repeat critical alert every 30min until resolved | Automated |

## Alert Test Protocol

Run monthly to verify alert routing works end-to-end.

### Test Procedure

```bash
# 1. Fire a test alert via Alertmanager API
curl -X POST http://localhost:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": { "alertname": "TestAlert", "severity": "warning", "job": "ecommerce" },
    "annotations": { "summary": "Monthly alert routing test", "description": "This is a test. No action needed." },
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "endsAt": "'$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+5M +%Y-%m-%dT%H:%M:%SZ)'"
  }]'

# 2. Verify receipt in Slack #ops-alerts (within 30s)
# 3. Verify resolved notification after 5 minutes
# 4. Log result in ops checklist
```

### Checklist (monthly)

```
[ ] Test alert fired via Alertmanager
[ ] Slack notification received in #ops-alerts
[ ] Critical test: SMS received (if configured)
[ ] Alert resolved notification received
[ ] Response time documented
```
