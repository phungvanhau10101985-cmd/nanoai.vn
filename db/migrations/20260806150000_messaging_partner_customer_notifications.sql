-- W5.2 — in-app notifications for guest customers (no push/email in v1).
create table if not exists public.messaging_partner_customer_notifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  guest_account_id text not null,
  type text not null default 'order',
  title text not null default '',
  body text not null default '',
  href text not null default '',
  read_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists messaging_partner_customer_notifications_guest_idx
  on public.messaging_partner_customer_notifications (partner_id, guest_account_id, created_at desc);

create index if not exists messaging_partner_customer_notifications_unread_idx
  on public.messaging_partner_customer_notifications (partner_id, guest_account_id)
  where read_at is null;
