#!/bin/bash
# Stop hook: run smoke tests before letting Claude finish.
# If tests fail, Claude continues working instead of stopping.

INPUT=$(cat)

# Prevent infinite loop: if we're already in a stop hook retry, let Claude stop
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
  exit 0
fi

# Run smoke tests (fast — ~1s)
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

RESULT=$(pnpm test:smoke 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "Smoke tests failed. Fix before completing:" >&2
  echo "$RESULT" | tail -20 >&2
  exit 2
fi

exit 0
