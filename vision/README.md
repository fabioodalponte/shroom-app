# Vision Module

Modulo inicial para visao computacional da sala de cultivo.

Este modulo foi criado para organizar o fluxo futuro de:

1. captura de imagem da sala
2. inferencia sobre blocos e colonizacao
3. persistencia de artefatos e resultados
4. preparacao de dataset para evolucao do modelo

## Objetivo do primeiro corte

Ainda nao existe IA real aqui.

O foco desta estrutura inicial e:

1. separar responsabilidades por pasta
2. centralizar configuracao
3. permitir um runner unico para os proximos passos
4. deixar o Raspberry Pi 3 pronto para executar pipelines simples

## Estrutura

- `capture/`: captura frames ou snapshots das fontes de imagem
- `inference/`: stubs e contratos do pipeline de inferencia
- `storage/`: persistencia local de imagens, metadata e resultados
- `scripts/`: atalhos operacionais para rodar o modulo
- `config/`: configuracao central do modulo
- `models/`: pesos e loaders dos modelos usados no Raspberry
- `training/`: scripts de treino e artefatos de treinamento
- `dataset/`: armazenamento local para dataset cru, processado e anotacoes
- `logs/`: logs locais do pipeline
- `runner.py`: orquestrador principal do modulo

## Fluxo previsto

1. o runner carrega `config/vision_config.json`
2. o modulo de captura busca um snapshot da camera
3. o snapshot e salvo em `storage/artifacts/YYYY/MM/DD/`
4. o pipeline calcula metricas basicas de qualidade da imagem
5. a avaliacao gera um status final simples para uso operacional e dataset
6. a classificacao do dataset copia ou cria link para a categoria local correta
7. a deteccao inicial de blocos roda com YOLOv8 se o modelo existir
8. a persistencia remota envia a imagem e o resultado ao Supabase
9. o resultado consolidado e salvo em JSON

## Arquivos principais

- `runner.py`: ponto de entrada do modulo
- `config/vision_config.json`: configuracao central
- `capture/esp32_cam_capture.py`: cliente de captura da ESP32-CAM
- `inference/pipeline.py`: pipeline stub com quality check local
- `storage/artifact_store.py`: salva imagens e resultados localmente
- `storage/dataset_classifier.py`: organiza o dataset local com base no quality check
- `storage/remote_persistence.py`: orquestra upload para Storage e insert no banco
- `storage/supabase_storage.py`: upload da imagem para o bucket
- `storage/supabase_records.py`: insert do resultado na tabela remota
- `models/yolo_block_detector.py`: loader defensivo do modelo YOLOv8
- `inference/block_detection.py`: inferencia inicial de blocos
- `training/train_yolo_blocks.py`: script de treino do detector
- `scripts/test_capture.sh`: teste manual rapido da etapa de captura
- `scripts/quality_latest.sh`: processa a ultima imagem ja capturada
- `scripts/dataset_classify_latest.sh`: classifica a ultima imagem no dataset local
- `scripts/detect_blocks_latest.sh`: roda inferencia apenas na ultima imagem

## Captura de imagem

O primeiro corte da captura faz:

1. leitura da URL da camera a partir da configuracao central
2. `GET` simples para o endpoint de snapshot da ESP32-CAM
3. salvamento local da imagem em pasta organizada por data
4. criacao de metadata JSON ao lado da imagem
5. retries com backoff curto para falhas intermitentes de rede
6. logs de sucesso e erro em `vision/logs/vision.log`

Se a camera falhar, o runner retorna um payload estruturado com `status= capture_failed`
ou `status= pipeline_capture_failed`, em vez de derrubar o processo com traceback.

## Quality check da imagem

A etapa 3 do modulo analisa a imagem capturada localmente, sem IA de blocos ainda.

Metricas calculadas:

1. resolucao
2. brilho medio
3. contraste estimado
4. nitidez aproximada por intensidade de bordas

Status finais possiveis:

- `valid`
- `too_dark`
- `too_bright`
- `too_blurry`
- `low_resolution`
- `invalid_image`

O resultado inclui:

1. metricas numericas
2. flags booleanas por problema
3. thresholds usados na avaliacao
4. `dataset_eligible`

## Classificacao automatica do dataset

Regras atuais:

1. `quality_status = valid` e `dataset_eligible = true`
   - classifica em `dataset/raw/valid/`
2. `dataset_eligible = false`
   - classifica em `dataset/raw/rejected/<quality_status>/`

O arquivo original da captura nao e movido.
O classificador tenta criar hardlink primeiro e faz copia se necessario.
Um metadata JSON complementar e salvo ao lado da imagem classificada.

## Persistencia remota no Supabase

Depois do `pipeline-once`, o modulo tenta:

1. subir a imagem capturada para o Supabase Storage
2. criar um registro na tabela remota com o resultado consolidado

Se qualquer etapa falhar:

1. o pipeline local continua
2. os artefatos locais sao mantidos
3. um manifesto JSON e salvo em `vision/storage/reprocess_queue/` para retry futuro

O JSON final local passa a incluir:

1. `remote_persisted`
2. `storage_uploaded`
3. `db_record_created`
4. `remote_persistence`

## Deteccao inicial de blocos com YOLOv8

Esta etapa adiciona uma inferencia inicial para a classe `bloco`.

Comportamento:

1. o pipeline tenta carregar `vision/models/block_detector.pt`
2. se o modelo nao existir, retorna fallback vazio
3. se o modelo existir, roda em CPU com `ultralytics`
4. o pipeline preenche:
   - `summary.blocos_detectados`
   - `detections`
   - `block_detection`

Formato retornado:

```json
{
  "blocos_detectados": 12,
  "detections": [
    {
      "label": "bloco",
      "confidence": 0.91,
      "bbox": [120, 230, 300, 410]
    }
  ]
}
```

Fallback seguro:

```json
{
  "blocos_detectados": 0,
  "detections": []
}
```

## Como rodar

Da raiz do projeto:

```bash
python3 -m pip install -r vision/requirements.txt
python3 -m vision.runner status
python3 -m vision.runner capture-once
python3 -m vision.runner pipeline-once
python3 -m vision.runner scheduled-capture
python3 -m vision.runner quality-latest
python3 -m vision.runner dataset-classify-latest
python3 -m vision.runner detect-blocks-latest
```

## Variaveis de ambiente

Necessarias para a persistencia remota:

```bash
export SUPABASE_URL="https://seu-projeto.supabase.co"
export SUPABASE_KEY="sua-chave"
export SUPABASE_STORAGE_BUCKET="vision-captures"
```

Template: [vision/config/.env.example](/Users/fabiodalponte/Workspace/shroom-app/vision/config/.env.example)

Teste manual simplificado:

```bash
./vision/scripts/test_capture.sh
```

Se quiser usar outro arquivo de configuracao:

```bash
./vision/scripts/test_capture.sh /caminho/para/vision_config.json
```

Para processar apenas a ultima imagem capturada:

```bash
./vision/scripts/quality_latest.sh
```

Para classificar a ultima imagem no dataset local:

```bash
./vision/scripts/dataset_classify_latest.sh
```

Para rodar apenas a inferencia de blocos na ultima captura:

```bash
./vision/scripts/detect_blocks_latest.sh
```

Para rodar a captura automatica com controle de luz:

```bash
./vision/scripts/test_scheduled_capture.sh
```

Se o ambiente local nao confiar na cadeia TLS do dominio da camera e aparecer
`CERTIFICATE_VERIFY_FAILED`, ajuste temporariamente a configuracao:

```json
"capture": {
  "verify_tls": false
}
```

Use isso apenas em ambiente controlado.

Configuracao recomendada para a captura:

```json
"capture": {
  "camera_url": "https://cam.cogumelos.net/capture",
  "request_timeout_seconds": 15,
  "request_retries": 3,
  "retry_backoff_seconds": 1.0,
  "verify_tls": true
}
```

Comportamento:

1. cada tentativa e logada separadamente
2. falhas intermitentes nao derrubam o pipeline na primeira tentativa
3. se todas as tentativas falharem, o erro final consolida os motivos por tentativa

## Captura automatica com iluminacao

O comando `scheduled-capture` foi criado para uso periodico via cron.

Fluxo:

1. ligar a luz da sala
2. aguardar o tempo de warmup
3. executar internamente o `pipeline-once`
4. desligar a luz
5. retornar o resultado do pipeline

Configuracao:

```json
"lighting": {
  "enabled": true,
  "warmup_seconds": 8,
  "cooldown_seconds": 1
}
```

Comportamento atual:

1. `vision/hardware/light_control.py` ainda e stub
2. `turn_light_on()` apenas loga `vision light_on`
3. `turn_light_off()` apenas loga `vision light_off`
4. o desligamento sempre acontece via `try/finally`

Comando:

```bash
python3 -m vision.runner scheduled-capture
```

Exemplo de cron a cada 10 minutos:

```cron
*/10 * * * * cd /caminho/para/shroom-app && /usr/bin/python3 -m vision.runner scheduled-capture
```

## Saidas esperadas

- imagens: `vision/storage/artifacts/YYYY/MM/DD/snapshot_<timestamp>.jpg`
- metadata da captura: mesmo nome da imagem com extensao `.json`
- resultado de quality check: `vision/storage/results/snapshot_<timestamp>_quality.json`
- resultado do pipeline: `vision/storage/results/snapshot_<timestamp>_result.json`
- imagem classificada no dataset: `vision/dataset/raw/valid/` ou `vision/dataset/raw/rejected/<status>/`
- metadata complementar da classificacao: JSON ao lado da imagem classificada
- manifestos de retry remoto: `vision/storage/reprocess_queue/remote_retry_<timestamp>.json`
- log operacional: `vision/logs/vision.log`

## Configuracao da classificacao de dataset

Em `config/vision_config.json`:

```json
"dataset_classification": {
  "enabled": true,
  "mode": "hardlink_or_copy",
  "valid_subdir": "raw/valid",
  "rejected_subdir": "raw/rejected"
}
```

## Configuracao da persistencia remota

Em `config/vision_config.json`:

```json
"remote_persistence": {
  "enabled": true,
  "db_table": "vision_pipeline_runs",
  "storage_prefix": "vision/captures"
}
```

## Configuracao da inferencia YOLOv8

Em `config/vision_config.json`:

```json
"inference": {
  "enabled": true,
  "mode": "yolov8",
  "model": "vision/models/block_detector.pt",
  "device": "cpu",
  "confidence_threshold": 0.25
}
```

Se o modelo ainda nao existir, o pipeline continua funcionando com deteccao vazia.

## Estrutura esperada para treino

```text
vision/dataset/train/images
vision/dataset/train/labels
vision/dataset/val/images
vision/dataset/val/labels
```

Classe atual:

```text
0 bloco
```

Comando de treino:

```bash
python3 vision/training/train_yolo_blocks.py
```

Modelo final salvo em:

```text
vision/models/block_detector.pt
```

## Thresholds configuraveis

Em `config/vision_config.json`:

```json
"quality": {
  "min_width": 640,
  "min_height": 480,
  "brightness": {
    "too_dark_below": 55.0,
    "too_bright_above": 210.0
  },
  "sharpness": {
    "too_blurry_below": 12.0
  }
}
```

## Exemplo resumido de JSON de saida

```json
{
  "status": "pipeline_complete",
  "saved_image": "vision/storage/artifacts/2026/03/11/snapshot_20260311T180715097539Z.jpg",
  "saved_result": "vision/storage/results/snapshot_20260311T180715097539Z_result.json",
  "result": {
    "executed_at": "2026-03-11T18:07:15.127190+00:00",
    "capture_metadata": {
      "captured_at": "2026-03-11T18:07:15.097320+00:00",
      "source": "esp32-cam",
      "camera_url": "https://cam.cogumelos.net/capture",
      "size_bytes": 33351
    },
    "quality_check": {
      "status": "too_blurry",
      "dataset_eligible": false
    },
    "dataset_classification": {
      "dataset_class": "rejected/too_blurry"
    },
    "remote_persisted": false,
    "storage_uploaded": false,
    "db_record_created": false,
    "remote_persistence": {
      "image_storage_path": "vision/captures/2026/03/11/snapshot_20260311T180715097539Z.jpg",
      "retry_manifest_path": "vision/storage/reprocess_queue/remote_retry_snapshot_....json",
      "error": "missing SUPABASE_URL, SUPABASE_KEY or SUPABASE_STORAGE_BUCKET"
    }
  }
}
```

## Payload salvo na tabela remota

Campos enviados:

- `executed_at`
- `captured_at`
- `source`
- `camera_url`
- `image_local_path`
- `image_storage_path`
- `file_size`
- `quality_status`
- `dataset_eligible`
- `dataset_class`
- `brightness_mean`
- `contrast_stddev`
- `sharpness_score`
- `summary_json`
- `raw_result_json`
- `dataset_classification_json`

## Schema SQL sugerido

Arquivo: [supabase_vision_pipeline_runs.sql](/Users/fabiodalponte/Workspace/shroom-app/vision/config/supabase_vision_pipeline_runs.sql)

## Proximos passos naturais

1. salvar frames periodicos via cron/systemd
2. ligar resultado ao Supabase
3. classificar bloco por bloco
4. detectar contaminacoes visuais por regras simples antes de usar modelo
5. versionar dataset anotado para treino futuro
