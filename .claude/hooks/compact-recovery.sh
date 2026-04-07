#!/bin/bash
# SessionStart hook (matcher: compact): re-inject project context after compaction.
# Writes to stdout — Claude receives this as context.

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMITS=$(git log --oneline -5 2>/dev/null || echo "no git history")
TEST_RESULT=$(pnpm test:smoke 2>&1 | tail -3)
DIRTY=$(git status --porcelain 2>/dev/null | head -10)

cat <<EOF
[Context recovery after compaction]

Branch: $BRANCH
Last 5 commits:
$LAST_COMMITS

Smoke tests: $TEST_RESULT

Working tree changes:
${DIRTY:-clean}

Reminder: Read CLAUDE.md at repo root for project conventions.
Multi-agent workflow: Claude = strategy/knowledge, Codex = execution/PRs.
Always sign messages for Codex with "— Claude".
EOF

exit 0
