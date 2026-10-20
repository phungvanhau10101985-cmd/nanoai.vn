-- Đề xuất sửa slide: lưu chữ đề xuất, phiếu đồng ý và không đồng ý.

alter table public.worksheet_slide_content_reviews
  add column if not exists body text;

alter table public.worksheet_slide_content_reviews
  drop constraint if exists worksheet_slide_content_reviews_action_check;

alter table public.worksheet_slide_content_reviews
  add constraint worksheet_slide_content_reviews_action_check
  check (action in ('confirm', 'edit', 'reject', 'agree'));

create unique index if not exists idx_slide_content_reviews_agree_once
  on public.worksheet_slide_content_reviews (curriculum_id, lesson_no, slide_index, content_hash, user_id)
  where action = 'agree';

create unique index if not exists idx_slide_content_reviews_reject_once
  on public.worksheet_slide_content_reviews (curriculum_id, lesson_no, slide_index, content_hash, user_id)
  where action = 'reject';
