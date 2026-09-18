-- Square sale favicon / PWA avatar (same-day-same-month). Additive.

alter table public.messaging_partner_sale_calendar_settings
  add column if not exists sale_icon_auto boolean not null default true;

comment on column public.messaging_partner_sale_calendar_settings.sale_icon_auto is
  'Tự đổi favicon + ảnh đại diện web app sang icon vuông AI khi sale ngày trùng tháng (teaser/active).';

create table if not exists public.messaging_partner_sale_icons (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  day integer not null check (day between 1 and 12),
  month integer not null check (month between 1 and 12),
  discount_percent numeric(5,2) not null default 0
    check (discount_percent between 0 and 100),
  image_url text,
  source_favicon_url text,
  source_pwa_icon_url text,
  prompt text not null default '',
  model text not null default '',
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, day, month)
);

create index if not exists idx_partner_sale_icons_status
  on public.messaging_partner_sale_icons (partner_id, status, updated_at desc);

comment on table public.messaging_partner_sale_icons is
  'Icon vuông 1:1 AI (favicon + PWA) cho từng ngày sale trùng tháng.';
