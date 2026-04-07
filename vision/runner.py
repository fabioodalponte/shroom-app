"""Main orchestration entrypoint for the vision module."""

from __future__ import annotations

import argparse
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .active_lot_resolver import ActiveLoteResolution, ActiveLoteResolver
from .capture.esp32_cam_capture import ESP32CamCaptureClient, capture_snapshot_safe
from .config.loader import load_vision_config
from .hardware.light_control import LightControlError, turn_light_off, turn_light_on
from .inference.pipeline import VisionInferencePipeline
from .logging_utils import get_vision_logger
from .models.yolo_block_detector import infer_model_version, resolve_configured_model_paths
from .storage.artifact_store import ArtifactStore
from .storage.dataset_classifier import DatasetClassifier
from .storage.remote_persistence import VisionRemotePersister


def _infer_room_name(camera_name: str, configured_room_name: str) -> str:
    room_name = configured_room_name.strip()
    if room_name:
        return room_name

    normalized = camera_name.strip().replace("_", "-").lower()
    if "colonizacao" in normalized:
        return "Colonizacao"
    if "frutificacao" in normalized:
        return "Frutificacao"
    if "sala-1" in normalized or "sala1" in normalized:
        return "Sala 1"
    return "Nao informada"


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
        self.active_lot_resolver = ActiveLoteResolver(config, logger=self.logger)
        self.runtime_context = self._build_runtime_context()
        self.logger.info(
            "vision runtime_context_initialized config_name=%s room_name=%s camera_name=%s model_version=%s model_path=%s",
            self.runtime_context["config_name"],
            self.runtime_context["room_name"],
            self.runtime_context["camera_name"],
            self.runtime_context["model_version"],
            self.runtime_context["model_path"],
        )

    def _build_runtime_context(self) -> dict[str, Any]:
        capture_config = self.config.get("capture", {})
        runtime_meta = self.config.get("_runtime", {})
        model_path, _ = resolve_configured_model_paths(self.config)
        camera_name = str(capture_config.get("camera_name", "") or "").strip() or "camera-nao-configurada"
        configured_room_name = str(capture_config.get("room_name", "") or "").strip()
        room_name = _infer_room_name(camera_name, configured_room_name)
        return {
            "config_name": str(runtime_meta.get("config_name", "") or "vision_config.json"),
            "config_path": str(runtime_meta.get("config_path", "") or ""),
            "room_name": room_name,
            "camera_name": camera_name,
            "model_path": str(model_path),
            "model_version": infer_model_version(model_path),
        }

    def _build_result_context(
        self,
        *,
        camera_status: str,
        last_error: str | None = None,
        used_fallback: bool = False,
        model_path: str | None = None,
        model_version: str | None = None,
    ) -> dict[str, Any]:
        return {
            "config_name": self.runtime_context["config_name"],
            "room_name": self.runtime_context["room_name"],
            "camera_name": self.runtime_context["camera_name"],
            "camera_status": camera_status,
            "model_path": model_path or self.runtime_context["model_path"],
            "model_version": model_version or self.runtime_context["model_version"],
            "used_fallback": used_fallback,
            "last_error": last_error,
        }

    def status(self) -> dict[str, Any]:
        """Return static runtime status without touching camera or model."""
        inference_config = self.config.get("inference", {})
        primary_model_path = inference_config.get("model_path") or inference_config.get("model")
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "enabled": self.config.get("enabled", False),
            "config_name": self.runtime_context["config_name"],
            "config_path": self.runtime_context["config_path"],
            "room_name": self.runtime_context["room_name"],
            "camera_name": self.runtime_context["camera_name"],
            "camera_status": "unknown",
            "camera_url": self.config.get("capture", {}).get("camera_url"),
            "default_lote_id": self.config.get("capture", {}).get("default_lote_id"),
            "capture_timeout_seconds": self.config.get("capture", {}).get("request_timeout_seconds", 15),
            "capture_connect_timeout_seconds": self.config.get("capture", {}).get(
                "connect_timeout_seconds",
                self.config.get("capture", {}).get("request_timeout_seconds", 15),
            ),
            "capture_read_timeout_seconds": self.config.get("capture", {}).get(
                "read_timeout_seconds",
                self.config.get("capture", {}).get("request_timeout_seconds", 15),
            ),
            "capture_retries": self.config.get("capture", {}).get("request_retries", 3),
            "capture_retry_backoff_seconds": self.config.get("capture", {}).get("retry_backoff_seconds", 1.0),
            "lighting_enabled": self.config.get("lighting", {}).get("enabled", True),
            "lighting_provider": self.config.get("lighting", {}).get("provider", "relay_http"),
            "lighting_base_url": self.config.get("lighting", {}).get("base_url"),
            "lighting_relay_channel": self.config.get("lighting", {}).get("relay_channel", 2),
            "lighting_timeout_seconds": self.config.get("lighting", {}).get("request_timeout_seconds", 5),
            "lighting_retries": self.config.get("lighting", {}).get("request_retries", 2),
            "lighting_retry_backoff_seconds": self.config.get("lighting", {}).get("retry_backoff_seconds", 0.5),
            "lighting_verify_state": self.config.get("lighting", {}).get("verify_state", True),
            "lighting_verify_state_strict": self.config.get("lighting", {}).get("verify_state_strict", False),
            "lighting_warmup_seconds": self.config.get("lighting", {}).get("warmup_seconds", 8),
            "lighting_cooldown_seconds": self.config.get("lighting", {}).get("cooldown_seconds", 1),
            "lighting_capture_session_max_seconds": self.config.get("lighting", {}).get("capture_session_max_seconds"),
            "artifacts_dir": str(self.artifact_store.artifacts_dir),
            "results_dir": str(self.artifact_store.results_dir),
            "dataset_dir": str(self.artifact_store.dataset_dir),
            "log_dir": str(self.config.get("logging", {}).get("dir", "vision/logs")),
            "mode": inference_config.get("mode", "stub"),
            "inference_enabled": inference_config.get("enabled", True),
            "inference_model": primary_model_path,
            "inference_model_path": primary_model_path,
            "inference_fallback_model_path": inference_config.get("fallback_model_path"),
            "model_path": self.runtime_context["model_path"],
            "model_version": self.runtime_context["model_version"],
            "inference_model_version": "v2" if "v2" in str(primary_model_path or "") else "v1",
            "inference_device": inference_config.get("device", "cpu"),
            "quality_thresholds": self.inference_pipeline.quality_thresholds,
            "dataset_classification_enabled": self.dataset_classifier.enabled,
            "remote_persistence_enabled": self.remote_persister.enabled,
            "remote_env_ready": self.remote_persister.env_config.is_ready,
            "remote_env_file": self.remote_persister.env_config.env_file_path,
            "remote_env_file_loaded": self.remote_persister.env_config.env_file_loaded,
            "used_fallback": False,
        }

    def capture_once(self) -> dict[str, Any]:
        """Capture and store one snapshot without crashing the runner on failure."""
        self.logger.info(
            "vision capture_start mode=capture_once config_name=%s room_name=%s camera_name=%s",
            self.runtime_context["config_name"],
            self.runtime_context["room_name"],
            self.runtime_context["camera_name"],
        )
        capture_result = capture_snapshot_safe(self.capture_client, self.logger)
        if not capture_result["ok"]:
            return {
                "status": "capture_failed",
                "error": capture_result["error"],
                "camera_url": capture_result["camera_url"],
                **self._build_result_context(
                    camera_status="offline",
                    last_error=str(capture_result["error"]),
                ),
            }

        image_bytes = capture_result["image_bytes"]
        metadata = capture_result["metadata"]
        metadata.update(self._build_result_context(camera_status="online"))
        saved_image = self.artifact_store.save_snapshot(image_bytes, metadata)
        self.logger.info("snapshot_saved image_path=%s", saved_image)

        return {
            "status": "captured",
            "saved_image": str(saved_image),
            "metadata": metadata,
            **self._build_result_context(camera_status="online"),
        }

    def _resolve_lote_id(self, lote_id: str | None = None) -> str | None:
        explicit = str(lote_id or "").strip()
        if explicit:
            return explicit

        configured = str(self.config.get("capture", {}).get("default_lote_id", "")).strip()
        return configured or None

    def _resolve_scheduled_lote_context(self, lote_id: str | None = None) -> ActiveLoteResolution:
        explicit = str(lote_id or "").strip()
        if explicit:
            return ActiveLoteResolution(
                lote_id=explicit,
                strategy="explicit_cli_lote_id",
                reason="provided_by_runner_argument",
            )

        configured = str(self.config.get("capture", {}).get("default_lote_id", "")).strip()
        if configured:
            return ActiveLoteResolution(
                lote_id=configured,
                strategy="default_lote_id",
                reason="configured_in_vision_config",
            )

        try:
            return self.active_lot_resolver.resolve()
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.warning("vision active_lot_resolution_failed error=%s", exc)
            return ActiveLoteResolution(
                lote_id=None,
                strategy="fallback_without_lote",
                reason=f"active_lot_resolution_error:{exc}",
            )

    def pipeline_once(self, lote_id: str | None = None) -> dict[str, Any]:
        """Run the full placeholder pipeline once without crashing on capture errors."""
        self.logger.info(
            "vision capture_pipeline_start mode=pipeline_once config_name=%s room_name=%s camera_name=%s model_version=%s model_path=%s",
            self.runtime_context["config_name"],
            self.runtime_context["room_name"],
            self.runtime_context["camera_name"],
            self.runtime_context["model_version"],
            self.runtime_context["model_path"],
        )
        capture_result = capture_snapshot_safe(self.capture_client, self.logger)
        if not capture_result["ok"]:
            result = {
                "status": "pipeline_capture_failed",
                "error": capture_result["error"],
                "camera_url": capture_result["camera_url"],
                **self._build_result_context(
                    camera_status="offline",
                    last_error=str(capture_result["error"]),
                ),
            }
            self.logger.info(
                "vision capture_pipeline_complete mode=pipeline_once status=%s config_name=%s room_name=%s camera_name=%s camera_status=%s model_version=%s used_fallback=%s",
                result["status"],
                result["config_name"],
                result["room_name"],
                result["camera_name"],
                result["camera_status"],
                result["model_version"],
                result["used_fallback"],
            )
            return result

        image_bytes = capture_result["image_bytes"]
        capture_metadata = capture_result["metadata"]
        capture_metadata.update(self._build_result_context(camera_status="online"))
        resolved_lote_id = self._resolve_lote_id(lote_id)
        if resolved_lote_id:
            capture_metadata["lote_id"] = resolved_lote_id
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
        last_error = (
            remote_persistence.get("error")
            or inference_result.get("last_error")
            or inference_result["quality_check"].get("error")
            or inference_result["block_detection"].get("error")
            or None
        )
        result_context = self._build_result_context(
            camera_status="online",
            last_error=str(last_error) if last_error else None,
            used_fallback=bool(inference_result["block_detection"].get("used_fallback", False)),
            model_path=inference_result["block_detection"].get("model_path"),
            model_version=inference_result["block_detection"].get("model_version"),
        )
        inference_result.update(result_context)
        inference_result["last_error"] = result_context["last_error"]
        inference_result["summary"].update(result_context)

        saved_result = self.artifact_store.save_inference_result(
            image_path=saved_image,
            result=inference_result,
        )

        result = {
            "status": "pipeline_complete",
            "saved_image": str(saved_image),
            "saved_result": str(saved_result),
            "result": inference_result,
            **result_context,
        }
        self.logger.info(
            "vision capture_pipeline_complete mode=pipeline_once status=%s config_name=%s room_name=%s camera_name=%s camera_status=%s model_version=%s used_fallback=%s",
            result["status"],
            result["config_name"],
            result["room_name"],
            result["camera_name"],
            result["camera_status"],
            result["model_version"],
            result["used_fallback"],
        )
        return result

    def _load_saved_snapshot_metadata(self, image_path: Path) -> dict[str, Any]:
        metadata_path = image_path.with_suffix(".json")
        if not metadata_path.exists():
            return {}

        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                return payload
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.warning(
                "vision saved_snapshot_metadata_invalid image_path=%s metadata_path=%s error=%s",
                image_path,
                metadata_path,
                exc,
            )
        return {}

    def _run_pipeline_for_existing_snapshot(
        self,
        image_path: Path,
        capture_metadata: dict[str, Any],
        mode: str,
    ) -> dict[str, Any]:
        inference_result = self.inference_pipeline.run(
            image_path=image_path,
            capture_metadata=capture_metadata,
        )
        dataset_classification = self.dataset_classifier.classify_safe(
            image_path=image_path,
            quality_check=inference_result["quality_check"],
        )
        inference_result["dataset_classification"] = dataset_classification
        inference_result["summary"]["dataset_class"] = dataset_classification["dataset_class"]
        remote_persistence = self.remote_persister.persist_pipeline_result_safe(
            image_path=image_path,
            pipeline_result=inference_result,
        )
        inference_result["remote_persistence"] = remote_persistence
        inference_result["remote_persisted"] = remote_persistence["remote_persisted"]
        inference_result["storage_uploaded"] = remote_persistence["storage_uploaded"]
        inference_result["db_record_created"] = remote_persistence["db_record_created"]
        inference_result["summary"]["remote_persisted"] = remote_persistence["remote_persisted"]

        saved_result = self.artifact_store.save_inference_result(
            image_path=image_path,
            result=inference_result,
        )
        return {
            "status": "pipeline_complete",
            "execution_mode": mode,
            "saved_image": str(image_path),
            "saved_result": str(saved_result),
            "result": inference_result,
        }

    def reprocess_latest(self, lote_id: str | None = None) -> dict[str, Any]:
        """Re-run the full pipeline for the latest saved snapshot and persist the result."""
        self.logger.info("vision capture_pipeline_start mode=reprocess_latest")
        latest_snapshot = self.artifact_store.find_latest_snapshot()
        if latest_snapshot is None:
            result = {
                "status": "no_snapshot_found",
                "artifacts_dir": str(self.artifact_store.artifacts_dir),
            }
            self.logger.info("vision capture_pipeline_complete mode=reprocess_latest status=%s", result["status"])
            return result

        capture_metadata = self._load_saved_snapshot_metadata(latest_snapshot)
        resolved_lote_id = self._resolve_lote_id(lote_id) or capture_metadata.get("lote_id")
        if resolved_lote_id:
            capture_metadata["lote_id"] = resolved_lote_id
        capture_metadata.setdefault("source", "saved_snapshot_reprocess")
        capture_metadata["reprocessed_from_saved_snapshot"] = True
        capture_metadata["reprocessed_at"] = datetime.now(timezone.utc).isoformat()

        result = self._run_pipeline_for_existing_snapshot(
            image_path=latest_snapshot,
            capture_metadata=capture_metadata,
            mode="reprocess_latest",
        )
        self.logger.info(
            "vision capture_pipeline_complete mode=reprocess_latest status=%s image_path=%s",
            result["status"],
            latest_snapshot,
        )
        return result

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
            **self._build_result_context(
                camera_status="unknown",
                last_error=detection_result.get("error"),
                used_fallback=bool(detection_result.get("used_fallback", False)),
                model_path=detection_result.get("model_path"),
                model_version=detection_result.get("model_version"),
            ),
        }

    def scheduled_capture(self, lote_id: str | None = None) -> dict[str, Any]:
        """Run the full pipeline with optional room lighting control."""
        lighting_config = self.config.get("lighting", {})
        capture_config = self.config.get("capture", {})
        lighting_enabled = bool(lighting_config.get("enabled", True))
        warmup_seconds = max(0.0, float(lighting_config.get("warmup_seconds", 8)))
        cooldown_seconds = max(0.0, float(lighting_config.get("cooldown_seconds", 1)))
        capture_session_max_seconds = max(
            1.0,
            float(
                lighting_config.get(
                    "capture_session_max_seconds",
                    warmup_seconds
                    + float(capture_config.get("connect_timeout_seconds", capture_config.get("request_timeout_seconds", 15)))
                    + float(capture_config.get("read_timeout_seconds", capture_config.get("request_timeout_seconds", 15)))
                    + (
                        max(0, int(capture_config.get("request_retries", 3)) - 1)
                        * max(0.0, float(capture_config.get("retry_backoff_seconds", 1.0)))
                    )
                    + cooldown_seconds
                    + 10.0,
                )
            ),
        )
        active_lot_resolution = self._resolve_scheduled_lote_context(lote_id)
        operation_started_at = time.monotonic()

        light_on_attempted = False
        light_on_ok: bool | None = None
        light_off_attempted = False
        light_off_ok: bool | None = None
        light_off_error: str | None = None
        light_fail_safe_armed = False
        light_fail_safe_triggered = False
        light_fail_safe_error: str | None = None
        result: dict[str, Any] | None = None
        light_off_completed = threading.Event()
        light_fail_safe_lock = threading.Lock()
        light_fail_safe_timer: threading.Timer | None = None

        def _force_light_off_fail_safe() -> None:
            nonlocal light_fail_safe_triggered, light_fail_safe_error, light_off_ok, light_off_error
            with light_fail_safe_lock:
                if light_off_completed.is_set():
                    return

                light_fail_safe_triggered = True
                self.logger.critical(
                    "vision light_fail_safe_triggered capture_session_max_seconds=%.2f",
                    capture_session_max_seconds,
                )
                try:
                    turn_light_off(self.config, self.logger)
                    light_off_ok = True
                    light_off_error = None
                    light_off_completed.set()
                    self.logger.critical("vision light_fail_safe_success")
                except LightControlError as exc:
                    light_off_ok = False
                    light_off_error = str(exc)
                    light_fail_safe_error = str(exc)
                    self.logger.critical("vision light_fail_safe_failed error=%s", exc)

        try:
            self.logger.info(
                "vision capture_pipeline_start mode=scheduled_capture config_name=%s room_name=%s camera_name=%s model_version=%s model_path=%s",
                self.runtime_context["config_name"],
                self.runtime_context["room_name"],
                self.runtime_context["camera_name"],
                self.runtime_context["model_version"],
                self.runtime_context["model_path"],
            )
            if active_lot_resolution.lote_id:
                self.logger.info(
                    "vision active_lot_found lote_id=%s codigo=%s strategy=%s reason=%s sala=%s camera=%s",
                    active_lot_resolution.lote_id,
                    active_lot_resolution.lote_codigo,
                    active_lot_resolution.strategy,
                    active_lot_resolution.reason,
                    active_lot_resolution.sala,
                    active_lot_resolution.camera_name,
                )
            else:
                self.logger.warning(
                    "vision active_lot_not_found strategy=%s reason=%s sala=%s camera=%s",
                    active_lot_resolution.strategy,
                    active_lot_resolution.reason,
                    active_lot_resolution.sala,
                    active_lot_resolution.camera_name,
                )
            if lighting_enabled:
                light_on_attempted = True
                try:
                    turn_light_on(self.config, self.logger)
                    light_on_ok = True
                    light_fail_safe_timer = threading.Timer(capture_session_max_seconds, _force_light_off_fail_safe)
                    light_fail_safe_timer.daemon = True
                    light_fail_safe_timer.start()
                    light_fail_safe_armed = True
                    self.logger.info(
                        "vision light_fail_safe_armed capture_session_max_seconds=%.2f",
                        capture_session_max_seconds,
                    )
                except LightControlError as exc:
                    light_on_ok = False
                    self.logger.error("vision scheduled_capture_aborted stage=light_on error=%s", exc)
                    result = {
                        "status": "scheduled_capture_aborted",
                        "stage": "light_on",
                        "error": str(exc),
                        "execution_mode": "scheduled_capture",
                        "active_lot_resolution": active_lot_resolution.to_dict(),
                        "lighting": {
                            "enabled": lighting_enabled,
                            "warmup_seconds": warmup_seconds,
                            "cooldown_seconds": cooldown_seconds,
                            "capture_session_max_seconds": capture_session_max_seconds,
                            "light_on_attempted": light_on_attempted,
                            "light_on_ok": light_on_ok,
                            "light_off_attempted": False,
                            "light_off_ok": None,
                            "light_off_error": None,
                            "light_fail_safe_armed": light_fail_safe_armed,
                            "light_fail_safe_triggered": light_fail_safe_triggered,
                            "light_fail_safe_error": light_fail_safe_error,
                        },
                    }
                    return result
                self.logger.info("vision waiting_for_light seconds=%s", warmup_seconds)
                if warmup_seconds > 0:
                    time.sleep(warmup_seconds)
            else:
                self.logger.info("vision lighting_disabled_skip_light_control")

            result = self.pipeline_once(lote_id=active_lot_resolution.lote_id)
            result["execution_mode"] = "scheduled_capture"
            result["active_lot_resolution"] = active_lot_resolution.to_dict()
            result["lighting"] = {
                "enabled": lighting_enabled,
                "warmup_seconds": warmup_seconds,
                "cooldown_seconds": cooldown_seconds,
                "capture_session_max_seconds": capture_session_max_seconds,
                "light_on_attempted": light_on_attempted,
                "light_on_ok": light_on_ok,
                "light_off_attempted": light_off_attempted,
                "light_off_ok": light_off_ok,
                "light_off_error": light_off_error,
                "light_fail_safe_armed": light_fail_safe_armed,
                "light_fail_safe_triggered": light_fail_safe_triggered,
                "light_fail_safe_error": light_fail_safe_error,
            }
            return result
        finally:
            if lighting_enabled and light_on_attempted and not light_off_completed.is_set():
                light_off_attempted = True
                try:
                    self.logger.info("vision light_off_start reason=scheduled_capture_finally")
                    turn_light_off(self.config, self.logger)
                    light_off_ok = True
                    light_off_error = None
                    light_off_completed.set()
                except LightControlError as exc:
                    light_off_ok = False
                    light_off_error = str(exc)
                    self.logger.critical("vision light_off_failed_critical error=%s", exc)
                if cooldown_seconds > 0:
                    time.sleep(cooldown_seconds)

            if light_fail_safe_timer is not None:
                light_fail_safe_timer.cancel()

            duration_seconds = round(time.monotonic() - operation_started_at, 3)
            self.logger.info(
                "vision capture_session_complete duration_seconds=%.3f light_fail_safe_armed=%s light_fail_safe_triggered=%s light_off_ok=%s",
                duration_seconds,
                light_fail_safe_armed,
                light_fail_safe_triggered,
                light_off_ok,
            )

            if result is not None:
                lighting_result = result.setdefault("lighting", {})
                lighting_result.update(
                    {
                        "enabled": lighting_enabled,
                        "warmup_seconds": warmup_seconds,
                        "cooldown_seconds": cooldown_seconds,
                        "capture_session_max_seconds": capture_session_max_seconds,
                        "light_on_attempted": light_on_attempted,
                        "light_on_ok": light_on_ok,
                        "light_off_attempted": light_off_attempted,
                        "light_off_ok": light_off_ok,
                        "light_off_error": light_off_error,
                        "light_fail_safe_armed": light_fail_safe_armed,
                        "light_fail_safe_triggered": light_fail_safe_triggered,
                        "light_fail_safe_error": light_fail_safe_error,
                    }
                )
                result["duration_seconds"] = duration_seconds
                self.logger.info(
                    "vision capture_pipeline_complete mode=scheduled_capture status=%s config_name=%s room_name=%s camera_name=%s camera_status=%s model_version=%s used_fallback=%s",
                    result.get("status"),
                    result.get("config_name", self.runtime_context["config_name"]),
                    result.get("room_name", self.runtime_context["room_name"]),
                    result.get("camera_name", self.runtime_context["camera_name"]),
                    result.get("camera_status", "unknown"),
                    result.get("model_version", self.runtime_context["model_version"]),
                    result.get("used_fallback", False),
                )


def print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Shroom vision module runner")
    parser.add_argument(
        "command",
        choices=[
            "status",
            "capture-once",
            "pipeline-once",
            "reprocess-latest",
            "quality-latest",
            "dataset-classify-latest",
            "detect-blocks-latest",
            "scheduled-capture",
        ],
        help="Action to execute",
    )
    parser.add_argument(
        "--config",
        default=str(Path(__file__).resolve().parent / "config" / "vision_config.json"),
        help="Path to the vision config JSON file",
    )
    parser.add_argument(
        "--lote-id",
        default=None,
        help="Optional lote_id to persist explicitly in vision runs",
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
            print_json(orchestrator.pipeline_once(lote_id=args.lote_id))
            return 0

        if args.command == "reprocess-latest":
            print_json(orchestrator.reprocess_latest(lote_id=args.lote_id))
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

        if args.command == "scheduled-capture":
            print_json(orchestrator.scheduled_capture(lote_id=args.lote_id))
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
