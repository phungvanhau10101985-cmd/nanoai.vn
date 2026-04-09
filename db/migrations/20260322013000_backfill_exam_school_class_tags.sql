-- Backfill legacy data after adding school/class tags to exam flow.
-- Goal: keep old reports usable (non-null class/school tags where possible).

do $$
declare
  v_default_school_id uuid;
begin
  -- 1) Ensure a default school exists for legacy rows.
  insert into schools (name, normalized_name, search_tokens)
  values ('Chưa cập nhật', 'chua cap nhat', 'chua cap nhat legacy')
  on conflict (normalized_name) do update set name = excluded.name
  returning id into v_default_school_id;

  if v_default_school_id is null then
    select id into v_default_school_id from schools where normalized_name = 'chua cap nhat' limit 1;
  end if;

  -- 2) Classes without school -> attach default school.
  update classes
  set school_id = v_default_school_id
  where school_id is null;

  -- 3) Create one legacy class per teacher for old exam sessions that had no class.
  insert into classes (teacher_id, name, join_code, school_id, grade_level_id)
  select distinct
    es.teacher_id,
    'Lớp cũ chưa gắn',
    upper('LG' || substr(md5(es.teacher_id::text), 1, 8)),
    coalesce(es.school_id, v_default_school_id),
    es.grade_level_id
  from exam_sessions es
  left join classes c
    on c.teacher_id = es.teacher_id
   and c.name = 'Lớp cũ chưa gắn'
  where es.class_id is null
    and es.teacher_id is not null
    and c.id is null;

  -- 4) Backfill session school/class from teacher legacy class.
  update exam_sessions es
  set class_id = c.id
  from classes c
  where es.class_id is null
    and es.teacher_id = c.teacher_id
    and c.name = 'Lớp cũ chưa gắn';

  update exam_sessions
  set school_id = coalesce(school_id, (
    select c.school_id from classes c where c.id = exam_sessions.class_id
  ), v_default_school_id)
  where school_id is null;

  -- 5) Backfill attempts from linked sessions.
  update exam_attempts ea
  set class_id = coalesce(ea.class_id, es.class_id),
      school_id = coalesce(ea.school_id, es.school_id)
  from exam_sessions es
  where ea.session_id = es.id
    and (ea.class_id is null or ea.school_id is null);

  -- 6) Recreate class membership from tagged attempts when user_id is known.
  insert into class_members (class_id, user_id)
  select distinct ea.class_id, ea.user_id
  from exam_attempts ea
  where ea.class_id is not null
    and ea.user_id is not null
  on conflict (class_id, user_id) do nothing;
end $$;
