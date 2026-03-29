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
exec pnpm turbo dev
