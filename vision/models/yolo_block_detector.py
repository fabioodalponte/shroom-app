"""YOLOv8 block detector loader with safe CPU fallback."""

from __future__ import annotations

import logging
import sys
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
    model_version: str
    device: str
    requested_model_path: Path
    fallback_model_path: Path | None = None
    used_fallback: bool = False
    error: str | None = None


MODEL_PATH = Path("vision/models/block_detector_v2.pt")
FALLBACK_MODEL_PATH = Path("vision/models/block_detector.pt")
DEFAULT_DEVICE = "cpu"
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def resolve_model_path(raw_path: str | Path) -> Path:
    path = Path(raw_path).expanduser()
    return path if path.is_absolute() else (PROJECT_ROOT / path).resolve()


def infer_model_version(model_path: str | Path) -> str:
    stem = Path(model_path).stem.lower()
    if stem.endswith("_v2") or "v2" in stem:
        return "v2"
    if stem.endswith("_v1") or stem == "block_detector":
        return "v1"
    return stem


def resolve_configured_model_paths(config: dict[str, Any] | None = None) -> tuple[Path, Path | None]:
    inference_config = (config or {}).get("inference", {})
    primary_model = inference_config.get("model_path") or inference_config.get("model") or MODEL_PATH
    fallback_model = inference_config.get("fallback_model_path") or inference_config.get("fallback_model") or FALLBACK_MODEL_PATH

    primary_model_path = resolve_model_path(primary_model)
    fallback_model_path = resolve_model_path(fallback_model)
    if fallback_model_path == primary_model_path:
        fallback_model_path = None

    return primary_model_path, fallback_model_path


def load_block_detector(
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> BlockDetectorHandle:
    """Load the YOLOv8 detector if the dependency and model are available."""
    inference_config = (config or {}).get("inference", {})
    enabled = bool(inference_config.get("enabled", True))
    primary_model_path, fallback_model_path = resolve_configured_model_paths(config)
    device = str(inference_config.get("device", DEFAULT_DEVICE) or DEFAULT_DEVICE)

    if not enabled:
        return BlockDetectorHandle(
            enabled=False,
            available=False,
            model=None,
            model_path=primary_model_path,
            model_version=infer_model_version(primary_model_path),
            device=device,
            requested_model_path=primary_model_path,
            fallback_model_path=fallback_model_path,
            error="inference disabled by config",
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
            model_path=primary_model_path,
            model_version=infer_model_version(primary_model_path),
            device=device,
            requested_model_path=primary_model_path,
            fallback_model_path=fallback_model_path,
            error=f"ultralytics import failed in {sys.executable}: {exc}",
        )

    attempted_errors: list[str] = []
    candidates: list[tuple[Path, bool]] = [(primary_model_path, False)]
    if fallback_model_path is not None:
        candidates.append((fallback_model_path, True))

    for candidate_path, used_fallback in candidates:
        if not candidate_path.exists():
            attempted_errors.append(f"model file not found: {candidate_path}")
            if logger and not used_fallback and fallback_model_path is not None:
                logger.warning(
                    "vision block_detector_primary_missing primary_model_path=%s fallback_model_path=%s",
                    candidate_path,
                    fallback_model_path,
                )
            continue

        try:
            model = YOLO(str(candidate_path))
        except Exception as exc:  # pragma: no cover - model load depends on runtime
            attempted_errors.append(f"model load failed for {candidate_path}: {exc}")
            if logger:
                if used_fallback:
                    logger.exception("vision block_detector_fallback_load_failed model_path=%s", candidate_path)
                elif fallback_model_path is not None:
                    logger.warning(
                        "vision block_detector_primary_load_failed primary_model_path=%s fallback_model_path=%s error=%s",
                        candidate_path,
                        fallback_model_path,
                        exc,
                    )
                else:
                    logger.exception("vision block_detector_load_failed model_path=%s", candidate_path)
            continue

        if logger:
            logger.info(
                "vision block_detector_loaded model_version=%s model_path=%s requested_model_path=%s fallback_model_path=%s used_fallback=%s device=%s",
                infer_model_version(candidate_path),
                candidate_path,
                primary_model_path,
                fallback_model_path,
                used_fallback,
                device,
            )

        return BlockDetectorHandle(
            enabled=True,
            available=True,
            model=model,
            model_path=candidate_path,
            model_version=infer_model_version(candidate_path),
            device=device,
            requested_model_path=primary_model_path,
            fallback_model_path=fallback_model_path,
            used_fallback=used_fallback,
            error=None,
        )

    return BlockDetectorHandle(
        enabled=True,
        available=False,
        model=None,
        model_path=primary_model_path,
        model_version=infer_model_version(primary_model_path),
        device=device,
        requested_model_path=primary_model_path,
        fallback_model_path=fallback_model_path,
        used_fallback=False,
        error="; ".join(attempted_errors) if attempted_errors else "no model candidates available",
    )
