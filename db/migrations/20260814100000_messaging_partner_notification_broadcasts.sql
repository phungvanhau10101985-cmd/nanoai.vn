-- Shop SaaS notifications like 188.com.vn:
-- scheduled/expiry in-app inbox + merchant broadcast (compose / Excel) + email.

alter table public.messaging_partner_customer_notifications
  add column if not exists scheduled_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists expires_at timestamptz null,
  add column if not exists email_status text not null default 'none',
  add column if not exists email_error text not null default '',
  add column if not exists broadcast_id uuid null;

comment on column public.messaging_partner_customer_notifications.scheduled_at is
  'Visible to customer when scheduled_at <= now (188 behavior).';
comment on column public.messaging_partner_customer_notifications.expires_at is
  'Auto-delete after this time (188 default: scheduled_at + 15 days).';
comment on column public.messaging_partner_customer_notifications.email_status is
  'none | pending | sent | skipped | failed';

create index if not exists messaging_partner_customer_notifications_visible_idx
  on public.messaging_partner_customer_notifications (partner_id, guest_account_id, scheduled_at desc);

create index if not exists messaging_partner_customer_notifications_email_pending_idx
  on public.messaging_partner_customer_notifications (scheduled_at)
  where email_status = 'pending';

create table if not exists public.messaging_partner_notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  type text not null default 'system',
  scheduled_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz null,
  send_email boolean not null default true,
  audience text not null default 'import',
  source text not null default 'compose',
  created_by uuid null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  total_processed integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  email_sent_count integer not null default 0
);

create index if not exists messaging_partner_notification_broadcasts_partner_idx
  on public.messaging_partner_notification_broadcasts (partner_id, created_at desc);

alter table public.messaging_partner_customer_notifications
  drop constraint if exists messaging_partner_customer_notifications_broadcast_fk;

alter table public.messaging_partner_customer_notifications
  add constraint messaging_partner_customer_notifications_broadcast_fk
  foreign key (broadcast_id)
  references public.messaging_partner_notification_broadcasts(id)
  on delete set null;
