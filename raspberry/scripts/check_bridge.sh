#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="shroom-mqtt-bridge.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BASE_DIR}/.env"

echo "== Status do service =="
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  echo "OK: ${SERVICE_NAME} ativo"
else
  echo "ERRO: ${SERVICE_NAME} inativo"
fi

echo ""
echo "== Habilitacao no boot =="
if systemctl is-enabled --quiet "${SERVICE_NAME}"; then
  echo "OK: ${SERVICE_NAME} habilitado no boot"
else
  echo "AVISO: ${SERVICE_NAME} nao habilitado no boot"
fi

echo ""
echo "== Ultimos logs =="
journalctl -u "${SERVICE_NAME}" -n 20 --no-pager || true

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"

  echo ""
  echo "== Conectividade MQTT =="
  MQTT_HOST="${MQTT_HOST:-}"
  MQTT_PORT="${MQTT_PORT:-1883}"
  if [[ -n "${MQTT_HOST}" ]]; then
    if command -v nc >/dev/null 2>&1; then
      if nc -z -w 3 "${MQTT_HOST}" "${MQTT_PORT}" >/dev/null 2>&1; then
        echo "OK: MQTT ${MQTT_HOST}:${MQTT_PORT} acessivel"
      else
        echo "ERRO: nao foi possivel conectar em ${MQTT_HOST}:${MQTT_PORT}"
      fi
    else
      echo "AVISO: comando nc nao encontrado; pulando teste de porta MQTT"
    fi
  else
    echo "AVISO: MQTT_HOST vazio no .env"
  fi

  echo ""
  echo "== Conectividade endpoint ingest =="
  INGEST_URL="${INGEST_URL:-}"
  SUPABASE_AUTH_TOKEN="${SUPABASE_AUTH_TOKEN:-${SUPABASE_ANON_KEY:-}}"
  SENSORES_INGEST_KEY="${SENSORES_INGEST_KEY:-}"
  INGEST_HEADER_NAME="${INGEST_HEADER_NAME:-x-sensores-key}"
  if [[ -n "${INGEST_URL}" ]]; then
    CURL_ARGS=(-sS -o /dev/null -w "%{http_code}" -X POST "${INGEST_URL}" -H "Content-Type: application/json" -d '{"ping":true}')
    if [[ -n "${SUPABASE_AUTH_TOKEN}" ]]; then
      CURL_ARGS+=(-H "Authorization: Bearer ${SUPABASE_AUTH_TOKEN}" -H "apikey: ${SUPABASE_AUTH_TOKEN}")
    fi
    if [[ -n "${SENSORES_INGEST_KEY}" ]]; then
      CURL_ARGS+=(-H "${INGEST_HEADER_NAME}: ${SENSORES_INGEST_KEY}")
    fi

    HTTP_CODE="$(curl "${CURL_ARGS[@]}" || true)"
    if [[ "${HTTP_CODE}" == "401" || "${HTTP_CODE}" == "400" || "${HTTP_CODE}" == "201" || "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "422" ]]; then
      echo "OK: endpoint acessivel (HTTP ${HTTP_CODE})"
    else
      echo "AVISO: endpoint respondeu HTTP ${HTTP_CODE}"
    fi
  else
    echo "AVISO: INGEST_URL vazio no .env"
  fi
else
  echo ""
  echo "AVISO: ${ENV_FILE} nao encontrado; pulando checks de rede."
fi
