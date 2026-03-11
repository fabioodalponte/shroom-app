"""Capture client for ESP32-CAM snapshot endpoints."""

from __future__ import annotations

import logging
import ssl
from datetime import datetime, timezone
from typing import Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class VisionCaptureError(Exception):
    """Raised when the camera snapshot request fails."""


class ESP32CamCaptureClient:
    """HTTP snapshot client used by the first vision pipeline."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.capture_config = config.get("capture", {})
        self.camera_url = str(self.capture_config.get("camera_url", "")).strip()
        self.timeout_seconds = int(self.capture_config.get("request_timeout_seconds", 10))
        self.verify_tls = bool(self.capture_config.get("verify_tls", True))

        if not self.camera_url:
            raise ValueError("capture.camera_url is required in vision config")

    def capture_snapshot(self) -> tuple[bytes, dict[str, Any]]:
        request = Request(
            self.camera_url,
            method="GET",
            headers={"User-Agent": "shroom-vision/0.1"},
        )
        context = None
        if self.camera_url.startswith("https://") and not self.verify_tls:
            context = ssl._create_unverified_context()

        try:
            with urlopen(request, timeout=self.timeout_seconds, context=context) as response:
                image_bytes = response.read()
                content_type = response.headers.get("Content-Type", "application/octet-stream")
                http_status = getattr(response, "status", 200)
        except HTTPError as exc:
            raise VisionCaptureError(
                f"Camera returned HTTP {exc.code} for {self.camera_url}"
            ) from exc
        except URLError as exc:
            raise VisionCaptureError(
                f"Camera request failed for {self.camera_url}: {exc.reason}"
            ) from exc
        except TimeoutError as exc:
            raise VisionCaptureError(
                f"Camera request timed out after {self.timeout_seconds}s for {self.camera_url}"
            ) from exc
        except OSError as exc:
            raise VisionCaptureError(
                f"Camera request failed for {self.camera_url}: {exc}"
            ) from exc

        if not image_bytes:
            raise VisionCaptureError(f"Camera returned an empty payload for {self.camera_url}")

        metadata = {
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "camera_url": self.camera_url,
            "http_status": http_status,
            "content_type": content_type,
            "size_bytes": len(image_bytes),
            "source": "esp32-cam",
        }
        return image_bytes, metadata


def capture_snapshot_safe(
    client: ESP32CamCaptureClient,
    logger: logging.Logger,
) -> dict[str, Any]:
    """Capture a snapshot and return a structured success or error payload."""
    try:
        image_bytes, metadata = client.capture_snapshot()
    except VisionCaptureError as exc:
        logger.error("capture_error camera_url=%s error=%s", client.camera_url, exc)
        return {
            "ok": False,
            "error": str(exc),
            "camera_url": client.camera_url,
        }

    logger.info(
        "capture_success camera_url=%s size_bytes=%s content_type=%s",
        client.camera_url,
        metadata["size_bytes"],
        metadata["content_type"],
    )
    return {
        "ok": True,
        "image_bytes": image_bytes,
        "metadata": metadata,
    }
