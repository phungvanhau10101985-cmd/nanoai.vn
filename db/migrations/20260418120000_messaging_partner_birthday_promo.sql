-- Chương trình giảm giá CMSN (cấu hình / shop) + log email đã gửi

create table if not exists public.messaging_partner_birthday_promo (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default false,
  discount_percent smallint not null default 10
    check (discount_percent >= 0 and discount_percent <= 100),
  /** Số ngày trước sinh nhật — biên xa (vd 14 = bắt đầu từ 14 ngày trước SN). */
  offer_days_before_max smallint not null default 7
    check (offer_days_before_max >= 1 and offer_days_before_max <= 120),
  /** Số ngày trước sinh nhật — biên gần (vd 1 = vẫn áp đến hôm trước SN). Phải <= offer_days_before_max. */
  offer_days_before_min smallint not null default 1
    check (offer_days_before_min >= 1 and offer_days_before_min <= 120),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_birthday_promo_window_ok
    check (offer_days_before_max >= offer_days_before_min)
);

comment on table public.messaging_partner_birthday_promo is 'Giảm giá sinh nhật: % giảm, khoảng ngày trước SN; email + link chat.';

create table if not exists public.messaging_partner_birthday_email_sent (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  /** Khóa chiến dịch: năm của lần SN sắp tới (vd 2026) + mmdd để mỗi SN một lần. */
  campaign_key text not null,
  sent_at timestamptz not null default now(),
  unique (partner_id, recipient_user_id, campaign_key)
);

create index if not exists idx_messaging_birthday_sent_partner
  on public.messaging_partner_birthday_email_sent (partner_id, campaign_key);

comment on table public.messaging_partner_birthday_email_sent is 'Đã gửi email CMSN (tránh trùng theo campaign_key).';
