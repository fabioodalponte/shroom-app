# Dataset Workspace

Este diretorio guarda material bruto e derivado para evolucao futura da visao computacional.

Sugestao de uso:

- `raw/`: imagens originais capturadas na sala
- `processed/`: imagens recortadas, normalizadas ou preparadas
- `annotations/`: rotulos manuais, masks e metadados de treino

Ainda nao existe pipeline de anotacao automatica neste primeiro corte.
## Dataset raw

Estrutura atual:

- `raw/valid/`: imagens aptas para dataset
- `raw/rejected/<quality_status>/`: imagens rejeitadas pelo quality check
- `processed/`: reservado para etapas futuras
- `annotations/`: reservado para anotacoes futuras

Cada imagem classificada recebe um JSON complementar ao lado com:

- caminho da imagem original
- classe de dataset
- quality status
- metodo usado (`hardlink` ou `copy`)
