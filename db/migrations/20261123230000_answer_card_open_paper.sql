-- Điện thoại bấm Mở đề. Màn chiếu trên máy tính quay lại trang đề.

alter table public.answer_card_rounds
  add column if not exists open_paper_at timestamptz;

comment on column public.answer_card_rounds.open_paper_at is
  'Thời điểm giáo viên bấm Mở đề trên điện thoại. Màn chiếu mở lại trang đề.';
