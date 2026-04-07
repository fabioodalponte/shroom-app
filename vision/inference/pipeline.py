"""Placeholder inference pipeline with local image quality analysis."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .block_detection import detect_blocks
from .evaluation import build_quality_thresholds, evaluate_quality
from .metrics import calculate_quality_metrics
from .preprocessing import ImageQualityError, load_image_bundle


def calculate_average_detection_confidence(detections: list[dict[str, Any]]) -> float | None:
    confidences = [
        float(detection["confidence"])
        for detection in detections
        if detection.get("confidence") is not None
    ]
    if not confidences:
        return None
    return round(sum(confidences) / len(confidences), 4)


class VisionInferencePipeline:
    """Stub pipeline that now includes quality checks before real AI exists."""

    def __init__(self, config: dict[str, Any], logger: logging.Logger) -> None:
        self.config = config
        self.logger = logger
        self.mode = config.get("inference", {}).get("mode", "stub")
        self.target_labels = config.get("inference", {}).get("target_labels", [])
        self.quality_thresholds = build_quality_thresholds(config)

    def analyze_image_quality(self, image_path: Path) -> dict[str, Any]:
        """Run the local image quality checks without AI detection."""
        try:
            image_bundle = load_image_bundle(image_path)
            metrics = calculate_quality_metrics(image_bundle)
            evaluation = evaluate_quality(metrics, self.quality_thresholds)

            self.logger.info(
                "quality_check_complete image_path=%s status=%s brightness_mean=%s contrast_stddev=%s sharpness_score=%s",
                image_path,
                evaluation["status"],
                metrics["brightness_mean"],
                metrics["contrast_stddev"],
                metrics["sharpness_score"],
            )
            return {
                "status": evaluation["status"],
                "dataset_eligible": evaluation["dataset_eligible"],
                "metrics": metrics,
                "flags": {
                    **evaluation["flags"],
                    "invalid_image": False,
                },
                "thresholds": evaluation["thresholds"],
                "error": None,
            }
        except ImageQualityError as exc:
            self.logger.error("quality_check_failed image_path=%s error=%s", image_path, exc)
            return {
                "status": "invalid_image",
                "dataset_eligible": False,
                "metrics": None,
                "flags": {
                    "low_resolution": False,
                    "too_dark": False,
                    "too_bright": False,
                    "too_blurry": False,
                    "invalid_image": True,
                },
                "thresholds": self.quality_thresholds,
                "error": str(exc),
            }
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.exception("quality_check_unexpected_error image_path=%s", image_path)
            return {
                "status": "invalid_image",
                "dataset_eligible": False,
                "metrics": None,
                "flags": {
                    "low_resolution": False,
                    "too_dark": False,
                    "too_bright": False,
                    "too_blurry": False,
                    "invalid_image": True,
                },
                "thresholds": self.quality_thresholds,
                "error": str(exc),
            }

    def detect_blocks(self, image_path: Path) -> dict[str, Any]:
        """Run optional YOLOv8 block detection with safe fallback."""
        return detect_blocks(
            image_path=image_path,
            config=self.config,
            logger=self.logger,
        )

    def run(self, image_path: Path, capture_metadata: dict[str, Any]) -> dict[str, Any]:
        lote_id = capture_metadata.get("lote_id")
        quality_check = self.analyze_image_quality(image_path)
        block_detection = self.detect_blocks(image_path)
        average_detection_confidence = calculate_average_detection_confidence(block_detection["detections"])
        last_error = (
            quality_check.get("error")
            or block_detection.get("error")
            or None
        )
        return {
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "mode": self.mode,
            "image_path": str(image_path),
            "lote_id": lote_id,
            "capture_metadata": capture_metadata,
            "config_name": capture_metadata.get("config_name"),
            "room_name": capture_metadata.get("room_name"),
            "camera_name": capture_metadata.get("camera_name"),
            "camera_status": capture_metadata.get("camera_status"),
            "quality_check": quality_check,
            "block_detection": block_detection,
            "model_version": block_detection.get("model_version"),
            "model_path": block_detection.get("model_path"),
            "used_fallback": bool(block_detection.get("used_fallback", False)),
            "last_error": last_error,
            "summary": {
                "lote_id": lote_id,
                "config_name": capture_metadata.get("config_name"),
                "room_name": capture_metadata.get("room_name"),
                "camera_name": capture_metadata.get("camera_name"),
                "camera_status": capture_metadata.get("camera_status"),
                "blocos_detectados": block_detection["blocos_detectados"],
                "confianca_media_blocos": average_detection_confidence,
                "block_detection_error": block_detection.get("error"),
                "model_version": block_detection.get("model_version"),
                "model_path": block_detection.get("model_path"),
                "used_fallback": bool(block_detection.get("used_fallback", False)),
                "last_error": last_error,
                "contaminacao_visual_detectada": False,
                "colonizacao_estimada": None,
                "quality_status": quality_check["status"],
                "dataset_eligible": quality_check["dataset_eligible"],
            },
            "detections": block_detection["detections"],
            "notes": [
                "Pipeline executado com quality check local e detector inicial de blocos.",
                "A deteccao de colonizacao e contaminacao_visual ainda nao esta implementada.",
                "Se o modelo YOLO nao existir, a deteccao retorna lista vazia sem quebrar o fluxo.",
            ],
            "target_labels": self.target_labels,
        }
