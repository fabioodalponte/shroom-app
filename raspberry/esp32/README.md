# ESP32 Firmware (Sala 1)

Arquivo versionado:

1. `sala1_mqtt_bridge.ino`
2. `esp32_cam_capture.ino`
3. `esp32_relay_controller.ino`
4. `vision_cam_s3/vision_cam_s3.ino`

## Objetivo

1. Ler SHT45 + SCD41.
2. Publicar no MQTT local (Raspberry) em:
   - `tele/chacara/sala1/temp`
   - `tele/chacara/sala1/rh`
   - `tele/chacara/sala1/co2`
   - `tele/chacara/sala1/json`
3. (Opcional) enviar HTTP direto para Supabase.

## ESP32-CAM (video snapshot)

Arquivo: `esp32_cam_capture.ino`

Esse firmware expoe:

1. `GET /capture` - snapshot JPEG (endpoint principal para app/tunnel)
2. `GET /capture?flash=1` - snapshot com LED flash ligado durante a captura
3. `GET /flash/on?seconds=3` - liga a luz por alguns segundos (default 3s, max 10s)
4. `GET /flash/off` - desliga a luz imediatamente
5. `GET /flash/status` - status da luz e tempo restante
6. `GET /camera/config` - retorna configuracao atual de imagem
7. `GET /camera/set?...` - aplica ajustes de imagem
8. `GET /health` - status basico em JSON
9. `GET /` - pagina simples com preview

Seguranca do flash:

1. O flash so liga quando `flash=1` e desliga ao final da captura.
2. Existe fail-safe no firmware que forca `OFF` automaticamente se ficar ligado por mais de ~10s.
3. O endpoint `/flash/on` tambem agenda auto-off (padrao 3s), reduzindo risco de ficar ligado por engano.
4. Capturas normais (`/capture`) nao desligam o flash quando ele foi ligado manualmente por `/flash/on`.

Ajustes aceitos em `/camera/set`:

1. `framesize`: `QQVGA|QVGA|CIF|VGA|SVGA|XGA`
2. `quality`: `10..63`
3. `brightness`: `-2..2`
4. `contrast`: `-2..2`
5. `saturation`: `-2..2`
6. `hmirror`: `0|1`
7. `vflip`: `0|1`
8. `exposure_ctrl`: `0|1`

### Antes de gravar

Edite no `esp32_cam_capture.ino`:

1. `WIFI_SSID`
2. `WIFI_PASS`

### Configuracao da IDE (ESP32-CAM AI Thinker)

1. Placa: `AI Thinker ESP32-CAM`
2. Flash Frequency: `40MHz`
3. Partition Scheme: `Huge APP (3MB No OTA/1MB SPIFFS)` (ou equivalente)
4. Upload Speed: `115200` (ou `921600` se estiver estavel)

### Teste local no Raspberry

Substitua `IP_DA_CAMERA`:

```bash
curl -I http://IP_DA_CAMERA/capture
curl -s http://IP_DA_CAMERA/health
```

Se o `/capture` responder `200`, voce pode apontar o cloudflared para `http://IP_DA_CAMERA`.

## ESP32-CAM S3 (Vision padronizado)

Pasta: `vision_cam_s3/`

Esse firmware novo foi separado do legado para nao quebrar a camera atual.

Objetivo:

1. usar `GET /capture` com o pipeline Vision atual
2. expor `GET /status` com diagnostico operacional
3. manter reconnect de Wi-Fi e watchdog
4. permitir uma camera para `Colonizacao` e outra para `Frutificacao`

Arquivos principais:

1. `vision_cam_s3/vision_cam_s3.ino`
2. `vision_cam_s3/camera_board_pins.h`
3. `vision_cam_s3/device_config_colonizacao.example.h`
4. `vision_cam_s3/device_config_frutificacao.example.h`

Guia completo:

1. `vision_cam_s3/README.md`

## ESP32 Relay Controller (HW-316 / Sala 1)

Arquivo: `esp32_relay_controller.ino`

Esse firmware expoe:

1. `GET /status` - estado atual dos 4 canais
2. `GET /health` - alias de status para checks rapidos
3. `POST /relay` - altera um canal especifico
4. `POST /relays` - altera varios canais de uma vez
5. `POST /mode` - alterna `manual` ou `remote`
6. `GET /` - pagina local simples para teste manual

Payloads:

```json
POST /relay
{
  "relay": 4,
  "state": true
}
```

```json
POST /relays
{
  "relay1": false,
  "relay2": true,
  "relay3": false,
  "relay4": true
}
```

```json
POST /mode
{
  "mode": "remote"
}
```

### Antes de gravar

Edite no `esp32_relay_controller.ino`:

1. `WIFI_SSID`
2. `WIFI_PASSWORD`
3. `API_TOKEN`
4. `DEVICE_ID`
5. `DEVICE_NAME`
6. `RELAY_ACTIVE_LOW`

### Pinos usados no firmware

1. `GPIO12` - ventilador
2. `GPIO13` - luz
3. `GPIO14` - aquecedor
4. `GPIO15` - umidificador

Se seu modulo HW-316 tiver logica invertida, ajuste:

```cpp
const bool RELAY_ACTIVE_LOW = true;
```

para `false`.

### Teste local do rele

No Raspberry:

```bash
curl http://10.0.0.148/status
curl http://10.0.0.148/health
curl -X POST http://10.0.0.148/relay \
  -H 'Content-Type: application/json' \
  -H 'X-API-Token: shroombros-token-123' \
  -d '{"relay":4,"state":true}'
```

### Tunnel Cloudflare para o rele

No Raspberry, no mesmo `config.yml` do `cloudflared`:

```yaml
ingress:
  - hostname: cam.cogumelos.net
    service: http://10.0.0.177
  - hostname: relay-sala1.cogumelos.net
    service: http://10.0.0.148
  - service: http_status:404
```

Depois:

```bash
sudo systemctl restart cloudflared
curl https://relay-sala1.cogumelos.net/status
```

### Registro no Supabase

Depois da migration `controladores_sala`, insira um registro:

```sql
insert into public.controladores_sala (
  nome,
  localizacao,
  tipo,
  base_url,
  device_id,
  api_token,
  status,
  modo_padrao,
  relay_map,
  observacoes
) values (
  'Controle Sala 1',
  'Sala de Cultivo 1',
  'Sala de Cultivo',
  'https://relay-sala1.cogumelos.net',
  'relay-controller-01',
  'shroombros-token-123',
  'Ativo',
  'remote',
  '{"relay1":"ventilador","relay2":"luz","relay3":"aquecedor","relay4":"umidificador"}'::jsonb,
  'Controlador principal da Sala 1'
);
```

### Arquitetura usada pelo app

1. O frontend chama apenas a Supabase Function.
2. A Function injeta `X-API-Token` e faz proxy para o rele.
3. O browser nunca fala direto com `10.0.0.148`.
4. Isso evita expor segredo, evita CORS/mixed content e funciona igual em localhost e producao.

## Firmware de sensores (SHT45 + SCD41)

Arquivo: `sala1_mqtt_bridge.ino`

### Ajustes obrigatorios

1. `WIFI_SSID`
2. `WIFI_PASS`
3. `MQTT_HOST`
4. `SHROOMOS_SENSOR_ID`
5. `SHROOMOS_SALA_ID`
6. `INGEST_URL`
7. `INGEST_HEADER_NAME`
8. `SENSORES_INGEST_KEY` (se for usar fallback HTTP)

## Recomendacao operacional

Com o bridge MQTT->API ativo no Raspberry:

1. Manter `ENABLE_HTTP_FALLBACK 0` para evitar duplicacao e inconsistencias.
2. Mapear no bridge o topico JSON:
   - `tele/chacara/sala1/json -> LOT-2024-001`

## Compatibilidade com o bridge

O bridge aceita `temp`, `rh`, `co2` e faz normalizacao para o payload da API.

## Contrato oficial de ingestao do ShroomOS

O formato oficial novo usa:

1. Header:
   - `x-sensores-key: SUA_SENSORES_INGEST_KEY`
2. Payload JSON:
   - `sensor_id`
   - `sala_id`
   - metricas (`temperatura`, `umidade`, `co2`)

### Payload final esperado - Sala 1

```json
{
  "sensor_id": "sensor_sala_1_a",
  "sala_id": "sala_1",
  "temperatura": 25.4,
  "umidade": 84.1,
  "co2": 520,
  "timestamp": "2026-03-23T19:00:00Z"
}
```

### Payload final esperado - Sala 2

```json
{
  "sensor_id": "sensor_sala_2_a",
  "sala_id": "sala_de_cultivo_2",
  "temperatura": 24.8,
  "umidade": 87.2,
  "co2": 640,
  "timestamp": "2026-03-23T19:00:00Z"
}
```

### Exemplo HTTP no formato do ESP32

O firmware agora envia assim no fallback HTTP:

```http
POST /functions/v1/make-server-5522cecf/sensores/ingest
Content-Type: application/json
x-sensores-key: SUA_SENSORES_INGEST_KEY
```

Body:

```json
{
  "sensor_id": "sensor_sala_2_a",
  "sala_id": "sala_de_cultivo_2",
  "temperatura": 24.8,
  "umidade": 87.2,
  "co2": 640
}
```

### Como configurar Sala 2 no ESP32

No firmware, troque:

```cpp
const char *SHROOMOS_SENSOR_ID = "sensor_sala_1_a";
const char *SHROOMOS_SALA_ID = "sala_1";
```

por:

```cpp
const char *SHROOMOS_SENSOR_ID = "sensor_sala_2_a";
const char *SHROOMOS_SALA_ID = "sala_de_cultivo_2";
```

### Retry e logs no Serial

O fallback HTTP agora faz:

1. ate 3 tentativas
2. delay de 1500 ms entre retries
3. logs simples no Serial:
   - sala enviada
   - payload enviado
   - status HTTP
   - resposta do backend
   - sucesso final ou falha final

### Como testar no ESP32

1. Grave o firmware com:
   - `ENABLE_HTTP_FALLBACK 1`
   - `SHROOMOS_SENSOR_ID` correto
   - `SHROOMOS_SALA_ID` correto
   - `INGEST_URL` apontando para Supabase
   - `SENSORES_INGEST_KEY` correta
2. Abra o Serial Monitor em `115200`
3. Confirme logs como:
   - `[HTTP] Enviando leitura para sala_de_cultivo_2`
   - `[HTTP] Status: 201`
   - `[HTTP] Ingest OK para sensor=sensor_sala_2_a sala_id=sala_de_cultivo_2`

Se preferir manter o fluxo atual do ambiente:

1. deixe `ENABLE_HTTP_FALLBACK 0`
2. publique em MQTT normalmente
3. o Raspberry bridge continua fazendo a normalizacao e envio para a API
