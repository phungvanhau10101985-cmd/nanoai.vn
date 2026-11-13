import { redactApiKey } from '@/lib/security/secret-vault'

/** URL Gemini không gắn API key. Key đi header `x-goog-api-key` để khỏi lọt access log. */
export function geminiModelUrl(model: string, action: 'generateContent' | 'embedContent'): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${action}`
}

export function geminiJsonHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey.trim(),
  }
}

export function clipGeminiError(body: string, apiKey: string, max = 300): string {
  return redactApiKey(body, apiKey).slice(0, max)
}
