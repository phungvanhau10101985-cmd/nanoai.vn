-- Nhãn kiến thức của một câu bài. Cùng kho với chủ đề gia sư (tutor_topics): key + title.
-- Nội dung mở ra (giải thích, tình huống) nằm ở tutor_topics, không nhân bản ở đây.

alter table public.homework_help_problem_cache
  add column if not exists tags jsonb not null default '[]'::jsonb;

comment on column public.homework_help_problem_cache.tags is
  'Nhãn kiến thức dùng chung với gia sư. Mỗi phần tử là {key, title}. Bấm nhãn đọc tutor_topics.';
