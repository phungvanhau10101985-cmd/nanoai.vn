-- Mỗi giáo viên xác nhận từng câu một lần trước khi mở slide.
-- Câu mới tạo chưa có dòng này nên phải duyệt lại. Không có lối bỏ qua.

create table if not exists public.worksheet_question_teacher_acks (
  question_id uuid not null references public.worksheet_questions(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

alter table public.worksheet_question_teacher_acks enable row level security;

drop policy if exists "Authenticated users can view worksheet question teacher acks" on public.worksheet_question_teacher_acks;
create policy "Authenticated users can view worksheet question teacher acks"
  on public.worksheet_question_teacher_acks for select
  using (auth.uid() is not null);

comment on table public.worksheet_question_teacher_acks is
  'Giáo viên đã xác nhận câu này một lần. Câu mới chưa có xác nhận thì phải duyệt trước khi mở slide.';
