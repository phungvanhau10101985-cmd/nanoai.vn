-- Bản địa hóa ảnh kho (parity 188 image_localization_*) theo partner_id.
-- Additive. Không khóa slug shop.

alter table public.messaging_partner_inventory
  add column if not exists image_localization_status text not null default 'pending',
  add column if not exists image_localization_language text,
  add column if not exists image_localized_at timestamptz,
  add column if not exists image_localization_error text;

comment on column public.messaging_partner_inventory.image_localization_status is
  'pending | processing | localized | failed | skipped — bản địa hóa ảnh O/P/Q/T.';
comment on column public.messaging_partner_inventory.image_localization_language is
  'vi | en | th | id — ngôn ngữ đích lần xử lý gần nhất.';
comment on column public.messaging_partner_inventory.image_localized_at is
  'Thời điểm bản địa hóa thành công (UTC).';
comment on column public.messaging_partner_inventory.image_localization_error is
  'Lỗi / ghi chú lần xử lý gần nhất.';

create index if not exists messaging_partner_inventory_image_loc_status_idx
  on public.messaging_partner_inventory (partner_id, image_localization_status)
  where is_active = true;

create table if not exists public.messaging_partner_image_localization_jobs (
  job_id text primary key,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  status text not null default 'queued',
  phase text default 'queued',
  message text,
  payload_json jsonb,
  current integer default 0,
  total integer,
  done integer default 0,
  failed integer default 0,
  skipped integer default 0,
  percent double precision,
  current_product_id text,
  cancel_requested boolean not null default false,
  queue_product_ids jsonb default '[]'::jsonb,
  processed_product_ids jsonb default '[]'::jsonb,
  job_queue_truncated boolean default false,
  recent_results jsonb default '[]'::jsonb,
  skipped_product_reports jsonb default '[]'::jsonb,
  language text,
  force boolean default false,
  dry_run boolean default false,
  gemini_mode text,
  local_image_only boolean default false,
  resume_count integer default 0,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists messaging_partner_image_loc_jobs_partner_status_idx
  on public.messaging_partner_image_localization_jobs (partner_id, status, created_at desc);

comment on table public.messaging_partner_image_localization_jobs is
  'Job bản địa hóa ảnh theo workspace — poll sau restart và resume worker.';

create table if not exists public.messaging_partner_image_localization_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  deepseek_off_peak_only boolean not null default false,
  updated_at timestamptz
);

comment on table public.messaging_partner_image_localization_settings is
  'Cờ chờ giờ thấp điểm DeepSeek theo workspace.';
