-- Reset toàn bộ dữ liệu trong schema public để test lại phần mềm
-- Giữ nguyên dữ liệu bảng câu hỏi trắc nghiệm chính thức.
-- CHỈ dùng cho môi trường development/test.
--
-- Bảng được giữ lại dữ liệu:
--   - worksheet_official_questions

begin;

do $$
declare
  stmt text;
begin
  for stmt in
    select format(
      'truncate table %I.%I restart identity cascade;',
      schemaname,
      tablename
    )
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('worksheet_official_questions')
  loop
    execute stmt;
  end loop;
end
$$;

commit;
