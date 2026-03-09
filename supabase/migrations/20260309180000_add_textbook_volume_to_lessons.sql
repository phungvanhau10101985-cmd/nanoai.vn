-- Thêm textbook_volume để phân biệt Tập 1 / Tập 2
alter table worksheet_textbook_lessons
  add column if not exists textbook_volume text default null;

create index if not exists idx_textbook_lessons_volume on worksheet_textbook_lessons(subject_id, grade_level_id, textbook_set_id, textbook_volume);

comment on column worksheet_textbook_lessons.textbook_volume is 'Tập sách (1, 2) – null nếu không phân tập';

-- Cho phép user đăng nhập insert mục lục (khi AI lấy xong)
create policy "Authenticated users can insert textbook lessons"
  on worksheet_textbook_lessons for insert
  with check (auth.uid() is not null);
