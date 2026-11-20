-- Gắn lượt gọi API với giáo trình. Không khóa ngoại: log tạo giáo trình được ghi trước khi có dòng worksheet_curricula.

alter table public.api_usage_log
  add column if not exists curriculum_id uuid;

create index if not exists idx_api_usage_log_curriculum_id
  on public.api_usage_log (curriculum_id, created_at)
  where curriculum_id is not null;

comment on column public.api_usage_log.curriculum_id is
  'Giáo trình mà lượt gọi phục vụ (tạo giáo trình, câu hỏi, slide, ảnh). Trống với log cũ hoặc lượt không thuộc giáo trình.';
