/**
 * Nginx chỉ đường /ho-tro-lam-bai cắt sau 500s. Các trang khác vẫn 300s.
 * Đọc ảnh, rồi DeepSeek và Gemini Pro chạy cùng lúc. Không khớp thì GPT giải lại trong phần thời gian còn lại.
 * Lần gọi cuối dừng trước mốc này 15s để còn chỗ trả lời.
 */
export const HOMEWORK_HELP_BUDGET_MS = 490_000
/**
 * DeepSeek V4 Pro, effort low. Đo khoảng 110s; trần 120s đã cắt một lượt chưa viết xong JSON.
 * 240s vẫn chừa hơn 3 phút cho GPT sau khi đọc ảnh.
 */
export const HOMEWORK_DRAFT_CALL_MS = 240_000
/** Gemini 2.5 Pro chỉ trả đáp án. Đo 41s trên một bài hóa. Chạy song song với DeepSeek. */
export const HOMEWORK_GEMINI_CALL_MS = 120_000
/** GPT-5 chỉ trả đáp án. Đo 77s khi nghĩ mức mặc định. Lượt muộn bị rút theo thời gian còn lại. */
export const HOMEWORK_GPT_CALL_MS = 150_000
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
