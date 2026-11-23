-- Giáo viên bấm «Đã xong» thì máy chiếu và điện thoại cùng mở bảng điểm lớp.

alter table public.answer_card_rounds
  add column if not exists show_summary boolean not null default false;

comment on column public.answer_card_rounds.show_summary is
  'Bật khi giáo viên chốt buổi quét. Cả màn lớp và điện thoại hiện bảng điểm.';
