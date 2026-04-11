-- Giao dịch nạp credit / QR (trước đây chỉ có trong migrations/create_payments_table.sql cũ).

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null,
  credits_added numeric not null,
  transaction_id varchar(255),
  transaction_content text,
  bank_account varchar(50),
  bank_name varchar(100),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled')),
  qr_url text,
  sepay_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_created_at_idx on public.payments (created_at desc);
create index if not exists payments_transaction_id_idx on public.payments (transaction_id);

comment on table public.payments is 'Yêu cầu nạp credit (pending) và khớp SePay (completed).';

create or replace function public.trg_payments_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_payments_updated_at on public.payments;
create trigger update_payments_updated_at
  before update on public.payments
  for each row
  execute procedure public.trg_payments_set_updated_at();
