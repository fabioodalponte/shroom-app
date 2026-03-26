"""Import a Label Studio YOLO export into a versioned annotations directory."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import tempfile
from pathlib import Path
import sys
from typing import Any
import zipfile

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.training.dataset_utils import IMAGE_EXTENSIONS, collect_dataset_issues, link_or_copy_file


SNAPSHOT_PATTERN = re.compile(r"(snapshot_[A-Za-z0-9]+)(?P<suffix>\.[A-Za-z0-9]+)?$")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import a Label Studio YOLO export into a normalized dataset directory")
    parser.add_argument("--export-zip", default="", help="Path to the Label Studio YOLO zip export")
    parser.add_argument("--export-root", default="", help="Path to an already extracted Label Studio YOLO export")
    parser.add_argument("--target-root", default="vision/dataset/annotations/block_detector_v2", help="Target annotations root with images/ and labels/")
    parser.add_argument("--source-images-dir", default="vision/dataset/annotations/block_detector_v1/images", help="Fallback image source directory when the export does not contain images")
    parser.add_argument("--image-mode", choices=["hardlink_or_copy", "copy", "symlink"], default="hardlink_or_copy", help="How to materialize images into the target directory")
    parser.add_argument("--clean", action="store_true", help="Remove previous contents from the target directory before importing")
    return parser


def normalize_export_name(path: Path) -> str:
    match = SNAPSHOT_PATTERN.search(path.name)
    if not match:
        raise ValueError(f"Unable to normalize exported filename: {path.name}")

    snapshot_name = match.group(1)
    suffix = path.suffix.lower()
    if not suffix:
        suffix = match.group("suffix") or ""
    return f"{snapshot_name}{suffix}"


def clear_directory(directory: Path) -> None:
    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
        return

    for child in directory.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()


def copy_and_rewrite_json(source: Path, target: Path, replacements: dict[str, str]) -> None:
    payload = json.loads(source.read_text(encoding="utf-8"))

    def rewrite(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: rewrite(item) for key, item in value.items()}
        if isinstance(value, list):
            return [rewrite(item) for item in value]
        if isinstance(value, str):
            updated = value
            for original, normalized in replacements.items():
                updated = updated.replace(original, normalized)
            return updated
        return value

    target.write_text(json.dumps(rewrite(payload), indent=2, ensure_ascii=True), encoding="utf-8")


def find_source_image(stem: str, export_images_dir: Path, source_images_dir: Path) -> Path | None:
    if export_images_dir.exists():
        for image_path in sorted(export_images_dir.iterdir()):
            if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            try:
                if Path(normalize_export_name(image_path)).stem == stem:
                    return image_path
            except ValueError:
                continue

    if source_images_dir.exists():
        for extension in sorted(IMAGE_EXTENSIONS):
            candidate = source_images_dir / f"{stem}{extension}"
            if candidate.exists():
                return candidate
    return None


def import_export(
    export_root: Path,
    target_root: Path,
    source_images_dir: Path,
    image_mode: str,
    clean: bool,
) -> dict[str, Any]:
    export_images_dir = export_root / "images"
    export_labels_dir = export_root / "labels"
    target_images_dir = target_root / "images"
    target_labels_dir = target_root / "labels"

    if not export_labels_dir.exists():
        raise FileNotFoundError(f"Export labels directory not found: {export_labels_dir}")

    if clean:
        clear_directory(target_root)

    target_root.mkdir(parents=True, exist_ok=True)
    target_images_dir.mkdir(parents=True, exist_ok=True)
    target_labels_dir.mkdir(parents=True, exist_ok=True)

    replacements: dict[str, str] = {}
    duplicate_target_names: list[str] = []
    missing_images: list[str] = []
    broken_names: list[str] = []
    imported_images: list[str] = []
    imported_labels: list[str] = []
    image_materialization: dict[str, str] = {}

    for label_path in sorted(export_labels_dir.glob("*.txt")):
        try:
            normalized_label_name = normalize_export_name(label_path.with_suffix(".txt"))
        except ValueError:
            broken_names.append(label_path.name)
            continue

        normalized_stem = Path(normalized_label_name).stem
        replacements[label_path.name] = normalized_label_name

        target_label_path = target_labels_dir / normalized_label_name
        if target_label_path.exists():
            duplicate_target_names.append(normalized_label_name)
            continue

        target_label_path.write_text(label_path.read_text(encoding="utf-8"), encoding="utf-8")
        imported_labels.append(normalized_label_name)

        source_image = find_source_image(normalized_stem, export_images_dir, source_images_dir)
        if source_image is None:
            missing_images.append(normalized_stem)
            continue

        target_image_path = target_images_dir / f"{normalized_stem}{source_image.suffix.lower()}"
        image_materialization[normalized_stem] = link_or_copy_file(source_image, target_image_path, mode=image_mode)
        imported_images.append(target_image_path.name)

    copied_metadata: list[str] = []
    for metadata_path in sorted(export_root.iterdir()):
        if metadata_path.name in {"images", "labels"} or not metadata_path.is_file():
            continue

        target_metadata_path = target_root / metadata_path.name
        if metadata_path.suffix.lower() == ".json":
            copy_and_rewrite_json(metadata_path, target_metadata_path, replacements)
        else:
            target_metadata_path.write_text(metadata_path.read_text(encoding="utf-8"), encoding="utf-8")
        copied_metadata.append(metadata_path.name)

    validation = collect_dataset_issues(target_images_dir, target_labels_dir, allow_missing_labels=False)
    empty_images = sorted(path.name for path in target_images_dir.iterdir() if path.is_file() and path.stat().st_size == 0)
    empty_labels = sorted(path.name for path in target_labels_dir.glob("*.txt") if path.stat().st_size == 0)

    report = {
        "export_root": str(export_root),
        "target_root": str(target_root),
        "source_images_dir": str(source_images_dir),
        "image_mode": image_mode,
        "copied_metadata": copied_metadata,
        "imported_image_count": len(imported_images),
        "imported_label_count": len(imported_labels),
        "duplicate_target_names": duplicate_target_names,
        "broken_names": broken_names,
        "missing_images": missing_images,
        "empty_images": empty_images,
        "empty_labels": empty_labels,
        "image_materialization": image_materialization,
        "validation": validation,
    }
    report["ok"] = not any(
        [
            duplicate_target_names,
            broken_names,
            missing_images,
            empty_images,
            validation["missing_labels"],
            validation["orphan_labels"],
            validation["invalid_labels"],
        ]
    )
    return report


def resolve_export_root(export_zip: str, export_root: str) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    if export_root:
        return Path(export_root), None
    if not export_zip:
        raise SystemExit("Either --export-zip or --export-root is required")

    temp_dir = tempfile.TemporaryDirectory(prefix="labelstudio_export_")
    extracted_root = Path(temp_dir.name)
    with zipfile.ZipFile(export_zip) as archive:
        archive.extractall(extracted_root)
    return extracted_root, temp_dir


def main() -> int:
    args = build_parser().parse_args()
    export_root, temp_dir = resolve_export_root(args.export_zip, args.export_root)

    try:
        report = import_export(
            export_root=export_root,
            target_root=Path(args.target_root),
            source_images_dir=Path(args.source_images_dir),
            image_mode=args.image_mode,
            clean=args.clean,
        )
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()

    report_path = Path(args.target_root) / "import_report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
