"""Select a diverse initial sample of valid images for manual annotation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.training.dataset_utils import (
    build_image_entries,
    link_or_copy_file,
    safe_clear_directory,
    sample_diverse_entries,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Select a diverse sample of valid images for block annotation")
    parser.add_argument("--source-dir", default="vision/dataset/raw/valid", help="Directory with valid raw images")
    parser.add_argument("--output-dir", default="vision/dataset/annotations/block_detector_v1/images", help="Output directory for sampled images")
    parser.add_argument("--metadata-dir", default="vision/dataset/annotations/block_detector_v1/metadata", help="Output directory for sampled metadata sidecars")
    parser.add_argument("--manifest-path", default="vision/dataset/annotations/block_detector_v1/sample_manifest.json", help="Path to the generated sample manifest")
    parser.add_argument("--sample-size", type=int, default=100, help="Number of images to sample")
    parser.add_argument("--link-mode", choices=["hardlink_or_copy", "copy", "symlink"], default="hardlink_or_copy", help="How to materialize selected files")
    parser.add_argument("--clean", action="store_true", help="Remove previous sampled images before writing the new selection")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    source_dir = Path(args.source_dir)
    output_dir = Path(args.output_dir)
    metadata_dir = Path(args.metadata_dir)
    manifest_path = Path(args.manifest_path)

    if not source_dir.exists():
        raise FileNotFoundError(f"Source directory not found: {source_dir}")

    entries = build_image_entries(source_dir)
    if not entries:
        raise FileNotFoundError(f"No valid images found in {source_dir}")

    sampled_entries = sample_diverse_entries(entries, args.sample_size)

    if args.clean:
        safe_clear_directory(output_dir)
        safe_clear_directory(metadata_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    for index, entry in enumerate(sampled_entries, start=1):
        target_image = output_dir / entry.image_path.name
        materialization = link_or_copy_file(entry.image_path, target_image, mode=args.link_mode)

        target_metadata = None
        if entry.metadata_path and entry.metadata_path.exists():
            target_metadata = metadata_dir / entry.metadata_path.name
            link_or_copy_file(entry.metadata_path, target_metadata, mode=args.link_mode)

        manifest_rows.append(
            {
                "index": index,
                "image_name": entry.image_path.name,
                "image_path": str(target_image),
                "source_image_path": str(entry.image_path),
                "metadata_path": str(target_metadata) if target_metadata else None,
                "timestamp": entry.timestamp.isoformat(),
                "materialization": materialization,
            }
        )

    manifest_payload = {
        "source_dir": str(source_dir),
        "sample_size_requested": args.sample_size,
        "sample_size_selected": len(sampled_entries),
        "output_dir": str(output_dir),
        "metadata_dir": str(metadata_dir),
        "manifest_entries": manifest_rows,
    }
    manifest_path.write_text(json.dumps(manifest_payload, indent=2, ensure_ascii=True), encoding="utf-8")

    print(json.dumps(manifest_payload, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
