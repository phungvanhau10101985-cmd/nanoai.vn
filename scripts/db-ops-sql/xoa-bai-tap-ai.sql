-- =============================================================================
-- CHẠY TRONG SQL EDITOR / psql: paste toàn file → Run
-- =============================================================================
-- Mục đích (dev/test): xóa sạch dữ liệu **phiếu bài tập** + **câu trong bảng
-- worksheet_questions** + job + nộp bài + gán lớp + báo cáo verify lô.
--
-- VẪN DÙNG ĐƯỢC với schema hiện tại (worksheet_jobs type mở rộng SGK không đổi tên bảng).
--
-- LƯU Ý QUAN TRỌNG – “xóa bài tập AI” thực tế là:
--   • TRUNCATE **toàn bộ** `worksheet_questions` (mọi source: ai, sgk, edited…),
--     không lọc theo cột source.
--   • Ngân hàng câu **Bộ / VNHSGE** nằm ở `worksheet_official_questions` → KHÔNG bị xóa.
--   • `worksheet_curricula` + slide + mục lục SGK (`worksheet_textbook_lessons`) → GIỮ.
--   • Link/QR phiếu cũ sẽ không còn bản ghi tương ứng.
--
-- Nếu lỗi: relation "worksheet_verify_batch_reports" does not exist
--   → xóa dòng có worksheet_verify_batch_reports trong khối TRUNCATE bên dưới,
--     hoặc chạy migration tạo bảng đó trước.
--
-- CHỈ dùng môi trường dev/test. Không chạy trên production có dữ liệu thật.
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
