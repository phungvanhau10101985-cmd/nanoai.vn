/**
 * Giá credits hiển thị trên UI luồng giáo trình / phiếu.
 * Khi bật trừ credit phía server, giữ khớp các giá trị này.
 *
 * ── Quy tắc chung (DB trước, AI sau) ──
 * - Có thể phục vụ từ DB / dữ liệu đã lưu → **không** gọi AI → **không** trừ credit.
 * - Phải gọi AI tạo mới → trừ credit theo mức dưới (server đã gắn spend: xem từng API).
 *
 * Đã gắn trừ server (có miễn phí lần đầu — xem `curriculum-ai-charge-policy`):
 * - `POST /api/curriculum-from-image`: 1 credit khi ghi đè / vượt 2 bài mới/ngày
 * - slide theo tiết: 0.5 credit khi tạo lại (lần đầu/tiết miễn phí)
 * - infographic: GPT medium 1 credit, high 2 credit khi tạo lại (lần đầu miễn phí)
 * - tạo từng câu: 5 trắc nghiệm + 5 tự luận đầu của mỗi giáo trình miễn phí. Câu thêm 0,5 credit. Không trần theo giáo viên.
 * - tách ảnh SGK: một lần miễn phí trên mỗi giáo trình. Tách lại: 1 credit.
 * Chưa gắn spend: curriculum-from-paste, curriculum-edit-check, worksheet-edit-check,
 * worksheet-generate-*, các job phiếu khác — v.v.
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
  /** Tách lại phiếu từ ảnh SGK. Lần đầu trên giáo trình thì miễn phí. */
  sgkExtractJob: 1,
  /** Mỗi câu trắc nghiệm / tự luận sau suất miễn phí (5 câu/loại trên giáo trình và 5 câu/loại/ngày). */
  worksheetQuestion: 0.5,
  /** So sánh 2 AI trước khi áp dụng sửa đoạn (Sửa giáo trình) */
  curriculumEditApply: 1,
  /** Sửa phiếu không trừ credit. Người sửa dùng ngay bản của mình; bản chung đổi sau 7 xác nhận. */
  worksheetEditCheck: 0,
  worksheetEditSave: 0,
  /** Kiểm tra AI cho đề xuất sửa/bổ sung slide (nút "Kiểm tra AI"). */
  slideProposalAICheck: 0.5,
  /** Tạo câu trắc nghiệm trên slide (GV) */
  slideGenerateQuiz: 0.5,
  /** Tạo slide theo 1 tiết (chỉ khi tiết đó chưa có cache) */
  lessonSlideGenerate: 0.5,
  /** Infographic giáo trình, mức mặc định GPT medium. High là 2. POST /api/curriculum-slide-infographic */
  slideInfographic2K: 1,
} as const

export function formatCurriculumCredits(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}
