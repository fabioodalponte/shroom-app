"""Initial block detection stage using YOLOv8 with safe fallback."""

from __future__ import annotations

import json
import logging
from pathlib import Path
import signal
import subprocess
import sys
from typing import Any

from ..models.yolo_block_detector import infer_model_version, load_block_detector, resolve_configured_model_paths


def _runtime_info() -> dict[str, str]:
    return {
        "python_executable": sys.executable,
        "python_version": sys.version.replace("\n", " "),
    }


def _empty_detection_result(
    config: dict[str, Any] | None,
    error: str | None = None,
    model_path: str | Path | None = None,
    model_version: str | None = None,
    device: str | None = None,
    used_fallback: bool = False,
    requested_model_path: str | Path | None = None,
    fallback_model_path: str | Path | None = None,
) -> dict[str, Any]:
    inference_config = (config or {}).get("inference", {})
    configured_model_path, configured_fallback_model_path = resolve_configured_model_paths(config)
    selected_model_path = Path(model_path) if model_path is not None else configured_model_path
    resolved_model_version = model_version or infer_model_version(selected_model_path)
    return {
        "enabled": bool(inference_config.get("enabled", True)),
        "model": str(selected_model_path),
        "model_path": str(selected_model_path),
        "model_version": resolved_model_version,
        "used_fallback": used_fallback,
        "requested_model_path": str(requested_model_path or configured_model_path),
        "fallback_model_path": str(fallback_model_path or configured_fallback_model_path or ""),
        "device": str(device or inference_config.get("device", "cpu") or "cpu"),
        "blocos_detectados": 0,
        "detections": [],
        "error": error,
        **_runtime_info(),
    }


def detect_blocks_in_process(
    image_path: str | Path,
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    """Detect mushroom blocks in one image inside the current process."""
    path = Path(image_path)
    detector = load_block_detector(config=config, logger=logger)
    if not detector.enabled or not detector.available or detector.model is None:
        result = _empty_detection_result(
            config,
            error=detector.error,
            model_path=detector.model_path,
            model_version=detector.model_version,
            device=detector.device,
            used_fallback=detector.used_fallback,
            requested_model_path=detector.requested_model_path,
            fallback_model_path=detector.fallback_model_path,
        )
        if logger:
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s model_version=%s model_path=%s device=%s blocks_detected=%s",
                path,
                False,
                result.get("model_version"),
                result.get("model_path"),
                result.get("device"),
                0,
            )
            logger.info("vision blocks_detected=%s image_path=%s", 0, path)
        return result

    inference_config = (config or {}).get("inference", {})
    confidence_threshold = float(inference_config.get("confidence_threshold", 0.25))

    try:
        if logger:
            logger.info(
                "vision block_detection_model_selected image_path=%s model_version=%s model_path=%s device=%s used_fallback=%s",
                path,
                detector.model_version,
                detector.model_path,
                detector.device,
                detector.used_fallback,
            )
            if detector.used_fallback:
                logger.warning(
                    "vision block_detector_fallback_used image_path=%s requested_model_path=%s fallback_model_path=%s active_model_path=%s model_version=%s device=%s",
                    path,
                    detector.requested_model_path,
                    detector.fallback_model_path,
                    detector.model_path,
                    detector.model_version,
                    detector.device,
                )
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
            "model_path": str(detector.model_path),
            "model_version": detector.model_version,
            "used_fallback": detector.used_fallback,
            "requested_model_path": str(detector.requested_model_path),
            "fallback_model_path": str(detector.fallback_model_path or ""),
            "device": detector.device,
            "blocos_detectados": len(detections),
            "detections": detections,
            "error": None,
            **_runtime_info(),
        }
        if logger:
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s model_version=%s model_path=%s device=%s blocks_detected=%s",
                path,
                True,
                detector.model_version,
                detector.model_path,
                detector.device,
                len(detections),
            )
            logger.info("vision blocks_detected=%s image_path=%s", len(detections), path)
        return payload
    except Exception as exc:  # pragma: no cover - depends on model/runtime
        if logger:
            logger.exception("vision block_detection_failed image_path=%s", path)
        result = _empty_detection_result(
            config,
            error=str(exc),
            model_path=detector.model_path,
            model_version=detector.model_version,
            device=detector.device,
            used_fallback=detector.used_fallback,
            requested_model_path=detector.requested_model_path,
            fallback_model_path=detector.fallback_model_path,
        )
        if logger:
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s model_version=%s model_path=%s device=%s blocks_detected=%s",
                path,
                True,
                result.get("model_version"),
                result.get("model_path"),
                result.get("device"),
                0,
            )
            logger.info("vision blocks_detected=%s image_path=%s", 0, path)
        return result


def _format_subprocess_failure(returncode: int, stderr: str) -> str:
    cleaned_stderr = (stderr or "").strip()
    if returncode < 0:
        signal_number = abs(returncode)
        try:
            signal_name = signal.Signals(signal_number).name
        except ValueError:
            signal_name = f"SIG{signal_number}"
        if signal_number == signal.SIGILL:
            return (
                "inference subprocess terminated with SIGILL (Illegal instruction). "
                "Provavel incompatibilidade binaria em torch/torchvision/opencv para a CPU do Raspberry."
            )
        return f"inference subprocess terminated by {signal_name}" + (f": {cleaned_stderr}" if cleaned_stderr else "")

    return f"inference subprocess failed with exit code {returncode}" + (f": {cleaned_stderr}" if cleaned_stderr else "")


def _detect_blocks_in_subprocess(
    image_path: Path,
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    payload = {
        "image_path": str(image_path),
        "config": config or {},
    }
    timeout_seconds = max(
        5,
        int(((config or {}).get("inference", {}) or {}).get("subprocess_timeout_seconds", 90)),
    )
    cmd = [sys.executable, "-m", "vision.inference.block_detection_worker"]

    try:
        completed = subprocess.run(
            cmd,
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired:
        if logger:
            logger.error("vision block_detection_subprocess_timeout image_path=%s timeout_seconds=%s", image_path, timeout_seconds)
        return _empty_detection_result(
            config,
            error=f"inference subprocess timed out after {timeout_seconds}s",
        )
    except Exception as exc:
        if logger:
            logger.exception("vision block_detection_subprocess_failed image_path=%s", image_path)
        return _empty_detection_result(
            config,
            error=f"failed to start inference subprocess: {exc}",
        )

    if completed.returncode != 0:
        error = _format_subprocess_failure(completed.returncode, completed.stderr)
        if logger:
            logger.error(
                "vision block_detection_subprocess_exit image_path=%s returncode=%s stderr=%s",
                image_path,
                completed.returncode,
                (completed.stderr or "").strip(),
            )
        return _empty_detection_result(config, error=error)

    try:
        return json.loads(completed.stdout or "{}")
    except json.JSONDecodeError as exc:
        if logger:
            logger.error(
                "vision block_detection_subprocess_invalid_json image_path=%s stdout=%s stderr=%s",
                image_path,
                (completed.stdout or "").strip(),
                (completed.stderr or "").strip(),
            )
        return _empty_detection_result(
            config,
            error=f"inference subprocess returned invalid JSON: {exc}",
        )


def detect_blocks(
    image_path: str | Path,
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    """Detect mushroom blocks in one image without breaking the pipeline."""
    path = Path(image_path)
    if logger:
        logger.info(
            "vision block_detection_start image_path=%s python_executable=%s python_version=%s",
            path,
            sys.executable,
            sys.version.replace("\n", " "),
        )

    inference_config = (config or {}).get("inference", {})
    use_subprocess = bool(inference_config.get("isolate_process", True))
    if use_subprocess:
        if logger:
            logger.info(
                "vision block_detection_subprocess_launch image_path=%s subprocess_python=%s",
                path,
                sys.executable,
            )
        result = _detect_blocks_in_subprocess(path, config=config, logger=logger)
        if logger:
            if result.get("used_fallback"):
                logger.warning(
                    "vision block_detector_fallback_used image_path=%s requested_model_path=%s fallback_model_path=%s active_model_path=%s model_version=%s device=%s",
                    path,
                    result.get("requested_model_path"),
                    result.get("fallback_model_path"),
                    result.get("model_path"),
                    result.get("model_version"),
                    result.get("device"),
                )
            logger.info(
                "vision block_detection_complete image_path=%s model_available=%s model_version=%s model_path=%s device=%s blocks_detected=%s worker_python=%s worker_python_version=%s",
                path,
                result.get("error") is None,
                result.get("model_version"),
                result.get("model_path"),
                result.get("device"),
                result.get("blocos_detectados", 0),
                result.get("python_executable"),
                result.get("python_version"),
            )
            logger.info("vision blocks_detected=%s image_path=%s", result.get("blocos_detectados", 0), path)
        return result

    return detect_blocks_in_process(
        image_path=path,
        config=config,
        logger=logger,
    )
