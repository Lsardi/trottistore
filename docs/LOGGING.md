# Logging & Retention

## Objectif

Conserver les logs applicatifs de manière fiable, avec rotation automatique pour éviter de saturer le disque.

## Implémentation

- Tous les services Docker utilisent le driver `json-file`.
- Rotation activée dans les compose:
  - `docker-compose.prod.yml`: `max-size=20m`, `max-file=10`, compression activée.
  - `docker-compose.dev.yml`: `max-size=10m`, `max-file=5`, compression activée.
- Les services applicatifs continuent d'écrire en `stdout/stderr` via Fastify + Pino.

## Commandes d'exploitation

### Suivre les logs en temps réel

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Ou par service:

```bash
docker compose -f docker-compose.prod.yml logs -f sav
docker compose -f docker-compose.prod.yml logs -f ecommerce
```

### Voir les options de rotation d'un container

```bash
docker inspect trottistore-sav --format '{{json .HostConfig.LogConfig}}'
```

### Export ponctuel des logs

```bash
docker logs --since 24h trottistore-sav > sav-logs-24h.txt
```

## Bonnes pratiques

- Garder les niveaux `info/error` en production.
- Éviter les données sensibles dans les logs (tokens, secrets, PII non nécessaire).
- Si besoin d'analyse long terme (recherche, alerting), ajouter un agrégateur dédié (Loki/ELK/OpenSearch) au-dessus de cette base.
