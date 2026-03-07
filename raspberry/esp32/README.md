# ESP32 Firmware (Sala 1)

Arquivo versionado:

1. `sala1_mqtt_bridge.ino`
2. `esp32_cam_capture.ino`

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
6. `GET /health` - status basico em JSON
7. `GET /` - pagina simples com preview

Seguranca do flash:

1. O flash so liga quando `flash=1` e desliga ao final da captura.
2. Existe fail-safe no firmware que forca `OFF` automaticamente se ficar ligado por mais de ~10s.
3. O endpoint `/flash/on` tambem agenda auto-off (padrao 3s), reduzindo risco de ficar ligado por engano.

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
