"""Initial block detection stage using YOLOv8 with safe fallback."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from ..models.yolo_block_detector import load_block_detector


def _empty_detection_result(
    config: dict[str, Any] | None,
    error: str | None = None,
) -> dict[str, Any]:
    inference_config = (config or {}).get("inference", {})
    return {
        "enabled": bool(inference_config.get("enabled", True)),
        "model": str(inference_config.get("model", "vision/models/block_detector.pt")),
        "device": str(inference_config.get("device", "cpu") or "cpu"),
        "blocos_detectados": 0,
        "detections": [],
        "error": error,
    }


def detect_blocks(
    image_path: str | Path,
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    """Detect mushroom blocks in one image without breaking the pipeline."""
    path = Path(image_path)
    if logger:
        logger.info("vision block_detection_start image_path=%s", path)

    detector = load_block_detector(config=config, logger=logger)
    if not detector.enabled or not detector.available or detector.model is None:
        result = _empty_detection_result(config, error=detector.error)
        if logger:
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s blocks_detected=%s",
                path,
                False,
                0,
            )
            logger.info("vision blocks_detected=%s image_path=%s", 0, path)
        return result

    inference_config = (config or {}).get("inference", {})
    confidence_threshold = float(inference_config.get("confidence_threshold", 0.25))

    try:
        results = detector.model.predict(
            source=str(path),
            device=detector.device,
            conf=confidence_threshold,
            verbose=False,
        )

        detections: list[dict[str, Any]] = []
        for result in results or []:
            names = getattr(result, "names", None) or getattr(detector.model, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue

            xyxy_values = boxes.xyxy.tolist() if getattr(boxes, "xyxy", None) is not None else []
            confidence_values = boxes.conf.tolist() if getattr(boxes, "conf", None) is not None else []
            class_values = boxes.cls.tolist() if getattr(boxes, "cls", None) is not None else []

            for xyxy, confidence, class_id in zip(xyxy_values, confidence_values, class_values):
                class_index = int(class_id)
                raw_label = names.get(class_index, str(class_index)) if isinstance(names, dict) else str(class_index)
                label = str(raw_label).strip().lower()
                if label != "bloco":
                    continue

                detections.append(
                    {
                        "label": "bloco",
                        "confidence": round(float(confidence), 4),
                        "bbox": [round(float(value), 2) for value in xyxy],
                    }
                )

        payload = {
            "enabled": True,
            "model": str(detector.model_path),
            "device": detector.device,
            "blocos_detectados": len(detections),
            "detections": detections,
            "error": None,
        }
        if logger:
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s blocks_detected=%s",
                path,
                True,
                len(detections),
            )
            logger.info("vision blocks_detected=%s image_path=%s", len(detections), path)
        return payload
    except Exception as exc:  # pragma: no cover - depends on model/runtime
        if logger:
            logger.exception("vision block_detection_failed image_path=%s", path)
        result = _empty_detection_result(config, error=str(exc))
        if logger:
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s blocks_detected=%s",
                path,
                True,
                0,
            )
            logger.info("vision blocks_detected=%s image_path=%s", 0, path)
        return result
