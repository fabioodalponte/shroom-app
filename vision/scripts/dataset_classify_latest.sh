#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG_PATH="${1:-$ROOT_DIR/vision/config/vision_config.json}"

cd "$ROOT_DIR"
python3 -m vision.runner dataset-classify-latest --config "$CONFIG_PATH"
