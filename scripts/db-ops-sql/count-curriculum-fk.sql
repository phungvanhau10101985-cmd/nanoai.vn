select c.conrelid::regclass as table_name, c.confdeltype as on_delete
from pg_constraint c
where c.contype = 'f'
  and c.confrelid = 'public.worksheet_curricula'::regclass
order by 1;

select 'worksheet_curricula' as t, count(*) from public.worksheet_curricula
union all select 'worksheet_textbook_lessons', count(*) from public.worksheet_textbook_lessons
union all select 'worksheet_official_questions', count(*) from public.worksheet_official_questions;
