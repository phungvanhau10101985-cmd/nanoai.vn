-- Phiên trắc nghiệm tại chỗ trên slide – giáo viên bắt đầu, học sinh làm bài qua QR/link
create table if not exists slide_quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  code varchar(8) not null unique,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  slide_index int not null,
  block_index int not null,
  quiz_data jsonb not null,
  status text not null default 'active' check (status in ('active', 'revealed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_slide_quiz_sessions_code on slide_quiz_sessions(code);
create index idx_slide_quiz_sessions_curriculum on slide_quiz_sessions(curriculum_id);
create index idx_slide_quiz_sessions_created on slide_quiz_sessions(created_at desc);

alter table slide_quiz_sessions enable row level security;

create policy "Anyone can read session by code"
  on slide_quiz_sessions for select using (true);

create policy "Authenticated users can create sessions"
  on slide_quiz_sessions for insert with check (auth.uid() is not null);

create policy "Creator can update own session"
  on slide_quiz_sessions for update using (created_by = auth.uid());

comment on table slide_quiz_sessions is 'Phiên trắc nghiệm tại chỗ – giáo viên tạo, học sinh tham gia qua mã';

-- Phiếu trả lời của học sinh (device_id bắt buộc, user_id tùy chọn)
create table if not exists slide_quiz_responses (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references slide_quiz_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_id varchar(64) not null,
  answer_index int not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(session_id, device_id)
);

create index idx_slide_quiz_responses_session on slide_quiz_responses(session_id);

alter table slide_quiz_responses enable row level security;

create policy "Anyone can insert response"
  on slide_quiz_responses for insert with check (true);

create policy "Session creator can read responses"
  on slide_quiz_responses for select using (
    exists (select 1 from slide_quiz_sessions s where s.id = session_id and s.created_by = auth.uid())
  );

comment on table slide_quiz_responses is 'Phiếu trả lời trắc nghiệm – user_id hoặc device_id để tránh trùng';
