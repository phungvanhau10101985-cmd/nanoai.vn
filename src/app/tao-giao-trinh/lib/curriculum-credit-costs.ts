/**
 * Giá credits hiển thị trên UI luồng giáo trình / phiếu.
 * Khi bật trừ credit phía server, giữ khớp các giá trị này.
 *
 * ── Quy tắc chung (DB trước, AI sau) ──
 * - Có thể phục vụ từ DB / dữ liệu đã lưu → **không** gọi AI → **không** trừ credit.
 * - Phải gọi AI tạo mới → trừ credit theo mức dưới (server đã gắn spend: xem từng API).
 *
 * Đã gắn trừ server (có miễn phí lần đầu — xem `curriculum-ai-charge-policy`):
 * - `POST /api/curriculum-from-image`: 1 credit khi ghi đè / vượt 3 bài mới/ngày
 * - slide theo tiết: 0.5 credit khi tạo lại (lần đầu/tiết miễn phí)
 * - infographic: 1.5 credit khi tạo lại (lần đầu miễn phí)
 * Chưa gắn spend: curriculum-from-paste, curriculum-edit-check, worksheet-edit-check,
 * worksheet-generate-*, worksheet jobs — v.v.
 */
export const CURRICULUM_CREDIT_RULES = {
  fromImage: {
    api: 'POST /api/curriculum-from-image',
    chargeWhen: 'Sau khi tạo xong markdown + slide (cùng request); metadata có contentHash.',
  },
} as const

export const CURRICULUM_UI_CREDITS = {
  /** createCurriculum (chủ đề) hoặc POST /api/curriculum-from-image — mỗi lần tạo bằng AI */
  createOrFromImage: 1,
  /** Job tách phiếu từ ảnh SGK (ước tính mỗi lần chạy) */
  sgkExtractJob: 1,
  /** Mỗi câu trắc nghiệm / mỗi bài tự luận (step-by-step, theo số lượng chọn) */
  worksheetQuestion: 1,
  /** So sánh 2 AI trước khi áp dụng sửa đoạn (Sửa giáo trình) */
  curriculumEditApply: 1,
  /** Kiểm tra / Lưu câu có gọi AI (popup sửa phiếu) */
  worksheetEditCheck: 1,
  worksheetEditSave: 1,
  /** Kiểm tra AI cho đề xuất sửa/bổ sung slide (nút "Kiểm tra AI"). */
  slideProposalAICheck: 0.5,
  /** Tạo câu trắc nghiệm trên slide (GV) */
  slideGenerateQuiz: 0.5,
  /** Tạo slide theo 1 tiết (chỉ khi tiết đó chưa có cache) */
  lessonSlideGenerate: 0.5,
  /** Infographic slide (Flash + ảnh 2K gemini-3-pro-image) — POST /api/curriculum-slide-infographic */
  slideInfographic2K: 1.5,
} as const

export function formatCurriculumCredits(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}
