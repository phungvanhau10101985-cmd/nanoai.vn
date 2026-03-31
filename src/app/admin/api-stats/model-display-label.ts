/** Nhãn hiển thị ngắn gọn cho model trong biểu đồ / bảng admin. */
export function getApiUsageModelDisplayLabel(model: string): string {
  const known: Record<string, string> = {
    'gemini-3-pro-image-preview': 'Gemini 3 Pro Image',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-3-pro-preview': 'Gemini 3 Pro',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-preview-09-2025': 'Gemini 2.5 Flash (preview)',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
    'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.0-flash-lite': 'Gemini 2.0 Flash-Lite',
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-reasoner': 'DeepSeek Reasoner',
    'gpt-5': 'GPT-5',
    'gpt-4o': 'GPT-4o',
    'gpt-4-turbo': 'GPT-4 Turbo',
  }
  if (known[model]) return known[model]
  const lower = model.toLowerCase()
  if (lower.includes('vision') || lower.includes('cloud-vision')) return 'Google Cloud Vision'
  return model
}
