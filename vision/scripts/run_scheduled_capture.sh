#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${VISION_ENV_FILE:-$ROOT_DIR/vision/config/.env.local}"
LOG_DIR="$ROOT_DIR/vision/logs"
LOG_FILE="$LOG_DIR/cron.log"
PYTHON_BIN="${VISION_PYTHON_BIN:-$ROOT_DIR/.venv/bin/python3}"

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

timestamp() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

echo "[$(timestamp)] scheduled-capture wrapper start"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(timestamp)] ERROR missing env file: $ENV_FILE" >&2
  echo "[$(timestamp)] Hint: copy vision/config/.env.example to vision/config/.env.local and fill the values." >&2
  exit 1
fi

if [[ ! -r "$ENV_FILE" ]]; then
  echo "[$(timestamp)] ERROR env file is not readable: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "[$(timestamp)] ERROR python executable not found or not executable: $PYTHON_BIN" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$ROOT_DIR"

echo "[$(timestamp)] INFO env loaded from $ENV_FILE"
echo "[$(timestamp)] INFO running scheduled-capture with $PYTHON_BIN"

if "$PYTHON_BIN" -m vision.runner scheduled-capture; then
  echo "[$(timestamp)] scheduled-capture wrapper complete exit_code=0"
  exit 0
fi

exit_code=$?
echo "[$(timestamp)] ERROR scheduled-capture wrapper failed exit_code=$exit_code" >&2
exit "$exit_code"
