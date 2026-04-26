/** Nhãn hiển thị ngắn gọn cho model trong biểu đồ / bảng admin. */
export function getApiUsageModelDisplayLabel(model: string): string {
  const known: Record<string, string> = {
    // Gemini 3.1 (preview, 2026-04)
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
    'gemini-3.1-pro-preview-customtools': 'Gemini 3.1 Pro (custom tools)',
    'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash-Lite',
    'gemini-3.1-flash-image-preview': 'Gemini 3.1 Flash Image',
    'gemini-3.1-flash-tts-preview': 'Gemini 3.1 Flash TTS',
    'gemini-3.1-flash-live-preview': 'Gemini 3.1 Flash Live',
    // Gemini 3 (preview)
    'gemini-3-pro-image-preview': 'Gemini 3 Pro Image',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-3-pro-preview': 'Gemini 3 Pro',
    // Gemini 2.5
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-pro-preview-tts': 'Gemini 2.5 Pro TTS',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-preview-09-2025': 'Gemini 2.5 Flash (preview)',
    'gemini-2.5-flash-preview-tts': 'Gemini 2.5 Flash TTS',
    'gemini-2.5-flash-native-audio-preview-12-2025': 'Gemini 2.5 Flash Native Audio',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
    'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
    'gemini-2.5-computer-use-preview-10-2025': 'Gemini 2.5 Computer Use',
    // Gemini 2.0
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.0-flash-lite': 'Gemini 2.0 Flash-Lite',
    // Gemini Robotics-ER
    'gemini-robotics-er-1.5-preview': 'Gemini Robotics-ER 1.5',
    'gemini-robotics-er-1.6-preview': 'Gemini Robotics-ER 1.6',
    // Gemini Embedding
    'gemini-embedding-001': 'Gemini Embedding',
    'gemini-embedding-2-preview': 'Gemini Embedding 2 (preview)',
    'gemini-embedding-2': 'Gemini Embedding 2',
    // Veo / Imagen / Lyria (charge per second/image/song, not per token)
    'veo-3.1-generate-preview': 'Veo 3.1 Standard',
    'veo-3.1-fast-generate-preview': 'Veo 3.1 Fast',
    'veo-3.1-lite-generate-preview': 'Veo 3.1 Lite',
    'veo-3.0-generate-001': 'Veo 3 Standard',
    'veo-3.0-fast-generate-001': 'Veo 3 Fast',
    'veo-2.0-generate-001': 'Veo 2',
    'imagen-4.0-generate-001': 'Imagen 4 Standard',
    'imagen-4.0-fast-generate-001': 'Imagen 4 Fast',
    'imagen-4.0-ultra-generate-001': 'Imagen 4 Ultra',
    'lyria-3-clip-preview': 'Lyria 3 Clip',
    'lyria-3-pro-preview': 'Lyria 3 Pro',
    // OpenAI
    'gpt-5': 'GPT-5',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o mini',
    'gpt-4o-mini-tts': 'GPT-4o mini TTS',
    'gpt-4-turbo': 'GPT-4 Turbo',
    // DeepSeek
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-reasoner': 'DeepSeek Reasoner',
  }
  if (known[model]) return known[model]
  const lower = model.toLowerCase()
  if (lower.includes('vision') || lower.includes('cloud-vision')) return 'Google Cloud Vision'
  return model
}
