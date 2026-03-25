/**
 * Giá credits hiển thị trên UI luồng giáo trình / phiếu.
 * Khi bật trừ credit phía server, giữ khớp các giá trị này.
 *
 * ── Quy tắc chung (DB trước, AI sau) ──
 * - Có thể phục vụ từ DB / dữ liệu đã lưu → **không** gọi AI → **không** trừ credit.
 * - Phải gọi AI tạo mới → trừ credit theo mức dưới (server đã gắn spend: xem từng API).
 *
 * Đã gắn trừ server: `POST /api/curriculum-analyze-slides` khi **không** `fromCache`
 * (`@/lib/curriculum-ai-credits`). Chưa gắn spend nhưng vẫn là AI thuần: curriculum-from-image,
 * curriculum-from-paste, curriculum-edit-check, worksheet-edit-check, worksheet-generate-*,
 * worksheet jobs — nên áp cùng nguyên tắc khi mở rộng (đọc DB/cache trước, spend sau khi AI OK).
 */
export const CURRICULUM_CREDIT_RULES = {
  analyzeSlides: {
    api: 'POST /api/curriculum-analyze-slides',
    dbFirstTables: ['worksheet_slides', 'worksheet_slides_original', 'user_customized_slides'] as const,
    chargeWhen: 'Chỉ khi chạy pipeline AI (response không có fromCache: true).',
  },
} as const

export const CURRICULUM_UI_CREDITS = {
  /** createCurriculum (chủ đề) hoặc POST /api/curriculum-from-image — mỗi lần tạo bằng AI */
  createOrFromImage: 1,
  /** POST /api/curriculum-analyze-slides — chỉ khi chưa có slide trong DB (API trả fromCache thì không tốn) */
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
