-- Xóa giáo trình đã lưu và dữ liệu gắn với giáo trình.
-- Giữ worksheet_textbook_lessons và worksheet_official_questions.
do $$
declare t text;
begin
  foreach t in array array[
    'worksheet_submissions',
    'class_worksheets',
    'quiz_question_reports',
    'slide_edit_proposals',
    'slide_quiz_sessions',
    'slide_share_sessions',
    'user_customized_slides_history',
    'user_customized_slides',
    'user_hidden_curricula',
    'user_opened_curricula',
    'worksheet_slide_content_reviews',
    'worksheet_curriculum_lesson_slides',
    'worksheet_curriculum_lessons',
    'worksheet_slide_edit_history',
    'worksheet_slides_original',
    'worksheet_slides',
    'curriculum_edit_reviews',
    'worksheet_question_reviews',
    'worksheet_questions',
    'worksheet_worksheets',
    'worksheet_curricula'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute 'delete from public.' || quote_ident(t);
    end if;
  end loop;
end $$;
