create extension if not exists pgcrypto;

create table if not exists public.vision_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid references public.lotes(id) on delete set null,
  executed_at timestamptz not null,
  captured_at timestamptz,
  source text,
  camera_url text,
  image_local_path text not null,
  image_storage_path text,
  file_size bigint,
  quality_status text,
  dataset_eligible boolean,
  dataset_class text,
  brightness_mean numeric,
  contrast_stddev numeric,
  sharpness_score numeric,
  summary_json jsonb not null default '{}'::jsonb,
  raw_result_json jsonb not null default '{}'::jsonb,
  dataset_classification_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_vision_pipeline_runs_executed_at
  on public.vision_pipeline_runs (executed_at desc);

create index if not exists idx_vision_pipeline_runs_lote_id
  on public.vision_pipeline_runs (lote_id);

create index if not exists idx_vision_pipeline_runs_quality_status
  on public.vision_pipeline_runs (quality_status);

create index if not exists idx_vision_pipeline_runs_dataset_class
  on public.vision_pipeline_runs (dataset_class);
