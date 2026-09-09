-- Quản lý vận chuyển EMS / COD theo từng workspace shop (parity admin 188).
-- Additive: không đụng đơn/tồn kho đã có.

alter table public.messaging_partner_orders
  add column if not exists tracking_number text not null default '',
  add column if not exists shipping_provider text not null default '';

comment on column public.messaging_partner_orders.tracking_number is
  'Mã vận đơn EMS/hãng (vd. EE123456789VN) — ghi khi import file gửi EMS hoặc nhập tay.';
comment on column public.messaging_partner_orders.shipping_provider is
  'Nhãn hãng vận chuyển đã gắn đơn (vd. EMS).';

create table if not exists public.messaging_partner_ems_shipping_records (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  reference_code text not null,
  product_code text,
  recipient_label text,
  order_code text,
  order_id uuid references public.messaging_partner_orders (id) on delete set null,
  excel_row_number int,
  order_status text,
  shop_return_received_at timestamptz,
  current_step_key text,
  tracking_number_saved text,
  ems_tracking_code text,
  ems_reference_code text,
  ems_status text,
  ems_phase text,
  sync_status text not null default 'pending',
  sync_message text,
  ems_error text,
  cod_amount numeric(15, 0),
  cod_paid_amount numeric(15, 0),
  cod_paid_date date,
  cod_settlement_status text,
  cod_settlement_message text,
  freight_amount numeric(15, 0),
  freight_settled_at timestamptz,
  freight_settlement_status text,
  freight_settlement_message text,
  freight_high_fee_warning text,
  import_source_filename text,
  imported_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, reference_code)
);

create index if not exists idx_mp_ems_records_partner_updated
  on public.messaging_partner_ems_shipping_records (partner_id, updated_at desc);
create index if not exists idx_mp_ems_records_partner_sync
  on public.messaging_partner_ems_shipping_records (partner_id, sync_status);
create index if not exists idx_mp_ems_records_partner_order
  on public.messaging_partner_ems_shipping_records (partner_id, order_code);
create index if not exists idx_mp_ems_records_partner_tracking
  on public.messaging_partner_ems_shipping_records (partner_id, ems_tracking_code);
create index if not exists idx_mp_ems_records_partner_order_id
  on public.messaging_partner_ems_shipping_records (partner_id, order_id);
create index if not exists idx_mp_ems_records_shop_return
  on public.messaging_partner_ems_shipping_records (partner_id, shop_return_received_at);

create table if not exists public.messaging_partner_ems_import_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  source_filename text,
  imported_by_user_id uuid,
  file_rows_processed int not null default 0,
  order_count int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_no_reference_count int not null default 0,
  orders_synced_count int not null default 0,
  total_cod_amount numeric(15, 0) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_import_batches_partner
  on public.messaging_partner_ems_import_batches (partner_id, created_at desc);

create table if not exists public.messaging_partner_ems_import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.messaging_partner_ems_import_batches (id) on delete cascade,
  ems_shipping_record_id uuid references public.messaging_partner_ems_shipping_records (id) on delete set null,
  excel_row_number int,
  reference_code text,
  recipient_label text,
  order_code text,
  order_id uuid,
  cod_amount numeric(15, 0),
  import_action text,
  sync_status text,
  sync_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_import_batch_rows_batch
  on public.messaging_partner_ems_import_batch_rows (batch_id);

create table if not exists public.messaging_partner_ems_cod_settlement_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  payment_date date not null,
  source_filename text,
  imported_by_user_id uuid,
  total_rows int not null default 0,
  matched_count int not null default 0,
  amount_mismatch_count int not null default 0,
  record_not_found_count int not null default 0,
  parse_error_count int not null default 0,
  total_paid_amount numeric(15, 0) not null default 0,
  total_db_cod_amount numeric(15, 0) not null default 0,
  total_amount_difference numeric(15, 0) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_cod_batches_partner
  on public.messaging_partner_ems_cod_settlement_batches (partner_id, created_at desc);

create table if not exists public.messaging_partner_ems_cod_settlement_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.messaging_partner_ems_cod_settlement_batches (id) on delete cascade,
  excel_row_number int,
  ems_reference_code text,
  ems_tracking_code text,
  paid_amount numeric(15, 0),
  ems_shipping_record_id uuid references public.messaging_partner_ems_shipping_records (id) on delete set null,
  db_cod_amount numeric(15, 0),
  amount_difference numeric(15, 0),
  reconcile_status text not null default 'pending',
  reconcile_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_cod_rows_batch
  on public.messaging_partner_ems_cod_settlement_rows (batch_id);

create table if not exists public.messaging_partner_ems_freight_settlement_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  settlement_date date,
  source_filename text,
  imported_by_user_id uuid,
  total_rows int not null default 0,
  settled_count int not null default 0,
  record_not_found_count int not null default 0,
  already_settled_count int not null default 0,
  parse_error_count int not null default 0,
  high_fee_warning_count int not null default 0,
  total_freight_amount numeric(15, 0) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_freight_batches_partner
  on public.messaging_partner_ems_freight_settlement_batches (partner_id, created_at desc);

create table if not exists public.messaging_partner_ems_freight_settlement_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.messaging_partner_ems_freight_settlement_batches (id) on delete cascade,
  excel_row_number int,
  ems_tracking_code text,
  freight_amount numeric(15, 0),
  ems_shipping_record_id uuid references public.messaging_partner_ems_shipping_records (id) on delete set null,
  high_fee_warning text,
  reconcile_status text not null default 'pending',
  reconcile_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_freight_rows_batch
  on public.messaging_partner_ems_freight_settlement_rows (batch_id);

create table if not exists public.messaging_partner_ems_tracking_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  status text not null default 'queued',
  source text not null default 'manual',
  message text not null default '',
  record_ids uuid[] not null default '{}',
  processed int not null default 0,
  ok_count int not null default 0,
  total int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mp_ems_tracking_jobs_partner
  on public.messaging_partner_ems_tracking_jobs (partner_id, created_at desc);
