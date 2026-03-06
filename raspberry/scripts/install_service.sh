#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="shroom-mqtt-bridge.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_PATH="${BASE_DIR}/systemd/${SERVICE_NAME}"
TMP_SERVICE_PATH="/tmp/${SERVICE_NAME}"
SYSTEMD_PATH="/etc/systemd/system/${SERVICE_NAME}"
VENV_PATH="${BASE_DIR}/.venv"
PYTHON_BIN="${VENV_PATH}/bin/python"
RUN_USER="${BRIDGE_RUN_USER:-$(id -un)}"
ENV_FILE="${BASE_DIR}/.env"
BRIDGE_SCRIPT="${BASE_DIR}/mqtt_bridge.py"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 nao encontrado. Instale antes de continuar."
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl nao encontrado. Este script exige systemd."
  exit 1
fi

echo "[1/6] Criando venv em ${VENV_PATH}"
python3 -m venv "${VENV_PATH}"

echo "[2/6] Instalando dependencias Python"
"${PYTHON_BIN}" -m pip install --upgrade pip
"${PYTHON_BIN}" -m pip install -r "${BASE_DIR}/requirements.txt"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[3/6] Criando .env a partir de .env.example"
  cp "${BASE_DIR}/.env.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "Arquivo ${ENV_FILE} criado. Edite os valores antes de iniciar em producao."
else
  echo "[3/6] .env ja existe em ${ENV_FILE}"
fi

escape() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

echo "[4/6] Gerando unit file do systemd"
sed \
  -e "s/__RUN_USER__/$(escape "${RUN_USER}")/g" \
  -e "s/__WORKDIR__/$(escape "${BASE_DIR}")/g" \
  -e "s/__ENV_FILE__/$(escape "${ENV_FILE}")/g" \
  -e "s/__PYTHON_BIN__/$(escape "${PYTHON_BIN}")/g" \
  -e "s/__SCRIPT_PATH__/$(escape "${BRIDGE_SCRIPT}")/g" \
  "${TEMPLATE_PATH}" > "${TMP_SERVICE_PATH}"

echo "[5/6] Instalando service em ${SYSTEMD_PATH}"
sudo install -m 644 "${TMP_SERVICE_PATH}" "${SYSTEMD_PATH}"
rm -f "${TMP_SERVICE_PATH}"

echo "[6/6] Recarregando systemd e iniciando service"
sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVICE_NAME}"

echo ""
echo "Instalacao concluida."
echo "Comandos uteis:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo "  sudo systemctl restart ${SERVICE_NAME}"
