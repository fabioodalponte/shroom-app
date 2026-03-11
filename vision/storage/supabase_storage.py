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
        file_size_bytes = len(image_bytes)
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
                payload_text = response.read().decode("utf-8", errors="replace").strip()
                parsed_payload, useful_fields = self._parse_response_text(payload_text)
                return {
                    "ok": True,
                    "http_status": getattr(response, "status", 200),
                    "storage_path": object_path,
                    "bucket": self.env_config.storage_bucket,
                    "endpoint": upload_url,
                    "content_type_sent": content_type,
                    "file_size_bytes": file_size_bytes,
                    "response": parsed_payload,
                    "response_body": payload_text,
                    "response_text": payload_text,
                    "response_json": parsed_payload,
                    "response_useful_fields": useful_fields,
                    "error": None,
                }
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace").strip()
            parsed_payload, useful_fields = self._parse_response_text(error_body)
            return {
                "ok": False,
                "http_status": exc.code,
                "storage_path": object_path,
                "bucket": self.env_config.storage_bucket,
                "endpoint": upload_url,
                "content_type_sent": content_type,
                "file_size_bytes": file_size_bytes,
                "response": parsed_payload if parsed_payload is not None else error_body,
                "response_body": error_body,
                "response_text": error_body,
                "response_json": parsed_payload,
                "response_useful_fields": useful_fields,
                "error": self._build_error_message(
                    http_status=exc.code,
                    bucket=self.env_config.storage_bucket,
                    storage_path=object_path,
                    endpoint=upload_url,
                    response_useful_fields=useful_fields,
                    fallback_text=error_body,
                ),
            }
        except URLError as exc:
            return {
                "ok": False,
                "http_status": None,
                "storage_path": object_path,
                "bucket": self.env_config.storage_bucket,
                "endpoint": upload_url,
                "content_type_sent": content_type,
                "file_size_bytes": file_size_bytes,
                "response": None,
                "response_body": None,
                "response_text": None,
                "response_json": None,
                "response_useful_fields": None,
                "error": self._build_error_message(
                    http_status=None,
                    bucket=self.env_config.storage_bucket,
                    storage_path=object_path,
                    endpoint=upload_url,
                    response_useful_fields=None,
                    fallback_text=str(exc.reason),
                ),
            }

    def _parse_response_text(self, response_text: str) -> tuple[Any, dict[str, Any] | None]:
        if not response_text:
            return None, None

        try:
            payload = json.loads(response_text)
        except json.JSONDecodeError:
            return None, None

        if isinstance(payload, dict):
            useful_fields = {
                key: payload[key]
                for key in ["code", "error", "message", "msg", "status", "statusCode"]
                if key in payload
            }
            return payload, useful_fields or payload

        return payload, None

    def _build_error_message(
        self,
        http_status: int | None,
        bucket: str,
        storage_path: str,
        endpoint: str,
        response_useful_fields: dict[str, Any] | None,
        fallback_text: str | None,
    ) -> str:
        status_label = f"HTTP {http_status}" if http_status is not None else "network error"
        response_hint = response_useful_fields or fallback_text or "no response body"
        return (
            f"Storage upload failed ({status_label}) "
            f"bucket={bucket} storage_path={storage_path} endpoint={endpoint} "
            f"details={response_hint}"
        )
