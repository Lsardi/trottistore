#!/usr/bin/env bash
set -euo pipefail

# Rebase all worktrees onto latest origin/main.
# Usage: ./scripts/git-agent-rebase-all.sh [--dry-run]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

echo "Fetching origin..."
git -C "$ROOT_DIR" fetch --all --prune

MAIN_HEAD="$(git -C "$ROOT_DIR" rev-parse origin/main)"
echo "origin/main: $MAIN_HEAD"
echo

fails=0

while IFS= read -r wt_path; do
  [[ "$wt_path" == "$ROOT_DIR" ]] && continue  # skip main worktree

  branch="$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "DETACHED")"
  behind="$(git -C "$wt_path" rev-list --count HEAD..origin/main 2>/dev/null || echo "?")"

  if [[ "$behind" == "0" ]]; then
    echo "✓ $branch — already up to date"
    continue
  fi

  dirty="$(git -C "$wt_path" status --porcelain 2>/dev/null | head -1)"
  if [[ -n "$dirty" ]]; then
    echo "⚠ $branch — dirty worktree ($behind behind), skipping"
    ((fails++)) || true
    continue
  fi

  if $DRY_RUN; then
    echo "→ $branch — $behind behind (would rebase)"
  else
    echo "→ $branch — rebasing ($behind behind)..."
    if git -C "$wt_path" rebase origin/main --quiet 2>/dev/null; then
      echo "  ✓ rebased"
    else
      echo "  ✗ conflict — aborting rebase"
      git -C "$wt_path" rebase --abort 2>/dev/null || true
      ((fails++)) || true
    fi
  fi
done < <(git -C "$ROOT_DIR" worktree list --porcelain | awk '/^worktree / { print $2 }')

echo
if [[ $fails -gt 0 ]]; then
  echo "Done. $fails worktree(s) need manual attention."
else
  echo "Done. All worktrees up to date."
fi
