-- Sale parity 188 for every Partner Website tenant.
-- Additive only: old orders/promotions remain readable.

create table if not exists public.messaging_partner_sale_calendar_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default true,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  teaser_days int not null default 3 check (teaser_days between 0 and 14),
  odd_month_discount_percent numeric(5,2) not null default 6
    check (odd_month_discount_percent between 0 and 100),
  even_month_discount_percent numeric(5,2) not null default 8
    check (even_month_discount_percent between 0 and 100),
  clearance_enabled boolean not null default true,
  clearance_discount_percent numeric(5,2) not null default 20
    check (clearance_discount_percent between 0 and 100),
  manual_sale_date date,
  manual_discount_percent numeric(5,2)
    check (manual_discount_percent is null or manual_discount_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.messaging_partner_sale_calendar_month_rules (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  month_no smallint not null check (month_no between 1 and 12),
  enabled boolean not null default true,
  discount_percent numeric(5,2)
    check (discount_percent is null or discount_percent between 0 and 100),
  primary key (partner_id, month_no)
);

insert into public.messaging_partner_sale_calendar_settings (partner_id)
select id from public.messaging_partners
on conflict (partner_id) do nothing;

insert into public.messaging_partner_birthday_promo (
  partner_id, enabled, discount_percent, offer_days_before_max, offer_days_before_min
)
select id, true, 10, 7, 1
from public.messaging_partners
on conflict (partner_id) do nothing;

insert into public.messaging_partner_sale_calendar_month_rules (partner_id, month_no)
select p.id, m.month_no
from public.messaging_partners p
cross join generate_series(1, 12) as m(month_no)
on conflict (partner_id, month_no) do nothing;

alter table public.messaging_partner_inventory
  add column if not exists is_clearance boolean not null default false;

create index if not exists idx_messaging_partner_inventory_clearance
  on public.messaging_partner_inventory (partner_id, is_clearance)
  where is_clearance = true;

alter table public.messaging_partner_promotions
  add column if not exists exclude_sale_items boolean not null default true,
  add column if not exists trigger_idle_hours int,
  add column if not exists trigger_inactive_days int,
  add column if not exists trigger_cooldown_days int;

alter table public.messaging_partner_promotions
  drop constraint if exists messaging_partner_promotions_trigger_idle_hours_check;
alter table public.messaging_partner_promotions
  add constraint messaging_partner_promotions_trigger_idle_hours_check
  check (trigger_idle_hours is null or trigger_idle_hours between 1 and 8760);

alter table public.messaging_partner_promotions
  drop constraint if exists messaging_partner_promotions_trigger_inactive_days_check;
alter table public.messaging_partner_promotions
  add constraint messaging_partner_promotions_trigger_inactive_days_check
  check (trigger_inactive_days is null or trigger_inactive_days between 1 and 3650);

alter table public.messaging_partner_promotions
  drop constraint if exists messaging_partner_promotions_trigger_cooldown_days_check;
alter table public.messaging_partner_promotions
  add constraint messaging_partner_promotions_trigger_cooldown_days_check
  check (trigger_cooldown_days is null or trigger_cooldown_days between 1 and 3650);

insert into public.messaging_partner_promotions (
  partner_id, code, name, name_i18n, description, description_i18n,
  discount_type, discount_percent, max_discount_amount, first_order_only,
  per_user_limit, is_active, is_public_redeemable, auto_grant_trigger,
  auto_grant_valid_days, exclude_sale_items, trigger_idle_hours,
  trigger_inactive_days, trigger_cooldown_days
)
select
  p.id,
  v.code,
  v.name_vi,
  jsonb_build_object(
    'vi', v.name_vi, 'en', v.name_en, 'zh', v.name_zh,
    'ja', v.name_ja, 'ko', v.name_ko
  ),
  v.description_vi,
  jsonb_build_object(
    'vi', v.description_vi, 'en', v.description_en, 'zh', v.description_zh,
    'ja', v.description_ja, 'ko', v.description_ko
  ),
  'percent',
  v.discount_percent,
  v.max_discount_amount,
  v.first_order_only,
  1,
  true,
  false,
  v.trigger_name,
  v.valid_days,
  true,
  v.idle_hours,
  v.inactive_days,
  v.cooldown_days
from public.messaging_partners p
cross join (
  values
    ('WELCOME10', 'Chào mừng thành viên mới', 'New member welcome', '新会员欢迎礼', '新規会員ウェルカム', '신규 회원 환영',
     'Ưu đãi cho đơn hàng đầu tiên.', 'Welcome discount for your first order.', '首单欢迎优惠。', '初回注文ウェルカム割引。', '첫 주문 환영 할인.',
     10::numeric, 200000::numeric, true, 'signup', 7, null::int, null::int, null::int),
    ('THANKYOU5', 'Cảm ơn đơn hàng đầu tiên', 'First order thank-you', '首单感谢礼', '初回注文ありがとう', '첫 주문 감사',
     'Ưu đãi sau khi đơn đầu tiên giao thành công.', 'Reward after your first delivered order.', '首单送达后的感谢优惠。', '初回注文の配送完了特典。', '첫 주문 배송 완료 혜택.',
     5::numeric, 100000::numeric, false, 'first_order_delivered', 14, null::int, null::int, null::int),
    ('COMEBACK10', 'Nhớ bạn quay lại', 'Welcome back', '欢迎回来', 'おかえりなさい', '다시 오신 것을 환영합니다',
     'Ưu đãi dành cho khách lâu ngày chưa mua.', 'A reward for returning customers.', '老客户回归优惠。', 'お久しぶりのお客様向け特典。', '오랜만에 돌아온 고객 혜택.',
     10::numeric, 100000::numeric, false, 'comeback', 5, null::int, 30, 30),
    ('CARTSAVE5', 'Hoàn tất giỏ hàng', 'Complete your cart', '完成购物车', 'カートを完了', '장바구니 완료',
     'Ưu đãi nhắc hoàn tất giỏ hàng.', 'A reminder reward to complete your cart.', '完成购物车提醒优惠。', 'カート完了リマインド特典。', '장바구니 완료 알림 혜택.',
     5::numeric, 80000::numeric, false, 'cart_abandon', 3, 24, null::int, 7)
) as v(
  code, name_vi, name_en, name_zh, name_ja, name_ko,
  description_vi, description_en, description_zh, description_ja, description_ko,
  discount_percent, max_discount_amount, first_order_only, trigger_name,
  valid_days, idle_hours, inactive_days, cooldown_days
)
where not exists (
  select 1
  from public.messaging_partner_promotions existing
  where existing.partner_id = p.id
    and existing.auto_grant_trigger = v.trigger_name
);

create table if not exists public.messaging_partner_promotion_claims (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  promotion_id uuid references public.messaging_partner_promotions (id) on delete cascade,
  identity_key text not null,
  trigger text not null check (
    trigger in ('signup', 'first_order_delivered', 'comeback', 'cart_abandon', 'birthday_email')
  ),
  cycle_key text not null,
  status text not null default 'claimed' check (status in ('claimed', 'completed', 'failed')),
  detail jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (partner_id, identity_key, trigger, cycle_key)
);

create index if not exists idx_partner_promotion_claims_partner_claimed
  on public.messaging_partner_promotion_claims (partner_id, claimed_at desc);

alter table public.messaging_partner_orders
  add column if not exists discount_breakdown_json jsonb not null default '{}'::jsonb,
  add column if not exists list_subtotal_amount numeric(14,2) not null default 0,
  add column if not exists site_sale_discount_amount numeric(14,2) not null default 0,
  add column if not exists google_discount_amount numeric(14,2) not null default 0,
  add column if not exists birthday_discount_amount numeric(14,2) not null default 0,
  add column if not exists loyalty_discount_amount numeric(14,2) not null default 0,
  add column if not exists discount_cap_adjustment_amount numeric(14,2) not null default 0,
  add column if not exists clearance_subtotal_amount numeric(14,2) not null default 0;

create table if not exists public.messaging_partner_google_discount_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default false,
  issuer text not null default '',
  audience text not null default '',
  public_key_pem text not null default '',
  lock_hours int not null default 48 check (lock_hours between 1 and 168),
  minimum_price_percent numeric(5,2) not null default 85
    check (minimum_price_percent between 1 and 100),
  updated_at timestamptz not null default now()
);

insert into public.messaging_partner_google_discount_settings (partner_id, enabled)
select id, false from public.messaging_partners
on conflict (partner_id) do nothing;

create table if not exists public.messaging_partner_google_discount_locks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  account_key text not null,
  inventory_id uuid not null references public.messaging_partner_inventory (id) on delete cascade,
  offer_id text not null,
  locked_unit_price numeric(14,2) not null check (locked_unit_price >= 0),
  token_fingerprint text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (partner_id, account_key, inventory_id, offer_id)
);

create index if not exists idx_partner_google_discount_locks_active
  on public.messaging_partner_google_discount_locks (partner_id, account_key, expires_at);

create table if not exists public.messaging_partner_affiliate_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default true,
  commission_percent numeric(5,2) not null default 5
    check (commission_percent between 0 and 100),
  attribution_days int not null default 30 check (attribution_days between 1 and 365),
  minimum_payout_amount numeric(14,2) not null default 0
    check (minimum_payout_amount >= 0),
  updated_at timestamptz not null default now()
);

insert into public.messaging_partner_affiliate_settings (partner_id)
select id from public.messaging_partners
on conflict (partner_id) do nothing;

create table if not exists public.messaging_partner_affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  guest_account_id uuid references public.messaging_guest_accounts (id) on delete cascade,
  linked_user_id uuid references auth.users (id) on delete cascade,
  email_normalized text,
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint messaging_partner_affiliate_profiles_identity
    check (guest_account_id is not null or linked_user_id is not null or email_normalized is not null),
  unique (partner_id, referral_code)
);

create unique index if not exists uq_partner_affiliate_profiles_guest
  on public.messaging_partner_affiliate_profiles (partner_id, guest_account_id)
  where guest_account_id is not null;
create unique index if not exists uq_partner_affiliate_profiles_user
  on public.messaging_partner_affiliate_profiles (partner_id, linked_user_id)
  where linked_user_id is not null;

create table if not exists public.messaging_partner_affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  account_key text not null,
  affiliate_profile_id uuid not null references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  attributed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (partner_id, account_key)
);

create table if not exists public.messaging_partner_affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  affiliate_profile_id uuid not null references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  base_amount numeric(14,2) not null default 0,
  commission_percent numeric(5,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'reversed', 'paid')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reversed_at timestamptz,
  unique (partner_id, order_id)
);

create index if not exists idx_partner_affiliate_commissions_profile
  on public.messaging_partner_affiliate_commissions
  (partner_id, affiliate_profile_id, status, created_at desc);

create table if not exists public.messaging_partner_sale_audit_log (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  event_type text not null,
  actor_key text,
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_sale_audit_partner_created
  on public.messaging_partner_sale_audit_log (partner_id, created_at desc);

alter table public.messaging_partner_sale_calendar_settings enable row level security;
alter table public.messaging_partner_sale_calendar_month_rules enable row level security;
alter table public.messaging_partner_promotion_claims enable row level security;
alter table public.messaging_partner_google_discount_settings enable row level security;
alter table public.messaging_partner_google_discount_locks enable row level security;
alter table public.messaging_partner_affiliate_settings enable row level security;
alter table public.messaging_partner_affiliate_profiles enable row level security;
alter table public.messaging_partner_affiliate_attributions enable row level security;
alter table public.messaging_partner_affiliate_commissions enable row level security;
alter table public.messaging_partner_sale_audit_log enable row level security;

drop policy if exists "Partner sale settings owners manage." on public.messaging_partner_sale_calendar_settings;
create policy "Partner sale settings owners manage."
  on public.messaging_partner_sale_calendar_settings for all
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

drop policy if exists "Partner sale month owners manage." on public.messaging_partner_sale_calendar_month_rules;
create policy "Partner sale month owners manage."
  on public.messaging_partner_sale_calendar_month_rules for all
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

-- Remaining tables are server-managed. Owners may read their own operational data.
drop policy if exists "Partner sale operational owners read." on public.messaging_partner_promotion_claims;
create policy "Partner sale operational owners read."
  on public.messaging_partner_promotion_claims for select
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

drop policy if exists "Partner Google settings owners manage." on public.messaging_partner_google_discount_settings;
create policy "Partner Google settings owners manage."
  on public.messaging_partner_google_discount_settings for all
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

drop policy if exists "Partner affiliate settings owners manage." on public.messaging_partner_affiliate_settings;
create policy "Partner affiliate settings owners manage."
  on public.messaging_partner_affiliate_settings for all
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

drop policy if exists "Partner affiliate profiles owners read." on public.messaging_partner_affiliate_profiles;
create policy "Partner affiliate profiles owners read."
  on public.messaging_partner_affiliate_profiles for select
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

drop policy if exists "Partner affiliate commissions owners read." on public.messaging_partner_affiliate_commissions;
create policy "Partner affiliate commissions owners read."
  on public.messaging_partner_affiliate_commissions for select
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));

drop policy if exists "Partner sale audit owners read." on public.messaging_partner_sale_audit_log;
create policy "Partner sale audit owners read."
  on public.messaging_partner_sale_audit_log for select
  using (exists (
    select 1 from public.messaging_partners p
    where p.id = partner_id and p.owner_user_id = auth.uid()
  ));
