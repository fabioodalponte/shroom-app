"""Local storage layer for images and inference results."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class ArtifactStore:
    """Stores snapshots and structured results in local folders."""

    def __init__(self, config: dict[str, Any]) -> None:
        storage_config = config.get("storage", {})
        self.artifacts_dir = Path(storage_config.get("artifacts_dir", "vision/storage/artifacts"))
        self.results_dir = Path(storage_config.get("results_dir", "vision/storage/results"))
        self.dataset_dir = Path(storage_config.get("dataset_dir", "vision/dataset"))

        for directory in [self.artifacts_dir, self.results_dir, self.dataset_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    def save_snapshot(self, image_bytes: bytes, metadata: dict[str, Any]) -> Path:
        timestamp = datetime.now(timezone.utc)
        date_dir = self.artifacts_dir / timestamp.strftime("%Y") / timestamp.strftime("%m") / timestamp.strftime("%d")
        date_dir.mkdir(parents=True, exist_ok=True)

        file_timestamp = timestamp.strftime("%Y%m%dT%H%M%S%fZ")
        image_path = date_dir / f"snapshot_{file_timestamp}.jpg"
        image_path.write_bytes(image_bytes)

        metadata_path = image_path.with_suffix(".json")
        persisted_metadata = {
            **metadata,
            "saved_image_path": str(image_path),
            "saved_metadata_path": str(metadata_path),
        }
        metadata_path.write_text(
            json.dumps(persisted_metadata, indent=2, ensure_ascii=True),
            encoding="utf-8",
        )
        return image_path

    def save_inference_result(self, image_path: Path, result: dict[str, Any]) -> Path:
        result_path = self.results_dir / f"{image_path.stem}_result.json"
        result_path.write_text(json.dumps(result, indent=2, ensure_ascii=True), encoding="utf-8")
        return result_path

    def save_quality_result(self, image_path: Path, result: dict[str, Any]) -> Path:
        result_path = self.results_dir / f"{image_path.stem}_quality.json"
        result_path.write_text(json.dumps(result, indent=2, ensure_ascii=True), encoding="utf-8")
        return result_path

    def find_latest_snapshot(self) -> Path | None:
        snapshots = sorted(
            self.artifacts_dir.rglob("snapshot_*.jpg"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        return snapshots[0] if snapshots else None
