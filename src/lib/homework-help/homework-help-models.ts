import { DEEPSEEK_V4_PRO } from '@/lib/deepseek-api'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

/** Đọc ảnh bài: Gemini 2.5 Flash. DeepSeek V4 Pro không nhận ảnh. */
export const HOMEWORK_HELP_READ_MODEL = GEMINI_25_FLASH_NO_THINKING.model

/**
 * Soạn kiến thức, hướng tư duy, gợi ý và đáp án nháp.
 * DeepSeek V4 Pro, thinking bật (reasoner). Chỉ chữ, không gửi lại ảnh.
 */
export const HOMEWORK_HELP_DRAFT_MODEL = DEEPSEEK_V4_PRO

/**
 * Gemini 2.5 Pro chỉ trả kết quả để đối chiếu với DeepSeek.
 * Không viết kiến thức, gợi ý hay bước giải.
 */
export const HOMEWORK_HELP_FALLBACK_MODEL = GEMINI_25_PRO.model

/** GPT giải lại khi DeepSeek và Gemini Pro không khớp. */
export const HOMEWORK_HELP_GPT_MODEL = 'gpt-5'

/** Trần token nghĩ của Pro, để còn chỗ viết JSON trước khi hết giờ. */
export const HOMEWORK_HELP_FALLBACK_THINKING_BUDGET = 8_192

/** Dòng kiến thức đúng hay sai. Flash, vì đáp án đã được đối chiếu. */
export const HOMEWORK_HELP_GRADE_MODEL = GEMINI_25_FLASH_NO_THINKING.model

/** Trần token ra của reasoner, gồm cả đoạn nghĩ, để JSON không bị cắt giữa chừng. */
export const HOMEWORK_HELP_DRAFT_MAX_TOKENS = 16_384
export const HOMEWORK_HELP_FALLBACK_MAX_TOKENS = 16_384
export const HOMEWORK_HELP_GPT_MAX_TOKENS = 16_384
export const HOMEWORK_HELP_GRADE_MAX_TOKENS = 2_048
export const HOMEWORK_HELP_READ_MAX_TOKENS = 16_384
