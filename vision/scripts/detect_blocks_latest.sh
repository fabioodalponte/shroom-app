#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${1:-vision/config/vision_config.json}"
python3 -m vision.runner detect-blocks-latest --config "$CONFIG_PATH"
