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

-- DB cũ có thể đã có public.payments với schema khác (thiếu cột) → IF NOT EXISTS bỏ qua CREATE và index/policy fail.
alter table public.payments add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.payments add column if not exists amount numeric;
alter table public.payments add column if not exists credits_added numeric;
alter table public.payments add column if not exists transaction_id varchar(255);
alter table public.payments add column if not exists transaction_content text;
alter table public.payments add column if not exists bank_account varchar(50);
alter table public.payments add column if not exists bank_name varchar(100);
alter table public.payments add column if not exists status varchar(20) not null default 'pending';
alter table public.payments add column if not exists qr_url text;
alter table public.payments add column if not exists sepay_data jsonb;
alter table public.payments add column if not exists created_at timestamptz not null default now();
alter table public.payments add column if not exists updated_at timestamptz not null default now();
alter table public.payments add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_status_check'
  ) then
    begin
      alter table public.payments
        add constraint payments_status_check
        check (status in ('pending', 'completed', 'failed', 'cancelled'));
    exception when others then null;
    end;
  end if;
end $$;

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
