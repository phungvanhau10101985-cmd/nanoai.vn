-- Bài tập về nhà: cùng luồng phiên thi / lam-bai nhưng không hiển thị điểm cho HS
alter table public.exam_sessions
  add column if not exists is_practice_homework boolean not null default false;

comment on column public.exam_sessions.is_practice_homework is
  'true: bài tập về nhà — không bắt tổng điểm 100 khi tạo; HS không thấy điểm sau nộp.';
