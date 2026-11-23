-- Ảnh giáo viên chụp trên bảng quét, để đối chiếu lại từng câu.

create table if not exists public.answer_card_shots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.answer_card_rounds(id) on delete cascade,
  question_index integer not null,
  exam_title text not null,
  subject_name text not null default '',
  image bytea not null,
  taken_at timestamp with time zone not null default now(),
  constraint answer_card_shots_index_check check (question_index >= 0),
  constraint answer_card_shots_image_check check (octet_length(image) between 32 and 2000000)
);

create index if not exists idx_answer_card_shots_round
  on public.answer_card_shots(round_id, taken_at desc);

alter table public.answer_card_shots enable row level security;

drop policy if exists "Teachers read own answer card shots" on public.answer_card_shots;
create policy "Teachers read own answer card shots"
  on public.answer_card_shots
  for select
  using (
    exists (
      select 1 from public.answer_card_rounds r
      where r.id = round_id and r.teacher_id = auth.uid()
    )
  );

comment on table public.answer_card_shots is
  'Ảnh camera lúc quét. Trên ảnh có số câu, giờ chụp, tên bài và môn.';
