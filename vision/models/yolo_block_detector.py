"""YOLOv8 block detector loader with safe CPU fallback."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class BlockDetectorHandle:
    """Represents the optional YOLO model runtime state."""

    enabled: bool
    available: bool
    model: Any | None
    model_path: Path
    device: str
    error: str | None = None


DEFAULT_MODEL_PATH = Path("vision/models/block_detector.pt")
DEFAULT_DEVICE = "cpu"
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def load_block_detector(
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> BlockDetectorHandle:
    """Load the YOLOv8 detector if the dependency and model are available."""
    inference_config = (config or {}).get("inference", {})
    enabled = bool(inference_config.get("enabled", True))
    configured_model_path = Path(inference_config.get("model", DEFAULT_MODEL_PATH)).expanduser()
    model_path = configured_model_path if configured_model_path.is_absolute() else (PROJECT_ROOT / configured_model_path).resolve()
    device = str(inference_config.get("device", DEFAULT_DEVICE) or DEFAULT_DEVICE)

    if not enabled:
        return BlockDetectorHandle(
            enabled=False,
            available=False,
            model=None,
            model_path=model_path,
            device=device,
            error="inference disabled by config",
        )

    if not model_path.exists():
        return BlockDetectorHandle(
            enabled=True,
            available=False,
            model=None,
            model_path=model_path,
            device=device,
            error=f"model file not found: {model_path}",
        )

    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        if logger:
            logger.warning("vision block_detector_unavailable reason=%s", exc)
        return BlockDetectorHandle(
            enabled=True,
            available=False,
            model=None,
            model_path=model_path,
            device=device,
            error=f"ultralytics import failed: {exc}",
        )

    try:
        model = YOLO(str(model_path))
    except Exception as exc:  # pragma: no cover - model load depends on runtime
        if logger:
            logger.exception("vision block_detector_load_failed model_path=%s", model_path)
        return BlockDetectorHandle(
            enabled=True,
            available=False,
            model=None,
            model_path=model_path,
            device=device,
            error=f"model load failed: {exc}",
        )

    if logger:
        logger.info(
            "vision block_detector_loaded model_path=%s device=%s",
            model_path,
            device,
        )

    return BlockDetectorHandle(
        enabled=True,
        available=True,
        model=model,
        model_path=model_path,
        device=device,
        error=None,
    )
