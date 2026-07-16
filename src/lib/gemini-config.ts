/**
 * Cấu hình chung cho Gemini 2.5 Flash.
 * Lưu ý: thinkingBudget không được API hỗ trợ cho gemini-2.5-flash.
 */
export const GEMINI_25_FLASH_NO_THINKING = {
  model: 'gemini-2.5-flash' as const,
}

/** Gemini 1.5 Flash – dùng cho tác vụ cần tốc độ cao, chi phí thấp (vd: tạo slide theo từng tiết). */
export const GEMINI_15_FLASH = {
  model: 'gemini-1.5-flash' as const,
}

/** Alias cùng cấu hình text; SDK @google/generative-ai không khai báo responseModalities trong GenerationConfig. */
export const GEMINI_25_FLASH_TEXT_NO_THINKING = GEMINI_25_FLASH_NO_THINKING

/** Gemini 2.5 Pro – model mạnh hơn cho tác vụ cần độ chính xác cao (ví dụ: tạo câu trắc nghiệm). */
export const GEMINI_25_PRO = {
  model: 'gemini-2.5-pro' as const,
}

/** Nano Banana Pro — Gemini 3 Pro Image (tier cao nhất tạo/sửa ảnh). */
export const GEMINI_3_PRO_IMAGE = {
  model: 'gemini-3-pro-image' as const,
}
