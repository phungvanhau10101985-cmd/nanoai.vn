-- Mở rộng type cho worksheet_jobs để hỗ trợ tách SGK và giải tự luận thành 2 luồng độc lập.
alter table if exists worksheet_jobs
  drop constraint if exists worksheet_jobs_type_check;

-- Chuẩn hóa dữ liệu cũ trước khi siết check constraint mới.
update worksheet_jobs
set type = 'parse_sgk_extract'
where type = 'parse_sgk';

alter table if exists worksheet_jobs
  add constraint worksheet_jobs_type_check
  check (
    type in (
      'parse_sgk_extract',
      'solve_sgk_essays',
      'step_by_step_quiz',
      'step_by_step_essay'
    )
  );
