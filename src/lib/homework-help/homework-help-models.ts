import { DEEPSEEK_V4_PRO } from '@/lib/deepseek-api'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

/** Đọc ảnh bài: Gemini 2.5 Flash. DeepSeek V4 Pro không nhận ảnh. */
export const HOMEWORK_HELP_READ_MODEL = GEMINI_25_FLASH_NO_THINKING.model

/**
 * Soạn kiến thức, hướng tư duy và gợi ý.
 * DeepSeek V4 Pro, thinking bật (reasoner). API này chỉ nhận chữ.
 * Đề có hình thì không gọi model này.
 */
export const HOMEWORK_HELP_DRAFT_MODEL = DEEPSEEK_V4_PRO

/**
 * Gemini 2.5 Pro trả kết quả để đối chiếu đề chữ mà DeepSeek đã giải.
 * DeepSeek không giải thì Gemini viết đủ kiến thức, hướng tư duy và đáp án, kèm ảnh nếu đề có hình.
 */
export const HOMEWORK_HELP_FALLBACK_MODEL = GEMINI_25_PRO.model

/** GPT giải riêng. DeepSeek không giải thì GPT chỉ trả kết quả để đối chiếu với bài của Gemini. */
export const HOMEWORK_HELP_GPT_MODEL = 'gpt-5'

/** Trần token nghĩ của Pro, để còn chỗ viết JSON trước khi hết giờ. */
export const HOMEWORK_HELP_FALLBACK_THINKING_BUDGET = 8_192
/** Lượt hỏi cùng kết quả, ngắn hơn lượt giải. */
export const HOMEWORK_HELP_JUDGE_THINKING_BUDGET = 4_096
export const HOMEWORK_HELP_JUDGE_MAX_TOKENS = 2_048

/** Trần token ra của reasoner, gồm cả đoạn nghĩ, để JSON không bị cắt giữa chừng. */
export const HOMEWORK_HELP_DRAFT_MAX_TOKENS = 16_384
export const HOMEWORK_HELP_FALLBACK_MAX_TOKENS = 16_384
export const HOMEWORK_HELP_GPT_MAX_TOKENS = 16_384
export const HOMEWORK_HELP_READ_MAX_TOKENS = 16_384
