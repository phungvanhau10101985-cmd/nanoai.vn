import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

/**
 * Đọc ảnh bài: Gemini 2.5 Flash.
 * Ảnh chiếm gần hết token đầu vào. Pro khoảng $1.25 / 1M token vào, Flash $0.30 — đắt hơn khoảng 4 lần mà bài ảnh không cần Pro.
 */
export const HOMEWORK_HELP_READ_MODEL = GEMINI_25_FLASH_NO_THINKING.model

/**
 * Soạn kiến thức, hướng tư duy, gợi ý và đáp án nháp. Pro, chỉ chữ, không gửi lại ảnh.
 * Flash cân bằng sai phản ứng oxi hóa-khử nhiều bước, lệch Pro nên đáp án bị giấu.
 */
export const HOMEWORK_HELP_DRAFT_MODEL = GEMINI_25_PRO.model

/**
 * Kiểm tra chéo: Gemini 2.5 Pro, chỉ chữ.
 * Pro tự giải đáp án (không thấy đáp án nháp) và đánh dấu từng dòng kiến thức đúng hay sai.
 * Đầu ra Pro $10 / 1M token nhưng payload kiểm tra ngắn. Mỗi đề chỉ gọi một lần rồi cache.
 */
export const HOMEWORK_HELP_CHECK_MODEL = GEMINI_25_PRO.model

/** Chữa bài làm của học sinh. Flash đủ vì đáp án đã kiểm tra lấy từ cache và không được viết ra. */
export const HOMEWORK_HELP_REVIEW_MODEL = GEMINI_25_FLASH_NO_THINKING.model
