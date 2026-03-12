CREATE TABLE IF NOT EXISTS public.produtos_perfis_cultivo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL UNIQUE REFERENCES public.produtos(id) ON DELETE CASCADE,
  co2_ideal_max DECIMAL(10, 2),
  luminosidade_min_lux DECIMAL(10, 2),
  luminosidade_max_lux DECIMAL(10, 2),
  ciclo_min_dias INTEGER,
  ciclo_max_dias INTEGER,
  parametros_fases_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recomendacoes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_perfis_cultivo_ativo
  ON public.produtos_perfis_cultivo(ativo);

DROP TRIGGER IF EXISTS set_produtos_perfis_cultivo_updated_at ON public.produtos_perfis_cultivo;
CREATE TRIGGER set_produtos_perfis_cultivo_updated_at
BEFORE UPDATE ON public.produtos_perfis_cultivo
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.produtos_treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  slug VARCHAR(120) NOT NULL,
  categoria VARCHAR(60) NOT NULL DEFAULT 'operacional',
  titulo VARCHAR(160) NOT NULL,
  objetivo TEXT,
  conteudo_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT produtos_treinamentos_produto_slug_key UNIQUE (produto_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_produtos_treinamentos_produto
  ON public.produtos_treinamentos(produto_id, ordem);

CREATE INDEX IF NOT EXISTS idx_produtos_treinamentos_ativo
  ON public.produtos_treinamentos(ativo);

DROP TRIGGER IF EXISTS set_produtos_treinamentos_updated_at ON public.produtos_treinamentos;
CREATE TRIGGER set_produtos_treinamentos_updated_at
BEFORE UPDATE ON public.produtos_treinamentos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.produtos_perfis_cultivo (
  produto_id,
  co2_ideal_max,
  luminosidade_min_lux,
  luminosidade_max_lux,
  ciclo_min_dias,
  ciclo_max_dias,
  parametros_fases_json,
  recomendacoes_json,
  observacoes
)
SELECT
  p.id,
  seed.co2_ideal_max,
  seed.luminosidade_min_lux,
  seed.luminosidade_max_lux,
  seed.ciclo_min_dias,
  seed.ciclo_max_dias,
  seed.parametros_fases_json,
  seed.recomendacoes_json,
  seed.observacoes
FROM public.produtos p
JOIN (
  VALUES
    (
      'Shiitake',
      1000::DECIMAL(10, 2),
      500::DECIMAL(10, 2),
      1000::DECIMAL(10, 2),
      18,
      25,
      jsonb_build_object(
        'incubacao', jsonb_build_object('temperatura_min', 22, 'temperatura_max', 26, 'umidade_min', 75, 'umidade_max', 85, 'luz', 'escuro'),
        'frutificacao', jsonb_build_object('temperatura_min', 18, 'temperatura_max', 22, 'umidade_min', 80, 'umidade_max', 90, 'luz', '500-1000 lux')
      ),
      jsonb_build_object(
        'resumo', 'Shiitake exige queda de temperatura e luz indireta para induzir frutificação.',
        'alertas', jsonb_build_array('Evitar CO2 acima de 1000 ppm na frutificação', 'Manter boa troca de ar sem ressecar o bloco')
      ),
      'Perfil inicial gerado a partir dos parâmetros operacionais atuais do app.'
    ),
    (
      'Shimeji Branco',
      1500::DECIMAL(10, 2),
      500::DECIMAL(10, 2),
      1000::DECIMAL(10, 2),
      14,
      21,
      jsonb_build_object(
        'incubacao', jsonb_build_object('temperatura_min', 20, 'temperatura_max', 24, 'umidade_min', 75, 'umidade_max', 85, 'luz', 'escuro'),
        'frutificacao', jsonb_build_object('temperatura_min', 16, 'temperatura_max', 20, 'umidade_min', 85, 'umidade_max', 90, 'luz', '500-1000 lux')
      ),
      jsonb_build_object(
        'resumo', 'Shimeji responde bem a ventilação leve e alta umidade na frutificação.',
        'alertas', jsonb_build_array('Evitar ressecamento dos primórdios', 'CO2 acima de 1500 ppm deforma cachos')
      ),
      'Perfil inicial compartilhado entre variedades de shimeji.'
    ),
    (
      'Shimeji Preto',
      1500::DECIMAL(10, 2),
      500::DECIMAL(10, 2),
      1000::DECIMAL(10, 2),
      14,
      21,
      jsonb_build_object(
        'incubacao', jsonb_build_object('temperatura_min', 20, 'temperatura_max', 24, 'umidade_min', 75, 'umidade_max', 85, 'luz', 'escuro'),
        'frutificacao', jsonb_build_object('temperatura_min', 16, 'temperatura_max', 20, 'umidade_min', 85, 'umidade_max', 90, 'luz', '500-1000 lux')
      ),
      jsonb_build_object(
        'resumo', 'Shimeji preto exige ventilação controlada e boa umidade para abrir os cachos.',
        'alertas', jsonb_build_array('Evitar calor acima da faixa ideal', 'Monitorar condensação excessiva no saco')
      ),
      'Perfil inicial compartilhado entre variedades de shimeji.'
    ),
    (
      'Cogumelo Paris',
      2000::DECIMAL(10, 2),
      0::DECIMAL(10, 2),
      50::DECIMAL(10, 2),
      21,
      28,
      jsonb_build_object(
        'incubacao', jsonb_build_object('temperatura_min', 18, 'temperatura_max', 22, 'umidade_min', 80, 'umidade_max', 90, 'luz', 'escuro'),
        'frutificacao', jsonb_build_object('temperatura_min', 14, 'temperatura_max', 18, 'umidade_min', 85, 'umidade_max', 95, 'luz', 'escuro')
      ),
      jsonb_build_object(
        'resumo', 'Champignon prefere baixa luminosidade e CO2 moderado em frutificação.',
        'alertas', jsonb_build_array('Excesso de luz prejudica uniformidade', 'Monitorar umidade alta com ventilação mínima')
      ),
      'Perfil inicial para champignon/cogumelo paris.'
    ),
    (
      'Cogumelo Ostra',
      1200::DECIMAL(10, 2),
      300::DECIMAL(10, 2),
      1200::DECIMAL(10, 2),
      12,
      20,
      jsonb_build_object(
        'incubacao', jsonb_build_object('temperatura_min', 22, 'temperatura_max', 26, 'umidade_min', 75, 'umidade_max', 85, 'luz', 'escuro'),
        'frutificacao', jsonb_build_object('temperatura_min', 18, 'temperatura_max', 24, 'umidade_min', 85, 'umidade_max', 92, 'luz', '300-1200 lux')
      ),
      jsonb_build_object(
        'resumo', 'Pleurotus tolera bem frutificação rápida, mas exige troca de ar constante.',
        'alertas', jsonb_build_array('CO2 alto alonga excessivamente os talos', 'Evitar secagem do corte de frutificação')
      ),
      'Perfil inicial para pleurotus/cogumelo ostra.'
    )
) AS seed (
  nome,
  co2_ideal_max,
  luminosidade_min_lux,
  luminosidade_max_lux,
  ciclo_min_dias,
  ciclo_max_dias,
  parametros_fases_json,
  recomendacoes_json,
  observacoes
) ON seed.nome = p.nome
ON CONFLICT (produto_id) DO UPDATE
SET
  co2_ideal_max = EXCLUDED.co2_ideal_max,
  luminosidade_min_lux = EXCLUDED.luminosidade_min_lux,
  luminosidade_max_lux = EXCLUDED.luminosidade_max_lux,
  ciclo_min_dias = EXCLUDED.ciclo_min_dias,
  ciclo_max_dias = EXCLUDED.ciclo_max_dias,
  parametros_fases_json = EXCLUDED.parametros_fases_json,
  recomendacoes_json = EXCLUDED.recomendacoes_json,
  observacoes = EXCLUDED.observacoes,
  updated_at = NOW();

INSERT INTO public.produtos_treinamentos (
  produto_id,
  slug,
  categoria,
  titulo,
  objetivo,
  conteudo_json,
  ordem
)
SELECT
  p.id,
  seed.slug,
  seed.categoria,
  seed.titulo,
  seed.objetivo,
  seed.conteudo_json,
  seed.ordem
FROM public.produtos p
JOIN (
  VALUES
    (
      'Shiitake',
      'guia-operacional',
      'operacional',
      'Guia operacional de Shiitake',
      'Conduzir incubação e frutificação com foco em indução correta e baixa contaminação.',
      jsonb_build_object(
        'etapas', jsonb_build_array(
          jsonb_build_object('titulo', 'Incubação', 'descricao', 'Manter estabilidade térmica e não abrir o bloco antes da consolidação.'),
          jsonb_build_object('titulo', 'Gatilho de frutificação', 'descricao', 'Aplicar queda de temperatura e fornecer luz indireta.'),
          jsonb_build_object('titulo', 'Colheita', 'descricao', 'Colher antes da borda do chapéu abrir excessivamente.')
        )
      ),
      10
    ),
    (
      'Shimeji Branco',
      'guia-operacional',
      'operacional',
      'Guia operacional de Shimeji Branco',
      'Padronizar ventilação, umidade e abertura de cachos.',
      jsonb_build_object(
        'etapas', jsonb_build_array(
          jsonb_build_object('titulo', 'Incubação', 'descricao', 'Evitar compactação excessiva e manter o saco íntegro.'),
          jsonb_build_object('titulo', 'Frutificação', 'descricao', 'Aumentar umidade e troca de ar de forma gradual.'),
          jsonb_build_object('titulo', 'Pós-colheita', 'descricao', 'Remover resíduos do bloco e avaliar segunda onda.')
        )
      ),
      10
    ),
    (
      'Shimeji Preto',
      'guia-operacional',
      'operacional',
      'Guia operacional de Shimeji Preto',
      'Conduzir cachos uniformes com ventilação controlada e alta umidade.',
      jsonb_build_object(
        'etapas', jsonb_build_array(
          jsonb_build_object('titulo', 'Incubação', 'descricao', 'Aguardar consolidação total antes de abrir o saco.'),
          jsonb_build_object('titulo', 'Frutificação', 'descricao', 'Estimular abertura dos cachos com ventilação leve.'),
          jsonb_build_object('titulo', 'Colheita', 'descricao', 'Colher quando os cachos estiverem firmes e bem formados.')
        )
      ),
      10
    ),
    (
      'Cogumelo Paris',
      'guia-operacional',
      'operacional',
      'Guia operacional de Cogumelo Paris',
      'Conduzir a produção com baixa luminosidade e controle rigoroso de umidade.',
      jsonb_build_object(
        'etapas', jsonb_build_array(
          jsonb_build_object('titulo', 'Ambiente', 'descricao', 'Reduzir luz direta e estabilizar temperatura em faixa mais baixa.'),
          jsonb_build_object('titulo', 'Frutificação', 'descricao', 'Monitorar umidade alta sem gerar excesso de condensação.'),
          jsonb_build_object('titulo', 'Qualidade', 'descricao', 'Separar rapidamente sinais de manchas e deformações.')
        )
      ),
      10
    ),
    (
      'Cogumelo Ostra',
      'guia-operacional',
      'operacional',
      'Guia operacional de Cogumelo Ostra',
      'Manter frutificação rápida e ventilação constante para pleurotus.',
      jsonb_build_object(
        'etapas', jsonb_build_array(
          jsonb_build_object('titulo', 'Incubação', 'descricao', 'Evitar perfurações prematuras no saco.'),
          jsonb_build_object('titulo', 'Frutificação', 'descricao', 'Abrir corte adequado e manter troca de ar constante.'),
          jsonb_build_object('titulo', 'Colheita', 'descricao', 'Colher antes de bordas ressecarem ou enrolarem demais.')
        )
      ),
      10
    ),
    (
      'Shiitake',
      'contaminacao-e-alertas',
      'qualidade',
      'Contaminação e alertas visuais',
      'Padronizar resposta operacional a sinais de contaminação.',
      jsonb_build_object(
        'sinais', jsonb_build_array('manchas verdes', 'pontos pretos', 'odor ácido', 'excesso de umidade parada'),
        'acao_imediata', jsonb_build_array('isolar bloco', 'registrar ocorrência', 'revisar higiene e ventilação')
      ),
      20
    ),
    (
      'Shimeji Branco',
      'contaminacao-e-alertas',
      'qualidade',
      'Contaminação e alertas visuais',
      'Padronizar resposta operacional a sinais de contaminação.',
      jsonb_build_object(
        'sinais', jsonb_build_array('manchas verdes', 'cacho deformado', 'condensação excessiva', 'odor estranho'),
        'acao_imediata', jsonb_build_array('isolar bloco', 'registrar ocorrência', 'revisar ventilação e umidade')
      ),
      20
    ),
    (
      'Shimeji Preto',
      'contaminacao-e-alertas',
      'qualidade',
      'Contaminação e alertas visuais',
      'Padronizar resposta operacional a sinais de contaminação.',
      jsonb_build_object(
        'sinais', jsonb_build_array('manchas verdes', 'cacho escurecido fora do padrão', 'odor estranho'),
        'acao_imediata', jsonb_build_array('isolar bloco', 'registrar ocorrência', 'avaliar higiene da sala')
      ),
      20
    ),
    (
      'Cogumelo Paris',
      'contaminacao-e-alertas',
      'qualidade',
      'Contaminação e alertas visuais',
      'Padronizar resposta operacional a sinais de contaminação.',
      jsonb_build_object(
        'sinais', jsonb_build_array('manchas escuras', 'umidade excessiva', 'odor forte'),
        'acao_imediata', jsonb_build_array('isolar lote', 'revisar ventilação', 'registrar ocorrência')
      ),
      20
    ),
    (
      'Cogumelo Ostra',
      'contaminacao-e-alertas',
      'qualidade',
      'Contaminação e alertas visuais',
      'Padronizar resposta operacional a sinais de contaminação.',
      jsonb_build_object(
        'sinais', jsonb_build_array('manchas verdes', 'bordas secas precocemente', 'odor ácido'),
        'acao_imediata', jsonb_build_array('isolar bloco', 'ajustar ventilação', 'registrar ocorrência')
      ),
      20
    )
) AS seed (
  nome,
  slug,
  categoria,
  titulo,
  objetivo,
  conteudo_json,
  ordem
) ON seed.nome = p.nome
ON CONFLICT (produto_id, slug) DO UPDATE
SET
  categoria = EXCLUDED.categoria,
  titulo = EXCLUDED.titulo,
  objetivo = EXCLUDED.objetivo,
  conteudo_json = EXCLUDED.conteudo_json,
  ordem = EXCLUDED.ordem,
  updated_at = NOW();
