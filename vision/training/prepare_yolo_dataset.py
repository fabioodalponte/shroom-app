"""Prepare YOLO train/val directories from manually annotated block images."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.training.dataset_utils import (
    build_image_entries,
    collect_dataset_issues,
    link_or_copy_file,
    safe_clear_directory,
    sample_evenly,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare the first YOLO dataset for block detection")
    parser.add_argument("--annotations-root", default="vision/dataset/annotations/block_detector_v1", help="Root folder with images/ and labels/")
    parser.add_argument("--dataset-root", default="vision/dataset", help="Target dataset root with train/ and val/")
    parser.add_argument("--val-ratio", type=float, default=0.2, help="Validation split ratio")
    parser.add_argument("--link-mode", choices=["hardlink_or_copy", "copy", "symlink"], default="hardlink_or_copy", help="How to materialize files into train/val")
    parser.add_argument("--clean", action="store_true", help="Remove previous train/val files before preparing the split")
    parser.add_argument("--manifest-path", default="vision/dataset/annotations/block_detector_v1/split_manifest.json", help="Path to the generated split manifest")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    annotations_root = Path(args.annotations_root)
    images_dir = annotations_root / "images"
    labels_dir = annotations_root / "labels"
    dataset_root = Path(args.dataset_root)
    train_images_dir = dataset_root / "train" / "images"
    train_labels_dir = dataset_root / "train" / "labels"
    val_images_dir = dataset_root / "val" / "images"
    val_labels_dir = dataset_root / "val" / "labels"
    manifest_path = Path(args.manifest_path)

    issues = collect_dataset_issues(images_dir, labels_dir, allow_missing_labels=False)
    if not issues["ok"]:
        raise SystemExit(json.dumps(issues, indent=2, ensure_ascii=True))

    image_entries = build_image_entries(images_dir)
    if not image_entries:
        raise FileNotFoundError(f"No annotated images found in {images_dir}")

    image_entries = [entry for entry in image_entries if (labels_dir / f"{entry.image_path.stem}.txt").exists()]

    val_count = max(1, round(len(image_entries) * max(0.05, min(args.val_ratio, 0.4))))
    val_entries = sample_evenly(image_entries, val_count)
    val_stems = {entry.image_path.stem for entry in val_entries}
    train_entries = [entry for entry in image_entries if entry.image_path.stem not in val_stems]

    if args.clean:
        for directory in (train_images_dir, train_labels_dir, val_images_dir, val_labels_dir):
            safe_clear_directory(directory)

    for directory in (train_images_dir, train_labels_dir, val_images_dir, val_labels_dir):
        directory.mkdir(parents=True, exist_ok=True)

    def materialize_split(entries: list, split_name: str, images_target: Path, labels_target: Path) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        for entry in entries:
            label_path = labels_dir / f"{entry.image_path.stem}.txt"
            target_image = images_target / entry.image_path.name
            target_label = labels_target / label_path.name
            link_or_copy_file(entry.image_path, target_image, mode=args.link_mode)
            link_or_copy_file(label_path, target_label, mode=args.link_mode)
            rows.append(
                {
                    "split": split_name,
                    "image_name": entry.image_path.name,
                    "image_path": str(target_image),
                    "label_path": str(target_label),
                    "timestamp": entry.timestamp.isoformat(),
                }
            )
        return rows

    manifest_rows = []
    manifest_rows.extend(materialize_split(train_entries, "train", train_images_dir, train_labels_dir))
    manifest_rows.extend(materialize_split(val_entries, "val", val_images_dir, val_labels_dir))

    manifest_payload = {
        "annotations_root": str(annotations_root),
        "dataset_root": str(dataset_root),
        "train_count": len(train_entries),
        "val_count": len(val_entries),
        "link_mode": args.link_mode,
        "entries": manifest_rows,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest_payload, indent=2, ensure_ascii=True), encoding="utf-8")

    print(json.dumps(manifest_payload, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
