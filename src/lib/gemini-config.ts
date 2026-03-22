/**
 * Cấu hình chung cho Gemini 2.5 Flash.
 * Lưu ý: thinkingBudget không được API hỗ trợ cho gemini-2.5-flash.
 */
export const GEMINI_25_FLASH_NO_THINKING = {
  model: 'gemini-2.5-flash' as const,
}

/** Alias cùng cấu hình text; SDK @google/generative-ai không khai báo responseModalities trong GenerationConfig. */
export const GEMINI_25_FLASH_TEXT_NO_THINKING = GEMINI_25_FLASH_NO_THINKING

/** Gemini 2.5 Pro – model mạnh hơn cho tác vụ cần độ chính xác cao (ví dụ: tạo câu trắc nghiệm). */
export const GEMINI_25_PRO = {
  model: 'gemini-2.5-pro' as const,
}
