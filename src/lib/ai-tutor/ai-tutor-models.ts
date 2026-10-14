import { DEEPSEEK_V4_PRO } from '@/lib/deepseek-api'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

/** Phân loại chủ đề và đọc ảnh bài: Gemini Flash. DeepSeek Pro không nhận ảnh. */
export const AI_TUTOR_FLASH_MODEL = GEMINI_25_FLASH_NO_THINKING.model

/**
 * Soạn bài: DeepSeek V4 Pro, thinking bật.
 * Chỉ chạy khi chủ đề chưa có trong kho.
 */
export const AI_TUTOR_DRAFT_MODEL = DEEPSEEK_V4_PRO

/**
 * Kiểm tra chéo trước khi lưu dùng chung: DeepSeek V4 Pro, thinking bật.
 * Chỉ chạy khi chủ đề hoặc nhãn chưa có trong kho. Lần sau đọc bản đã lưu.
 */
export const AI_TUTOR_CHECK_MODEL = DEEPSEEK_V4_PRO
