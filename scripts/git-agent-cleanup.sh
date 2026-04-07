#!/usr/bin/env bash
set -euo pipefail

# Delete local branches already merged into main + prune stale worktrees.
# Usage: ./scripts/git-agent-cleanup.sh [--dry-run]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

echo "=== Pruning stale worktrees ==="
if $DRY_RUN; then
  git -C "$ROOT_DIR" worktree list
else
  git -C "$ROOT_DIR" worktree prune
  echo "Done."
fi
echo

echo "=== Branches merged into main ==="
merged=0
while IFS= read -r branch; do
  branch="$(echo "$branch" | sed 's/^[* +]*//' | xargs)"
  [[ -z "$branch" ]] && continue
  [[ "$branch" == "main" || "$branch" == "develop" ]] && continue

  # Skip branches with active worktrees
  wt_branch="refs/heads/$branch"
  if git -C "$ROOT_DIR" worktree list --porcelain | grep -q "branch $wt_branch"; then
    echo "  skip (worktree active): $branch"
    continue
  fi

  if $DRY_RUN; then
    echo "  would delete: $branch"
  else
    git -C "$ROOT_DIR" branch -d "$branch" 2>/dev/null && echo "  deleted: $branch" || echo "  failed: $branch"
  fi
  ((merged++)) || true
done < <(git -C "$ROOT_DIR" branch --merged main)

echo
echo "$merged merged branch(es) found."

# Remote pruning
echo
echo "=== Pruning remote tracking refs ==="
if $DRY_RUN; then
  echo "(would run git remote prune origin)"
else
  git -C "$ROOT_DIR" remote prune origin
  echo "Done."
fi
