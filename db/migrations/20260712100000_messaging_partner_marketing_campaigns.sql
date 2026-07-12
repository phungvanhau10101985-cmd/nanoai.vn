-- Marketing campaigns (widget chat remarketing) — Phase 1: chat-only, additive schema

create table if not exists public.messaging_partner_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'completed', 'cancelled', 'failed')),
  channel_chat boolean not null default true,
  channel_email boolean not null default false,
  segment_json jsonb not null default '{}'::jsonb,
  template_subject text null,
  template_body_chat text not null default '',
  template_body_email text null,
  offer_percent smallint null check (offer_percent is null or (offer_percent >= 0 and offer_percent <= 100)),
  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  total_queued int not null default 0,
  sent_chat int not null default 0,
  sent_email int not null default 0,
  skipped int not null default 0,
  failed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_messaging_marketing_campaigns_partner_status
  on public.messaging_partner_marketing_campaigns (partner_id, status, created_at desc);

comment on table public.messaging_partner_marketing_campaigns is
  'Chiến dịch marketing remarketing trong widget chat (fashion messaging).';

create table if not exists public.messaging_partner_marketing_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.messaging_partner_marketing_campaigns (id) on delete cascade,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  conversation_id uuid null references public.customer_care_conversations (id) on delete set null,
  recipient_key text not null,
  email text null,
  status text not null default 'pending'
    check (status in ('pending', 'sent_chat', 'sent_chat_email', 'skipped', 'failed')),
  skip_reason text null,
  rendered_body_chat text null,
  rendered_body_email text null,
  sent_chat_at timestamptz null,
  sent_email_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, recipient_key)
);

create index if not exists idx_messaging_marketing_deliveries_campaign_status
  on public.messaging_partner_marketing_deliveries (campaign_id, status, created_at);

comment on table public.messaging_partner_marketing_deliveries is
  'Log gửi từng người nhận trong campaign marketing.';

create table if not exists public.messaging_partner_marketing_sent_slots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  recipient_key text not null,
  campaign_key text not null,
  sent_at timestamptz not null default now(),
  unique (partner_id, recipient_key, campaign_key)
);

create index if not exists idx_messaging_marketing_sent_slots_partner_recipient
  on public.messaging_partner_marketing_sent_slots (partner_id, recipient_key, sent_at desc);

comment on table public.messaging_partner_marketing_sent_slots is
  'Chống trùng / quota marketing (pattern giống birthday_email_sent).';

create table if not exists public.messaging_partner_marketing_opt_out (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  recipient_key text not null,
  email_normalized text null,
  opted_out_at timestamptz not null default now(),
  unique (partner_id, recipient_key)
);

comment on table public.messaging_partner_marketing_opt_out is
  'Khách từ chối email marketing từ shop (Phase 2).';
