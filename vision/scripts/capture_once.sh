#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG_PATH="${1:-$ROOT_DIR/vision/config/vision_config.json}"

resolve_python_bin() {
  if [[ -n "${VISION_PYTHON_BIN:-}" ]]; then
    printf '%s\n' "$VISION_PYTHON_BIN"
    return
  fi
  if [[ -x "$ROOT_DIR/.venv311/bin/python3" ]]; then
    printf '%s\n' "$ROOT_DIR/.venv311/bin/python3"
    return
  fi
  if [[ -x "$ROOT_DIR/.venv/bin/python3" ]]; then
    printf '%s\n' "$ROOT_DIR/.venv/bin/python3"
    return
  fi
  command -v python3
}

PYTHON_BIN="$(resolve_python_bin)"

cd "$ROOT_DIR"
"$PYTHON_BIN" -m vision.runner capture-once --config "$CONFIG_PATH"
