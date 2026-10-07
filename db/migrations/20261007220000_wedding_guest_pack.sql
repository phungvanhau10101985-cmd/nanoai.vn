-- Gói khách mời theo từng thiệp. null = dùng thử 3 khách.
alter table public.wedding_cards
  add column if not exists guest_pack text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wedding_cards_guest_pack_check'
  ) then
    alter table public.wedding_cards
      add constraint wedding_cards_guest_pack_check
      check (guest_pack is null or guest_pack in ('p50', 'p100', 'unlimited'));
  end if;
end $$;

comment on column public.wedding_cards.guest_pack is
  'Gói khách mời: null = 3 khách miễn phí, p50 = 50, p100 = 100, unlimited = không giới hạn.';

create table if not exists public.wedding_guest_pack_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wedding_card_id uuid not null references public.wedding_cards (id) on delete cascade,
  pack_id text not null check (pack_id in ('p50', 'p100', 'unlimited')),
  amount integer not null check (amount > 0),
  list_price integer not null check (list_price > 0),
  prior_pack text,
  transaction_content text not null,
  bank_account text not null default '',
  bank_name text not null default '',
  account_holder_name text not null default '',
  qr_url text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled')),
  transaction_id text,
  sepay_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists wedding_guest_pack_payments_card_idx
  on public.wedding_guest_pack_payments (wedding_card_id, created_at desc);

create index if not exists wedding_guest_pack_payments_pending_content_idx
  on public.wedding_guest_pack_payments (status, transaction_content);

create unique index if not exists wedding_guest_pack_payments_transaction_id_idx
  on public.wedding_guest_pack_payments (transaction_id)
  where transaction_id is not null and transaction_id <> '';

comment on table public.wedding_guest_pack_payments is
  'Thanh toán SePay gói khách mời. amount là phần chênh so với gói đang có.';
