import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

/** Phân loại chủ đề và soạn lời giải dễ hiểu: Flash, chỉ chữ. */
export const AI_TUTOR_DRAFT_MODEL = GEMINI_25_FLASH_NO_THINKING.model

/**
 * Kiểm tra chéo trước khi lưu dùng chung: Gemini 2.5 Pro.
 * Pro chỉ chạy khi chủ đề hoặc nhãn chưa có trong kho. Lần sau đọc bản đã lưu.
 */
export const AI_TUTOR_CHECK_MODEL = GEMINI_25_PRO.model
