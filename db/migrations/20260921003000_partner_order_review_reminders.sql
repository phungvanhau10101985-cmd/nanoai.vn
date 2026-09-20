-- 188 parity: delivered timestamp + send-once review invitation/reminder state.

alter table public.messaging_partner_orders
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_review_email_claimed_at timestamptz,
  add column if not exists delivered_review_email_sent_at timestamptz,
  add column if not exists review_reminder_claimed_at timestamptz,
  add column if not exists review_reminder_sent_at timestamptz;

update public.messaging_partner_orders
set delivered_at = coalesce(updated_at, created_at, now())
where shipping_status = 'delivered'
  and delivered_at is null;

create index if not exists idx_messaging_partner_orders_review_reminder_due
  on public.messaging_partner_orders (delivered_at, id)
  where shipping_status = 'delivered'
    and review_reminder_sent_at is null;

comment on column public.messaging_partner_orders.delivered_at is
  'First time the order reached delivered, from customer confirmation, carrier sync, or shop admin.';
comment on column public.messaging_partner_orders.delivered_review_email_sent_at is
  'Immediate delivered/review invitation successfully emailed once.';
comment on column public.messaging_partner_orders.review_reminder_sent_at is
  '3-7 day post-delivery review reminder successfully emailed once.';
