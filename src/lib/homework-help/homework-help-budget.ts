/**
 * Nginx nanoai.vn cắt POST /ho-tro-lam-bai sau 300s.
 * Đọc ảnh, rồi DeepSeek và Gemini Pro chạy cùng lúc. Không khớp thì GPT giải lại trong phần thời gian còn lại.
 * Lần gọi cuối dừng trước mốc này 15s để còn chỗ trả lời.
 */
export const HOMEWORK_HELP_BUDGET_MS = 290_000
/** Effort low vẫn nghĩ khoảng 8 nghìn token và viết JSON trong ~110s. High ăn hết trần token nên không còn câu trả lời. */
export const HOMEWORK_PRO_CALL_MS = 120_000
export const HOMEWORK_FLASH_CALL_MS = 35_000

const RESPONSE_SLACK_MS = 15_000
const MIN_CALL_MS = 20_000

/** Thời gian còn được phép cho một lần generateContent. null = hết ngân sách, bỏ qua. */
export function homeworkCallTimeoutMs(startedAt: number, now: number, preferredMs: number): number | null {
  if (preferredMs < MIN_CALL_MS) return null
  const elapsed = Math.max(0, now - startedAt)
  const left = HOMEWORK_HELP_BUDGET_MS - elapsed - RESPONSE_SLACK_MS
  if (left < MIN_CALL_MS) return null
  return Math.min(preferredMs, left)
}
