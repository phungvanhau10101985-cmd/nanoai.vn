-- Stable per-recipient notification keys for retry-safe order/customer/owner delivery.

alter table public.messaging_partner_customer_notifications
  add column if not exists dedupe_key text;

create unique index if not exists uq_mp_customer_notification_dedupe
  on public.messaging_partner_customer_notifications (partner_id, guest_account_id, dedupe_key)
  where dedupe_key is not null and dedupe_key <> '';

create unique index if not exists uq_notifications_meta_idempotency
  on public.notifications (user_id, ((meta ->> 'idempotency_key')))
  where coalesce(meta ->> 'idempotency_key', '') <> '';

comment on column public.messaging_partner_customer_notifications.dedupe_key is
  'Stable event/channel key used to suppress duplicate customer order notifications and pushes.';
