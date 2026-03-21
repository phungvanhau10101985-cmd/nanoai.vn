-- =============================================================================
-- RESET DỮ LIỆU GIÁO TRÌNH / PHIẾU BÀI TẬP / SLIDE (AI tạo) – để test lại
-- =============================================================================
-- CHỈ dùng cho môi trường dev/test.
--
-- Cách chạy: Supabase Dashboard → SQL Editor → paste file này và Run
-- Hoặc: supabase db execute -f scripts/reset-curriculum-worksheet-data.sql
--
-- LƯU Ý nếu deadlock: đóng tab SQL khác, tắt app (npm run dev), chạy lại.
-- Dùng 1 lệnh TRUNCATE nhiều bảng – Postgres tự xử lý thứ tự, giảm deadlock.
--
-- GIỮ LẠI (không xóa):
--   worksheet_official_questions, worksheet_textbook_lessons
--   classes, class_members, credits, transactions, profiles
-- =============================================================================

begin;

truncate table
  public.slide_edit_votes,
  public.slide_edit_proposals,
  public.slide_quiz_responses,
  public.slide_quiz_sessions,
  public.worksheet_submissions,
  public.class_worksheets,
  public.user_opened_curricula,
  public.user_hidden_curricula,
  public.curriculum_edit_reviews,
  public.quiz_question_reports,
  public.user_customized_slides_history,
  public.user_customized_slides,
  public.worksheet_slide_edit_history,
  public.worksheet_slides_original,
  public.worksheet_slides,
  public.worksheet_questions,
  public.worksheet_worksheets,
  public.worksheet_curricula,
  public.slide_share_sessions
restart identity cascade;

commit;
