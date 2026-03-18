"""Validate YOLO images/labels pairs for the first block-detector dataset."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.training.dataset_utils import collect_dataset_issues


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate YOLO dataset consistency for class 'bloco'")
    parser.add_argument("--images-dir", required=True, help="Directory containing YOLO images")
    parser.add_argument("--labels-dir", required=True, help="Directory containing YOLO labels")
    parser.add_argument("--allow-missing-labels", action="store_true", help="Allow images without labels")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    issues = collect_dataset_issues(
        images_dir=Path(args.images_dir),
        labels_dir=Path(args.labels_dir),
        allow_missing_labels=args.allow_missing_labels,
    )
    print(json.dumps(issues, indent=2, ensure_ascii=True))
    return 0 if issues["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
