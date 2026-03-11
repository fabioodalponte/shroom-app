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
from .storage.dataset_classifier import DatasetClassifier
from .storage.remote_persistence import VisionRemotePersister


class VisionOrchestrator:
    """Coordinates capture, inference and persistence."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.logger = get_vision_logger(config)
        self.capture_client = ESP32CamCaptureClient(config)
        self.inference_pipeline = VisionInferencePipeline(config, logger=self.logger)
        self.artifact_store = ArtifactStore(config)
        self.dataset_classifier = DatasetClassifier(config, logger=self.logger)
        self.remote_persister = VisionRemotePersister(config, logger=self.logger, artifact_store=self.artifact_store)

    def status(self) -> dict[str, Any]:
        """Return static runtime status without touching camera or model."""
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "enabled": self.config.get("enabled", False),
            "camera_url": self.config.get("capture", {}).get("camera_url"),
            "capture_timeout_seconds": self.config.get("capture", {}).get("request_timeout_seconds", 15),
            "capture_retries": self.config.get("capture", {}).get("request_retries", 3),
            "capture_retry_backoff_seconds": self.config.get("capture", {}).get("retry_backoff_seconds", 1.0),
            "artifacts_dir": str(self.artifact_store.artifacts_dir),
            "results_dir": str(self.artifact_store.results_dir),
            "dataset_dir": str(self.artifact_store.dataset_dir),
            "log_dir": str(self.config.get("logging", {}).get("dir", "vision/logs")),
            "mode": self.config.get("inference", {}).get("mode", "stub"),
            "inference_enabled": self.config.get("inference", {}).get("enabled", True),
            "inference_model": self.config.get("inference", {}).get("model"),
            "inference_device": self.config.get("inference", {}).get("device", "cpu"),
            "quality_thresholds": self.inference_pipeline.quality_thresholds,
            "dataset_classification_enabled": self.dataset_classifier.enabled,
            "remote_persistence_enabled": self.remote_persister.enabled,
            "remote_env_ready": self.remote_persister.env_config.is_ready,
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
        dataset_classification = self.dataset_classifier.classify_safe(
            image_path=saved_image,
            quality_check=inference_result["quality_check"],
        )
        inference_result["dataset_classification"] = dataset_classification
        inference_result["summary"]["dataset_class"] = dataset_classification["dataset_class"]
        remote_persistence = self.remote_persister.persist_pipeline_result_safe(
            image_path=saved_image,
            pipeline_result=inference_result,
        )
        inference_result["remote_persistence"] = remote_persistence
        inference_result["remote_persisted"] = remote_persistence["remote_persisted"]
        inference_result["storage_uploaded"] = remote_persistence["storage_uploaded"]
        inference_result["db_record_created"] = remote_persistence["db_record_created"]
        inference_result["summary"]["remote_persisted"] = remote_persistence["remote_persisted"]

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

    def quality_latest(self) -> dict[str, Any]:
        """Run quality analysis against the latest saved snapshot."""
        latest_snapshot = self.artifact_store.find_latest_snapshot()
        if latest_snapshot is None:
            return {
                "status": "no_snapshot_found",
                "artifacts_dir": str(self.artifact_store.artifacts_dir),
            }

        quality_result = self.inference_pipeline.analyze_image_quality(latest_snapshot)
        saved_result = self.artifact_store.save_quality_result(latest_snapshot, quality_result)
        self.logger.info(
            "quality_result_saved image_path=%s result_path=%s status=%s",
            latest_snapshot,
            saved_result,
            quality_result["status"],
        )

        return {
            "status": "quality_complete",
            "image_path": str(latest_snapshot),
            "saved_result": str(saved_result),
            "quality_check": quality_result,
        }

    def dataset_classify_latest(self) -> dict[str, Any]:
        """Run quality check and dataset classification for the latest snapshot."""
        latest_snapshot = self.artifact_store.find_latest_snapshot()
        if latest_snapshot is None:
            return {
                "status": "no_snapshot_found",
                "artifacts_dir": str(self.artifact_store.artifacts_dir),
            }

        quality_result = self.inference_pipeline.analyze_image_quality(latest_snapshot)
        dataset_classification = self.dataset_classifier.classify_safe(
            image_path=latest_snapshot,
            quality_check=quality_result,
        )
        payload = {
            "status": "dataset_classification_complete",
            "image_path": str(latest_snapshot),
            "quality_check": quality_result,
            "dataset_classification": dataset_classification,
        }
        saved_result = self.artifact_store.save_quality_result(latest_snapshot, payload)
        self.logger.info(
            "dataset_classification_result_saved image_path=%s result_path=%s dataset_class=%s",
            latest_snapshot,
            saved_result,
            dataset_classification["dataset_class"],
        )
        payload["saved_result"] = str(saved_result)
        return payload

    def detect_blocks_latest(self) -> dict[str, Any]:
        """Run only the block detector against the latest saved snapshot."""
        latest_snapshot = self.artifact_store.find_latest_snapshot()
        if latest_snapshot is None:
            return {
                "status": "no_snapshot_found",
                "artifacts_dir": str(self.artifact_store.artifacts_dir),
            }

        detection_result = self.inference_pipeline.detect_blocks(latest_snapshot)
        return {
            "status": "block_detection_complete",
            "image_path": str(latest_snapshot),
            "block_detection": detection_result,
        }


def print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Shroom vision module runner")
    parser.add_argument(
        "command",
        choices=["status", "capture-once", "pipeline-once", "quality-latest", "dataset-classify-latest", "detect-blocks-latest"],
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

        if args.command == "quality-latest":
            print_json(orchestrator.quality_latest())
            return 0

        if args.command == "dataset-classify-latest":
            print_json(orchestrator.dataset_classify_latest())
            return 0

        if args.command == "detect-blocks-latest":
            print_json(orchestrator.detect_blocks_latest())
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
