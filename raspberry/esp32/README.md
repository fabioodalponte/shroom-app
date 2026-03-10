# ESP32 Firmware (Sala 1)

Arquivo versionado:

1. `sala1_mqtt_bridge.ino`
2. `esp32_cam_capture.ino`
3. `esp32_relay_controller.ino`

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
4. `INGEST_URL` e `SUPABASE_ANON_KEY` (se for usar fallback HTTP)

## Recomendacao operacional

Com o bridge MQTT->API ativo no Raspberry:

1. Manter `ENABLE_HTTP_FALLBACK 0` para evitar duplicacao e inconsistencias.
2. Mapear no bridge o topico JSON:
   - `tele/chacara/sala1/json -> LOT-2024-001`

## Compatibilidade com o bridge

O bridge aceita `temp`, `rh`, `co2` e faz normalizacao para o payload da API.
