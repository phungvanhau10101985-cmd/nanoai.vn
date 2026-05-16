'use client'

import { flushSync } from 'react-dom'
import { preloadImageUrl } from '@/lib/preload-image-url'

/** Để kịp vẽ màn GENERATING trước khi chạy server action (double rAF). */
export function waitForNextPaintClient(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

export async function finalizeStandardImageGenerationResult(
  rawResult: unknown,
  handlers: {
    onServerErrorMessage: (message: string) => void
    onSuccessWithUrl: (imageUrl: string) => void
    onUnexpectedPayload: () => void
  },
): Promise<void> {
  let serverErr: string | undefined
  let resultUrl: string | undefined
  let success = false

  if (rawResult && typeof rawResult === 'object') {
    const r = rawResult as Record<string, unknown>
    if (typeof r.error === 'string' && r.error.trim()) serverErr = r.error.trim()
    if (typeof r.resultUrl === 'string' && r.resultUrl.trim()) resultUrl = r.resultUrl.trim()
    success = r.success === true
  }

  if (serverErr) {
    handlers.onServerErrorMessage(serverErr)
    return
  }

  if (success && resultUrl) {
    await preloadImageUrl(resultUrl).catch(() => {})
    flushSync(() => handlers.onSuccessWithUrl(resultUrl!))
    return
  }

  handlers.onUnexpectedPayload()
}
