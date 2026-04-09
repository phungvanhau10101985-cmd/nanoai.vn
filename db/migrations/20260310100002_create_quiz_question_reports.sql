-- Báo cáo câu hỏi trắc nghiệm sai từ giáo viên
-- Luồng: GV báo lần 1 → Gemini kiểm tra; lần 2 → GPT kiểm tra; lần 3 → Admin duyệt
create table if not exists quiz_question_reports (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slide_index int not null,
  block_index int not null,
  quiz_marker text not null,
  slide_content text not null,
  slide_title text default '',
  report_count int not null default 1,
  status text not null default 'pending',
  ai_reasoning text,
  ai_model_used text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  admin_approved_at timestamp with time zone,
  admin_user_id uuid references auth.users(id) on delete set null,
  unique(curriculum_id, slide_index, block_index, user_id)
);

create index if not exists idx_quiz_question_reports_curriculum on quiz_question_reports(curriculum_id);
create index if not exists idx_quiz_question_reports_status on quiz_question_reports(status);
create index if not exists idx_quiz_question_reports_user on quiz_question_reports(user_id);

alter table quiz_question_reports enable row level security;

drop policy if exists "Users can insert own reports" on quiz_question_reports;
create policy "Users can insert own reports"
  on quiz_question_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own reports" on quiz_question_reports;
create policy "Users can view own reports"
  on quiz_question_reports for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all reports" on quiz_question_reports;
create policy "Admins can view all reports"
  on quiz_question_reports for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Admins can update reports" on quiz_question_reports;
create policy "Admins can update reports"
  on quiz_question_reports for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users can update own reports" on quiz_question_reports;
create policy "Users can update own reports"
  on quiz_question_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table quiz_question_reports is 'Báo cáo câu hỏi trắc nghiệm sai từ giáo viên – luồng AI kiểm tra và admin duyệt';
