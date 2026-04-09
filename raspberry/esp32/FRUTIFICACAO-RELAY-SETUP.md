# Relay da Frutificacao

Arquivo para subir no ESP32:

1. `raspberry/esp32/esp32_relay_controller_frutificacao.ino`

## O que editar antes de gravar

No topo do arquivo, ajuste:

1. `WIFI_SSID`
2. `WIFI_PASSWORD`
3. `API_TOKEN`

Se quiser mudar a identificacao do equipamento, ajuste tambem:

1. `DEVICE_ID`
2. `DEVICE_NAME`

## Mapeamento atual

1. `relay2` e o canal reservado para a luz da sala de frutificacao
2. a configuracao Vision da frutificacao ja usa `relay_channel = 2`
3. os outros canais ficaram como `canal_1`, `canal_3` e `canal_4` para voces nomearem conforme a instalacao real

## Pinos do modulo

1. `GPIO12` -> `relay1`
2. `GPIO13` -> `relay2`
3. `GPIO14` -> `relay3`
4. `GPIO15` -> `relay4`

Se o modulo estiver invertido, troque:

```cpp
const bool RELAY_ACTIVE_LOW = true;
```

para:

```cpp
const bool RELAY_ACTIVE_LOW = false;
```

## Teste depois do upload

Descubra o IP no serial monitor e rode:

```bash
curl http://IP_DO_ESP32/status
```

Liga a luz da frutificacao no canal 2:

```bash
curl -X POST http://IP_DO_ESP32/relay \
  -H 'Content-Type: application/json' \
  -H 'X-API-Token: SEU_TOKEN' \
  -d '{"relay":2,"state":true}'
```

Desliga:

```bash
curl -X POST http://IP_DO_ESP32/relay \
  -H 'Content-Type: application/json' \
  -H 'X-API-Token: SEU_TOKEN' \
  -d '{"relay":2,"state":false}'
```

## Se forem integrar com o Vision

Em `vision/config/vision_config_frutificacao.json`, a base esperada e:

```json
"lighting": {
  "enabled": true,
  "provider": "relay_http",
  "base_url": "http://IP_DO_ESP32",
  "relay_channel": 2
}
```

Hoje o repositório deixa `lighting.enabled = false` e `base_url = ""`, entao essa parte ainda precisa ser preenchida no ambiente onde a sala vai rodar.
