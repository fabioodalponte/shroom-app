"""Rule-based evaluation for image quality results."""

from __future__ import annotations

from typing import Any


def build_quality_thresholds(config: dict[str, Any]) -> dict[str, Any]:
    quality_config = config.get("quality", {})
    brightness_config = quality_config.get("brightness", {})
    sharpness_config = quality_config.get("sharpness", {})

    return {
        "min_width": int(quality_config.get("min_width", 640)),
        "min_height": int(quality_config.get("min_height", 480)),
        "too_dark_below": float(brightness_config.get("too_dark_below", 55.0)),
        "too_bright_above": float(brightness_config.get("too_bright_above", 210.0)),
        "too_blurry_below": float(sharpness_config.get("too_blurry_below", 12.0)),
    }


def evaluate_quality(metrics: dict[str, Any], thresholds: dict[str, Any]) -> dict[str, Any]:
    resolution = metrics["resolution"]

    flags = {
        "low_resolution": resolution["width"] < thresholds["min_width"]
        or resolution["height"] < thresholds["min_height"],
        "too_dark": metrics["brightness_mean"] < thresholds["too_dark_below"],
        "too_bright": metrics["brightness_mean"] > thresholds["too_bright_above"],
        "too_blurry": metrics["sharpness_score"] < thresholds["too_blurry_below"],
    }

    if flags["low_resolution"]:
        status = "low_resolution"
    elif flags["too_dark"]:
        status = "too_dark"
    elif flags["too_bright"]:
        status = "too_bright"
    elif flags["too_blurry"]:
        status = "too_blurry"
    else:
        status = "valid"

    return {
        "status": status,
        "dataset_eligible": status == "valid",
        "flags": flags,
        "thresholds": thresholds,
    }
