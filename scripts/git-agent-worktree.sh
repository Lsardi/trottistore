#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage:"
  echo "  $0 init <agent> [topic] [base-ref]"
  echo "  $0 install-hooks [path]"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREES_DIR="$ROOT_DIR/.worktrees"
HOOKS_DIR="$ROOT_DIR/.githooks"

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//'
}

install_hooks() {
  local target_dir="${1:-$(pwd)}"
  git -C "$target_dir" config core.hooksPath "$HOOKS_DIR"
  echo "Hooks installes pour: $target_dir"
}

init_worktree() {
  local agent_raw="$1"
  local topic_raw="${2:-task}"
  local base_ref="${3:-origin/main}"

  local agent
  local topic
  agent="$(slugify "$agent_raw")"
  topic="$(slugify "$topic_raw")"

  if [[ -z "$agent" || -z "$topic" ]]; then
    echo "agent/topic invalides apres normalisation"
    exit 1
  fi

  mkdir -p "$WORKTREES_DIR"
  mkdir -p "$HOOKS_DIR"

  git -C "$ROOT_DIR" config extensions.worktreeConfig true

  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  local branch="${agent}/${topic}-${ts}"
  local path="$WORKTREES_DIR/${agent}-${topic}"

  if [[ -e "$path" ]]; then
    echo "Le worktree existe deja: $path"
    echo "Utilisez un autre topic ou supprimez l'ancien worktree."
    exit 1
  fi

  git -C "$ROOT_DIR" fetch --all --prune
  git -C "$ROOT_DIR" worktree add -b "$branch" "$path" "$base_ref"

  git -C "$path" config --worktree trottistore.agent "$agent"
  git -C "$path" config --worktree trottistore.topic "$topic"
  git -C "$path" config --worktree push.default current
  git -C "$path" config --worktree core.hooksPath "$HOOKS_DIR"

  echo
  echo "Worktree cree:"
  echo "  Path   : $path"
  echo "  Branch : $branch"
  echo
  echo "Lance ton terminal/agent dans ce dossier pour eviter tout conflit de branche."
}

case "$1" in
  init)
    if [[ $# -lt 2 ]]; then
      echo "Usage: $0 init <agent> [topic] [base-ref]"
      exit 1
    fi
    init_worktree "$2" "${3:-task}" "${4:-origin/main}"
    ;;
  install-hooks)
    install_hooks "${2:-}"
    ;;
  *)
    echo "Commande inconnue: $1"
    exit 1
    ;;
esac
