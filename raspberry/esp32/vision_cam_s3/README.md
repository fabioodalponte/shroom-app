# Vision Cam S3

Firmware padronizado para ESP32-CAM S3 dedicado ao pipeline Vision.

Objetivo:

1. endpoint `GET /capture` com JPEG simples para o pipeline atual
2. endpoint `GET /status` com diagnostico operacional
3. boot defensivo com watchdog, reconnect de Wi-Fi e reinicio automatico em falhas repetidas
4. configuracao por arquivo separado para `colonizacao` e `frutificacao`
5. zero impacto no firmware legado `esp32_cam_capture.ino`

## Arquivos

1. `vision_cam_s3.ino`
2. `camera_board_pins.h`
3. `device_config_colonizacao.example.h`
4. `device_config_frutificacao.example.h`

## Nomes sugeridos

1. `vision-cam-colonizacao-01`
2. `vision-cam-frutificacao-01`

No Vision / banco:

1. `camera-colonizacao`
2. `camera-frutificacao`

## O que o firmware expoe

1. `GET /capture`
2. `GET /status`
3. `GET /health`
4. `GET /`

Campos principais de `/status`:

1. `device_name`
2. `room_name`
3. `ip`
4. `wifi_rssi`
5. `uptime_seconds`
6. `free_heap`
7. `last_boot_reason`

## Validacao atual

Camera validada localmente em `2026-04-07`:

1. `device_name`: `vision-cam-colonizacao-01`
2. `room_name`: `Colonizacao`
3. `ip local`: `10.0.0.163`
4. `capture_url`: `http://10.0.0.163/capture`
5. `status_url`: `http://10.0.0.163/status`
6. `health_url`: `http://10.0.0.163/health`

Observacao:

1. este IP e um endereco local atual da rede
2. se o DHCP mudar, atualize `vision/config/vision_config_colonizacao.json`

Camera validada localmente em `2026-04-13`:

1. `device_name`: `vision-cam-frutificacao-01`
2. `room_name`: `Frutificacao`
3. `ip local`: `10.0.0.137`
4. `capture_url`: `http://10.0.0.137/capture`
5. `status_url`: `http://10.0.0.137/status`
6. `health_url`: `http://10.0.0.137/health`

Observacao:

1. este IP e um endereco local atual da rede
2. se o DHCP mudar, atualize `vision/config/vision_config_frutificacao.json`

## Tunnel atual

Configuracao atual do `cloudflared` em `2026-04-13`:

1. `cam.cogumelos.net` -> `http://10.0.0.177`
2. `cam-frutificacao.cogumelos.net` -> `http://10.0.0.137`
3. `cam-colonizacao.cogumelos.net` -> `http://10.0.0.163`
4. `raspberry.cogumelos.net` -> `ssh://localhost:22`
5. `relay-sala1.cogumelos.net` -> `http://10.0.0.101`
6. `rele-frutificacao.cogumelos.net` -> `http://10.0.0.200`

Para acesso externo das cameras:

1. `https://cam-frutificacao.cogumelos.net/status`
2. `https://cam-frutificacao.cogumelos.net/health`
3. `https://cam-frutificacao.cogumelos.net/capture`
4. `https://cam-colonizacao.cogumelos.net/status`
5. `https://cam-colonizacao.cogumelos.net/health`
6. `https://cam-colonizacao.cogumelos.net/capture`

## Board profile

Os pinouts em `camera_board_pins.h` foram derivados do exemplo oficial da Espressif:

1. `CameraWebServer/camera_pins.h`
2. https://raw.githubusercontent.com/espressif/arduino-esp32/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h

Perfis incluidos:

1. `CAMERA_MODEL_XIAO_ESP32S3`
2. `CAMERA_MODEL_ESP32S3_CAM_LCD`
3. `CAMERA_MODEL_ESP32S3_EYE`
4. `CAMERA_MODEL_DFRobot_FireBeetle2_ESP32S3`
5. `CAMERA_MODEL_M5STACK_CAMS3_UNIT`
6. `CAMERA_MODEL_CUSTOM_S3`

Se a sua placa nao bater com um desses nomes, use `CAMERA_MODEL_CUSTOM_S3` e preencha o pinout real em `device_config.h`.

## Como preparar cada camera

### Colonizacao

```bash
cp raspberry/esp32/vision_cam_s3/device_config_colonizacao.example.h \
  raspberry/esp32/vision_cam_s3/device_config.h
```

Edite:

1. `WIFI_SSID`
2. `WIFI_PASSWORD`
3. `DEVICE_NAME`
4. `ROOM_NAME`
5. perfil da placa
6. pinout se usar `CAMERA_MODEL_CUSTOM_S3`

### Frutificacao

```bash
cp raspberry/esp32/vision_cam_s3/device_config_frutificacao.example.h \
  raspberry/esp32/vision_cam_s3/device_config.h
```

Edite os mesmos campos antes de gravar a segunda placa.

## Configuracao conservadora padrao

O firmware sobe com defaults focados em estabilidade:

1. `FRAMESIZE_VGA`
2. `jpeg_quality = 14`
3. `fb_count = 1`
4. `WiFi.setSleep(false)`
5. reconnect automatico
6. watchdog ativo

Se a imagem vier estavel, depois voce pode subir para `SVGA`.

## Flash

### Arduino IDE

1. Instale a plataforma `esp32` da Espressif
2. Abra `vision_cam_s3.ino`
3. Confirme que `device_config.h` existe
4. Selecione a placa correta da sua camera S3
5. Escolha a porta serial
6. Grave o firmware

Configuracao recomendada:

1. Upload Speed: `115200`
2. Flash Mode: default da placa
3. Partition Scheme: preferir uma opcao com PSRAM/APP ampla quando disponivel

### VS Code + PlatformIO

Estrutura minima incluida nesta pasta:

1. `platformio.ini`
2. `vision_cam_s3.ino`
3. `device_config.h`

Como usar:

1. Abra no VS Code a pasta `raspberry/esp32/vision_cam_s3`
2. Instale a extensao `PlatformIO IDE`
3. Aguarde o PlatformIO instalar a toolchain
4. Confirme que `device_config.h` existe e esta preenchido
5. Conecte a placa e selecione a porta serial
6. Rode `PlatformIO: Upload`
7. Rode `PlatformIO: Serial Monitor`

Configuracao inicial incluida:

1. board: `esp32-s3-devkitc-1`
2. framework: `arduino`
3. upload speed: `115200`
4. monitor speed: `115200`

Se o upload falhar no bootloader:

1. segure `BOOT`
2. clique em upload
3. solte `BOOT` quando aparecer `Connecting...`

## Teste local apos gravar

No monitor serial, espere:

1. banner de boot
2. `reset_reason`
3. IP do Wi-Fi
4. URLs locais de `/status` e `/capture`

Teste na rede local:

```bash
curl -s http://IP_DA_CAMERA/status
curl -o /tmp/camera.jpg http://IP_DA_CAMERA/capture
file /tmp/camera.jpg
```

## Checklist de validacao

1. A placa sobe sem reboot em loop
2. `/status` responde JSON valido
3. `device_name` e `room_name` estao corretos
4. `/capture` retorna JPEG
5. `wifi_rssi` esta aceitavel para a sala
6. `free_heap` permanece estavel entre chamadas
7. reiniciar energia da placa preserva o boot normal
8. desligar e religar o Wi-Fi da rede faz a placa reconectar

## Integracao com o Vision atual

Sem quebrar a camera antiga:

1. mantenha `vision/config/vision_config.json` como legado
2. use um arquivo novo por sala
3. rode cada pipeline com `--config`

Arquivos sugeridos neste repositorio:

1. `vision/config/vision_config_colonizacao.json`
2. `vision/config/vision_config_frutificacao.json`

Testes:

```bash
./vision/scripts/test_capture.sh vision/config/vision_config_colonizacao.json
./vision/scripts/test_capture.sh vision/config/vision_config_frutificacao.json
```

Execucao:

```bash
./vision/scripts/pipeline_once.sh vision/config/vision_config_colonizacao.json
./vision/scripts/pipeline_once.sh vision/config/vision_config_frutificacao.json
```

## Testes prontos

Para a camera da frutificacao:

```bash
./vision/scripts/test_capture.sh vision/config/vision_config_frutificacao.json
./vision/scripts/pipeline_once.sh vision/config/vision_config_frutificacao.json
```

Para as duas salas em sequencia:

```bash
./vision/scripts/test_capture.sh vision/config/vision_config_colonizacao.json
./vision/scripts/test_capture.sh vision/config/vision_config_frutificacao.json
./vision/scripts/pipeline_once.sh vision/config/vision_config_colonizacao.json
./vision/scripts/pipeline_once.sh vision/config/vision_config_frutificacao.json
```

## Observacao importante

O endpoint padrao do Vision continua sendo `/capture`, entao o firmware novo encaixa no cliente atual sem precisar mudar `vision/capture/esp32_cam_capture.py`.
