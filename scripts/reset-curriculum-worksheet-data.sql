-- Reset dữ liệu giáo trình + phiếu bài tập để test lại từ đầu.
-- GIỮ NGUYÊN cấu trúc bảng và dữ liệu seed quan trọng (vd: worksheet_official_questions, worksheet_textbook_lessons).
-- CHỈ dùng cho môi trường dev/test.

begin;

do $$
declare
  t text;
begin
  for t in
    select unnest(ARRAY[
    -- 1) Dữ liệu thao tác quanh phiếu bài tập
    'public.worksheet_worksheets',

    -- 2) Dữ liệu thao tác quanh slide dùng chung/cá nhân và đề xuất chỉnh sửa
    'public.slide_edit_votes',
    'public.slide_edit_proposals',
    'public.worksheet_slide_edit_history',
    'public.user_customized_slides_history',
    'public.user_customized_slides',
    'public.worksheet_slides_original',
    'public.worksheet_slides',

    -- 3) Dữ liệu theo dõi truy cập/ẩn giáo trình
    'public.user_opened_curricula',
    'public.user_hidden_curricula',

    -- 4) Review/sự cố liên quan giáo trình
    'public.curriculum_edit_reviews',
    'public.quiz_question_reports',

    -- 5) Cuối cùng xóa giáo trình
    'public.worksheet_curricula'
  ]::text[])
  loop
    if to_regclass(t) is not null then
      execute format('truncate table %s restart identity cascade;', t);
    end if;
  end loop;
end
$$;

commit;
