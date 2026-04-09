-- Bật/tắt flow tạo slide (legacy/lesson) từ admin
-- và gắn mode mặc định vào từng giáo trình tại thời điểm tạo.

alter table if exists worksheet_curricula
  add column if not exists slide_flow_mode text not null default 'lesson'
  check (slide_flow_mode in ('legacy', 'lesson'));

create index if not exists idx_worksheet_curricula_slide_flow_mode
  on worksheet_curricula(slide_flow_mode);

-- Backfill mode cho dữ liệu cũ:
-- 1) Có lesson_json theo tiết => lesson
-- 2) Chưa có lesson_json nhưng đã có full slides cũ => legacy
update worksheet_curricula c
set slide_flow_mode = 'lesson'
where exists (
  select 1
  from worksheet_curriculum_lessons l
  where l.curriculum_id = c.id
);

update worksheet_curricula c
set slide_flow_mode = 'legacy'
where not exists (
  select 1
  from worksheet_curriculum_lessons l
  where l.curriculum_id = c.id
)
and (
  exists (select 1 from worksheet_slides s where s.curriculum_id = c.id)
  or exists (select 1 from worksheet_slides_original so where so.curriculum_id = c.id)
  or exists (select 1 from user_customized_slides us where us.curriculum_id = c.id)
);

create table if not exists admin_runtime_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_by uuid references auth.users(id) on delete set null
);

alter table admin_runtime_settings enable row level security;

create policy "Authenticated users can read runtime settings"
  on admin_runtime_settings for select
  using (
    auth.uid() is not null
    and key = 'curriculum_default_flow_mode'
  );

comment on table admin_runtime_settings is
  'Runtime settings do admin quản trị (feature flags, default flow mode, ...).';
