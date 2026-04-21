-- Hospitality CRM domain (hotel/guesthouse) isolated from fashion inventory.

create table if not exists public.hospitality_room_types (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  max_guests int not null default 2 check (max_guests > 0 and max_guests <= 50),
  base_hourly_rate numeric(12,2) null check (base_hourly_rate is null or base_hourly_rate >= 0),
  base_daily_rate numeric(12,2) null check (base_daily_rate is null or base_daily_rate >= 0),
  currency text not null default 'VND',
  amenities jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, code)
);

create table if not exists public.hospitality_rooms (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  room_type_id uuid not null references public.hospitality_room_types (id) on delete cascade,
  room_code text not null,
  floor_label text null,
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, room_code)
);

create table if not exists public.hospitality_room_images (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.hospitality_room_types (id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hospitality_rate_plans (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  name text not null,
  billing_mode text not null default 'mixed' check (billing_mode in ('hourly', 'daily', 'overnight', 'mixed')),
  is_default boolean not null default false,
  policy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_rate_rules (
  id uuid primary key default gen_random_uuid(),
  rate_plan_id uuid not null references public.hospitality_rate_plans (id) on delete cascade,
  room_type_id uuid not null references public.hospitality_room_types (id) on delete cascade,
  day_of_week smallint null check (day_of_week between 0 and 6),
  start_time time null,
  end_time time null,
  min_hours numeric(8,2) null check (min_hours is null or min_hours > 0),
  min_nights int null check (min_nights is null or min_nights > 0),
  hourly_rate numeric(12,2) null check (hourly_rate is null or hourly_rate >= 0),
  daily_rate numeric(12,2) null check (daily_rate is null or daily_rate >= 0),
  effective_from date null,
  effective_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_holds (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  room_type_id uuid not null references public.hospitality_room_types (id) on delete cascade,
  conversation_id uuid null references public.customer_care_conversations (id) on delete set null,
  customer_name text null,
  customer_phone text null,
  guests int not null default 1 check (guests > 0 and guests <= 50),
  checkin_at timestamptz not null,
  checkout_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'converted', 'cancelled')),
  expires_at timestamptz not null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hospitality_holds_time_chk check (checkout_at > checkin_at)
);

create table if not exists public.hospitality_bookings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  room_type_id uuid not null references public.hospitality_room_types (id) on delete restrict,
  room_id uuid null references public.hospitality_rooms (id) on delete set null,
  hold_id uuid null references public.hospitality_holds (id) on delete set null,
  conversation_id uuid null references public.customer_care_conversations (id) on delete set null,
  channel text not null default 'widget' check (channel in ('widget', 'facebook', 'zalo', 'whatsapp', 'manual', 'pms')),
  customer_name text not null,
  customer_phone text null,
  customer_email text null,
  guests int not null default 1 check (guests > 0 and guests <= 50),
  checkin_at timestamptz not null,
  checkout_at timestamptz not null,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  currency text not null default 'VND',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hospitality_bookings_time_chk check (checkout_at > checkin_at)
);

create table if not exists public.hospitality_payments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  booking_id uuid not null references public.hospitality_bookings (id) on delete cascade,
  provider text not null,
  provider_txn_id text null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'VND',
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz null,
  raw_payload jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.hospitality_availability_slots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  room_id uuid not null references public.hospitality_rooms (id) on delete cascade,
  hold_id uuid null references public.hospitality_holds (id) on delete set null,
  booking_id uuid null references public.hospitality_bookings (id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('held', 'booked', 'maintenance')),
  source text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hospitality_availability_slots_time_chk check (end_at > start_at)
);

create table if not exists public.hospitality_guest_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  phone text null,
  email text null,
  customer_name text null,
  locale text null,
  last_seen_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_notifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  booking_id uuid null references public.hospitality_bookings (id) on delete set null,
  channel text not null check (channel in ('sms', 'email', 'zalo', 'whatsapp', 'internal')),
  recipient text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz null,
  sent_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.hospitality_pms_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  connector_key text not null,
  direction text not null check (direction in ('push', 'pull')),
  entity_type text not null,
  entity_id text null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'cancelled')),
  attempt_count int not null default 0,
  next_retry_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_ai_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default true,
  tone_instructions text not null default 'Lịch sự, nhanh, rõ ràng, ưu tiên chốt booking.',
  policy_text text not null default '',
  default_locale text not null default 'vi',
  supported_locales jsonb not null default '["vi","en"]'::jsonb,
  auto_reply_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_faq (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  title text not null,
  trigger_keywords text not null default '',
  answer text not null,
  answer_i18n jsonb null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_policy_blocks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  policy_key text not null,
  title text not null,
  content_i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, policy_key)
);

create index if not exists idx_hospitality_room_types_partner on public.hospitality_room_types (partner_id, is_active);
create index if not exists idx_hospitality_rooms_partner on public.hospitality_rooms (partner_id, room_type_id, status);
create index if not exists idx_hospitality_rate_plans_partner on public.hospitality_rate_plans (partner_id, is_default);
create index if not exists idx_hospitality_rate_rules_plan_room on public.hospitality_rate_rules (rate_plan_id, room_type_id);
create index if not exists idx_hospitality_holds_partner_status on public.hospitality_holds (partner_id, status, expires_at);
create index if not exists idx_hospitality_bookings_partner_time on public.hospitality_bookings (partner_id, checkin_at, checkout_at);
create index if not exists idx_hospitality_bookings_partner_status on public.hospitality_bookings (partner_id, status, created_at desc);
create index if not exists idx_hospitality_payments_booking on public.hospitality_payments (booking_id, created_at desc);
create index if not exists idx_hospitality_availability_room_time on public.hospitality_availability_slots (room_id, start_at, end_at);
create index if not exists idx_hospitality_guest_profiles_partner on public.hospitality_guest_profiles (partner_id, last_seen_at desc);
create index if not exists idx_hospitality_notifications_partner on public.hospitality_notifications (partner_id, status, scheduled_at);
create index if not exists idx_hospitality_pms_sync_jobs_partner on public.hospitality_pms_sync_jobs (partner_id, status, next_retry_at);
create index if not exists idx_hospitality_faq_partner on public.hospitality_faq (partner_id, is_active);
create index if not exists idx_hospitality_policy_blocks_partner on public.hospitality_policy_blocks (partner_id, is_active, sort_order);

comment on table public.hospitality_room_types is 'Loại phòng cho domain hospitality (tách riêng messaging_partner_inventory của fashion).';
comment on table public.hospitality_rooms is 'Phòng vật lý theo room_type.';
comment on table public.hospitality_rate_plans is 'Gói giá (theo giờ/ngày/đêm/mixed) của đối tác hospitality.';
comment on table public.hospitality_rate_rules is 'Rule giá chi tiết theo khung giờ/ngày trong tuần/mùa.';
comment on table public.hospitality_holds is 'Giữ phòng tạm trước khi chốt booking.';
comment on table public.hospitality_bookings is 'Đơn đặt phòng hospitality.';
comment on table public.hospitality_payments is 'Giao dịch thanh toán booking.';
comment on table public.hospitality_availability_slots is 'Khoảng thời gian phòng đã bị giữ/đặt/bảo trì.';
comment on table public.hospitality_pms_sync_jobs is 'Hàng đợi đồng bộ PMS hai chiều.';
comment on table public.hospitality_ai_settings is 'Cấu hình AI concierge cho khách sạn/nhà nghỉ.';
