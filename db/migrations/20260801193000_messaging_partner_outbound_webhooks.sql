-- Outbound webhooks for headless shop integration (order.created, lead.created, payment.paid).

create table if not exists public.messaging_partner_outbound_webhooks (
  partner_id uuid primary key references public.messaging_partners(id) on delete cascade,
  webhook_url text not null default '',
  webhook_secret text not null default '',
  is_enabled boolean not null default false,
  events jsonb not null default '["order.created","lead.created","payment.paid"]'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_partner_outbound_webhooks_enabled
  on public.messaging_partner_outbound_webhooks (partner_id)
  where is_enabled = true and length(trim(webhook_url)) > 0;
