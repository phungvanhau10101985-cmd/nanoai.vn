-- Phase 4: hub agent auto-run (bán tự động)

alter table public.hub_multi_task_plans
  add column if not exists auto_run_status text not null default 'off'
    check (auto_run_status in ('off', 'queued', 'running', 'failed', 'completed')),
  add column if not exists auto_run_error text,
  add column if not exists input_images_json jsonb,
  add column if not exists estimated_credits numeric(8,2);

alter table public.hub_multi_task_steps
  add column if not exists result_url text,
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

create index if not exists idx_hub_multi_task_plans_auto_run
  on public.hub_multi_task_plans(auto_run_status, updated_at desc)
  where auto_run_status in ('queued', 'running');
