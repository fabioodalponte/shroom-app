"""Run the trained block detector against the latest captured image."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.config.loader import load_vision_config
from vision.inference.block_detection import detect_blocks
from vision.storage.artifact_store import ArtifactStore


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Test the trained YOLO block detector on the latest snapshot")
    parser.add_argument("--config", default="vision/config/vision_config.json", help="Path to the vision config JSON")
    parser.add_argument("--image-path", default="", help="Optional image path to override the latest snapshot lookup")
    parser.add_argument("--image", default="", help="Deprecated alias for --image-path")
    parser.add_argument("--output", default="", help="Optional JSON path to save the test result")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    config = load_vision_config(args.config)
    artifact_store = ArtifactStore(config)
    manual_image_path = str(args.image_path or args.image).strip()

    if manual_image_path:
        image_path = Path(manual_image_path)
        selection_info = {
            "image_path": str(image_path),
            "selected_by": "manual_override",
            "candidate_count": 1,
            "selected_timestamp": None,
        }
    else:
        latest_snapshot = artifact_store.find_latest_snapshot_details()
        if latest_snapshot is None:
            raise FileNotFoundError(f"No snapshot found in {artifact_store.artifacts_dir}")
        image_path = Path(latest_snapshot["path"])
        selection_info = {
            "image_path": str(image_path),
            "selected_by": latest_snapshot["criterion"],
            "candidate_count": latest_snapshot["candidate_count"],
            "selected_timestamp": latest_snapshot["timestamp"].isoformat(),
        }

    print(
        "[vision] latest_test_image"
        f" path={selection_info['image_path']}"
        f" criterion={selection_info['selected_by']}"
        f" candidates={selection_info['candidate_count']}",
        file=sys.stderr,
    )

    detection_result = detect_blocks(image_path=image_path, config=config, logger=None)
    payload = {
        "status": "block_detector_test_complete",
        "image_path": str(image_path),
        "image_selection": selection_info,
        "block_detection": detection_result,
    }

    if detection_result.get("error"):
        print(json.dumps(payload, indent=2, ensure_ascii=True))
        return 1

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")

    print(json.dumps(payload, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
