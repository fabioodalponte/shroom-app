#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-}"
CONFIG_PATH="${2:-vision/config/vision_config.json}"

if [[ "$ACTION" != "on" && "$ACTION" != "off" ]]; then
  echo "usage: ./vision/scripts/test_light_control.sh on|off [config_path]" >&2
  exit 1
fi

python3 - "$ACTION" "$CONFIG_PATH" <<'PY'
import json
import sys

from vision.config.loader import load_vision_config
from vision.hardware.light_control import turn_light_off, turn_light_on
from vision.logging_utils import get_vision_logger

action = sys.argv[1]
config_path = sys.argv[2]
config = load_vision_config(config_path)
logger = get_vision_logger(config)

if action == "on":
    result = turn_light_on(config, logger)
else:
    result = turn_light_off(config, logger)

print(json.dumps(result, indent=2, ensure_ascii=True))
PY
