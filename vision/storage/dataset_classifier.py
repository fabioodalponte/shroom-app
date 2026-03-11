"""Dataset organization helpers driven by the image quality result."""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class DatasetClassifier:
    """Copies or links captured images into local dataset categories."""

    def __init__(self, config: dict[str, Any], logger: logging.Logger) -> None:
        self.logger = logger
        self.dataset_dir = Path(config.get("storage", {}).get("dataset_dir", "vision/dataset"))
        classifier_config = config.get("dataset_classification", {})
        self.enabled = bool(classifier_config.get("enabled", True))
        self.mode = str(classifier_config.get("mode", "hardlink_or_copy"))
        self.valid_subdir = str(classifier_config.get("valid_subdir", "raw/valid"))
        self.rejected_subdir = str(classifier_config.get("rejected_subdir", "raw/rejected"))

        self.dataset_dir.mkdir(parents=True, exist_ok=True)

    def classify(self, image_path: Path, quality_check: dict[str, Any]) -> dict[str, Any]:
        """Classify one image into the local dataset structure."""
        quality_status = str(quality_check.get("status", "invalid_image"))
        dataset_eligible = bool(quality_check.get("dataset_eligible", False))

        if not self.enabled:
            return {
                "enabled": False,
                "applied": False,
                "dataset_class": None,
                "quality_status": quality_status,
                "dataset_eligible": dataset_eligible,
                "target_image_path": None,
                "target_metadata_path": None,
                "method": None,
                "error": None,
            }

        if dataset_eligible and quality_status == "valid":
            relative_target_dir = Path(self.valid_subdir)
            dataset_class = "valid"
        else:
            relative_target_dir = Path(self.rejected_subdir) / quality_status
            dataset_class = f"rejected/{quality_status}"

        target_dir = self.dataset_dir / relative_target_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        target_image_path = self._build_target_path(target_dir, image_path.name)
        method = self._materialize_image(image_path, target_image_path)
        metadata_path = target_image_path.with_suffix(".json")

        metadata_payload = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "original_image_path": str(image_path),
            "dataset_image_path": str(target_image_path),
            "dataset_class": dataset_class,
            "quality_status": quality_status,
            "dataset_eligible": dataset_eligible,
            "method": method,
            "quality_check": quality_check,
        }
        metadata_path.write_text(json.dumps(metadata_payload, indent=2, ensure_ascii=True), encoding="utf-8")

        self.logger.info(
            "dataset_classified image_path=%s dataset_class=%s method=%s target_image_path=%s",
            image_path,
            dataset_class,
            method,
            target_image_path,
        )
        return {
            "enabled": True,
            "applied": True,
            "dataset_class": dataset_class,
            "quality_status": quality_status,
            "dataset_eligible": dataset_eligible,
            "target_image_path": str(target_image_path),
            "target_metadata_path": str(metadata_path),
            "method": method,
            "error": None,
        }

    def classify_safe(self, image_path: Path, quality_check: dict[str, Any]) -> dict[str, Any]:
        """Classify without bubbling errors to the runner."""
        try:
            return self.classify(image_path, quality_check)
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.exception("dataset_classification_failed image_path=%s", image_path)
            return {
                "enabled": self.enabled,
                "applied": False,
                "dataset_class": None,
                "quality_status": str(quality_check.get("status", "invalid_image")),
                "dataset_eligible": bool(quality_check.get("dataset_eligible", False)),
                "target_image_path": None,
                "target_metadata_path": None,
                "method": None,
                "error": str(exc),
            }

    def _materialize_image(self, source_path: Path, target_path: Path) -> str:
        if self.mode == "hardlink":
            os.link(source_path, target_path)
            return "hardlink"

        if self.mode == "copy":
            shutil.copy2(source_path, target_path)
            return "copy"

        try:
            os.link(source_path, target_path)
            return "hardlink"
        except OSError:
            shutil.copy2(source_path, target_path)
            return "copy"

    def _build_target_path(self, target_dir: Path, file_name: str) -> Path:
        candidate = target_dir / file_name
        if not candidate.exists():
            return candidate

        stem = candidate.stem
        suffix = candidate.suffix
        counter = 1
        while True:
            next_candidate = target_dir / f"{stem}_{counter}{suffix}"
            if not next_candidate.exists():
                return next_candidate
            counter += 1
