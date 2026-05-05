create table if not exists public.messaging_guest_carts (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  account_key text not null,
  cart_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (partner_id, account_key)
);

comment on table public.messaging_guest_carts is
  'Server-side guest cart synced per messaging partner and authenticated guest account.';
