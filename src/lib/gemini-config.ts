/**
 * Cấu hình chung cho Gemini 2.5 Flash.
 * Lưu ý: thinkingBudget không được API hỗ trợ cho gemini-2.5-flash.
 */
export const GEMINI_25_FLASH_NO_THINKING = {
  model: 'gemini-2.5-flash' as const,
}

/** Gemini 2.5 Flash với responseModalities TEXT (dùng khi cần output text thuần). */
export const GEMINI_25_FLASH_TEXT_NO_THINKING = {
  model: 'gemini-2.5-flash' as const,
  generationConfig: { responseModalities: ['TEXT'] as const },
}
