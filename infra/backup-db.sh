#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="trottistore_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump and compress
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-trottistore}" "${POSTGRES_DB:-trottistore}" \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

# Cleanup old backups
find "$BACKUP_DIR" -name "trottistore_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup complete: ${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"
