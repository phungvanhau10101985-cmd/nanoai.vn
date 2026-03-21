-- Lớp học: GV tạo lớp, HS tham gia qua mã
create table if not exists classes (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  join_code varchar(12) not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_classes_teacher on classes(teacher_id);
create index idx_classes_join_code on classes(join_code);

alter table classes enable row level security;

create policy "Teachers can manage own classes"
  on classes for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create policy "Authenticated can read class by join_code"
  on classes for select
  using (auth.uid() is not null);

comment on table classes is 'Lớp học – GV tạo, HS tham gia qua mã';

-- Thành viên lớp
create table if not exists class_members (
  id uuid default gen_random_uuid() primary key,
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(class_id, user_id)
);

create index idx_class_members_class on class_members(class_id);
create index idx_class_members_user on class_members(user_id);

alter table class_members enable row level security;

create policy "Teachers can manage members of own classes"
  on class_members for all
  using (
    exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy "Members can view own class memberships"
  on class_members for select
  using (user_id = auth.uid());

create policy "Users can join class (insert self)"
  on class_members for insert
  with check (user_id = auth.uid());

comment on table class_members is 'Thành viên lớp – GV quản lý, HS tự tham gia';

-- Phiếu gán cho lớp
create table if not exists class_worksheets (
  id uuid default gen_random_uuid() primary key,
  class_id uuid not null references classes(id) on delete cascade,
  worksheet_id uuid not null references worksheet_worksheets(id) on delete cascade,
  assigned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(class_id, worksheet_id)
);

create index idx_class_worksheets_class on class_worksheets(class_id);
create index idx_class_worksheets_worksheet on class_worksheets(worksheet_id);

alter table class_worksheets enable row level security;

create policy "Teachers can manage worksheets of own classes"
  on class_worksheets for all
  using (
    exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy "Class members can view assigned worksheets"
  on class_worksheets for select
  using (
    exists (select 1 from class_members m where m.class_id = class_worksheets.class_id and m.user_id = auth.uid())
  );

comment on table class_worksheets is 'Phiếu bài tập gán cho lớp';

-- Bài nộp của học sinh
create table if not exists worksheet_submissions (
  id uuid default gen_random_uuid() primary key,
  worksheet_id uuid not null references worksheet_worksheets(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null default '{}',
  quiz_score int default 0,
  quiz_total int default 0,
  essay_ai_score int,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(worksheet_id, class_id, user_id)
);

create index idx_worksheet_submissions_worksheet on worksheet_submissions(worksheet_id);
create index idx_worksheet_submissions_class on worksheet_submissions(class_id);
create index idx_worksheet_submissions_user on worksheet_submissions(user_id);
create index idx_worksheet_submissions_submitted on worksheet_submissions(class_id, worksheet_id, submitted_at desc);

alter table worksheet_submissions enable row level security;

create policy "Teachers can view submissions of own classes"
  on worksheet_submissions for select
  using (
    exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy "Students can insert own submission"
  on worksheet_submissions for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from class_members m where m.class_id = worksheet_submissions.class_id and m.user_id = auth.uid())
    and exists (select 1 from class_worksheets cw where cw.class_id = worksheet_submissions.class_id and cw.worksheet_id = worksheet_submissions.worksheet_id)
  );

create policy "Students can view own submissions"
  on worksheet_submissions for select
  using (user_id = auth.uid());

comment on table worksheet_submissions is 'Bài nộp – HS trong lớp mới nộp được';
