-- Kiểm tra nguồn hàng (parity 188 source_stock_*) theo partner_id.
-- Additive. Không khóa slug shop.

alter table public.messaging_partner_inventory
  add column if not exists source_stock_status text not null default 'unknown',
  add column if not exists source_stock_checked_at timestamptz,
  add column if not exists source_stock_next_check_at timestamptz,
  add column if not exists source_stock_error text,
  add column if not exists source_stock_check_platform text,
  add column if not exists admin_source_batch_scanned_at timestamptz;

comment on column public.messaging_partner_inventory.source_stock_status is
  'unknown | queued | checking | in_stock | out_of_stock | blocked | error — kiểm tra nguồn CSSBuy/Vipomall/PandaMall.';
comment on column public.messaging_partner_inventory.source_stock_checked_at is
  'Thời điểm kiểm tra nguồn gần nhất (UTC).';
comment on column public.messaging_partner_inventory.source_stock_next_check_at is
  'Thời điểm worker được claim lại.';
comment on column public.messaging_partner_inventory.source_stock_error is
  'Lỗi / ghi chú lần kiểm tra gần nhất.';
comment on column public.messaging_partner_inventory.source_stock_check_platform is
  'cssbuy | vipomall | pandamall | cssbuy+vipomall+pandamall';
comment on column public.messaging_partner_inventory.admin_source_batch_scanned_at is
  'TTL batch admin (không ghi khi error/blocked).';

create index if not exists messaging_partner_inventory_source_stock_due_idx
  on public.messaging_partner_inventory (partner_id, source_stock_next_check_at)
  where is_active = true;

create index if not exists messaging_partner_inventory_source_stock_status_idx
  on public.messaging_partner_inventory (partner_id, source_stock_status);

create table if not exists public.messaging_partner_source_stock_worker_state (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  paused boolean not null default false,
  updated_at timestamptz,
  checking_inventory_id uuid,
  checking_started_at timestamptz,
  last_done_inventory_id uuid,
  last_done_finished_at timestamptz,
  last_done_source_stock_status text,
  last_products_commit_ok boolean,
  last_products_commit_at timestamptz,
  last_products_commit_detail text
);

comment on table public.messaging_partner_source_stock_worker_state is
  'Cờ pause + tiến trình worker kiểm tra nguồn theo workspace.';
