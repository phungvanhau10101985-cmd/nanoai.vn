/**
 * Hướng dẫn chuẩn cho AI khi tạo nội dung toán/giáo dục.
 * Dùng trong các prompt generateContent – đảm bảo output Unicode dễ đọc cho học sinh.
 */
export const AI_UNICODE_READABLE =
  'CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode chuẩn, KHÔNG LaTeX $...$. Ví dụ: π, ∫, x², 1/2, √, ∞, ∈, ℝ, ⇒, log₂(x), ∫[a→b], {0;1}. Phân số: 1/2 hoặc ½. Căn: √(x+1). Bảng: +∞, −∞.'

export const AI_UNICODE_READABLE_SHORT =
  'BẮT BUỘC Unicode dễ đọc (π, ∫, ², √, ½, log₂, ∫[a→b]) – KHÔNG LaTeX $...$.'
