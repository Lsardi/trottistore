#!/bin/bash
# Pre-write hook: check if the file being edited conflicts with another worktree.
# Exit 0 = allow (with warning context on stderr for verbose mode).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Make path relative to repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$REPO_ROOT" ]]; then
  exit 0
fi

REL_PATH="${FILE_PATH#$REPO_ROOT/}"

# Run clash check — exit 2 + JSON on stderr = conflicts found
CLASH_STDERR=$(clash check "$REL_PATH" 2>&1)
CLASH_EXIT=$?

if [[ $CLASH_EXIT -ne 2 ]]; then
  # No conflicts or clash unavailable
  exit 0
fi

# Parse conflict count from clash JSON (output is on stderr, captured above)
CONFLICT_COUNT=$(echo "$CLASH_STDERR" | jq -r '.conflicts | length' 2>/dev/null)

if [[ "$CONFLICT_COUNT" -gt 0 ]]; then
  BRANCHES=$(echo "$CLASH_STDERR" | jq -r '[.conflicts[].branch] | join(", ")' 2>/dev/null)
  echo "⚠ Clash: '$REL_PATH' conflicts with worktree branches: $BRANCHES" >&2
fi

# Warn but don't block — change to exit 2 for hard blocking
exit 0
