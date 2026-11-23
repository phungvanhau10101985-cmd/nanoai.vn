-- Câu vừa ghi trên điện thoại. Màn chiếu mở bảng thống kê câu đó, không mở bảng điểm.

alter table public.answer_card_rounds
  add column if not exists revealed_question_index int;

alter table public.answer_card_rounds
  add column if not exists revealed_at timestamptz;

comment on column public.answer_card_rounds.revealed_question_index is
  'Câu giáo viên vừa bấm Tiếp hoặc Xong. Màn chiếu hiện bảng thống kê câu này.';

comment on column public.answer_card_rounds.revealed_at is
  'Thời điểm bấm Tiếp hoặc Xong. Màn chiếu mở lại bảng thống kê mỗi lần bấm.';
