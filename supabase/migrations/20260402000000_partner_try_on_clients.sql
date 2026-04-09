-- API partner thử đồ: xác thực bằng Bearer secret (SHA-256 lưu key_hash); credit trừ theo billing_user_id.
create table if not exists public.partner_try_on_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  billing_user_id uuid not null references auth.users (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_try_on_clients_billing_user_id
  on public.partner_try_on_clients (billing_user_id);

create index if not exists idx_partner_try_on_clients_active
  on public.partner_try_on_clients (is_active) where is_active = true;

comment on table public.partner_try_on_clients is 'B2B virtual try-on: API key hash maps to billing user id for credits.';

alter table public.partner_try_on_clients enable row level security;

-- Ví dụ thêm partner (key_hash = SHA-256 của secret, hex 64 ký tự — tạo bằng Node: crypto.createHash('sha256').update(secret,'utf8').digest('hex')):
-- insert into public.partner_try_on_clients (name, key_hash, billing_user_id)
-- values ('Tên shop', '<hex64>', '<uuid auth.users có credits>');
