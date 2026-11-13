-- Kênh lúc khách bấm tạo thiệp. Rỗng = thiệp tạo trước khi ghi nguồn.

alter table public.wedding_cards
  add column if not exists created_source text not null default '';

alter table public.wedding_cards
  add column if not exists created_source_detail text not null default '';

alter table public.wedding_cards
  drop constraint if exists wedding_cards_created_source_check;

alter table public.wedding_cards
  add constraint wedding_cards_created_source_check
  check (created_source in ('', 'facebook', 'tiktok', 'google_ads', 'direct', 'other'));

alter table public.wedding_cards
  drop constraint if exists wedding_cards_created_source_detail_len;

alter table public.wedding_cards
  add constraint wedding_cards_created_source_detail_len
  check (char_length(created_source_detail) <= 160);

comment on column public.wedding_cards.created_source is
  'Kênh lúc bấm tạo thiệp: facebook, tiktok, google_ads, direct, other. Rỗng nếu tạo trước khi ghi nguồn.';

comment on column public.wedding_cards.created_source_detail is
  'utm hoặc tên miền giới thiệu lúc tạo thiệp. Không chứa click id.';
