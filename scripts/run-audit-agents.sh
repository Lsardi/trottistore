#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/lyes/trottistore"
PROMPTS_DIR="${PROMPTS_DIR:-/tmp/codex-agent-prompts}"
LOG_ROOT="${LOG_ROOT:-/tmp/codex-agent-runs}"
MODEL="${MODEL:-gpt-5.4}"

ORDER=(
  agent-2
  agent-1
  agent-4
  agent-5
  agent-3
  agent-6
  agent-7
  agent-8
  agent-9
  agent-10
  agent-11
)

usage() {
  cat <<'EOF'
Usage:
  scripts/run-audit-agents.sh [all|agent-2 agent-1 ...]

Behavior:
  - generates prompts if missing
  - runs each agent with `codex exec`
  - stores JSONL event logs and final messages
  - captures a status snapshot after each run:
    - exit code
    - git status --short
    - git diff --stat

Environment overrides:
  PROMPTS_DIR=/tmp/codex-agent-prompts
  LOG_ROOT=/tmp/codex-agent-runs
  MODEL=gpt-5.4
EOF
}

ensure_prompts() {
  if [[ ! -d "$PROMPTS_DIR" ]] || [[ ! -f "$PROMPTS_DIR/agent-2.txt" ]]; then
    bash "$REPO_DIR/scripts/generate-audit-agent-prompts.sh" "$PROMPTS_DIR"
  fi
}

snapshot_status() {
  local agent="$1"
  local run_dir="$2"

  {
    printf 'agent=%s\n' "$agent"
    printf 'timestamp=%s\n' "$(date -Iseconds)"
    printf 'branch=%s\n' "$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
    printf 'head=%s\n' "$(git -C "$REPO_DIR" rev-parse HEAD)"
    printf '\n[git status --short]\n'
    git -C "$REPO_DIR" status --short
    printf '\n[git diff --stat]\n'
    git -C "$REPO_DIR" diff --stat
  } > "$run_dir/status.txt"
}

run_agent() {
  local agent="$1"
  local prompt_file="$PROMPTS_DIR/${agent}.txt"

  if [[ ! -f "$prompt_file" ]]; then
    echo "Missing prompt file: $prompt_file" >&2
    return 1
  fi

  local run_dir="$LOG_ROOT/$agent"
  mkdir -p "$run_dir"

  echo "==> Running $agent"
  echo "    prompt: $prompt_file"
  echo "    logs:   $run_dir"

  set +e
  codex exec \
    --full-auto \
    --json \
    -m "$MODEL" \
    -C "$REPO_DIR" \
    -o "$run_dir/last-message.txt" \
    - < "$prompt_file" | tee "$run_dir/events.jsonl"
  local exit_code=${PIPESTATUS[0]}
  set -e

  printf '%s\n' "$exit_code" > "$run_dir/exit-code.txt"
  snapshot_status "$agent" "$run_dir"

  if [[ $exit_code -ne 0 ]]; then
    echo "!! $agent failed with exit code $exit_code" >&2
    return "$exit_code"
  fi

  echo "==> $agent done"
}

main() {
  cd "$REPO_DIR"
  mkdir -p "$LOG_ROOT"
  ensure_prompts

  if [[ $# -gt 0 ]] && [[ "$1" == "--help" || "$1" == "-h" ]]; then
    usage
    exit 0
  fi

  local targets=()
  if [[ $# -eq 0 || "$1" == "all" ]]; then
    targets=("${ORDER[@]}")
  else
    targets=("$@")
  fi

  for agent in "${targets[@]}"; do
    run_agent "$agent"
  done

  echo
  echo "All requested agents completed."
  echo "Logs: $LOG_ROOT"
}

main "$@"
