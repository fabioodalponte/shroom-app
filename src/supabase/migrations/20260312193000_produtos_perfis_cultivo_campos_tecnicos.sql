ALTER TABLE public.produtos_perfis_cultivo
  ADD COLUMN IF NOT EXISTS co2_ideal_max DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS luminosidade_min_lux DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS luminosidade_max_lux DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS ciclo_estimado_dias_min INTEGER,
  ADD COLUMN IF NOT EXISTS ciclo_estimado_dias_max INTEGER;

UPDATE public.produtos_perfis_cultivo
SET
  ciclo_estimado_dias_min = COALESCE(ciclo_estimado_dias_min, ciclo_min_dias),
  ciclo_estimado_dias_max = COALESCE(ciclo_estimado_dias_max, ciclo_max_dias)
WHERE ciclo_estimado_dias_min IS NULL
   OR ciclo_estimado_dias_max IS NULL;

UPDATE public.produtos_perfis_cultivo
SET
  ciclo_min_dias = COALESCE(ciclo_min_dias, ciclo_estimado_dias_min),
  ciclo_max_dias = COALESCE(ciclo_max_dias, ciclo_estimado_dias_max)
WHERE ciclo_min_dias IS NULL
   OR ciclo_max_dias IS NULL;
