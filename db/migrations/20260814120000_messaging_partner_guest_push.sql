-- Shop SaaS Web Push for guest customers (188-style, partner-scoped).
-- Platform push_subscriptions stays tied to auth.users; shop guests use this table.

alter table public.messaging_partner_customer_notifications
  add column if not exists push_status text not null default 'pending',
  add column if not exists push_error text not null default '';

comment on column public.messaging_partner_customer_notifications.push_status is
  'none | pending | sent | skipped | failed — send when scheduled_at <= now';

create index if not exists messaging_partner_customer_notifications_push_pending_idx
  on public.messaging_partner_customer_notifications (scheduled_at)
  where push_status = 'pending';

create table if not exists public.messaging_partner_guest_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  guest_account_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  custom_domain boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists messaging_partner_guest_push_partner_guest_endpoint_uniq
  on public.messaging_partner_guest_push_subscriptions (partner_id, guest_account_id, endpoint);

create index if not exists messaging_partner_guest_push_guest_idx
  on public.messaging_partner_guest_push_subscriptions (partner_id, guest_account_id);

comment on table public.messaging_partner_guest_push_subscriptions is
  'Web Push subscriptions for shop guest accounts; origin-bound (platform vs custom domain).';
