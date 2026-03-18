#!/usr/bin/env python3
"""Validate the Raspberry vision inference runtime step by step."""

from __future__ import annotations

import argparse
import json
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]


def run_step(name: str, command: list[str], timeout: int = 60, stdin_payload: str | None = None) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            input=stdin_payload,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            cwd=str(ROOT_DIR),
        )
    except subprocess.TimeoutExpired:
        return {
            "name": name,
            "ok": False,
            "returncode": None,
            "error": f"timeout after {timeout}s",
        }
    except Exception as exc:
        return {
            "name": name,
            "ok": False,
            "returncode": None,
            "error": str(exc),
        }

    result = {
        "name": name,
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "stdout": (completed.stdout or "").strip(),
        "stderr": (completed.stderr or "").strip(),
    }

    if completed.returncode < 0:
        result["error"] = f"terminated_by_signal_{abs(completed.returncode)}"
    elif completed.returncode != 0 and not result["stderr"]:
        result["error"] = f"exit_code_{completed.returncode}"

    return result


def pick_latest_snapshot() -> Path | None:
    artifacts_dir = ROOT_DIR / "vision" / "storage" / "artifacts"
    candidates = list(artifacts_dir.rglob("snapshot_*.jpg"))
    if not candidates:
        return None
    return max(candidates, key=lambda item: item.stat().st_mtime)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check the Raspberry inference environment for YOLO block detection")
    parser.add_argument("--config", default="vision/config/vision_config.json")
    parser.add_argument("--image-path", help="Specific image to use for the minimal inference probe")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    image_path = Path(args.image_path).expanduser().resolve() if args.image_path else pick_latest_snapshot()
    config_path = Path(args.config).expanduser().resolve()

    steps = [
        run_step(
            "import_torch",
            [sys.executable, "-c", "import torch; print(torch.__version__)"],
            timeout=args.timeout,
        ),
        run_step(
            "import_torchvision",
            [sys.executable, "-c", "import torchvision; print(torchvision.__version__)"],
            timeout=args.timeout,
        ),
        run_step(
            "import_ultralytics",
            [sys.executable, "-c", "import ultralytics; print(ultralytics.__version__)"],
            timeout=args.timeout,
        ),
        run_step(
            "load_model",
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from vision.config.loader import load_vision_config; "
                    "from vision.models.yolo_block_detector import load_block_detector; "
                    f"config = load_vision_config(r'{config_path}'); "
                    "handle = load_block_detector(config=config, logger=None); "
                    "print(json.dumps({'available': handle.available, 'model_path': str(handle.model_path), 'error': handle.error}))"
                ),
            ],
            timeout=args.timeout,
        ),
    ]

    if image_path and image_path.exists():
        payload = json.dumps({
            "image_path": str(image_path),
            "config": json.loads(config_path.read_text(encoding="utf-8")),
        })
        steps.append(
            run_step(
                "minimal_inference",
                [sys.executable, "-m", "vision.inference.block_detection_worker"],
                timeout=args.timeout,
                stdin_payload=payload,
            )
        )

    summary = {
        "python_executable": sys.executable,
        "python_version": sys.version,
        "platform": {
            "machine": platform.machine(),
            "processor": platform.processor(),
            "system": platform.system(),
            "release": platform.release(),
        },
        "config_path": str(config_path),
        "image_path": str(image_path) if image_path else None,
        "steps": steps,
    }

    print(json.dumps(summary, indent=2))
    return 0 if all(step["ok"] for step in steps) else 1


if __name__ == "__main__":
    raise SystemExit(main())
