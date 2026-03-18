"""Local storage layer for images and inference results."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SnapshotCandidate:
    """Represents one candidate snapshot and how its timestamp was resolved."""

    path: Path
    timestamp: datetime
    criterion: str


class ArtifactStore:
    """Stores snapshots and structured results in local folders."""

    def __init__(self, config: dict[str, Any]) -> None:
        storage_config = config.get("storage", {})
        self.artifacts_dir = Path(storage_config.get("artifacts_dir", "vision/storage/artifacts"))
        self.results_dir = Path(storage_config.get("results_dir", "vision/storage/results"))
        self.dataset_dir = Path(storage_config.get("dataset_dir", "vision/dataset"))
        self.reprocess_dir = Path(storage_config.get("reprocess_dir", "vision/storage/reprocess_queue"))

        for directory in [self.artifacts_dir, self.results_dir, self.dataset_dir, self.reprocess_dir]:
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

    def _resolve_snapshot_timestamp(self, image_path: Path) -> SnapshotCandidate:
        metadata_path = image_path.with_suffix(".json")
        if metadata_path.exists():
            try:
                payload = json.loads(metadata_path.read_text(encoding="utf-8"))
                for key in ("captured_at", "timestamp", "created_at"):
                    value = payload.get(key)
                    if not value:
                        continue
                    normalized = str(value).replace("Z", "+00:00")
                    try:
                        return SnapshotCandidate(
                            path=image_path,
                            timestamp=datetime.fromisoformat(normalized).astimezone(timezone.utc),
                            criterion=f"metadata.{key}",
                        )
                    except ValueError:
                        continue
            except Exception:
                pass

        stem = image_path.stem
        if stem.startswith("snapshot_"):
            raw = stem[len("snapshot_") :]
            for pattern in ("%Y%m%dT%H%M%S%fZ", "%Y%m%dT%H%M%SZ"):
                try:
                    return SnapshotCandidate(
                        path=image_path,
                        timestamp=datetime.strptime(raw, pattern).replace(tzinfo=timezone.utc),
                        criterion="filename_timestamp",
                    )
                except ValueError:
                    continue

        return SnapshotCandidate(
            path=image_path,
            timestamp=datetime.fromtimestamp(image_path.stat().st_mtime, tz=timezone.utc),
            criterion="file_mtime",
        )

    def list_snapshot_candidates(self) -> list[SnapshotCandidate]:
        snapshots = [path for path in self.artifacts_dir.rglob("snapshot_*.jpg") if path.is_file()]
        candidates = [self._resolve_snapshot_timestamp(path) for path in snapshots]
        return sorted(candidates, key=lambda candidate: (candidate.timestamp, candidate.path.name), reverse=True)

    def find_latest_snapshot_details(self) -> dict[str, Any] | None:
        candidates = self.list_snapshot_candidates()
        if not candidates:
            return None

        latest = candidates[0]
        return {
            "path": latest.path,
            "timestamp": latest.timestamp,
            "criterion": latest.criterion,
            "candidate_count": len(candidates),
        }

    def find_latest_snapshot(self) -> Path | None:
        details = self.find_latest_snapshot_details()
        return details["path"] if details else None

    def enqueue_remote_retry(
        self,
        image_path: Path,
        pipeline_result: dict[str, Any],
        remote_state: dict[str, Any],
    ) -> Path:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        manifest_path = self.reprocess_dir / f"remote_retry_{image_path.stem}_{timestamp}.json"
        payload = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "image_path": str(image_path),
            "remote_state": remote_state,
            "pipeline_result": pipeline_result,
        }
        manifest_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
        return manifest_path
