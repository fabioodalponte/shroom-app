ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS fase_atual VARCHAR(40) DEFAULT 'esterilizacao',
  ADD COLUMN IF NOT EXISTS data_inoculacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_prevista_fim_incubacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_real_fim_incubacao TIMESTAMPTZ;

ALTER TABLE public.lotes
  DROP CONSTRAINT IF EXISTS lotes_fase_operacional_check;

ALTER TABLE public.lotes
  ADD CONSTRAINT lotes_fase_operacional_check
  CHECK (
    fase_operacional IN (
      'esterilizacao',
      'inoculacao',
      'incubacao',
      'pronto_para_frutificacao',
      'frutificacao',
      'colheita',
      'encerramento'
    )
  );

ALTER TABLE public.lotes
  DROP CONSTRAINT IF EXISTS lotes_fase_atual_check;

ALTER TABLE public.lotes
  ADD CONSTRAINT lotes_fase_atual_check
  CHECK (
    fase_atual IN (
      'esterilizacao',
      'inoculacao',
      'incubacao',
      'pronto_para_frutificacao',
      'frutificacao',
      'colheita',
      'encerramento'
    )
  );

UPDATE public.lotes
SET fase_atual = COALESCE(fase_atual, fase_operacional, 'esterilizacao')
WHERE fase_atual IS NULL;

UPDATE public.lotes l
SET data_inoculacao = blocos.primeira_inoculacao
FROM (
  SELECT lote_id, MIN(data_inoculacao) AS primeira_inoculacao
  FROM public.lotes_blocos
  WHERE data_inoculacao IS NOT NULL
  GROUP BY lote_id
) AS blocos
WHERE l.id = blocos.lote_id
  AND l.data_inoculacao IS NULL;

UPDATE public.produtos_perfis_cultivo
SET parametros_fases_json = jsonb_set(
  COALESCE(parametros_fases_json, '{}'::jsonb),
  '{incubacao,dias_previstos}',
  to_jsonb(
    COALESCE(
      NULLIF(parametros_fases_json -> 'incubacao' ->> 'dias_previstos', '')::INTEGER,
      ciclo_min_dias,
      14
    )
  ),
  true
)
WHERE ativo = true;

UPDATE public.lotes l
SET data_prevista_fim_incubacao = l.data_inoculacao + make_interval(
  days => COALESCE(
    NULLIF(pp.parametros_fases_json -> 'incubacao' ->> 'dias_previstos', '')::INTEGER,
    pp.ciclo_min_dias,
    14
  )
)
FROM public.produtos_perfis_cultivo pp
WHERE l.produto_id = pp.produto_id
  AND l.data_inoculacao IS NOT NULL
  AND l.data_prevista_fim_incubacao IS NULL
  AND l.fase_operacional IN ('incubacao', 'pronto_para_frutificacao', 'frutificacao', 'colheita', 'encerramento');

CREATE INDEX IF NOT EXISTS idx_lotes_fase_atual
  ON public.lotes(fase_atual);

CREATE INDEX IF NOT EXISTS idx_lotes_data_prevista_fim_incubacao
  ON public.lotes(data_prevista_fim_incubacao);
