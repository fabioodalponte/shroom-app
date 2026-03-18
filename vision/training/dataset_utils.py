"""Shared helpers for the first YOLOv8 block-detector dataset workflow."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class ImageEntry:
    """Represents one dataset image ordered in time."""

    image_path: Path
    timestamp: datetime
    metadata_path: Path | None = None


def list_image_files(directory: Path) -> list[Path]:
    return sorted(
        [
            path
            for path in directory.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        ]
    )


def parse_snapshot_timestamp(path: Path) -> datetime:
    stem = path.stem
    if stem.startswith("snapshot_"):
        raw = stem[len("snapshot_") :]
        for pattern in ("%Y%m%dT%H%M%S%fZ", "%Y%m%dT%H%M%SZ"):
            try:
                return datetime.strptime(raw, pattern).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

    metadata_path = path.with_suffix(".json")
    if metadata_path.exists():
        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            for key in ("captured_at", "executed_at", "timestamp", "created_at"):
                value = payload.get(key)
                if not value:
                    continue
                normalized = str(value).replace("Z", "+00:00")
                try:
                    return datetime.fromisoformat(normalized).astimezone(timezone.utc)
                except ValueError:
                    continue
        except Exception:
            pass

    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)


def build_image_entries(directory: Path) -> list[ImageEntry]:
    entries = []
    for image_path in list_image_files(directory):
        metadata_path = image_path.with_suffix(".json")
        entries.append(
            ImageEntry(
                image_path=image_path,
                timestamp=parse_snapshot_timestamp(image_path),
                metadata_path=metadata_path if metadata_path.exists() else None,
            )
        )
    return sorted(entries, key=lambda entry: (entry.timestamp, entry.image_path.name))


def sample_evenly(items: list[Any], limit: int) -> list[Any]:
    if limit <= 0:
        return []
    if len(items) <= limit:
        return items
    if limit == 1:
        return [items[0]]

    step = (len(items) - 1) / (limit - 1)
    selected: list[Any] = []
    used_indices: set[int] = set()

    for index in range(limit):
        target_index = min(len(items) - 1, round(index * step))
        if target_index in used_indices:
            continue
        used_indices.add(target_index)
        selected.append(items[target_index])

    if len(selected) < limit:
        for index, item in enumerate(items):
            if index in used_indices:
                continue
            selected.append(item)
            if len(selected) >= limit:
                break

    return selected[:limit]


def timelapse_bucket_key(timestamp: datetime, total_hours: float) -> str:
    if total_hours >= 24 * 30:
        return timestamp.strftime("%Y-%m-%d")
    if total_hours >= 24 * 7:
        bucket_hour = (timestamp.hour // 6) * 6
        return f"{timestamp.strftime('%Y-%m-%d')}-{bucket_hour:02d}"
    if total_hours >= 24 * 2:
        bucket_hour = (timestamp.hour // 2) * 2
        return f"{timestamp.strftime('%Y-%m-%d')}-{bucket_hour:02d}"
    if total_hours >= 8:
        return timestamp.strftime("%Y-%m-%d-%H")

    bucket_minute = (timestamp.minute // 30) * 30
    return f"{timestamp.strftime('%Y-%m-%d-%H')}-{bucket_minute:02d}"


def sample_diverse_entries(entries: list[ImageEntry], limit: int) -> list[ImageEntry]:
    if len(entries) <= limit:
        return entries

    span_hours = max(
        1.0,
        (entries[-1].timestamp - entries[0].timestamp).total_seconds() / 3600,
    )

    buckets: dict[str, list[ImageEntry]] = {}
    for entry in entries:
        bucket_key = timelapse_bucket_key(entry.timestamp, span_hours)
        buckets.setdefault(bucket_key, []).append(entry)

    representatives = [
        bucket_entries[len(bucket_entries) // 2]
        for _, bucket_entries in sorted(buckets.items())
    ]

    selected = sample_evenly(representatives, min(limit, len(representatives)))
    if len(selected) >= limit:
        return sorted(selected, key=lambda entry: (entry.timestamp, entry.image_path.name))

    selected_keys = {entry.image_path for entry in selected}
    leftovers = [entry for entry in entries if entry.image_path not in selected_keys]
    selected.extend(sample_evenly(leftovers, limit - len(selected)))
    return sorted(selected[:limit], key=lambda entry: (entry.timestamp, entry.image_path.name))


def safe_clear_directory(directory: Path) -> None:
    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
        return

    for child in directory.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()


def link_or_copy_file(source: Path, target: Path, mode: str = "hardlink_or_copy") -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() or target.is_symlink():
        target.unlink()

    normalized_mode = mode.strip().lower()
    if normalized_mode == "copy":
        shutil.copy2(source, target)
        return "copy"

    if normalized_mode == "symlink":
        target.symlink_to(source.resolve())
        return "symlink"

    try:
        target.hardlink_to(source)
        return "hardlink"
    except OSError:
        shutil.copy2(source, target)
        return "copy"


def dataset_pairs(images_dir: Path, labels_dir: Path) -> tuple[dict[str, Path], dict[str, Path]]:
    image_map = {path.stem: path for path in list_image_files(images_dir)}
    label_map = {
        path.stem: path
        for path in sorted(labels_dir.rglob("*.txt"))
        if path.is_file()
    }
    return image_map, label_map


def validate_label_file(label_path: Path) -> list[str]:
    errors: list[str] = []
    content = label_path.read_text(encoding="utf-8").strip()
    if not content:
        return errors

    for line_number, line in enumerate(content.splitlines(), start=1):
        parts = line.strip().split()
        if len(parts) != 5:
            errors.append(f"{label_path}: linha {line_number} deve ter 5 colunas, recebeu {len(parts)}")
            continue

        try:
            class_id = int(parts[0])
            values = [float(value) for value in parts[1:]]
        except ValueError:
            errors.append(f"{label_path}: linha {line_number} contem valor nao numerico")
            continue

        if class_id != 0:
            errors.append(f"{label_path}: linha {line_number} usa class_id {class_id}, esperado 0")

        x_center, y_center, width, height = values
        for value_name, value in (
            ("x_center", x_center),
            ("y_center", y_center),
            ("width", width),
            ("height", height),
        ):
            if value < 0 or value > 1:
                errors.append(f"{label_path}: linha {line_number} possui {value_name} fora do intervalo [0,1]")

        if width <= 0 or height <= 0:
            errors.append(f"{label_path}: linha {line_number} possui bbox com width/height <= 0")

    return errors


def collect_dataset_issues(
    images_dir: Path,
    labels_dir: Path,
    allow_missing_labels: bool = False,
) -> dict[str, Any]:
    image_map, label_map = dataset_pairs(images_dir, labels_dir)
    missing_labels = sorted(stem for stem in image_map if stem not in label_map)
    orphan_labels = sorted(stem for stem in label_map if stem not in image_map)
    invalid_labels: list[str] = []

    for stem in sorted(set(image_map).intersection(label_map)):
        invalid_labels.extend(validate_label_file(label_map[stem]))

    issues = {
        "images_dir": str(images_dir),
        "labels_dir": str(labels_dir),
        "image_count": len(image_map),
        "label_count": len(label_map),
        "matched_pairs": len(set(image_map).intersection(label_map)),
        "missing_labels": missing_labels,
        "orphan_labels": orphan_labels,
        "invalid_labels": invalid_labels,
    }

    issue_count = len(orphan_labels) + len(invalid_labels)
    if not allow_missing_labels:
        issue_count += len(missing_labels)

    issues["ok"] = issue_count == 0
    return issues
