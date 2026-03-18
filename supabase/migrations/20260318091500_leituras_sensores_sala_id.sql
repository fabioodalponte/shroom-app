ALTER TABLE public.leituras_sensores
ADD COLUMN IF NOT EXISTS sala_id text;

UPDATE public.leituras_sensores AS leitura
SET sala_id = lower(trim(lote.sala))
FROM public.lotes AS lote
WHERE leitura.lote_id = lote.id
  AND leitura.sala_id IS NULL
  AND nullif(trim(lote.sala), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leituras_sensores_sala_timestamp
ON public.leituras_sensores (sala_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_leituras_sensores_lote_timestamp
ON public.leituras_sensores (lote_id, "timestamp" DESC);
