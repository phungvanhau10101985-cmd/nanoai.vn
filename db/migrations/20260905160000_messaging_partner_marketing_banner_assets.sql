-- AI / uploaded 21:9 marketing banners (birthday + same-day-same-month sale)
-- per messaging partner. Additive only.

create table if not exists public.messaging_partner_marketing_banner_assets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  kind text not null check (kind in ('sale', 'birthday')),
  campaign_key text not null,
  date_key text not null,
  discount_percent numeric(5,2) not null
    check (discount_percent between 0 and 100),
  image_url text,
  aspect_ratio text not null default '21:9',
  image_width integer,
  image_height integer,
  prompt text not null default '',
  provider text not null default 'gemini',
  model text not null default '',
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  error_message text,
  version integer not null default 1,
  is_active boolean not null default false,
  source text not null default 'ai' check (source in ('ai', 'upload')),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, kind, campaign_key, version)
);

create index if not exists idx_partner_marketing_banner_active
  on public.messaging_partner_marketing_banner_assets (partner_id, kind, campaign_key, is_active);

create index if not exists idx_partner_marketing_banner_status
  on public.messaging_partner_marketing_banner_assets (partner_id, status, created_at desc);

create index if not exists idx_partner_marketing_banner_kind_date
  on public.messaging_partner_marketing_banner_assets (partner_id, kind, date_key);
