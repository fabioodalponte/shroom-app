CREATE TABLE IF NOT EXISTS public.salas (
  id text PRIMARY KEY,
  codigo varchar(120) NOT NULL UNIQUE,
  nome varchar(160) NOT NULL,
  tipo varchar(60) NOT NULL DEFAULT 'cultivo',
  ativa boolean NOT NULL DEFAULT true,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lotes
ADD COLUMN IF NOT EXISTS sala_id text;

ALTER TABLE public.cameras
ADD COLUMN IF NOT EXISTS sala_id text;

ALTER TABLE public.controladores_sala
ADD COLUMN IF NOT EXISTS sala_id text;

INSERT INTO public.salas (id, codigo, nome, tipo)
SELECT DISTINCT
  lower(regexp_replace(regexp_replace(trim(origem.nome_ref), '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g')) AS id,
  upper(regexp_replace(regexp_replace(trim(origem.nome_ref), '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g')) AS codigo,
  trim(origem.nome_ref) AS nome,
  origem.tipo
FROM (
  SELECT sala AS nome_ref, 'cultivo'::text AS tipo
  FROM public.lotes
  WHERE nullif(trim(sala), '') IS NOT NULL

  UNION

  SELECT sala_id AS nome_ref, 'cultivo'::text AS tipo
  FROM public.leituras_sensores
  WHERE nullif(trim(sala_id), '') IS NOT NULL

  UNION

  SELECT localizacao AS nome_ref, 'monitoramento'::text AS tipo
  FROM public.cameras
  WHERE nullif(trim(localizacao), '') IS NOT NULL

  UNION

  SELECT localizacao AS nome_ref, 'controle_ambiente'::text AS tipo
  FROM public.controladores_sala
  WHERE nullif(trim(localizacao), '') IS NOT NULL
) AS origem
WHERE nullif(trim(origem.nome_ref), '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.lotes
SET sala_id = lower(regexp_replace(regexp_replace(trim(sala), '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g'))
WHERE sala_id IS NULL
  AND nullif(trim(sala), '') IS NOT NULL;

UPDATE public.cameras
SET sala_id = lower(regexp_replace(regexp_replace(trim(localizacao), '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g'))
WHERE sala_id IS NULL
  AND nullif(trim(localizacao), '') IS NOT NULL;

UPDATE public.controladores_sala
SET sala_id = lower(regexp_replace(regexp_replace(trim(localizacao), '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g'))
WHERE sala_id IS NULL
  AND nullif(trim(localizacao), '') IS NOT NULL;

UPDATE public.leituras_sensores
SET sala_id = lower(regexp_replace(regexp_replace(trim(sala_id), '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g'))
WHERE nullif(trim(sala_id), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_salas_ativa ON public.salas (ativa);
CREATE INDEX IF NOT EXISTS idx_lotes_sala_id ON public.lotes (sala_id);
CREATE INDEX IF NOT EXISTS idx_cameras_sala_id ON public.cameras (sala_id);
CREATE INDEX IF NOT EXISTS idx_controladores_sala_sala_id ON public.controladores_sala (sala_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lotes_sala_id_fkey'
  ) THEN
    ALTER TABLE public.lotes
      ADD CONSTRAINT lotes_sala_id_fkey
      FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cameras_sala_id_fkey'
  ) THEN
    ALTER TABLE public.cameras
      ADD CONSTRAINT cameras_sala_id_fkey
      FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'controladores_sala_sala_id_fkey'
  ) THEN
    ALTER TABLE public.controladores_sala
      ADD CONSTRAINT controladores_sala_sala_id_fkey
      FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leituras_sensores_sala_id_fkey'
  ) THEN
    ALTER TABLE public.leituras_sensores
      ADD CONSTRAINT leituras_sensores_sala_id_fkey
      FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE SET NULL;
  END IF;
END $$;
