-- Đề xuất sửa một câu trong phiếu. Bản chung chỉ đổi khi đủ 7 giáo viên khác đồng ý.

create table if not exists public.worksheet_question_reviews (
  id bigserial primary key,
  question_id uuid not null references public.worksheet_questions(id) on delete cascade,
  content_hash text not null,
  user_id uuid not null,
  action text not null check (action in ('edit', 'agree', 'reject')),
  body jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_worksheet_question_reviews_lookup
  on public.worksheet_question_reviews (question_id, created_at);

create unique index if not exists idx_worksheet_question_reviews_agree_once
  on public.worksheet_question_reviews (question_id, content_hash, user_id)
  where action = 'agree';

create unique index if not exists idx_worksheet_question_reviews_reject_once
  on public.worksheet_question_reviews (question_id, content_hash, user_id)
  where action = 'reject';

alter table public.worksheet_question_reviews enable row level security;

drop policy if exists "Authenticated users can view worksheet question reviews" on public.worksheet_question_reviews;
create policy "Authenticated users can view worksheet question reviews"
  on public.worksheet_question_reviews for select
  using (auth.uid() is not null);

comment on table public.worksheet_question_reviews is
  'Giáo viên sửa câu thì dùng bản riêng ngay. Bản chung đổi khi 7 giáo viên khác đồng ý. Sửa mới thì đếm lại.';
