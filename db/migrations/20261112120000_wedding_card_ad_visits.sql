-- Lượt khách mở thiệp đã xuất bản, theo nguồn Facebook (gồm Instagram), TikTok hoặc Google Ads.
-- Mỗi trình duyệt, mỗi nguồn, mỗi ngày (giờ Việt Nam) tính một lượt.

create table if not exists public.wedding_card_ad_visits (
  wedding_card_id uuid not null references public.wedding_cards (id) on delete cascade,
  source text not null check (source in ('facebook', 'tiktok', 'google_ads')),
  visitor_key text not null check (char_length(visitor_key) between 8 and 80),
  visited_on date not null,
  created_at timestamptz not null default now(),
  primary key (wedding_card_id, source, visitor_key, visited_on)
);

comment on table public.wedding_card_ad_visits is
  'Lượt mở thiệp công khai từ Facebook (kể cả Instagram), TikTok hoặc Google Ads. Một trình duyệt, một nguồn, một ngày một lượt.';
