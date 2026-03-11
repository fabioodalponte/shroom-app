"""Supabase PostgREST client for pipeline result records."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config.env import SupabaseEnvConfig


class SupabaseResultRepository:
    """Inserts structured pipeline results into a Supabase table."""

    def __init__(self, env_config: SupabaseEnvConfig, table_name: str) -> None:
        self.env_config = env_config
        self.table_name = table_name

    def insert_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = Request(
            f"{self.env_config.url}/rest/v1/{self.table_name}",
            method="POST",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "apikey": self.env_config.key,
                "Authorization": f"Bearer {self.env_config.key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )

        try:
            with urlopen(request, timeout=30) as response:
                body = response.read().decode("utf-8").strip()
                parsed_body = json.loads(body) if body else []
                record_id = None
                if isinstance(parsed_body, list) and parsed_body:
                    record_id = parsed_body[0].get("id")

                return {
                    "ok": True,
                    "http_status": getattr(response, "status", 201),
                    "record_id": record_id,
                    "response": parsed_body,
                    "error": None,
                }
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace").strip()
            return {
                "ok": False,
                "http_status": exc.code,
                "record_id": None,
                "response": error_body,
                "error": f"DB insert failed with HTTP {exc.code}",
            }
        except URLError as exc:
            return {
                "ok": False,
                "http_status": None,
                "record_id": None,
                "response": None,
                "error": f"DB insert failed: {exc.reason}",
            }
