-- Per-visitor personalization for partner shop / landing (recently viewed, UTM context).
create table if not exists public.messaging_partner_visitor_personalization (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  account_key text not null,
  recently_viewed_ids jsonb not null default '[]'::jsonb,
  utm_context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (partner_id, account_key)
);

create index if not exists messaging_partner_visitor_personalization_updated_idx
  on public.messaging_partner_visitor_personalization (partner_id, updated_at desc);

comment on table public.messaging_partner_visitor_personalization is
  'Visitor personalization state per partner: recently viewed inventory ids + last UTM context (guest session, guest account, or headless customer_ref).';

comment on column public.messaging_partner_visitor_personalization.account_key is
  'Stable visitor key: guest session UUID, messaging_guest_accounts.id, linked user id, or headless:{customer_ref}.';

comment on column public.messaging_partner_visitor_personalization.recently_viewed_ids is
  'JSON array of inventory UUID strings, most recent first (max ~24).';

comment on column public.messaging_partner_visitor_personalization.utm_context is
  'JSON object: utm_source, utm_medium, utm_campaign, utm_content, utm_term, captured_at.';
