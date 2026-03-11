"""Image loading and preprocessing helpers for quality analysis."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError


class ImageQualityError(Exception):
    """Raised when an image cannot be prepared for quality analysis."""


def load_image_bundle(image_path: str | Path) -> dict[str, Any]:
    """Load the image once and prepare RGB and grayscale versions."""
    resolved_path = Path(image_path).expanduser().resolve()
    if not resolved_path.exists():
        raise ImageQualityError(f"Image not found: {resolved_path}")

    try:
        with Image.open(resolved_path) as image:
            rgb_image = image.convert("RGB")
            grayscale_image = rgb_image.convert("L")
            width, height = rgb_image.size

            return {
                "path": resolved_path,
                "rgb": rgb_image.copy(),
                "gray": grayscale_image.copy(),
                "width": width,
                "height": height,
            }
    except UnidentifiedImageError as exc:
        raise ImageQualityError(f"Invalid or unsupported image: {resolved_path}") from exc
    except OSError as exc:
        raise ImageQualityError(f"Failed to open image {resolved_path}: {exc}") from exc
