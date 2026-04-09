-- =============================================================================
-- XÓA SẠCH PHIẾU + CÂU worksheet (job, verify lô, nộp bài, gán lớp) – để test lại
-- =============================================================================
-- Xóa:
--   worksheet_verify_batch_reports, worksheet_jobs, worksheet_submissions,
--   class_worksheets, worksheet_worksheets, worksheet_questions
-- Cảnh báo: worksheet_questions = TOÀN BỘ dòng (ai/sgk/edited), không chỉ AI.
-- GIỮ LẠI: worksheet_curricula, slides, worksheet_official_questions, worksheet_textbook_lessons…
--
-- Muốn xóa LUÔN giáo trình + slide + mọi thứ AI tạo giáo trình → dùng file:
--   scripts/reset-curriculum-worksheet-data.sql
--
-- Cách chạy:
--   Bản copy-paste: scripts/db-ops-sql/xoa-bai-tap-ai.sql
--   npm run db:delete-worksheet-exercises   (CLI project linked — xem package.json)
--   hoặc: paste file này vào SQL Editor → Run
--
-- LƯU Ý: CHỈ dev/test. Đóng tab SQL khác, tắt app (npm run dev) nếu bị deadlock.
-- =============================================================================

begin;

truncate table
  public.worksheet_verify_batch_reports,
  public.worksheet_jobs,
  public.worksheet_submissions,
  public.class_worksheets,
  public.worksheet_worksheets,
  public.worksheet_questions
restart identity cascade;

commit;
