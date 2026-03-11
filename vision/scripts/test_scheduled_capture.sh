#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${1:-vision/config/vision_config.json}"
python3 -m vision.runner scheduled-capture --config "$CONFIG_PATH"
