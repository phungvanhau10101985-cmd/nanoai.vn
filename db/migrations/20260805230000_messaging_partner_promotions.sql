-- W1.4 + M2.2 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): khuyến mãi / voucher / ví quà.
-- Xem docs/188_BEHAVIOR_SPEC.md mục D — vượt qua hạn chế của 188 (chỉ giảm %, không có endpoint tự
-- nhập mã, field stacking "nói dối" hành vi thật). Additive-only: không đổi schema orders hiện có,
-- chỉ thêm cột mới cho lớp giảm giá promo (tách biệt hoàn toàn khỏi loyalty/birthday đã có).

create table if not exists public.messaging_partner_promotions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  code text not null,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  description text not null default '',
  description_i18n jsonb not null default '{}'::jsonb,
  discount_type text not null,
  discount_percent numeric(5, 2),
  discount_amount numeric(14, 2),
  max_discount_amount numeric(14, 2),
  min_subtotal numeric(14, 2) not null default 0,
  first_order_only boolean not null default false,
  category_id uuid references public.messaging_partner_categories (id) on delete set null,
  inventory_id uuid references public.messaging_partner_inventory (id) on delete set null,
  usage_limit int,
  per_user_limit int not null default 1,
  used_count int not null default 0,
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean not null default true,
  is_public_redeemable boolean not null default true,
  auto_grant_trigger text,
  auto_grant_valid_days int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_promotions_code_format check (code ~ '^[A-Z0-9_-]{3,40}$'),
  constraint messaging_partner_promotions_name_len check (char_length(name) >= 1 and char_length(name) <= 200),
  constraint messaging_partner_promotions_discount_type check (discount_type in ('percent', 'fixed_amount')),
  constraint messaging_partner_promotions_discount_fields check (
    (discount_type = 'percent' and discount_percent is not null and discount_percent > 0
      and discount_percent <= 100 and discount_amount is null)
    or
    (discount_type = 'fixed_amount' and discount_amount is not null and discount_amount >= 0
      and discount_percent is null)
  ),
  constraint messaging_partner_promotions_max_discount_nonneg check (max_discount_amount is null or max_discount_amount >= 0),
  constraint messaging_partner_promotions_min_subtotal_nonneg check (min_subtotal >= 0),
  constraint messaging_partner_promotions_usage_limit_pos check (usage_limit is null or usage_limit > 0),
  constraint messaging_partner_promotions_per_user_limit_pos check (per_user_limit > 0),
  constraint messaging_partner_promotions_used_count_nonneg check (used_count >= 0),
  constraint messaging_partner_promotions_valid_window check (valid_from is null or valid_to is null or valid_from <= valid_to),
  constraint messaging_partner_promotions_auto_grant_trigger check (
    auto_grant_trigger is null
    or auto_grant_trigger in ('signup', 'first_order_delivered', 'comeback', 'cart_abandon')
  )
);

comment on table public.messaging_partner_promotions is
  'Khuyến mãi/voucher theo shop (W1.4). Khác 188: hỗ trợ cả giảm % và giảm số tiền cố định, cho phép
   tự nhập mã redeem công khai (is_public_redeemable), target theo category/sản phẩm cụ thể.';
comment on column public.messaging_partner_promotions.is_public_redeemable is
  'true = khách tự nhập mã ở giỏ hàng dùng được ngay (không cần được cấp trong ví). false = chỉ dùng
   được khi có 1 grant active trong messaging_partner_promotion_grants (auto-grant hoặc admin tặng).';
comment on column public.messaging_partner_promotions.auto_grant_trigger is
  'Nếu đặt: hệ thống tự cấp voucher này vào ví khách khi trigger xảy ra (đăng ký/đơn đầu giao thành
   công/khách cũ quay lại/bỏ giỏ hàng). Tổng quát hoá từ hardcode của 188 — merchant tự cấu hình.';

create unique index if not exists uq_messaging_partner_promotions_partner_code
  on public.messaging_partner_promotions (partner_id, code);

create index if not exists idx_messaging_partner_promotions_partner_active
  on public.messaging_partner_promotions (partner_id, is_active);

create index if not exists idx_messaging_partner_promotions_auto_grant
  on public.messaging_partner_promotions (partner_id, auto_grant_trigger)
  where auto_grant_trigger is not null and is_active = true;

create or replace function public.trg_messaging_partner_promotions_targets_same_partner()
returns trigger
language plpgsql
as $$
declare
  cat_partner uuid;
  inv_partner uuid;
begin
  if new.category_id is not null then
    select partner_id into cat_partner from public.messaging_partner_categories where id = new.category_id;
    if cat_partner is null or cat_partner <> new.partner_id then
      raise exception 'category_id phải cùng partner_id với voucher';
    end if;
  end if;
  if new.inventory_id is not null then
    select partner_id into inv_partner from public.messaging_partner_inventory where id = new.inventory_id;
    if inv_partner is null or inv_partner <> new.partner_id then
      raise exception 'inventory_id phải cùng partner_id với voucher';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_promotions_targets_same_partner on public.messaging_partner_promotions;
create trigger tr_messaging_partner_promotions_targets_same_partner
  before insert or update of category_id, inventory_id, partner_id on public.messaging_partner_promotions
  for each row
  execute function public.trg_messaging_partner_promotions_targets_same_partner();

create or replace function public.trg_messaging_partner_promotions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_promotions_set_updated_at on public.messaging_partner_promotions;
create trigger tr_messaging_partner_promotions_set_updated_at
  before update on public.messaging_partner_promotions
  for each row
  execute function public.trg_messaging_partner_promotions_set_updated_at();

alter table public.messaging_partner_promotions enable row level security;

drop policy if exists "Partner promotion owners manage own promotions." on public.messaging_partner_promotions;
create policy "Partner promotion owners manage own promotions." on public.messaging_partner_promotions
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_promotions.partner_id and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_promotions.partner_id and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Active public promotions are readable." on public.messaging_partner_promotions;
create policy "Active public promotions are readable." on public.messaging_partner_promotions
  for select using (is_active = true);

-- Ví quà: voucher đã cấp cho 1 khách cụ thể (auto-grant theo trigger hoặc admin tặng tay).
create table if not exists public.messaging_partner_promotion_grants (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  promotion_id uuid not null references public.messaging_partner_promotions (id) on delete cascade,
  guest_account_id uuid references public.messaging_guest_accounts (id) on delete cascade,
  linked_user_id uuid references auth.users (id) on delete cascade,
  source text not null,
  status text not null default 'active',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_order_id uuid references public.messaging_partner_orders (id) on delete set null,
  constraint messaging_partner_promotion_grants_identity check (guest_account_id is not null or linked_user_id is not null),
  constraint messaging_partner_promotion_grants_source check (
    source in ('signup', 'first_order_delivered', 'comeback', 'cart_abandon', 'admin_gift', 'public_redeem')
  ),
  constraint messaging_partner_promotion_grants_status check (status in ('active', 'used', 'expired'))
);

comment on table public.messaging_partner_promotion_grants is
  'Ví quà — 1 dòng = 1 voucher đã cấp cho 1 khách. W5.4 (PromotionWalletPanel) đọc bảng này để hiển thị.';

create index if not exists idx_messaging_partner_promotion_grants_guest
  on public.messaging_partner_promotion_grants (partner_id, guest_account_id, status)
  where guest_account_id is not null;

create index if not exists idx_messaging_partner_promotion_grants_user
  on public.messaging_partner_promotion_grants (partner_id, linked_user_id, status)
  where linked_user_id is not null;

create index if not exists idx_messaging_partner_promotion_grants_promotion
  on public.messaging_partner_promotion_grants (promotion_id);

alter table public.messaging_partner_promotion_grants enable row level security;

drop policy if exists "Partner grant owners manage own grants." on public.messaging_partner_promotion_grants;
create policy "Partner grant owners manage own grants." on public.messaging_partner_promotion_grants
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_promotion_grants.partner_id and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_promotion_grants.partner_id and p.owner_user_id = auth.uid()
    )
  );

-- Ghi nhận sử dụng thật (báo cáo hiệu quả voucher, S0.8) — 1 đơn chỉ áp 1 voucher (giữ đơn giản,
-- không multi-stack voucher, giống nguyên tắc D.1 của 188).
create table if not exists public.messaging_partner_promotion_usages (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  promotion_id uuid not null references public.messaging_partner_promotions (id) on delete cascade,
  grant_id uuid references public.messaging_partner_promotion_grants (id) on delete set null,
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  guest_account_id uuid references public.messaging_guest_accounts (id) on delete set null,
  linked_user_id uuid references auth.users (id) on delete set null,
  discount_amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint messaging_partner_promotion_usages_discount_nonneg check (discount_amount >= 0)
);

create unique index if not exists uq_messaging_partner_promotion_usages_order
  on public.messaging_partner_promotion_usages (order_id);

create index if not exists idx_messaging_partner_promotion_usages_promotion
  on public.messaging_partner_promotion_usages (promotion_id);

create index if not exists idx_messaging_partner_promotion_usages_identity
  on public.messaging_partner_promotion_usages (partner_id, promotion_id, guest_account_id, linked_user_id);

alter table public.messaging_partner_promotion_usages enable row level security;

drop policy if exists "Partner usage owners manage own usages." on public.messaging_partner_promotion_usages;
create policy "Partner usage owners manage own usages." on public.messaging_partner_promotion_usages
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_promotion_usages.partner_id and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_promotion_usages.partner_id and p.owner_user_id = auth.uid()
    )
  );

-- Đơn hàng: lớp giảm giá promo TÁCH BIỆT hoàn toàn khỏi loyalty/birthday hiện có (total_discount_*
-- giữ nguyên ý nghĩa cũ = loyalty+birthday, KHÔNG đổi để tránh vỡ báo cáo/hiển thị hiện có).
alter table public.messaging_partner_orders
  add column if not exists promo_id uuid references public.messaging_partner_promotions (id) on delete set null,
  add column if not exists promo_code text not null default '',
  add column if not exists promo_discount_amount numeric(14, 2) not null default 0;

comment on column public.messaging_partner_orders.promo_discount_amount is
  'Số tiền giảm từ voucher (W1.4), áp dụng SAU loyalty/birthday. amount_after_discount đã trừ luôn khoản này.';
