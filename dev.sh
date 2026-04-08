#!/bin/bash
# Load .env file if it exists
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    case "$line" in \#*|"") continue ;; esac
    # Extract key=value, handle quotes
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"
    val="${val#\"}"
    export "$key=$val" 2>/dev/null
  done < .env
fi
# Ensure DB schema is up to date and seeded
echo "→ Syncing database schema..."
pnpm --filter @trottistore/database db:push --skip-generate 2>/dev/null

# Seed demo data if DB is empty (no users = fresh DB)
USER_COUNT=$(pnpm --filter @trottistore/database exec prisma db execute --stdin <<< "SELECT count(*) FROM shared.users;" 2>/dev/null | grep -o '[0-9]*' | tail -1)
if [ "${USER_COUNT:-0}" = "0" ]; then
  echo "→ Empty database detected, seeding demo data..."
  pnpm db:seed:demo
else
  echo "→ Database already has data ($USER_COUNT users), skipping seed."
fi

exec pnpm turbo dev
