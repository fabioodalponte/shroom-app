"""Capture client for ESP32-CAM snapshot endpoints."""

from __future__ import annotations

import http.client
import logging
import socket
import ssl
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit


class VisionCaptureError(Exception):
    """Raised when the camera snapshot request fails."""


class ESP32CamCaptureClient:
    """HTTP snapshot client used by the first vision pipeline."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.capture_config = config.get("capture", {})
        self.camera_url = str(self.capture_config.get("camera_url", "")).strip()
        self.timeout_seconds = int(self.capture_config.get("request_timeout_seconds", 15))
        self.connect_timeout_seconds = float(
            self.capture_config.get("connect_timeout_seconds", self.timeout_seconds)
        )
        self.read_timeout_seconds = float(
            self.capture_config.get("read_timeout_seconds", self.timeout_seconds)
        )
        self.retries = max(1, int(self.capture_config.get("request_retries", 3)))
        self.retry_backoff_seconds = float(self.capture_config.get("retry_backoff_seconds", 1.0))
        self.verify_tls = bool(self.capture_config.get("verify_tls", True))

        if not self.camera_url:
            raise ValueError("capture.camera_url is required in vision config")

    def capture_snapshot(self, logger: logging.Logger | None = None) -> tuple[bytes, dict[str, Any]]:
        attempt_errors: list[str] = []

        for attempt in range(1, self.retries + 1):
            attempt_started_at = time.monotonic()
            if logger:
                logger.info(
                    "capture_attempt_start camera_url=%s attempt=%s/%s connect_timeout_seconds=%.2f read_timeout_seconds=%.2f",
                    self.camera_url,
                    attempt,
                    self.retries,
                    self.connect_timeout_seconds,
                    self.read_timeout_seconds,
                )

            try:
                image_bytes, metadata = self.capture_snapshot_once()
                attempt_duration_seconds = round(time.monotonic() - attempt_started_at, 3)
                metadata["capture_attempt"] = attempt
                metadata["capture_attempts_total"] = self.retries
                metadata["request_timeout_seconds"] = self.timeout_seconds
                metadata["connect_timeout_seconds"] = self.connect_timeout_seconds
                metadata["read_timeout_seconds"] = self.read_timeout_seconds
                metadata["capture_attempt_duration_seconds"] = attempt_duration_seconds
                return image_bytes, metadata
            except VisionCaptureError as exc:
                attempt_errors.append(f"attempt {attempt}/{self.retries}: {exc}")

                if logger:
                    logger.warning(
                        "capture_attempt_failed camera_url=%s attempt=%s/%s duration_seconds=%.3f error=%s",
                        self.camera_url,
                        attempt,
                        self.retries,
                        time.monotonic() - attempt_started_at,
                        exc,
                    )

                if attempt >= self.retries:
                    break

                backoff_seconds = self.retry_backoff_seconds * attempt
                if logger:
                    logger.info(
                        "capture_attempt_retrying camera_url=%s next_attempt=%s/%s backoff_seconds=%.2f",
                        self.camera_url,
                        attempt + 1,
                        self.retries,
                        backoff_seconds,
                    )
                if backoff_seconds > 0:
                    time.sleep(backoff_seconds)

        raise VisionCaptureError(
            f"Camera capture failed after {self.retries} attempts for {self.camera_url}: "
            + " | ".join(attempt_errors)
        )

    def capture_snapshot_once(self) -> tuple[bytes, dict[str, Any]]:
        parsed = urlsplit(self.camera_url)
        if parsed.scheme not in {"http", "https"}:
            raise VisionCaptureError(f"Unsupported camera URL scheme for {self.camera_url}")

        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        connection: http.client.HTTPConnection | http.client.HTTPSConnection | None = None
        response: http.client.HTTPResponse | None = None

        try:
            if parsed.scheme == "https":
                context = ssl.create_default_context()
                if not self.verify_tls:
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                connection = http.client.HTTPSConnection(
                    parsed.hostname,
                    parsed.port or 443,
                    timeout=self.connect_timeout_seconds,
                    context=context,
                )
            else:
                connection = http.client.HTTPConnection(
                    parsed.hostname,
                    parsed.port or 80,
                    timeout=self.connect_timeout_seconds,
                )

            connection.request("GET", path, headers={"User-Agent": "shroom-vision/0.1"})
            response = connection.getresponse()
            http_status = response.status
            content_type = response.getheader("Content-Type", "application/octet-stream")

            if connection.sock is not None:
                connection.sock.settimeout(self.read_timeout_seconds)

            image_bytes = response.read()
        except http.client.HTTPException as exc:
            raise VisionCaptureError(
                f"Camera returned an invalid HTTP response for {self.camera_url}: {exc}"
            ) from exc
        except (TimeoutError, socket.timeout) as exc:
            raise VisionCaptureError(
                "Camera request timed out "
                f"(connect={self.connect_timeout_seconds}s, read={self.read_timeout_seconds}s) "
                f"for {self.camera_url}"
            ) from exc
        except OSError as exc:
            raise VisionCaptureError(f"Camera request failed for {self.camera_url}: {exc}") from exc
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass
            if connection is not None:
                connection.close()

        if http_status < 200 or http_status >= 300:
            raise VisionCaptureError(f"Camera returned HTTP {http_status} for {self.camera_url}")

        if not image_bytes:
            raise VisionCaptureError(f"Camera returned an empty payload for {self.camera_url}")

        if not _is_probably_image_payload(content_type, image_bytes):
            preview = image_bytes[:120].decode("utf-8", errors="replace").strip().replace("\n", " ")
            raise VisionCaptureError(
                "Camera returned a non-image payload "
                f"for {self.camera_url} (content_type={content_type}, preview={preview!r})"
            )

        metadata = {
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "camera_url": self.camera_url,
            "http_status": http_status,
            "content_type": content_type,
            "size_bytes": len(image_bytes),
            "source": "esp32-cam",
        }
        return image_bytes, metadata


def _is_probably_image_payload(content_type: str, payload: bytes) -> bool:
    normalized = content_type.lower().strip()
    if normalized.startswith("image/"):
        return True

    return (
        payload.startswith(b"\xff\xd8\xff")  # JPEG
        or payload.startswith(b"\x89PNG\r\n\x1a\n")  # PNG
        or payload.startswith(b"GIF87a")
        or payload.startswith(b"GIF89a")
        or payload.startswith(b"RIFF")  # WEBP container
    )


def capture_snapshot_safe(
    client: ESP32CamCaptureClient,
    logger: logging.Logger,
) -> dict[str, Any]:
    """Capture a snapshot and return a structured success or error payload."""
    try:
        image_bytes, metadata = client.capture_snapshot(logger=logger)
    except VisionCaptureError as exc:
        logger.error("capture_error camera_url=%s error=%s", client.camera_url, exc)
        return {
            "ok": False,
            "error": str(exc),
            "camera_url": client.camera_url,
        }

    logger.info(
        "capture_success camera_url=%s size_bytes=%s content_type=%s attempt=%s/%s",
        client.camera_url,
        metadata["size_bytes"],
        metadata["content_type"],
        metadata.get("capture_attempt"),
        metadata.get("capture_attempts_total"),
    )
    return {
        "ok": True,
        "image_bytes": image_bytes,
        "metadata": metadata,
    }
