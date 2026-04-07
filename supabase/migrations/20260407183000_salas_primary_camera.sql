ALTER TABLE public.salas
ADD COLUMN IF NOT EXISTS primary_camera_id uuid;

CREATE INDEX IF NOT EXISTS idx_salas_primary_camera_id
ON public.salas (primary_camera_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salas_primary_camera_id_fkey'
  ) THEN
    ALTER TABLE public.salas
      ADD CONSTRAINT salas_primary_camera_id_fkey
      FOREIGN KEY (primary_camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;
  END IF;
END $$;
