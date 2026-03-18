"""Resolve the active lote for scheduled vision captures."""

from __future__ import annotations

import json
import logging
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

from .config.env import load_supabase_env


ACTIVE_PHASES = {
    "esterilizacao",
    "inoculacao",
    "incubacao",
    "pronto_para_frutificacao",
    "frutificacao",
    "colheita",
}
TERMINAL_PHASES = {"encerramento"}
TERMINAL_STATUSES = {"finalizado"}


@dataclass
class ActiveLoteResolution:
    lote_id: str | None
    strategy: str
    reason: str | None
    lote_codigo: str | None = None
    sala: str | None = None
    camera_id: str | None = None
    camera_name: str | None = None
    camera_location: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "lote_id": self.lote_id,
            "strategy": self.strategy,
            "reason": self.reason,
            "lote_codigo": self.lote_codigo,
            "sala": self.sala,
            "camera_id": self.camera_id,
            "camera_name": self.camera_name,
            "camera_location": self.camera_location,
        }


class ActiveLoteResolver:
    """Resolve the active lote for a capture camera using Supabase REST."""

    def __init__(self, config: dict[str, Any], logger: logging.Logger) -> None:
        self.config = config
        self.logger = logger
        self.env = load_supabase_env()
        capture_config = config.get("capture", {})
        self.camera_url = str(capture_config.get("camera_url", "")).strip()
        self.camera_name = str(capture_config.get("camera_name", "")).strip()

    def resolve(self) -> ActiveLoteResolution:
        if not self.env.has_api_access:
            return ActiveLoteResolution(
                lote_id=None,
                strategy="fallback_without_lote",
                reason="missing_supabase_api_env",
            )

        camera = self._find_camera()
        if camera is None:
            return ActiveLoteResolution(
                lote_id=None,
                strategy="fallback_without_lote",
                reason="camera_not_resolved",
            )

        camera_location = str(camera.get("localizacao") or "").strip()
        if not camera_location:
            return ActiveLoteResolution(
                lote_id=None,
                strategy="fallback_without_lote",
                reason="camera_without_location",
                camera_id=camera.get("id"),
                camera_name=camera.get("nome"),
            )

        exact_sala_lote = self._resolve_latest_lote_by_sala(camera_location)
        if exact_sala_lote is not None:
            return self._build_resolution(
                lot=exact_sala_lote,
                strategy="camera_sala_active_lote",
                reason="exact_camera_location_match",
                camera=camera,
            )

        relaxed_sala_lote = self._resolve_latest_lote_by_relaxed_sala(camera_location)
        if relaxed_sala_lote is not None:
            return self._build_resolution(
                lot=relaxed_sala_lote,
                strategy="recent_sala_active_lote",
                reason="normalized_camera_location_match",
                camera=camera,
            )

        return ActiveLoteResolution(
            lote_id=None,
            strategy="fallback_without_lote",
            reason="no_active_lote_for_camera_sala",
            camera_id=camera.get("id"),
            camera_name=camera.get("nome"),
            camera_location=camera_location,
        )

    def _find_camera(self) -> dict[str, Any] | None:
        cameras = self._fetch_rows(
            "cameras",
            {"select": "id,nome,localizacao,url_stream,status", "order": "localizacao.asc"},
        )
        if not cameras:
            return None

        normalized_capture_url = self._normalize_url(self.camera_url)
        normalized_camera_name = self._normalize_text(self.camera_name)

        exact_url_match = next(
            (
                camera
                for camera in cameras
                if normalized_capture_url
                and self._normalize_url(str(camera.get("url_stream") or "")) == normalized_capture_url
            ),
            None,
        )
        if exact_url_match is not None:
            return exact_url_match

        if normalized_camera_name:
            name_match = next(
                (
                    camera
                    for camera in cameras
                    if normalized_camera_name
                    and normalized_camera_name in self._normalize_text(str(camera.get("nome") or ""))
                ),
                None,
            )
            if name_match is not None:
                return name_match

        active_cameras = [camera for camera in cameras if str(camera.get("status") or "").strip().lower() == "ativa"]
        if len(active_cameras) == 1:
            return active_cameras[0]

        return None

    def _resolve_latest_lote_by_sala(self, sala: str) -> dict[str, Any] | None:
        lots = self._fetch_rows(
            "lotes",
            {
                "select": "id,codigo_lote,sala,status,fase_operacional,fase_atual,data_inoculacao,data_inicio,created_at",
                "sala": f"eq.{sala}",
                "order": "created_at.desc",
                "limit": "20",
            },
        )
        active_lots = [lot for lot in lots if self._is_active_lot(lot)]
        if not active_lots:
            return None
        return self._sort_lots(active_lots)[0]

    def _resolve_latest_lote_by_relaxed_sala(self, sala: str) -> dict[str, Any] | None:
        normalized_target = self._normalize_text(sala)
        if not normalized_target:
            return None

        lots = self._fetch_rows(
            "lotes",
            {
                "select": "id,codigo_lote,sala,status,fase_operacional,fase_atual,data_inoculacao,data_inicio,created_at",
                "order": "created_at.desc",
                "limit": "50",
            },
        )
        matching_lots = [
            lot
            for lot in lots
            if self._is_active_lot(lot) and self._normalized_sala_matches(normalized_target, str(lot.get("sala") or ""))
        ]
        if not matching_lots:
            return None
        return self._sort_lots(matching_lots)[0]

    def _fetch_rows(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        base_url = self.env.url.rstrip("/") + "/rest/v1/"
        query = urlencode(params)
        url = urljoin(base_url, f"{table}?{query}")
        headers = {
            "apikey": self.env.key,
            "Authorization": f"Bearer {self.env.key}",
            "Accept": "application/json",
        }
        request = Request(url, headers=headers, method="GET")
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, list):
            return []
        return [row for row in payload if isinstance(row, dict)]

    def _is_active_lot(self, lot: dict[str, Any]) -> bool:
        status = str(lot.get("status") or "").strip().lower()
        if status in TERMINAL_STATUSES:
            return False

        phase = str(lot.get("fase_operacional") or lot.get("fase_atual") or "").strip().lower()
        if phase in TERMINAL_PHASES:
            return False
        if phase and phase not in ACTIVE_PHASES:
            return False
        return True

    def _sort_lots(self, lots: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(lots, key=self._lot_sort_key, reverse=True)

    def _lot_sort_key(self, lot: dict[str, Any]) -> tuple[float, float]:
        inoculation_ts = self._parse_timestamp(lot.get("data_inoculacao"))
        start_ts = self._parse_timestamp(lot.get("data_inicio"))
        created_ts = self._parse_timestamp(lot.get("created_at"))
        return (inoculation_ts or start_ts or created_ts, created_ts)

    def _build_resolution(
        self,
        lot: dict[str, Any],
        strategy: str,
        reason: str,
        camera: dict[str, Any],
    ) -> ActiveLoteResolution:
        return ActiveLoteResolution(
            lote_id=str(lot.get("id") or "").strip() or None,
            strategy=strategy,
            reason=reason,
            lote_codigo=str(lot.get("codigo_lote") or "").strip() or None,
            sala=str(lot.get("sala") or "").strip() or None,
            camera_id=str(camera.get("id") or "").strip() or None,
            camera_name=str(camera.get("nome") or "").strip() or None,
            camera_location=str(camera.get("localizacao") or "").strip() or None,
        )

    @staticmethod
    def _normalize_text(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value or "")
        ascii_only = "".join(ch for ch in normalized if not unicodedata.combining(ch))
        return " ".join(ascii_only.lower().replace("-", " ").replace("_", " ").split())

    def _normalized_sala_matches(self, target: str, candidate: str) -> bool:
        normalized_candidate = self._normalize_text(candidate)
        if not normalized_candidate:
            return False
        return normalized_candidate == target or target in normalized_candidate or normalized_candidate in target

    @staticmethod
    def _normalize_url(value: str) -> str:
        return value.strip().rstrip("/").lower()

    @staticmethod
    def _parse_timestamp(value: Any) -> float:
        if not value:
            return 0.0
        text = str(value).strip()
        if not text:
            return 0.0
        normalized = text.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized).timestamp()
        except ValueError:
            return 0.0
