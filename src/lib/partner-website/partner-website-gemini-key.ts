/** Gemini SDK — project dùng GOOGLE_API_KEY; GEMINI_API_KEY giữ tương thích cũ. */
export function resolvePartnerWebsiteGeminiApiKey(): string | null {
  return process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || null
}
