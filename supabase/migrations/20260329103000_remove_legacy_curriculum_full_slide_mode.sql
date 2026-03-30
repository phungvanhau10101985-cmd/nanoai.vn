-- Remove legacy curriculum full-slide flow artifacts.
-- System now supports lesson-by-lesson slides only.

begin;

drop index if exists idx_worksheet_curricula_slide_flow_mode;

alter table if exists public.worksheet_curricula
  drop column if exists slide_flow_mode;

drop table if exists public.admin_runtime_settings cascade;

commit;
