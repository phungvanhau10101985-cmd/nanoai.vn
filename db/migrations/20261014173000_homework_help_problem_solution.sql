-- Bài giải chi tiết của một câu. Viết một lần, mọi học sinh sau đọc lại, không gọi model nữa.

alter table public.homework_help_problem_cache
  add column if not exists solution text not null default '';

comment on column public.homework_help_problem_cache.solution is
  'Lời giải chi tiết. Rỗng cho đến lần học sinh đầu trả credit để mở. Bản đầu thắng, lần sau không ghi đè.';
