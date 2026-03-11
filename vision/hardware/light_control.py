"""Local HTTP relay adapter for room lighting control."""

from __future__ import annotations

import json
import logging
import os
import socket
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class LightControlError(Exception):
    """Raised when the relay-backed light control fails."""


@dataclass
class LightingConfig:
    enabled: bool
    provider: str
    base_url: str
    relay_channel: int
    request_timeout_seconds: float
    request_retries: int
    retry_backoff_seconds: float
    verify_state: bool
    verify_state_strict: bool


DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "shroom-vision/0.1",
}


def _normalize_base_url(value: str) -> str:
    return value.strip().rstrip("/")


def _load_lighting_config(config: dict[str, Any] | None) -> LightingConfig:
    lighting_config = (config or {}).get("lighting", {})
    return LightingConfig(
        enabled=bool(lighting_config.get("enabled", True)),
        provider=str(lighting_config.get("provider", "relay_http") or "relay_http"),
        base_url=_normalize_base_url(str(lighting_config.get("base_url", "") or "")),
        relay_channel=max(1, int(lighting_config.get("relay_channel", 2))),
        request_timeout_seconds=max(0.1, float(lighting_config.get("request_timeout_seconds", 5))),
        request_retries=max(1, int(lighting_config.get("request_retries", 2))),
        retry_backoff_seconds=max(0.0, float(lighting_config.get("retry_backoff_seconds", 0.5))),
        verify_state=bool(lighting_config.get("verify_state", True)),
        verify_state_strict=bool(lighting_config.get("verify_state_strict", False)),
    )


def _build_headers() -> dict[str, str]:
    token = os.getenv("VISION_RELAY_API_TOKEN", "").strip()
    if not token:
        raise LightControlError("VISION_RELAY_API_TOKEN is required for local relay control")

    return {
        **DEFAULT_HEADERS,
        "X-API-Token": token,
    }


def _request_json(
    method: str,
    url: str,
    headers: dict[str, str],
    timeout_seconds: float,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    request = Request(url, method=method, data=data, headers=headers)

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8", errors="replace").strip()
            payload = json.loads(raw) if raw else {}
            return {
                "ok": True,
                "http_status": getattr(response, "status", 200),
                "payload": payload,
                "raw": raw,
            }
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace").strip()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw} if raw else {}
        return {
            "ok": False,
            "http_status": exc.code,
            "payload": payload,
            "raw": raw,
            "error": payload.get("error") or payload.get("message") or raw or f"HTTP {exc.code}",
        }
    except URLError as exc:
        raise LightControlError(f"relay request failed for {url}: {exc.reason}") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise LightControlError(f"relay request timed out after {timeout_seconds}s for {url}") from exc
    except OSError as exc:
        raise LightControlError(f"relay request failed for {url}: {exc}") from exc


def _extract_relay_state(payload: dict[str, Any], relay_channel: int) -> bool | None:
    relays = payload.get("relays")
    if not isinstance(relays, dict):
        return None

    relay_key = f"relay{relay_channel}"
    relay_info = relays.get(relay_key)
    if not isinstance(relay_info, dict):
        return None

    state = relay_info.get("state")
    return state if isinstance(state, bool) else None


def _verify_relay_state(
    lighting: LightingConfig,
    target_state: bool,
    headers: dict[str, str],
    logger: logging.Logger,
) -> tuple[bool, str | None]:
    if not lighting.verify_state:
        return True, None

    status_url = f"{lighting.base_url}/status"
    logger.info(
        "vision light_status_check_start base_url=%s relay_channel=%s expected_state=%s",
        lighting.base_url,
        lighting.relay_channel,
        target_state,
    )

    try:
        response = _request_json(
            method="GET",
            url=status_url,
            headers=headers,
            timeout_seconds=lighting.request_timeout_seconds,
            body=None,
        )
    except LightControlError as exc:
        return False, str(exc)

    if not response.get("ok"):
        return False, str(response.get("error") or f"HTTP {response.get('http_status')}")

    relay_state = _extract_relay_state(response.get("payload") or {}, lighting.relay_channel)
    if relay_state is None:
        return False, f"relay state not found in /status payload for relay{lighting.relay_channel}"

    if relay_state != target_state:
        return False, f"relay{lighting.relay_channel} state mismatch: expected {target_state}, got {relay_state}"

    logger.info(
        "vision light_status_check_success relay_channel=%s confirmed_state=%s",
        lighting.relay_channel,
        relay_state,
    )
    return True, None


def _set_light_state(
    target_state: bool,
    config: dict[str, Any] | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    active_logger = logger or logging.getLogger("vision")
    lighting = _load_lighting_config(config)
    state_label = "on" if target_state else "off"

    if not lighting.enabled:
        active_logger.info("vision light_%s_skipped reason=disabled_by_config", state_label)
        return {
            "ok": True,
            "skipped": True,
            "state": target_state,
            "relay_channel": lighting.relay_channel,
        }

    if lighting.provider != "relay_http":
        raise LightControlError(f"unsupported lighting.provider: {lighting.provider}")

    if not lighting.base_url:
        raise LightControlError("lighting.base_url is required for relay_http provider")

    headers = _build_headers()
    endpoint = f"{lighting.base_url}/relay"
    payload = {
        "relay": lighting.relay_channel,
        "state": target_state,
    }

    active_logger.info(
        "vision light_%s_start base_url=%s relay_channel=%s timeout_seconds=%s retries=%s",
        state_label,
        lighting.base_url,
        lighting.relay_channel,
        lighting.request_timeout_seconds,
        lighting.request_retries,
    )

    attempt_errors: list[str] = []
    for attempt in range(1, lighting.request_retries + 1):
        try:
            response = _request_json(
                method="POST",
                url=endpoint,
                headers=headers,
                timeout_seconds=lighting.request_timeout_seconds,
                body=payload,
            )
            if not response.get("ok"):
                raise LightControlError(
                    f"HTTP {response.get('http_status')} calling {endpoint}: {response.get('error')}"
                )

            verified = False
            verify_error = None
            if lighting.verify_state:
                verified, verify_error = _verify_relay_state(lighting, target_state, headers, active_logger)
                if not verified and lighting.verify_state_strict:
                    raise LightControlError(f"state verification failed after light_{state_label}: {verify_error}")
                if not verified:
                    active_logger.warning(
                        "vision light_%s_verify_warn relay_channel=%s error=%s",
                        state_label,
                        lighting.relay_channel,
                        verify_error,
                    )

            active_logger.info(
                "vision light_%s_success base_url=%s relay_channel=%s attempt=%s/%s verified=%s",
                state_label,
                lighting.base_url,
                lighting.relay_channel,
                attempt,
                lighting.request_retries,
                verified,
            )
            return {
                "ok": True,
                "skipped": False,
                "state": target_state,
                "relay_channel": lighting.relay_channel,
                "attempt": attempt,
                "attempts_total": lighting.request_retries,
                "verified": verified,
                "verify_error": verify_error,
                "response": response.get("payload"),
            }
        except LightControlError as exc:
            attempt_errors.append(f"attempt {attempt}/{lighting.request_retries}: {exc}")
            active_logger.error(
                "vision light_%s_failed base_url=%s relay_channel=%s attempt=%s/%s error=%s",
                state_label,
                lighting.base_url,
                lighting.relay_channel,
                attempt,
                lighting.request_retries,
                exc,
            )
            if attempt >= lighting.request_retries:
                break

            backoff_seconds = lighting.retry_backoff_seconds * attempt
            if backoff_seconds > 0:
                time.sleep(backoff_seconds)

    raise LightControlError(
        f"light_{state_label} failed after {lighting.request_retries} attempts for relay{lighting.relay_channel} at {lighting.base_url}: "
        + " | ".join(attempt_errors)
    )


def turn_light_on(config: dict[str, Any] | None = None, logger: logging.Logger | None = None) -> dict[str, Any]:
    """Turn the room light on using the local relay controller."""
    return _set_light_state(True, config=config, logger=logger)


def turn_light_off(config: dict[str, Any] | None = None, logger: logging.Logger | None = None) -> dict[str, Any]:
    """Turn the room light off using the local relay controller."""
    return _set_light_state(False, config=config, logger=logger)
