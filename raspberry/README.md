# MQTT Bridge (Raspberry Pi)

Bridge para consumir mensagens MQTT com sensores e enviar para:

`POST /make-server-5522cecf/sensores/ingest`

## O que este pacote faz

1. Conecta no broker MQTT.
2. Assina topicos definidos em `MQTT_TOPIC_MAP_JSON`.
3. Converte payload JSON para o formato da API.
4. Envia leitura com header `x-sensores-key`.
5. Aplica retry em memoria para falhas transientes.
6. Roda como `systemd` com restart automatico.

## Estrutura

1. `mqtt_bridge.py` - processo principal.
2. `.env.example` - template de configuracao.
3. `requirements.txt` - dependencias Python.
4. `systemd/shroom-mqtt-bridge.service` - template de unit file.
5. `scripts/install_service.sh` - instala venv + service.
6. `scripts/check_bridge.sh` - checks rapidos de operacao.
7. `esp32/` - firmware versionado para ESP32 (sensores, camera e controlador de rele).

## Pre-requisitos no Raspberry

1. Raspberry Pi OS com `systemd`.
2. Python 3.9+.
3. `sudo` configurado.
4. Broker MQTT acessivel.

## Instalar

No Raspberry, dentro da pasta `raspberry/`:

```bash
cp .env.example .env
chmod 600 .env
```

Edite `.env` com seus dados reais.

Depois rode:

```bash
./scripts/install_service.sh
```

## Configuracao (.env)

### Obrigatorios

1. `MQTT_HOST`
2. `MQTT_TOPIC_MAP_JSON`
3. `SENSORES_INGEST_KEY`
4. `SUPABASE_ANON_KEY` (ou `SUPABASE_AUTH_TOKEN`) quando o Supabase exigir `Authorization`

### Exemplo de mapeamento topico -> lote

```env
MQTT_TOPIC_MAP_JSON={"tele/chacara/sala1/json":"LOT-2024-001","tele/chacara/sala2/json":"LOT-2024-002"}
```

### Formato MQTT esperado (JSON)

Pelo menos uma metrica valida:

1. `temperatura` (ou `temperature`, `temp`)
2. `umidade` (ou `humidity`, `hum`, `rh`)
3. `co2` (ou `co2_ppm`)
4. `luminosidade_lux` (ou `lux`, opcional)
5. `timestamp` (opcional)

Exemplo:

```json
{
  "temperatura": 22.4,
  "umidade": 87.1,
  "co2": 910,
  "timestamp": "2026-03-04T15:00:00Z"
}
```

## Operacao

Ver status:

```bash
sudo systemctl status shroom-mqtt-bridge.service
```

Ver logs em tempo real:

```bash
sudo journalctl -u shroom-mqtt-bridge.service -f
```

Reiniciar:

```bash
sudo systemctl restart shroom-mqtt-bridge.service
```

Check rapido:

```bash
./scripts/check_bridge.sh
```

## Teste de ponta a ponta

1. Publique uma mensagem MQTT valida no topico mapeado.
2. Verifique log `ingest_success` no journal.
3. Abra a tela `Seguranca` no app.
4. Confirme leitura nova em ate 30 segundos.

## Troubleshooting

### Erro `config_error`

1. Confirme variaveis obrigatorias no `.env`.
2. Valide JSON de `MQTT_TOPIC_MAP_JSON`.

### `topic_not_mapped`

1. O topico recebido nao bate com seu mapeamento.
2. Ajuste o topico exato ou wildcard no JSON.

### `ingest_drop_permanent` com HTTP 401

1. Se a mensagem for `Missing authorization header`, configure `SUPABASE_ANON_KEY` (ou `SUPABASE_AUTH_TOKEN`) no `.env`.
2. Se a mensagem for `Webhook não autorizado`, confira `SENSORES_INGEST_KEY`.

### `ingest_retry_scheduled` repetindo

1. Falha de rede ou endpoint indisponivel.
2. Verifique conectividade para `INGEST_URL`.

### Fila enchendo (`queue_overflow`)

1. Endpoint lento ou indisponivel.
2. Ajuste `QUEUE_MAX_SIZE`.
3. Reduza taxa de publicacao no MQTT, se necessario.
