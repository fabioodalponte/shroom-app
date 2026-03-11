"""Remote persistence orchestration for Supabase Storage and Postgres."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config.env import load_supabase_env
from .supabase_records import SupabaseResultRepository
from .supabase_storage import SupabaseStorageUploader


class VisionRemotePersister:
    """Coordinates remote upload to Supabase without breaking the local pipeline."""

    def __init__(self, config: dict[str, Any], logger: logging.Logger, artifact_store: Any) -> None:
        self.config = config
        self.logger = logger
        self.artifact_store = artifact_store

        remote_config = config.get("remote_persistence", {})
        self.enabled = bool(remote_config.get("enabled", True))
        self.storage_prefix = str(remote_config.get("storage_prefix", "vision/captures"))
        self.db_table = str(remote_config.get("db_table", "vision_pipeline_runs"))

        self.env_config = load_supabase_env()
        self.storage_uploader = SupabaseStorageUploader(self.env_config)
        self.result_repository = SupabaseResultRepository(self.env_config, self.db_table)

    @property
    def is_ready(self) -> bool:
        return self.enabled and self.env_config.is_ready

    def persist_pipeline_result(
        self,
        image_path: Path,
        pipeline_result: dict[str, Any],
    ) -> dict[str, Any]:
        """Upload the image and then insert the result row into the database."""
        if not self.enabled:
            self.logger.warning("remote_persistence_skipped reason=disabled_by_config")
            return self._disabled_result("remote persistence disabled by config")

        if not self.env_config.is_ready:
            self.logger.warning("remote_persistence_skipped reason=missing_env")
            return self._disabled_result("missing SUPABASE_URL, SUPABASE_KEY or SUPABASE_STORAGE_BUCKET")

        capture_metadata = pipeline_result.get("capture_metadata", {})
        object_path = self._build_storage_path(image_path)
        content_type = str(capture_metadata.get("content_type", "image/jpeg"))

        storage_result = self.storage_uploader.upload_image(image_path, object_path, content_type)
        if not storage_result["ok"]:
            queue_path = self.artifact_store.enqueue_remote_retry(
                image_path=image_path,
                pipeline_result=pipeline_result,
                remote_state={
                    "stage": "storage_upload",
                    "storage_path": object_path,
                    "error": storage_result["error"],
                    "response": storage_result["response"],
                },
            )
            self.logger.error(
                "remote_storage_upload_failed image_path=%s storage_path=%s error=%s retry_manifest=%s",
                image_path,
                object_path,
                storage_result["error"],
                queue_path,
            )
            return {
                "enabled": True,
                "remote_persisted": False,
                "storage_uploaded": False,
                "db_record_created": False,
                "image_storage_path": object_path,
                "record_id": None,
                "db_table": self.db_table,
                "retry_manifest_path": str(queue_path),
                "error": storage_result["error"],
            }

        db_payload = self._build_db_payload(
            image_path=image_path,
            image_storage_path=object_path,
            pipeline_result=pipeline_result,
        )
        db_result = self.result_repository.insert_record(db_payload)
        if not db_result["ok"]:
            queue_path = self.artifact_store.enqueue_remote_retry(
                image_path=image_path,
                pipeline_result=pipeline_result,
                remote_state={
                    "stage": "db_insert",
                    "storage_path": object_path,
                    "error": db_result["error"],
                    "response": db_result["response"],
                },
            )
            self.logger.error(
                "remote_db_insert_failed image_path=%s storage_path=%s error=%s retry_manifest=%s",
                image_path,
                object_path,
                db_result["error"],
                queue_path,
            )
            return {
                "enabled": True,
                "remote_persisted": False,
                "storage_uploaded": True,
                "db_record_created": False,
                "image_storage_path": object_path,
                "record_id": None,
                "db_table": self.db_table,
                "retry_manifest_path": str(queue_path),
                "error": db_result["error"],
            }

        self.logger.info(
            "remote_persistence_complete image_path=%s storage_path=%s record_id=%s",
            image_path,
            object_path,
            db_result["record_id"],
        )
        return {
            "enabled": True,
            "remote_persisted": True,
            "storage_uploaded": True,
            "db_record_created": True,
            "image_storage_path": object_path,
            "record_id": db_result["record_id"],
            "db_table": self.db_table,
            "retry_manifest_path": None,
            "error": None,
        }

    def persist_pipeline_result_safe(
        self,
        image_path: Path,
        pipeline_result: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            return self.persist_pipeline_result(image_path, pipeline_result)
        except Exception as exc:  # pragma: no cover - defensive guard
            queue_path = self.artifact_store.enqueue_remote_retry(
                image_path=image_path,
                pipeline_result=pipeline_result,
                remote_state={
                    "stage": "unexpected_error",
                    "error": str(exc),
                },
            )
            self.logger.exception("remote_persistence_unexpected_error image_path=%s", image_path)
            return {
                "enabled": self.enabled,
                "remote_persisted": False,
                "storage_uploaded": False,
                "db_record_created": False,
                "image_storage_path": None,
                "record_id": None,
                "db_table": self.db_table,
                "retry_manifest_path": str(queue_path),
                "error": str(exc),
            }

    def _build_storage_path(self, image_path: Path) -> str:
        timestamp = datetime.now(timezone.utc)
        return "/".join(
            [
                self.storage_prefix.strip("/"),
                timestamp.strftime("%Y"),
                timestamp.strftime("%m"),
                timestamp.strftime("%d"),
                image_path.name,
            ]
        )

    def _build_db_payload(
        self,
        image_path: Path,
        image_storage_path: str,
        pipeline_result: dict[str, Any],
    ) -> dict[str, Any]:
        capture_metadata = pipeline_result.get("capture_metadata", {})
        quality_check = pipeline_result.get("quality_check", {})
        quality_metrics = quality_check.get("metrics") or {}
        dataset_classification = pipeline_result.get("dataset_classification", {})

        return {
            "executed_at": pipeline_result.get("executed_at"),
            "captured_at": capture_metadata.get("captured_at"),
            "source": capture_metadata.get("source"),
            "camera_url": capture_metadata.get("camera_url"),
            "image_local_path": str(image_path),
            "image_storage_path": image_storage_path,
            "file_size": capture_metadata.get("size_bytes"),
            "quality_status": quality_check.get("status"),
            "dataset_eligible": quality_check.get("dataset_eligible"),
            "dataset_class": dataset_classification.get("dataset_class"),
            "brightness_mean": quality_metrics.get("brightness_mean"),
            "contrast_stddev": quality_metrics.get("contrast_stddev"),
            "sharpness_score": quality_metrics.get("sharpness_score"),
            "summary_json": pipeline_result.get("summary"),
            "raw_result_json": pipeline_result,
            "dataset_classification_json": dataset_classification,
        }

    def _disabled_result(self, reason: str) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "remote_persisted": False,
            "storage_uploaded": False,
            "db_record_created": False,
            "image_storage_path": None,
            "record_id": None,
            "db_table": self.db_table,
            "retry_manifest_path": None,
            "error": reason,
        }
