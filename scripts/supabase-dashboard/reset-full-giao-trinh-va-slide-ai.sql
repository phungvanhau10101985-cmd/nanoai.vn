-- =============================================================================
-- CHẠY TRÊN SUPABASE: Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================================
-- RESET TOÀN BỘ giáo trình AI + slide + phiếu + câu + job verify lô + job worksheet.
-- Mạnh hơn file xoa-bai-tap-ai.sql (file đó GIỮ worksheet_curricula).
--
-- GIỮ LẠI: worksheet_official_questions, worksheet_textbook_lessons,
--          classes, class_members, credits, transactions, profiles
--
-- Nếu lỗi thiếu bảng (vd. worksheet_verify_batch_reports): xóa dòng tương ứng
-- trong TRUNCATE rồi Run lại.
--
-- CHỈ dev/test. Tắt app local nếu deadlock.
-- =============================================================================

begin;

truncate table
  public.worksheet_verify_batch_reports,
  public.worksheet_jobs,
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
