'use client'

import {
  CUSTOMER_ERROR_LIMITS as L,
  clipText,
  isExpectedCustomerMessage,
} from '@/lib/errors/customer-error-filter'

const recent = new Map<string, number>()
const SAME_ERROR_COOLDOWN_MS = 60_000

/** Gửi lỗi khách vừa thấy về `/api/error-reports`. Không throw, không chặn UI. */
export function reportCustomerErrorClient(input: {
  source: 'toast' | 'boundary'
  title?: string
  message: string
  detail?: string
  digest?: string
}): void {
  if (typeof window === 'undefined') return
  const path = window.location.pathname + window.location.search
  if (path.startsWith('/admin')) return
  const title = clipText(input.title, L.title)
  const message = clipText(input.message, L.message)
  if (isExpectedCustomerMessage(title, message)) return

  const key = `${window.location.pathname}\n${title}\n${message}`
  const now = Date.now()
  const last = recent.get(key)
  if (last && now - last < SAME_ERROR_COOLDOWN_MS) return
  recent.set(key, now)

  try {
    void fetch('/api/error-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        source: input.source,
        path: clipText(path, L.path),
        title,
        message,
        detail: clipText(input.detail, L.detail),
        digest: clipText(input.digest, L.digest),
      }),
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}
