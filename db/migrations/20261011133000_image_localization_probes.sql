-- Ảnh cổng thử bản địa hóa. Không ghi kho. Hết hạn 7 ngày thì xóa file CDN.

create table if not exists public.messaging_partner_image_localization_probes (
  id uuid primary key,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  status text not null,
  language text not null,
  apparel_sheet boolean not null default false,
  engine text,
  model text,
  classify_type text,
  classify_reason text,
  message text,
  log_json jsonb not null default '[]'::jsonb,
  original_url text,
  result_url text,
  original_path text,
  result_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  expires_at timestamptz not null,
  constraint messaging_partner_image_loc_probes_status_chk
    check (status in ('running', 'done', 'error'))
);

create index if not exists messaging_partner_image_loc_probes_partner_idx
  on public.messaging_partner_image_localization_probes (partner_id, created_at desc);

create index if not exists messaging_partner_image_loc_probes_expires_idx
  on public.messaging_partner_image_localization_probes (expires_at);

comment on table public.messaging_partner_image_localization_probes is
  'Cổng thử một ảnh trên trang bản địa hóa. Ảnh hết hạn sau 7 ngày.';
