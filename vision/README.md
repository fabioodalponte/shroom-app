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
7. o resultado consolidado e salvo em JSON

## Arquivos principais

- `runner.py`: ponto de entrada do modulo
- `config/vision_config.json`: configuracao central
- `capture/esp32_cam_capture.py`: cliente de captura da ESP32-CAM
- `inference/pipeline.py`: pipeline stub com quality check local
- `storage/artifact_store.py`: salva imagens e resultados localmente
- `storage/dataset_classifier.py`: organiza o dataset local com base no quality check
- `scripts/test_capture.sh`: teste manual rapido da etapa de captura
- `scripts/quality_latest.sh`: processa a ultima imagem ja capturada
- `scripts/dataset_classify_latest.sh`: classifica a ultima imagem no dataset local

## Captura de imagem

O primeiro corte da captura faz:

1. leitura da URL da camera a partir da configuracao central
2. `GET` simples para o endpoint de snapshot da ESP32-CAM
3. salvamento local da imagem em pasta organizada por data
4. criacao de metadata JSON ao lado da imagem
5. logs de sucesso e erro em `vision/logs/vision.log`

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

## Como rodar

Da raiz do projeto:

```bash
python3 -m pip install -r vision/requirements.txt
python3 -m vision.runner status
python3 -m vision.runner capture-once
python3 -m vision.runner pipeline-once
python3 -m vision.runner quality-latest
python3 -m vision.runner dataset-classify-latest
```

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

Se o ambiente local nao confiar na cadeia TLS do dominio da camera e aparecer
`CERTIFICATE_VERIFY_FAILED`, ajuste temporariamente a configuracao:

```json
"capture": {
  "verify_tls": false
}
```

Use isso apenas em ambiente controlado.

## Saidas esperadas

- imagens: `vision/storage/artifacts/YYYY/MM/DD/snapshot_<timestamp>.jpg`
- metadata da captura: mesmo nome da imagem com extensao `.json`
- resultado de quality check: `vision/storage/results/snapshot_<timestamp>_quality.json`
- resultado do pipeline: `vision/storage/results/snapshot_<timestamp>_result.json`
- imagem classificada no dataset: `vision/dataset/raw/valid/` ou `vision/dataset/raw/rejected/<status>/`
- metadata complementar da classificacao: JSON ao lado da imagem classificada
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
  "status": "quality_complete",
  "image_path": "vision/storage/artifacts/2026/03/11/snapshot_20260311T173917217461Z.jpg",
  "saved_result": "vision/storage/results/snapshot_20260311T173917217461Z_quality.json",
  "quality_check": {
    "status": "valid",
    "dataset_eligible": true,
    "metrics": {
      "resolution": {
        "width": 800,
        "height": 600,
        "total_pixels": 480000
      },
      "brightness_mean": 126.4,
      "contrast_stddev": 38.2,
      "sharpness_score": 19.6
    },
    "flags": {
      "low_resolution": false,
      "too_dark": false,
      "too_bright": false,
      "too_blurry": false,
      "invalid_image": false
    }
  }
}
```

## Proximos passos naturais

1. salvar frames periodicos via cron/systemd
2. ligar resultado ao Supabase
3. classificar bloco por bloco
4. detectar contaminacoes visuais por regras simples antes de usar modelo
5. versionar dataset anotado para treino futuro
