-- =============================================================================
-- XÓA DỮ LIỆU GIÁO TRÌNH + SLIDE (bản chuẩn, an toàn khi thiếu bảng)
-- Mục tiêu: dọn sạch dữ liệu curriculum/slide/worksheet liên quan, giữ nguyên user/credits
-- Cách chạy: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =============================================================================

begin;

do $$
declare
  target_tables text[] := array[
    -- curriculum + lesson flow mới
    'worksheet_curriculum_lesson_slides',
    'worksheet_curriculum_lessons',
    'worksheet_curricula',

    -- slide + chỉnh sửa
    'worksheet_slides',
    'worksheet_slides_original',
    'worksheet_slide_edit_history',
    'user_customized_slides',
    'user_customized_slides_history',

    -- worksheet đi kèm giáo trình
    'worksheet_worksheets',
    'worksheet_questions',
    'worksheet_verify_batch_reports',
    'worksheet_jobs'
  ];
  truncate_sql text;
begin
  select
    case
      when count(*) = 0 then null
      else
        'truncate table ' ||
        string_agg(format('public.%I', t), ', ') ||
        ' restart identity cascade'
    end
  into truncate_sql
  from unnest(target_tables) as t
  where to_regclass(format('public.%I', t)) is not null;

  if truncate_sql is null then
    raise notice 'Không tìm thấy bảng mục tiêu nào để xóa.';
  else
    execute truncate_sql;
    raise notice 'Đã xóa dữ liệu giáo trình + slide + worksheet liên quan.';
  end if;
end $$;

commit;
