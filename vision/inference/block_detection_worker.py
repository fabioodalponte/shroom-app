"""Subprocess worker for YOLO block detection.

This isolates native runtime faults such as SIGILL/SIGSEGV from the main pipeline
process so the orchestrator can persist a structured error instead of crashing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from .block_detection import detect_blocks_in_process


def main() -> int:
    raw_payload = sys.stdin.read().strip()
    if not raw_payload:
        print(json.dumps({"error": "missing stdin payload"}))
        return 1

    try:
        payload = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"invalid stdin json: {exc}"}))
        return 1

    image_path = payload.get("image_path")
    if not image_path:
        print(json.dumps({"error": "image_path is required"}))
        return 1

    result = detect_blocks_in_process(
        image_path=Path(str(image_path)),
        config=payload.get("config") or {},
        logger=None,
    )
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
