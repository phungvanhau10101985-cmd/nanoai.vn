/**
 * Giá credits hiển thị trên UI luồng giáo trình / phiếu.
 * Khi bật trừ credit phía server, giữ khớp các giá trị này.
 */
export const CURRICULUM_UI_CREDITS = {
  /** createCurriculum (chủ đề) hoặc POST /api/curriculum-from-image — mỗi lần tạo bằng AI */
  createOrFromImage: 1,
  /** POST /api/curriculum-analyze-slides (bấm Xem slide) */
  analyzeSlides: 1,
  /** Job tách phiếu từ ảnh SGK (ước tính mỗi lần chạy) */
  sgkExtractJob: 1,
  /** Mỗi câu trắc nghiệm / mỗi bài tự luận (step-by-step, theo số lượng chọn) */
  worksheetQuestion: 1,
  /** So sánh 2 AI trước khi áp dụng sửa đoạn (Sửa giáo trình) */
  curriculumEditApply: 1,
  /** Kiểm tra / Lưu câu có gọi AI (popup sửa phiếu) */
  worksheetEditCheck: 1,
  worksheetEditSave: 1,
  /** Tạo câu trắc nghiệm trên slide (GV) */
  slideGenerateQuiz: 1,
} as const

export function formatCurriculumCredits(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}
