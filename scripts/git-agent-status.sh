#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Repo: $ROOT_DIR"
echo
git -C "$ROOT_DIR" worktree list --porcelain | awk '
  /^worktree / { wt=$2; next }
  /^HEAD / { head=$2; next }
  /^branch / {
    br=$2
    sub("refs/heads/","",br)
    cmd="git -C \"" wt "\" config --worktree --get trottistore.agent 2>/dev/null"
    cmd | getline agent
    close(cmd)
    if (agent == "") { agent = "-" }
    printf("worktree=%s\n  branch=%s\n  head=%s\n  agent=%s\n\n", wt, br, head, agent)
    wt=""; head=""; br=""
  }
'
