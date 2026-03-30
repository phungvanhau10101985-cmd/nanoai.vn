-- Lưu JSON theo từng tiết (AI trả về) và cache slide theo từng tiết.
-- Mục tiêu: giáo viên chọn tiết nào thì chỉ tạo/tải slide tiết đó.

create table if not exists worksheet_curriculum_lessons (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  lesson_no int not null check (lesson_no > 0),
  lesson_title text not null default '',
  lesson_markdown text not null default '',
  lesson_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (curriculum_id, lesson_no)
);

create index if not exists idx_worksheet_curriculum_lessons_curriculum
  on worksheet_curriculum_lessons(curriculum_id, lesson_no);

alter table worksheet_curriculum_lessons enable row level security;

create policy "Authenticated users can view curriculum lessons"
  on worksheet_curriculum_lessons for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert curriculum lessons"
  on worksheet_curriculum_lessons for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update curriculum lessons"
  on worksheet_curriculum_lessons for update
  using (auth.uid() is not null);

create table if not exists worksheet_curriculum_lesson_slides (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  mode text not null check (mode in ('shared', 'original', 'personal')),
  user_id uuid references auth.users(id) on delete cascade,
  lesson_no int not null check (lesson_no > 0),
  slides_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- shared/original: user_id null, unique theo curriculum + mode + lesson
create unique index if not exists idx_wcls_shared_original_unique
  on worksheet_curriculum_lesson_slides(curriculum_id, mode, lesson_no)
  where user_id is null;

-- personal: unique thêm user_id
create unique index if not exists idx_wcls_personal_unique
  on worksheet_curriculum_lesson_slides(curriculum_id, mode, lesson_no, user_id)
  where user_id is not null;

create index if not exists idx_wcls_curriculum_mode
  on worksheet_curriculum_lesson_slides(curriculum_id, mode, lesson_no);

alter table worksheet_curriculum_lesson_slides enable row level security;

create policy "Authenticated users can view lesson slides"
  on worksheet_curriculum_lesson_slides for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert shared or own lesson slides"
  on worksheet_curriculum_lesson_slides for insert
  with check (
    auth.uid() is not null
    and (
      (mode in ('shared', 'original') and user_id is null)
      or (mode = 'personal' and user_id = auth.uid())
    )
  );

create policy "Authenticated users can update shared or own lesson slides"
  on worksheet_curriculum_lesson_slides for update
  using (
    auth.uid() is not null
    and (
      (mode in ('shared', 'original') and user_id is null)
      or (mode = 'personal' and user_id = auth.uid())
    )
  );

comment on table worksheet_curriculum_lessons is
  'JSON từng tiết của một giáo trình. Tạo lúc tạo giáo trình để mở/tạo slide theo tiết.';

comment on table worksheet_curriculum_lesson_slides is
  'Cache slide theo từng tiết + mode (shared/original/personal).';
