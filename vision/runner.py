"""Main orchestration entrypoint for the vision module."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .capture.esp32_cam_capture import ESP32CamCaptureClient, capture_snapshot_safe
from .config.loader import load_vision_config
from .inference.pipeline import VisionInferencePipeline
from .logging_utils import get_vision_logger
from .storage.artifact_store import ArtifactStore


class VisionOrchestrator:
    """Coordinates capture, inference and persistence."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.logger = get_vision_logger(config)
        self.capture_client = ESP32CamCaptureClient(config)
        self.inference_pipeline = VisionInferencePipeline(config)
        self.artifact_store = ArtifactStore(config)

    def status(self) -> dict[str, Any]:
        """Return static runtime status without touching camera or model."""
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "enabled": self.config.get("enabled", False),
            "camera_url": self.config.get("capture", {}).get("camera_url"),
            "artifacts_dir": str(self.artifact_store.artifacts_dir),
            "dataset_dir": str(self.artifact_store.dataset_dir),
            "log_dir": str(self.config.get("logging", {}).get("dir", "vision/logs")),
            "mode": self.config.get("inference", {}).get("mode", "stub"),
        }

    def capture_once(self) -> dict[str, Any]:
        """Capture and store one snapshot without crashing the runner on failure."""
        capture_result = capture_snapshot_safe(self.capture_client, self.logger)
        if not capture_result["ok"]:
            return {
                "status": "capture_failed",
                "error": capture_result["error"],
                "camera_url": capture_result["camera_url"],
            }

        image_bytes = capture_result["image_bytes"]
        metadata = capture_result["metadata"]
        saved_image = self.artifact_store.save_snapshot(image_bytes, metadata)
        self.logger.info("snapshot_saved image_path=%s", saved_image)

        return {
            "status": "captured",
            "saved_image": str(saved_image),
            "metadata": metadata,
        }

    def pipeline_once(self) -> dict[str, Any]:
        """Run the full placeholder pipeline once without crashing on capture errors."""
        capture_result = capture_snapshot_safe(self.capture_client, self.logger)
        if not capture_result["ok"]:
            return {
                "status": "pipeline_capture_failed",
                "error": capture_result["error"],
                "camera_url": capture_result["camera_url"],
            }

        image_bytes = capture_result["image_bytes"]
        capture_metadata = capture_result["metadata"]
        saved_image = self.artifact_store.save_snapshot(image_bytes, capture_metadata)
        self.logger.info("snapshot_saved image_path=%s", saved_image)

        inference_result = self.inference_pipeline.run(
            image_path=saved_image,
            capture_metadata=capture_metadata,
        )

        saved_result = self.artifact_store.save_inference_result(
            image_path=saved_image,
            result=inference_result,
        )

        return {
            "status": "pipeline_complete",
            "saved_image": str(saved_image),
            "saved_result": str(saved_result),
            "result": inference_result,
        }


def print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Shroom vision module runner")
    parser.add_argument(
        "command",
        choices=["status", "capture-once", "pipeline-once"],
        help="Action to execute",
    )
    parser.add_argument(
        "--config",
        default=str(Path(__file__).resolve().parent / "config" / "vision_config.json"),
        help="Path to the vision config JSON file",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        config = load_vision_config(args.config)
        orchestrator = VisionOrchestrator(config)

        if args.command == "status":
            print_json(orchestrator.status())
            return 0

        if args.command == "capture-once":
            print_json(orchestrator.capture_once())
            return 0

        if args.command == "pipeline-once":
            print_json(orchestrator.pipeline_once())
            return 0

        raise ValueError(f"Unsupported command: {args.command}")
    except Exception as exc:
        print_json(
            {
                "status": "runner_error",
                "error": str(exc),
                "command": args.command,
            }
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
