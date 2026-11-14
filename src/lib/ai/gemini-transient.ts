/** Gọi lại khi Gemini báo quá tải hoặc đứt mạng. Lỗi nội dung không gọi lại. */

export function isTransientGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /\[503|\[429|\[500|service unavailable|unavailable|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|overloaded|resource exhausted|internal server error/i.test(
    message
  )
}

export async function withTransientGeminiRetry<T>(
  run: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number }
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3)
  const delayMs = options?.delayMs ?? 800
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run()
    } catch (error) {
      last = error
      if (attempt >= attempts || !isTransientGeminiError(error)) throw error
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }
  throw last
}
