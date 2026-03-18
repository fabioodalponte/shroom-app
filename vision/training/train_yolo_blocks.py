"""Train a first YOLOv8 detector for mushroom blocks."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.training.dataset_utils import collect_dataset_issues


DATASET_ROOT = Path("vision/dataset")
TRAIN_IMAGES = DATASET_ROOT / "train" / "images"
TRAIN_LABELS = DATASET_ROOT / "train" / "labels"
VAL_IMAGES = DATASET_ROOT / "val" / "images"
VAL_LABELS = DATASET_ROOT / "val" / "labels"
RUNS_DIR = Path("vision/training/runs")
MODEL_OUTPUT = Path("vision/models/block_detector.pt")
DATASET_YAML = Path("vision/training/yolo_blocks_dataset.yaml")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train YOLOv8 block detector")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size used for training")
    parser.add_argument("--device", default="cpu", help="Training device, default cpu")
    parser.add_argument("--base-model", default="yolov8n.pt", help="Base YOLOv8 model")
    return parser


def ensure_dataset_structure() -> None:
    required_dirs = [TRAIN_IMAGES, TRAIN_LABELS, VAL_IMAGES, VAL_LABELS, RUNS_DIR, MODEL_OUTPUT.parent]
    for directory in required_dirs:
        directory.mkdir(parents=True, exist_ok=True)


def validate_dataset() -> None:
    if not any(TRAIN_IMAGES.iterdir()):
        raise FileNotFoundError(f"No training images found in {TRAIN_IMAGES}")
    if not any(VAL_IMAGES.iterdir()):
        raise FileNotFoundError(f"No validation images found in {VAL_IMAGES}")

    train_issues = collect_dataset_issues(TRAIN_IMAGES, TRAIN_LABELS, allow_missing_labels=False)
    val_issues = collect_dataset_issues(VAL_IMAGES, VAL_LABELS, allow_missing_labels=False)

    if not train_issues["ok"]:
        raise ValueError(f"Training dataset is inconsistent: {train_issues}")
    if not val_issues["ok"]:
        raise ValueError(f"Validation dataset is inconsistent: {val_issues}")


def write_dataset_yaml() -> Path:
    yaml_content = "\n".join(
        [
            f"path: {DATASET_ROOT.resolve()}",
            "train: train/images",
            "val: val/images",
            "names:",
            "  0: bloco",
            "",
        ]
    )
    DATASET_YAML.write_text(yaml_content, encoding="utf-8")
    return DATASET_YAML


def main() -> int:
    args = build_parser().parse_args()
    ensure_dataset_structure()
    validate_dataset()
    dataset_yaml_path = write_dataset_yaml()

    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as exc:
        raise SystemExit(f"ultralytics is required to train the model: {exc}")

    print(f"[vision] training_start dataset={dataset_yaml_path} base_model={args.base_model} device={args.device}")
    model = YOLO(args.base_model)
    results = model.train(
        data=str(dataset_yaml_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        device=args.device,
        project=str(RUNS_DIR),
        name="block_detector",
        exist_ok=True,
    )

    save_dir = Path(getattr(results, "save_dir", RUNS_DIR / "block_detector"))
    best_weights = save_dir / "weights" / "best.pt"
    if not best_weights.exists():
        raise FileNotFoundError(f"best.pt not found after training in {best_weights}")

    shutil.copy2(best_weights, MODEL_OUTPUT)
    print(f"[vision] training_complete model_saved={MODEL_OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
