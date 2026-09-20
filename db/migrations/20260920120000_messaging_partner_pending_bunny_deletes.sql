-- Hàng đợi xoá object Bunny CDN sau khi xóa sản phẩm kho — cùng luồng 188 pending_bunny_deletes.
-- Additive. Mọi shop SaaS cùng engine.

create table if not exists public.messaging_partner_pending_bunny_deletes (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  source_url text,
  partner_id uuid,
  inventory_id uuid,
  status text not null default 'pending' check (status in ('pending', 'failed')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_messaging_partner_pending_bunny_deletes_path
  on public.messaging_partner_pending_bunny_deletes (storage_path);

create index if not exists idx_messaging_partner_pending_bunny_deletes_due
  on public.messaging_partner_pending_bunny_deletes (status, next_attempt_at, id)
  where status = 'pending';

comment on table public.messaging_partner_pending_bunny_deletes is
  'Xoá file Bunny sau khi xóa SP kho. Cron / drain nền DELETE Storage API rồi gỡ dòng.';
