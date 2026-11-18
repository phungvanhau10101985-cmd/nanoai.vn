-- Kênh lúc khách thêm giỏ giáo trình (tạo hoặc mở). Rỗng = trước khi ghi nguồn.

alter table public.worksheet_curricula
  add column if not exists created_source text not null default '';

alter table public.worksheet_curricula
  add column if not exists created_source_detail text not null default '';

alter table public.worksheet_curricula
  drop constraint if exists worksheet_curricula_created_source_check;

alter table public.worksheet_curricula
  add constraint worksheet_curricula_created_source_check
  check (created_source in ('', 'facebook', 'tiktok', 'google_ads', 'direct', 'other'));

alter table public.worksheet_curricula
  drop constraint if exists worksheet_curricula_created_source_detail_len;

alter table public.worksheet_curricula
  add constraint worksheet_curricula_created_source_detail_len
  check (char_length(created_source_detail) <= 160);

comment on column public.worksheet_curricula.created_source is
  'Kênh lúc tạo giáo trình (thêm giỏ): facebook, tiktok, google_ads, direct, other. Rỗng nếu tạo trước khi ghi nguồn.';

comment on column public.worksheet_curricula.created_source_detail is
  'utm hoặc tên miền giới thiệu lúc tạo giáo trình. Không chứa click id.';

alter table public.user_opened_curricula
  add column if not exists opened_source text not null default '';

alter table public.user_opened_curricula
  add column if not exists opened_source_detail text not null default '';

alter table public.user_opened_curricula
  drop constraint if exists user_opened_curricula_opened_source_check;

alter table public.user_opened_curricula
  add constraint user_opened_curricula_opened_source_check
  check (opened_source in ('', 'facebook', 'tiktok', 'google_ads', 'direct', 'other'));

alter table public.user_opened_curricula
  drop constraint if exists user_opened_curricula_opened_source_detail_len;

alter table public.user_opened_curricula
  add constraint user_opened_curricula_opened_source_detail_len
  check (char_length(opened_source_detail) <= 160);

comment on column public.user_opened_curricula.opened_source is
  'Kênh lúc mở giáo trình lần đầu được ghi (thêm giỏ). Rỗng nếu mở trước khi ghi nguồn.';

comment on column public.user_opened_curricula.opened_source_detail is
  'utm hoặc tên miền giới thiệu lúc mở giáo trình. Không chứa click id.';

create index if not exists idx_worksheet_curricula_created_source
  on public.worksheet_curricula (user_id, created_at)
  where created_source <> '';

create index if not exists idx_user_opened_curricula_opened_source
  on public.user_opened_curricula (user_id, opened_at)
  where opened_source <> '';
