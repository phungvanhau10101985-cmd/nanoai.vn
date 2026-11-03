-- Giao diện ngày lễ per shop: lịch dịp + bản xem trước 10 phút.
-- Banner holiday dùng messaging_partner_marketing_banner_assets.kind = 'holiday'.

create table if not exists public.messaging_partner_holiday_occasion_settings (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  code text not null,
  enabled boolean not null default true,
  start_month smallint not null,
  start_day smallint not null,
  end_month smallint not null,
  end_day smallint not null,
  lead_days smallint not null default 0,
  after_days smallint not null default 0,
  sale_percent numeric(5,2) not null default 0
    check (sale_percent between 0 and 50),
  sale_lead_days smallint,
  sale_days smallint,
  updated_at timestamptz not null default now(),
  primary key (partner_id, code),
  check (start_month between 1 and 12),
  check (end_month between 1 and 12),
  check (start_day between 1 and 31),
  check (end_day between 1 and 31),
  check (lead_days between 0 and 60),
  check (after_days between 0 and 60),
  check (sale_lead_days is null or sale_lead_days between 0 and 60),
  check (sale_days is null or sale_days between 0 and 60)
);

create index if not exists idx_partner_holiday_occasion_enabled
  on public.messaging_partner_holiday_occasion_settings (partner_id, enabled);

create table if not exists public.messaging_partner_holiday_theme_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  preview_code text,
  preview_admin_id uuid,
  preview_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.messaging_partner_marketing_banner_assets
  drop constraint if exists messaging_partner_marketing_banner_assets_kind_check;

alter table public.messaging_partner_marketing_banner_assets
  add constraint messaging_partner_marketing_banner_assets_kind_check
  check (kind in ('sale', 'birthday', 'warehouse', 'regular', 'holiday'));
