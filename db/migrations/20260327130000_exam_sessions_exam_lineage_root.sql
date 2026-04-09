-- Theo dõi cùng một "đề" qua nhiều phiên (gốc + bản gắn lớp) để không gắn trùng lớp
alter table public.exam_sessions
  add column if not exists exam_lineage_root_id uuid references public.exam_sessions (id) on delete set null;

comment on column public.exam_sessions.exam_lineage_root_id is
  'UUID phiên gốc của cùng một đề; mọi bản sao khi gắn lớp dùng cùng giá trị này.';

create index if not exists idx_exam_sessions_lineage_teacher
  on public.exam_sessions (teacher_id, exam_lineage_root_id)
  where exam_lineage_root_id is not null;

-- Phiên cũ: coi mỗi phiên là gốc của chính nó
update public.exam_sessions
set exam_lineage_root_id = id
where exam_lineage_root_id is null;
