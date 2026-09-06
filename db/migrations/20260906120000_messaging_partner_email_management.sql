-- Quản lý gửi email shop (warmup SMTP + newsletter + CMSN recipient_key)
-- Local:  node scripts/pg-run-sql-file.mjs db/migrations/20260906120000_messaging_partner_email_management.sql --apply
-- Server: node scripts/pg-run-sql-file.mjs db/migrations/20260906120000_messaging_partner_email_management.sql --apply

create table if not exists public.messaging_partner_email_send_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  warmup_enabled boolean not null default true,
  start_limit integer not null default 5 check (start_limit >= 1),
  daily_increment integer not null default 5 check (daily_increment >= 1),
  max_limit integer null check (max_limit is null or max_limit >= 1),
  birthday_cron_enabled boolean not null default true,
  cart_abandon_email_enabled boolean not null default true,
  comeback_email_enabled boolean not null default true,
  newsletter_welcome_email_enabled boolean not null default true,
  warmup_started_at timestamptz null,
  warmup_day integer not null default 1 check (warmup_day >= 1),
  daily_sent_total integer not null default 0 check (daily_sent_total >= 0),
  daily_birthday_sent integer not null default 0 check (daily_birthday_sent >= 0),
  daily_marketing_sent integer not null default 0 check (daily_marketing_sent >= 0),
  last_reset_date date null,
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_email_send_settings is
  'Warm-up SMTP + cờ mail promo theo shop. Quota ngày: start + (day-1)*increment, CMSN ưu tiên.';

create table if not exists public.messaging_partner_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  email_normalized text not null,
  email_raw text not null default '',
  subscriber_name text null,
  gender text null,
  birthday date null,
  phone text null,
  source text not null default 'footer',
  is_active boolean not null default true,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, email_normalized)
);

create index if not exists idx_partner_newsletter_partner_active
  on public.messaging_partner_newsletter_subscribers (partner_id, is_active, subscribed_at desc);

comment on table public.messaging_partner_newsletter_subscribers is
  'Đăng ký nhận tin footer / import — mỗi shop một list.';

create table if not exists public.messaging_partner_email_send_log (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  channel text not null,
  recipient_email text not null,
  recipient_key text null,
  campaign_key text null,
  subject text null,
  status text not null default 'sent',
  error text null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_partner_email_send_log_partner_day
  on public.messaging_partner_email_send_log (partner_id, sent_at desc);

comment on table public.messaging_partner_email_send_log is
  'Nhật ký gửi mail promo (birthday / cart_abandon / comeback / newsletter / campaign).';

-- CMSN: nhận cả khách shop (guest / email), không chỉ auth.users
alter table public.messaging_partner_birthday_email_sent
  add column if not exists recipient_key text,
  add column if not exists recipient_email text;

update public.messaging_partner_birthday_email_sent
  set recipient_key = 'user:' || recipient_user_id::text
  where recipient_key is null and recipient_user_id is not null;

delete from public.messaging_partner_birthday_email_sent
  where recipient_key is null;

alter table public.messaging_partner_birthday_email_sent
  alter column recipient_key set not null;

alter table public.messaging_partner_birthday_email_sent
  alter column recipient_user_id drop not null;

alter table public.messaging_partner_birthday_email_sent
  drop constraint if exists messaging_partner_birthday_email_sent_partner_id_recipient_user_id_campaign_key_key;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.messaging_partner_birthday_email_sent'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%recipient_user_id%'
  ) then
    execute (
      select 'alter table public.messaging_partner_birthday_email_sent drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.messaging_partner_birthday_email_sent'::regclass
        and contype = 'u'
        and pg_get_constraintdef(oid) ilike '%recipient_user_id%'
      limit 1
    );
  end if;
end $$;

create unique index if not exists messaging_partner_birthday_email_sent_partner_key_campaign
  on public.messaging_partner_birthday_email_sent (partner_id, recipient_key, campaign_key);
