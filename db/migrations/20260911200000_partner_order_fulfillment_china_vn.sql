-- Đơn khách VN vs TQ (1688/Taobao/Tmall) + lịch trình giao — parity 188.
-- Additive: không xóa đơn/tồn kho đã có.

alter table public.messaging_partner_orders
  add column if not exists fulfillment_source text not null default 'vietnam',
  add column if not exists fulfillment_needs_review boolean not null default false,
  add column if not exists source_platform text,
  add column if not exists checkout_group_id uuid,
  add column if not exists split_index int not null default 1,
  add column if not exists staff_consultation_contacted boolean not null default false,
  add column if not exists deposit_exception boolean not null default false,
  add column if not exists deposit_exception_note text not null default '',
  add column if not exists stock_hold_expires_at timestamptz,
  add column if not exists stock_hold_released_at timestamptz,
  add column if not exists deposit_hold_overdue boolean not null default false,
  add column if not exists deposit_reminded_at_2h timestamptz,
  add column if not exists deposit_reminded_at_20h timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messaging_partner_orders_fulfillment_source_check'
  ) then
    alter table public.messaging_partner_orders
      add constraint messaging_partner_orders_fulfillment_source_check
      check (fulfillment_source in ('vietnam', 'china'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'messaging_partner_orders_source_platform_check'
  ) then
    alter table public.messaging_partner_orders
      add constraint messaging_partner_orders_source_platform_check
      check (source_platform is null or source_platform in ('1688', 'taobao', 'tmall'));
  end if;
end $$;

comment on column public.messaging_partner_orders.fulfillment_source is
  'Tuyến xử lý snapshot lúc checkout: vietnam (kho VN) hoặc china (1688/Taobao/Tmall).';
comment on column public.messaging_partner_orders.checkout_group_id is
  'Các đơn tách từ cùng một giỏ mix VN+TQ.';

create index if not exists idx_mp_orders_fulfillment_source
  on public.messaging_partner_orders (partner_id, fulfillment_source);
create index if not exists idx_mp_orders_checkout_group
  on public.messaging_partner_orders (partner_id, checkout_group_id)
  where checkout_group_id is not null;
create index if not exists idx_mp_orders_needs_review
  on public.messaging_partner_orders (partner_id, fulfillment_needs_review)
  where fulfillment_needs_review = true;

alter table public.messaging_partner_order_lines
  add column if not exists fulfillment_source text not null default 'vietnam',
  add column if not exists source_platform text,
  add column if not exists source_url text not null default '',
  add column if not exists product_sku_snapshot text not null default '',
  add column if not exists is_warehouse_item boolean not null default false,
  add column if not exists warehouse_stock_reserved_at timestamptz,
  add column if not exists warehouse_stock_deducted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messaging_partner_order_lines_fulfillment_source_check'
  ) then
    alter table public.messaging_partner_order_lines
      add constraint messaging_partner_order_lines_fulfillment_source_check
      check (fulfillment_source in ('vietnam', 'china'));
  end if;
end $$;

create table if not exists public.messaging_partner_order_shipment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  step_key text not null,
  title text not null default '',
  sort_order int not null default 0,
  status text not null default 'pending',
  scheduled_at timestamptz,
  completed_at timestamptz,
  note text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, step_key)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messaging_partner_order_shipment_events_status_check'
  ) then
    alter table public.messaging_partner_order_shipment_events
      add constraint messaging_partner_order_shipment_events_status_check
      check (status in ('pending', 'active', 'completed', 'skipped'));
  end if;
end $$;

create index if not exists idx_mp_order_shipment_events_order
  on public.messaging_partner_order_shipment_events (order_id, sort_order, created_at);

comment on table public.messaging_partner_order_shipment_events is
  'Lịch trình giao: TQ 7 bước (dừng cửa khẩu) hoặc VN 4 bước thủ công.';

-- Backfill: host 1688/taobao/tmall trên URL dòng/đơn = china. Không đoán TQ khi mất URL.
update public.messaging_partner_order_lines l
set
  source_url = case when coalesce(nullif(trim(l.source_url), ''), '') = '' then coalesce(l.product_url, '') else l.source_url end,
  source_platform = case
    when coalesce(l.source_platform, '') <> '' then l.source_platform
    when lower(coalesce(l.product_url, '')) ~* '(^|://|\\.)1688\\.com([/:?]|$)' then '1688'
    when lower(coalesce(l.product_url, '')) ~* '(^|://|\\.)taobao\\.com([/:?]|$)' then 'taobao'
    when lower(coalesce(l.product_url, '')) ~* '(^|://|\\.)tmall\\.com([/:?]|$)' then 'tmall'
    else null
  end,
  fulfillment_source = case
    when lower(coalesce(l.product_url, '')) ~* '(^|://|\\.)(1688|taobao|tmall)\\.com([/:?]|$)' then 'china'
    else coalesce(nullif(l.fulfillment_source, ''), 'vietnam')
  end
where l.fulfillment_source is distinct from 'china'
   or l.source_platform is null;

update public.messaging_partner_orders o
set
  fulfillment_source = coalesce((
    select case
      when bool_or(l.fulfillment_source = 'china') and bool_or(l.fulfillment_source = 'vietnam') then 'china'
      when bool_or(l.fulfillment_source = 'china') then 'china'
      else 'vietnam'
    end
    from public.messaging_partner_order_lines l
    where l.order_id = o.id
  ), case
    when lower(coalesce(o.product_url, '')) ~* '(^|://|\\.)(1688|taobao|tmall)\\.com([/:?]|$)' then 'china'
    else 'vietnam'
  end),
  source_platform = coalesce(o.source_platform, (
    select l.source_platform
    from public.messaging_partner_order_lines l
    where l.order_id = o.id and l.source_platform is not null
    order by l.sort_order asc
    limit 1
  ), case
    when lower(coalesce(o.product_url, '')) ~* '(^|://|\\.)1688\\.com([/:?]|$)' then '1688'
    when lower(coalesce(o.product_url, '')) ~* '(^|://|\\.)taobao\\.com([/:?]|$)' then 'taobao'
    when lower(coalesce(o.product_url, '')) ~* '(^|://|\\.)tmall\\.com([/:?]|$)' then 'tmall'
    else null
  end),
  fulfillment_needs_review = coalesce((
    select bool_or(trim(coalesce(l.product_url, '')) = '')
    from public.messaging_partner_order_lines l
    where l.order_id = o.id
  ), trim(coalesce(o.product_url, '')) = '');
