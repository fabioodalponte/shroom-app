"""Train a YOLOv8 detector for mushroom blocks."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from vision.training.dataset_utils import collect_dataset_issues


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train YOLOv8 block detector")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size used for training")
    parser.add_argument("--device", default="cpu", help="Training device, default cpu")
    parser.add_argument("--base-model", default="yolov8n.pt", help="Base YOLOv8 model")
    parser.add_argument("--dataset-root", default="vision/dataset", help="Dataset root containing train/ and val/")
    parser.add_argument("--dataset-yaml", default="vision/training/yolo_blocks_dataset.yaml", help="Path to the generated dataset yaml")
    parser.add_argument("--runs-dir", default="vision/training/runs", help="Directory where YOLO training runs are stored")
    parser.add_argument("--run-name", default="block_detector", help="YOLO run name")
    parser.add_argument("--model-output", default="vision/models/block_detector.pt", help="Path where the trained best weights will be copied")
    return parser


def ensure_dataset_structure(dataset_root: Path, runs_dir: Path, model_output: Path, dataset_yaml: Path) -> None:
    train_images = dataset_root / "train" / "images"
    train_labels = dataset_root / "train" / "labels"
    val_images = dataset_root / "val" / "images"
    val_labels = dataset_root / "val" / "labels"
    required_dirs = [train_images, train_labels, val_images, val_labels, runs_dir, model_output.parent, dataset_yaml.parent]
    for directory in required_dirs:
        directory.mkdir(parents=True, exist_ok=True)


def validate_dataset(dataset_root: Path) -> None:
    train_images = dataset_root / "train" / "images"
    train_labels = dataset_root / "train" / "labels"
    val_images = dataset_root / "val" / "images"
    val_labels = dataset_root / "val" / "labels"

    if not any(train_images.iterdir()):
        raise FileNotFoundError(f"No training images found in {train_images}")
    if not any(val_images.iterdir()):
        raise FileNotFoundError(f"No validation images found in {val_images}")

    train_issues = collect_dataset_issues(train_images, train_labels, allow_missing_labels=False)
    val_issues = collect_dataset_issues(val_images, val_labels, allow_missing_labels=False)

    if not train_issues["ok"]:
        raise ValueError(f"Training dataset is inconsistent: {train_issues}")
    if not val_issues["ok"]:
        raise ValueError(f"Validation dataset is inconsistent: {val_issues}")


def write_dataset_yaml(dataset_root: Path, dataset_yaml: Path) -> Path:
    yaml_content = "\n".join(
        [
            f"path: {dataset_root.resolve()}",
            "train: train/images",
            "val: val/images",
            "names:",
            "  0: bloco",
            "",
        ]
    )
    dataset_yaml.write_text(yaml_content, encoding="utf-8")
    return dataset_yaml


def main() -> int:
    args = build_parser().parse_args()
    dataset_root = Path(args.dataset_root)
    dataset_yaml = Path(args.dataset_yaml)
    runs_dir = Path(args.runs_dir).resolve()
    model_output = Path(args.model_output)

    ensure_dataset_structure(dataset_root, runs_dir, model_output, dataset_yaml)
    validate_dataset(dataset_root)
    dataset_yaml_path = write_dataset_yaml(dataset_root, dataset_yaml)

    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as exc:
        raise SystemExit(f"ultralytics is required to train the model: {exc}")

    print(f"[vision] training_start dataset={dataset_yaml_path} base_model={args.base_model} device={args.device}")
    model = YOLO(args.base_model)
    save_dir = runs_dir / args.run_name
    try:
        results = model.train(
            data=str(dataset_yaml_path),
            epochs=args.epochs,
            imgsz=args.imgsz,
            device=args.device,
            project=str(runs_dir),
            name=args.run_name,
            exist_ok=True,
        )
        save_dir = Path(getattr(results, "save_dir", save_dir))
    except KeyboardInterrupt:
        print(f"[vision] training_interrupted run_dir={save_dir}", file=sys.stderr)

    best_weights = save_dir / "weights" / "best.pt"
    if not best_weights.exists():
        raise FileNotFoundError(f"best.pt not found after training in {best_weights}")

    shutil.copy2(best_weights, model_output)
    print(f"[vision] training_complete model_saved={model_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
