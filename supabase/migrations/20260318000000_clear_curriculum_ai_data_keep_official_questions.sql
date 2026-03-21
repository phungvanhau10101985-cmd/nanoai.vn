-- Xóa toàn bộ dữ liệu liên quan tạo giáo trình (do AI tạo)
--
-- GHI CHÚ – KHI RESET, KHÔNG ĐƯỢC XÓA (trừ khi nhắc rõ):
-- • worksheet_official_questions – câu hỏi đã tải lên và chuẩn hóa
-- • Danh sách thành viên (classes, class_members)
-- • Credit của mỗi tài khoản (credits, transactions)
--
-- XÓA: giáo trình, phiếu bài tập, slides, lịch sử sửa, đề xuất, bài nộp, v.v.

-- Thứ tự xóa theo foreign key (con trước, cha sau)

-- 1. Bài nộp học sinh (phụ thuộc worksheet_worksheets)
truncate table worksheet_submissions cascade;

-- 2. Phiếu gán cho lớp (phụ thuộc worksheet_worksheets)
truncate table class_worksheets cascade;

-- 3. Báo câu hỏi sai (phụ thuộc worksheet_curricula)
truncate table quiz_question_reports cascade;

-- 4. Đề xuất sửa slide (phụ thuộc worksheet_curricula)
truncate table slide_edit_proposals cascade;

-- 5. Phiên quiz slide (phụ thuộc worksheet_curricula)
truncate table slide_quiz_sessions cascade;

-- 6. Giáo trình user đã mở (phụ thuộc worksheet_curricula)
truncate table user_opened_curricula cascade;

-- 7. Đánh giá chỉnh sửa giáo trình (phụ thuộc worksheet_curricula)
truncate table curriculum_edit_reviews cascade;

-- 8. Lịch sử slide tùy chỉnh (phụ thuộc worksheet_curricula)
truncate table user_customized_slides_history cascade;

-- 9. Slide tùy chỉnh user (phụ thuộc worksheet_curricula)
truncate table user_customized_slides cascade;

-- 10. Lịch sử chỉnh sửa slide (phụ thuộc worksheet_curricula)
truncate table worksheet_slide_edit_history cascade;

-- 11. Bản gốc slide (phụ thuộc worksheet_curricula)
truncate table worksheet_slides_original cascade;

-- 12. Slide bài giảng (phụ thuộc worksheet_curricula)
truncate table worksheet_slides cascade;

-- 13. Giáo trình ẩn soft-delete (phụ thuộc worksheet_curricula)
truncate table user_hidden_curricula cascade;

-- 14. Phiếu bài tập AI (phụ thuộc worksheet_curricula)
truncate table worksheet_worksheets cascade;

-- 15. Giáo trình AI
truncate table worksheet_curricula cascade;

-- 16. Phiên chia sẻ slide (dữ liệu tạm, liên quan curriculum)
truncate table slide_share_sessions cascade;

-- GIỮ LẠI: worksheet_official_questions (câu hỏi đã tải lên và chuẩn hóa)
-- GIỮ LẠI: worksheet_textbook_lessons (mục lục SGK – dữ liệu tham chiếu)
