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

Robustez no Raspberry:

1. a inferencia roda isolada em subprocesso por padrao
2. se `torch`/`torchvision`/`opencv` dispararem `Illegal instruction`, o pipeline principal nao cai
3. o resultado volta com erro estruturado em `block_detection.error`
4. use `vision/scripts/check_inference_env.py` para validar o ambiente passo a passo

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
python3 -m vision.runner pipeline-once --lote-id UUID_DO_LOTE
python3 -m vision.runner scheduled-capture
python3 -m vision.runner scheduled-capture --lote-id UUID_DO_LOTE
python3 -m vision.runner quality-latest
python3 -m vision.runner dataset-classify-latest
python3 -m vision.runner detect-blocks-latest
```

## Validacao do ambiente de inferencia no Raspberry

Para diagnosticar incompatibilidade binaria:

```bash
python3 vision/scripts/check_inference_env.py \
  --config vision/config/vision_config.json
```

O checker valida em subprocessos separados:

1. `import torch`
2. `import torchvision`
3. `import ultralytics`
4. load do modelo
5. inferencia minima na captura mais recente

Se alguma etapa morrer com `SIGILL`, o JSON final vai mostrar qual foi a etapa.

## Dependencias recomendadas para Raspberry

Para Raspberry, prefira instalar as dependencias do modulo `vision` assim:

```bash
python3 -m pip install -r vision/requirements.raspberry.txt
```

`torch` e `torchvision` devem ser instalados separadamente com uma dupla compativel com a arquitetura e a versao do Python da placa.

## Vinculo explicito com lote

O pipeline agora aceita `lote_id` explicito.

Prioridade de resolucao:

1. `--lote-id` passado no runner
2. `capture.default_lote_id` no `vision_config.json`
3. `scheduled-capture` tenta resolver dinamicamente o lote ativo pela camera/sala
4. ausencia de lote explicito, mantendo o fallback atual por camera/sala/periodo

Quando disponivel, o `lote_id` e salvo em:

1. `capture_metadata`
2. JSON local do resultado do pipeline
3. registro remoto em `vision_pipeline_runs`

Configuracao opcional:

```json
"capture": {
  "camera_name": "camera-sala-1",
  "camera_url": "https://cam.cogumelos.net/capture",
  "default_lote_id": "UUID_DO_LOTE"
}
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
  "camera_name": "camera-sala-1",
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
  "provider": "relay_http",
  "base_url": "http://10.0.0.101",
  "relay_channel": 2,
  "request_timeout_seconds": 5,
  "request_retries": 2,
  "retry_backoff_seconds": 0.5,
  "verify_state": true,
  "verify_state_strict": false,
  "warmup_seconds": 8,
  "cooldown_seconds": 1
}
```

Exporte o token do controlador local no Raspberry:

```bash
export VISION_RELAY_API_TOKEN="shroombros-token-123"
```

Resolucao dinamica do lote ativo no `scheduled-capture`:

1. usa `--lote-id` quando passado manualmente
2. usa `capture.default_lote_id` quando configurado para piloto
3. tenta resolver a camera por:
   - `capture.camera_url` contra `cameras.url_stream`
   - `capture.camera_name` contra `cameras.nome`
   - fallback para camera ativa unica, quando houver apenas uma
4. usa a `localizacao` da camera como sala alvo
5. busca lotes ativos da mesma sala
6. escolhe o lote mais recente por `data_inoculacao`, com fallback para `data_inicio` e `created_at`
7. se nada for encontrado, executa o pipeline sem `lote_id`

Comportamento atual:

1. `scheduled-capture` resolve o lote ativo antes da captura
2. liga a luz localmente via `POST http://<base_url>/relay`
3. espera o tempo de warmup
4. executa internamente o `pipeline-once`
5. desliga a luz no `finally`, mesmo se o pipeline falhar
6. se `light_on` falhar, a captura e abortada com retorno estruturado
7. se `light_off` falhar, o erro e logado como critico e o retorno e anotado
8. se `verify_state=true`, o modulo tenta confirmar o estado via `GET /status`
9. se `verify_state_strict=false`, falhas de verificacao geram warning, mas nao invalidam o comando
10. se nao houver lote ativo, o pipeline segue sem `lote_id` e registra o fallback nos logs

Teste manual do rele local:

```bash
./vision/scripts/test_light_control.sh on
./vision/scripts/test_light_control.sh off
```

Comando:

```bash
python3 -m vision.runner scheduled-capture
```

## Executando scheduled-capture com cron

O cron roda com ambiente minimo. Para evitar falhas por env ausente, use o wrapper:

`vision/scripts/run_scheduled_capture.sh`

Ele:

1. carrega as variaveis de `vision/config/.env.local`
2. exporta automaticamente as variaveis
3. garante a existencia de `vision/logs`
4. executa `python3 -m vision.runner scheduled-capture`
5. escreve a saida em `vision/logs/cron.log`

Preparacao no Raspberry:

1. copie o arquivo de exemplo:

```bash
cp /home/shroom/workspace/shroom-app/vision/config/.env.example /home/shroom/workspace/shroom-app/vision/config/.env.local
```

2. edite `vision/config/.env.local` com os valores reais:

```bash
nano /home/shroom/workspace/shroom-app/vision/config/.env.local
```

3. teste o wrapper manualmente:

```bash
/home/shroom/workspace/shroom-app/vision/scripts/run_scheduled_capture.sh
```

4. acompanhe o log:

```bash
tail -f /home/shroom/workspace/shroom-app/vision/logs/cron.log
```

Crontab:

1. abra o crontab no Raspberry:

```bash
crontab -e
```

2. adicione esta linha:

```cron
*/10 * * * * /home/shroom/workspace/shroom-app/vision/scripts/run_scheduled_capture.sh
```

3. confirme o agendamento:

```bash
crontab -l
```

Teste manual equivalente sem cron:

```bash
cd /home/shroom/workspace/shroom-app
/home/shroom/workspace/shroom-app/vision/scripts/run_scheduled_capture.sh
```

Troubleshooting rapido:

1. `bash: */10: No such file or directory`
   Isso acontece quando a linha do cron e executada no shell. Use `crontab -e` e cole a linha la.

2. `VISION_RELAY_API_TOKEN is required`
   O arquivo `vision/config/.env.local` esta ausente ou incompleto. Garanta que ele contenha `VISION_RELAY_API_TOKEN=...`.

3. `missing SUPABASE_URL, SUPABASE_KEY or SUPABASE_STORAGE_BUCKET`
   O arquivo `vision/config/.env.local` nao contem as variaveis do Supabase. Preencha o bucket e as credenciais usadas pelo pipeline.

4. `Permission denied` em `vision/logs/cron.log`
   Garanta que o usuario `shroom` tenha permissao de escrita no diretorio `vision/logs`:

   ```bash
   mkdir -p /home/shroom/workspace/shroom-app/vision/logs
   chmod u+rwX /home/shroom/workspace/shroom-app/vision/logs
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
      "lote_id": "UUID_DO_LOTE",
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
