"""Quality metrics for captured room images."""

from __future__ import annotations

from typing import Any

from PIL import ImageFilter, ImageStat


def calculate_quality_metrics(image_bundle: dict[str, Any]) -> dict[str, Any]:
    """Compute lightweight metrics suitable for Raspberry Pi."""
    gray_image = image_bundle["gray"]
    width = int(image_bundle["width"])
    height = int(image_bundle["height"])

    gray_stats = ImageStat.Stat(gray_image)
    edge_image = gray_image.filter(ImageFilter.FIND_EDGES)
    edge_stats = ImageStat.Stat(edge_image)

    brightness_mean = float(gray_stats.mean[0])
    contrast_stddev = float(gray_stats.stddev[0])
    sharpness_score = float(edge_stats.mean[0])

    return {
        "resolution": {
            "width": width,
            "height": height,
            "total_pixels": width * height,
        },
        "brightness_mean": round(brightness_mean, 2),
        "contrast_stddev": round(contrast_stddev, 2),
        "sharpness_score": round(sharpness_score, 2),
    }
