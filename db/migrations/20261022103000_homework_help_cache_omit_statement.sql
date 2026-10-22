-- Kho dùng chung chỉ giữ vân tay và phần AI viết. Xóa chữ đề đã lưu.

update public.homework_help_problem_cache
set statement = ''
where btrim(statement) <> '';

comment on column public.homework_help_problem_cache.statement is
  'Không còn lưu chữ đề. Cột giữ chuỗi rỗng vì schema cũ. Tra cứu bằng fingerprint.';

comment on table public.homework_help_problem_cache is
  'Hướng dẫn và lời giải đã kiểm tra. Khóa là vân tay đề và ngôn ngữ. Không lưu câu chữ đề.';

update public.homework_help_photo_cache
set guide = jsonb_set(
  guide,
  '{problems}',
  coalesce(
    (
      select jsonb_agg(item.problem || jsonb_build_object('statement', '') order by item.ordinality)
      from jsonb_array_elements(coalesce(guide->'problems', '[]'::jsonb)) with ordinality as item(problem, ordinality)
    ),
    '[]'::jsonb
  )
)
where jsonb_typeof(guide->'problems') = 'array';

comment on table public.homework_help_photo_cache is
  'Hướng dẫn của một ảnh, theo hash byte ảnh và ngôn ngữ. Không lưu câu chữ đề. Vân tay từng câu nằm ở guide.prints.';
