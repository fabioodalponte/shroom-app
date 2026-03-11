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
4. a inferencia stub produz metadata sem IA real
5. o resultado consolidado e salvo em JSON

## Arquivos principais

- `runner.py`: ponto de entrada do modulo
- `config/vision_config.json`: configuracao central
- `capture/esp32_cam_capture.py`: cliente de captura da ESP32-CAM
- `inference/pipeline.py`: stub do pipeline de inferencia
- `storage/artifact_store.py`: salva imagens e resultados localmente
- `scripts/test_capture.sh`: teste manual rapido da etapa de captura

## Captura de imagem

O primeiro corte da captura faz:

1. leitura da URL da camera a partir da configuracao central
2. `GET` simples para o endpoint de snapshot da ESP32-CAM
3. salvamento local da imagem em pasta organizada por data
4. criacao de metadata JSON ao lado da imagem
5. logs de sucesso e erro em `vision/logs/vision.log`

Se a camera falhar, o runner retorna um payload estruturado com `status= capture_failed`
ou `status= pipeline_capture_failed`, em vez de derrubar o processo com traceback.

## Como rodar

Da raiz do projeto:

```bash
python3 -m vision.runner status
python3 -m vision.runner capture-once
python3 -m vision.runner pipeline-once
```

Teste manual simplificado:

```bash
./vision/scripts/test_capture.sh
```

Se quiser usar outro arquivo de configuracao:

```bash
./vision/scripts/test_capture.sh /caminho/para/vision_config.json
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
- log operacional: `vision/logs/vision.log`

## Proximos passos naturais

1. salvar frames periodicos via cron/systemd
2. ligar resultado ao Supabase
3. classificar bloco por bloco
4. detectar contaminacoes visuais por regras simples antes de usar modelo
5. versionar dataset anotado para treino futuro
