"""Supabase Storage upload client for captured images."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config.env import SupabaseEnvConfig


class SupabaseStorageUploader:
    """Uploads local images to Supabase Storage using lightweight HTTP calls."""

    def __init__(self, env_config: SupabaseEnvConfig) -> None:
        self.env_config = env_config

    def upload_image(self, image_path: Path, object_path: str, content_type: str) -> dict[str, Any]:
        upload_url = (
            f"{self.env_config.url}/storage/v1/object/"
            f"{self.env_config.storage_bucket}/{object_path}"
        )
        image_bytes = image_path.read_bytes()
        request = Request(
            upload_url,
            method="POST",
            data=image_bytes,
            headers={
                "apikey": self.env_config.key,
                "Authorization": f"Bearer {self.env_config.key}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )

        try:
            with urlopen(request, timeout=30) as response:
                payload = response.read().decode("utf-8").strip()
                parsed_payload = json.loads(payload) if payload else {}
                return {
                    "ok": True,
                    "http_status": getattr(response, "status", 200),
                    "storage_path": object_path,
                    "response": parsed_payload,
                    "error": None,
                }
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace").strip()
            return {
                "ok": False,
                "http_status": exc.code,
                "storage_path": object_path,
                "response": error_body,
                "error": f"Storage upload failed with HTTP {exc.code}",
            }
        except URLError as exc:
            return {
                "ok": False,
                "http_status": None,
                "storage_path": object_path,
                "response": None,
                "error": f"Storage upload failed: {exc.reason}",
            }
