alter table if exists public.vision_pipeline_runs
  add column if not exists lote_id uuid references public.lotes(id) on delete set null;

create index if not exists idx_vision_pipeline_runs_lote_id
  on public.vision_pipeline_runs (lote_id);
