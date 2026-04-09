-- Liên kết phiếu bài tập với giáo trình (bài tập thuộc bộ giáo trình)
alter table worksheet_worksheets
  add column if not exists curriculum_id uuid references worksheet_curricula(id) on delete set null;

create index if not exists idx_worksheet_worksheets_curriculum_id on worksheet_worksheets(curriculum_id);
create index if not exists idx_worksheet_worksheets_subject_grade on worksheet_worksheets(subject_id, grade_level_id);

comment on column worksheet_worksheets.curriculum_id is 'Giáo trình cha - phiếu bài tập thuộc bộ giáo trình này';
