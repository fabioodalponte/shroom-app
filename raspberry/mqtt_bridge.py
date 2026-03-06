#!/usr/bin/env python3
"""
Shroom MQTT -> HTTP ingest bridge.

Consumes MQTT JSON messages, maps topics to codigo_lote, and forwards metrics
to the Supabase ingest endpoint using retry-in-memory.
"""

from __future__ import annotations

import json
import os
import queue
import random
import signal
import socket
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
import requests
from dotenv import load_dotenv


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(status: str, **kwargs: Any) -> None:
    payload = {"timestamp": utc_now(), "status": status}
    payload.update(kwargs)
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def parse_int(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        parsed = int(raw)
        return max(parsed, minimum)
    except ValueError:
        raise ValueError(f"{name} deve ser inteiro valido. Valor atual: {raw!r}")


def parse_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        normalized = value.strip().replace(",", ".")
        if not normalized:
            return None
        try:
            return float(normalized)
        except ValueError:
            return None
    return None


def get_first_number(payload: dict[str, Any], keys: list[str]) -> float | None:
    for key in keys:
        if key in payload:
            parsed = parse_number(payload.get(key))
            if parsed is not None:
                return parsed
    return None


@dataclass(frozen=True)
class Config:
    mqtt_host: str
    mqtt_port: int
    mqtt_username: str | None
    mqtt_password: str | None
    mqtt_client_id: str
    mqtt_qos: int
    mqtt_keepalive: int
    topic_map: dict[str, str]
    ingest_url: str
    ingest_key: str
    ingest_header_name: str
    supabase_auth_token: str | None
    queue_max_size: int
    retry_base_seconds: int
    retry_max_seconds: int
    request_timeout_seconds: int


class MQTTBridge:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.shutdown_event = threading.Event()
        self.message_queue: queue.Queue[dict[str, Any]] = queue.Queue(
            maxsize=config.queue_max_size
        )
        self.session = requests.Session()
        self.worker_thread = threading.Thread(
            target=self.http_worker, name="http-worker", daemon=True
        )
        self.heartbeat_thread = threading.Thread(
            target=self.heartbeat_worker, name="heartbeat-worker", daemon=True
        )
        self.mqtt_client = mqtt.Client(client_id=config.mqtt_client_id)
        self.mqtt_client.on_connect = self.on_connect
        self.mqtt_client.on_disconnect = self.on_disconnect
        self.mqtt_client.on_message = self.on_message
        self.mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)

        if config.mqtt_username:
            self.mqtt_client.username_pw_set(
                username=config.mqtt_username,
                password=config.mqtt_password or None,
            )

    def resolve_codigo_lote(self, topic: str) -> str | None:
        direct = self.config.topic_map.get(topic)
        if direct:
            return direct

        for pattern, codigo_lote in self.config.topic_map.items():
            try:
                if mqtt.topic_matches_sub(pattern, topic):
                    return codigo_lote
            except Exception:
                continue
        return None

    def is_connect_success(self, reason_code: Any) -> bool:
        try:
            return int(reason_code) == 0
        except Exception:
            text = str(reason_code).strip().lower()
            return text in {"0", "success", "success (0)"}

    def enqueue_event(self, event: dict[str, Any]) -> None:
        if self.message_queue.full():
            try:
                dropped = self.message_queue.get_nowait()
                self.message_queue.task_done()
                log_event(
                    "queue_overflow",
                    dropped_topic=dropped.get("topic"),
                    dropped_codigo_lote=dropped.get("codigo_lote"),
                    queue_size=self.message_queue.qsize(),
                )
            except queue.Empty:
                pass

        self.message_queue.put_nowait(event)

    def build_ingest_payload(
        self, topic: str, message: dict[str, Any]
    ) -> dict[str, Any] | None:
        codigo_lote = self.resolve_codigo_lote(topic)
        if not codigo_lote:
            log_event("topic_not_mapped", topic=topic)
            return None

        temperatura = get_first_number(message, ["temperatura", "temperature", "temp"])
        umidade = get_first_number(message, ["umidade", "humidity", "hum", "rh"])
        co2 = get_first_number(message, ["co2_ppm", "co2"])
        luminosidade = get_first_number(message, ["luminosidade_lux", "lux"])

        if temperatura is None and umidade is None and co2 is None and luminosidade is None:
            log_event("payload_without_metrics", topic=topic, codigo_lote=codigo_lote)
            return None

        payload: dict[str, Any] = {
            "codigo_lote": codigo_lote,
        }
        if temperatura is not None:
            payload["temperatura"] = temperatura
        if umidade is not None:
            payload["umidade"] = umidade
        if co2 is not None:
            payload["co2"] = co2
        if luminosidade is not None:
            payload["luminosidade_lux"] = luminosidade

        timestamp = message.get("timestamp")
        if timestamp is not None and str(timestamp).strip():
            payload["timestamp"] = timestamp

        return payload

    def on_connect(self, client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _properties: Any = None) -> None:
        log_event("mqtt_connected", reason_code=str(reason_code))
        if not self.is_connect_success(reason_code):
            log_event("mqtt_connect_failed", reason_code=str(reason_code))
            return
        for topic in self.config.topic_map.keys():
            client.subscribe(topic, qos=self.config.mqtt_qos)
            log_event("mqtt_subscribed", topic=topic, qos=self.config.mqtt_qos)

    def on_disconnect(self, _client: mqtt.Client, _userdata: Any, reason_code: Any, _properties: Any = None) -> None:
        if self.shutdown_event.is_set():
            return
        log_event("mqtt_disconnected", reason_code=str(reason_code))

    def on_message(self, _client: mqtt.Client, _userdata: Any, msg: mqtt.MQTTMessage) -> None:
        topic = msg.topic
        try:
            payload_text = msg.payload.decode("utf-8")
        except UnicodeDecodeError:
            log_event("invalid_utf8_payload", topic=topic)
            return

        try:
            parsed = json.loads(payload_text)
        except json.JSONDecodeError:
            log_event("invalid_json_payload", topic=topic, payload=payload_text[:200])
            return

        if not isinstance(parsed, dict):
            log_event("invalid_json_object", topic=topic)
            return

        ingest_payload = self.build_ingest_payload(topic, parsed)
        if not ingest_payload:
            return

        event = {
            "topic": topic,
            "codigo_lote": ingest_payload["codigo_lote"],
            "payload": ingest_payload,
            "attempt": 1,
            "received_at": utc_now(),
        }
        self.enqueue_event(event)
        log_event(
            "event_enqueued",
            topic=topic,
            codigo_lote=ingest_payload["codigo_lote"],
            queue_size=self.message_queue.qsize(),
        )

    def is_permanent_http_error(self, status_code: int) -> bool:
        return status_code in {400, 401, 403, 404}

    def calculate_retry_delay(self, attempt: int) -> float:
        delay = min(
            self.config.retry_max_seconds,
            self.config.retry_base_seconds * (2 ** max(attempt - 1, 0)),
        )
        jitter = random.uniform(0, delay * 0.2)
        return delay + jitter

    def send_to_ingest(self, event: dict[str, Any]) -> tuple[bool, bool, int | None, str]:
        headers = {
            "Content-Type": "application/json",
            self.config.ingest_header_name: self.config.ingest_key,
        }
        if self.config.supabase_auth_token:
            headers["Authorization"] = f"Bearer {self.config.supabase_auth_token}"
            headers["apikey"] = self.config.supabase_auth_token
        try:
            response = self.session.post(
                self.config.ingest_url,
                json=event["payload"],
                headers=headers,
                timeout=self.config.request_timeout_seconds,
            )
        except requests.RequestException as exc:
            return False, False, None, str(exc)

        if 200 <= response.status_code < 300:
            return True, False, response.status_code, response.text[:300]

        permanent = self.is_permanent_http_error(response.status_code)
        return False, permanent, response.status_code, response.text[:300]

    def http_worker(self) -> None:
        while not self.shutdown_event.is_set() or not self.message_queue.empty():
            try:
                event = self.message_queue.get(timeout=1)
            except queue.Empty:
                continue

            attempt = int(event.get("attempt", 1))
            success, permanent, status_code, response_excerpt = self.send_to_ingest(event)

            if success:
                log_event(
                    "ingest_success",
                    topic=event.get("topic"),
                    codigo_lote=event.get("codigo_lote"),
                    attempt=attempt,
                    http_status=status_code,
                    queue_size=self.message_queue.qsize(),
                )
                self.message_queue.task_done()
                continue

            if permanent:
                log_event(
                    "ingest_drop_permanent",
                    topic=event.get("topic"),
                    codigo_lote=event.get("codigo_lote"),
                    attempt=attempt,
                    http_status=status_code,
                    response=response_excerpt,
                )
                self.message_queue.task_done()
                continue

            next_attempt = attempt + 1
            delay = self.calculate_retry_delay(attempt)
            log_event(
                "ingest_retry_scheduled",
                topic=event.get("topic"),
                codigo_lote=event.get("codigo_lote"),
                attempt=attempt,
                next_attempt=next_attempt,
                http_status=status_code,
                retry_in_seconds=round(delay, 2),
                response=response_excerpt,
            )
            self.message_queue.task_done()

            if self.shutdown_event.wait(delay):
                break

            retry_event = dict(event)
            retry_event["attempt"] = next_attempt
            retry_event["last_error_status"] = status_code
            self.enqueue_event(retry_event)

    def heartbeat_worker(self) -> None:
        while not self.shutdown_event.wait(60):
            log_event("heartbeat", queue_size=self.message_queue.qsize())

    def start(self) -> None:
        self.worker_thread.start()
        self.heartbeat_thread.start()
        self.mqtt_client.loop_start()
        self.mqtt_client.connect_async(
            self.config.mqtt_host,
            self.config.mqtt_port,
            self.config.mqtt_keepalive,
        )
        log_event(
            "bridge_started",
            mqtt_host=self.config.mqtt_host,
            mqtt_port=self.config.mqtt_port,
            ingest_url=self.config.ingest_url,
            topics=len(self.config.topic_map),
            auth_header_enabled=bool(self.config.supabase_auth_token),
        )

    def stop(self) -> None:
        if self.shutdown_event.is_set():
            return
        self.shutdown_event.set()
        log_event("bridge_stopping")
        try:
            self.mqtt_client.disconnect()
        except Exception:
            pass
        self.mqtt_client.loop_stop()
        self.worker_thread.join(timeout=10)
        self.heartbeat_thread.join(timeout=2)
        self.session.close()
        log_event("bridge_stopped")


def load_config() -> Config:
    base_dir = Path(__file__).resolve().parent
    env_path = base_dir / ".env"
    load_dotenv(env_path)

    mqtt_host = os.getenv("MQTT_HOST", "").strip()
    if not mqtt_host:
        raise ValueError("MQTT_HOST e obrigatorio")

    topic_map_raw = os.getenv("MQTT_TOPIC_MAP_JSON", "").strip()
    if not topic_map_raw:
        raise ValueError("MQTT_TOPIC_MAP_JSON e obrigatorio")

    try:
        topic_map_loaded = json.loads(topic_map_raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"MQTT_TOPIC_MAP_JSON invalido: {exc}") from exc

    if not isinstance(topic_map_loaded, dict) or not topic_map_loaded:
        raise ValueError("MQTT_TOPIC_MAP_JSON deve ser objeto JSON nao vazio")

    topic_map: dict[str, str] = {}
    for topic, codigo_lote in topic_map_loaded.items():
        topic_key = str(topic).strip()
        lote_value = str(codigo_lote).strip()
        if not topic_key or not lote_value:
            raise ValueError("Topicos e codigos de lote nao podem ser vazios no MQTT_TOPIC_MAP_JSON")
        topic_map[topic_key] = lote_value

    ingest_key = os.getenv("SENSORES_INGEST_KEY", "").strip()
    if not ingest_key:
        raise ValueError("SENSORES_INGEST_KEY e obrigatorio")

    mqtt_client_id = os.getenv("MQTT_CLIENT_ID", "").strip()
    if not mqtt_client_id:
        mqtt_client_id = f"shroom-bridge-{socket.gethostname()}"

    ingest_url = os.getenv(
        "INGEST_URL",
        "https://zgxxbguoijamtbydcxrm.supabase.co/functions/v1/make-server-5522cecf/sensores/ingest",
    ).strip()
    if not ingest_url:
        raise ValueError("INGEST_URL nao pode ser vazio")

    supabase_auth_token = (
        os.getenv("SUPABASE_AUTH_TOKEN", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
        or None
    )

    return Config(
        mqtt_host=mqtt_host,
        mqtt_port=parse_int("MQTT_PORT", 1883),
        mqtt_username=os.getenv("MQTT_USERNAME", "").strip() or None,
        mqtt_password=os.getenv("MQTT_PASSWORD", "").strip() or None,
        mqtt_client_id=mqtt_client_id,
        mqtt_qos=parse_int("MQTT_QOS", 1, minimum=0),
        mqtt_keepalive=parse_int("MQTT_KEEPALIVE", 60),
        topic_map=topic_map,
        ingest_url=ingest_url,
        ingest_key=ingest_key,
        ingest_header_name=os.getenv("INGEST_HEADER_NAME", "x-sensores-key").strip() or "x-sensores-key",
        supabase_auth_token=supabase_auth_token,
        queue_max_size=parse_int("QUEUE_MAX_SIZE", 500),
        retry_base_seconds=parse_int("RETRY_BASE_SECONDS", 2),
        retry_max_seconds=parse_int("RETRY_MAX_SECONDS", 60),
        request_timeout_seconds=parse_int("REQUEST_TIMEOUT_SECONDS", 10),
    )


def main() -> int:
    try:
        config = load_config()
    except Exception as exc:
        log_event("config_error", error=str(exc))
        return 1

    bridge = MQTTBridge(config)

    def _handle_signal(_signum: int, _frame: Any) -> None:
        bridge.stop()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    bridge.start()

    try:
        while not bridge.shutdown_event.is_set():
            time.sleep(1)
    except KeyboardInterrupt:
        bridge.stop()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
