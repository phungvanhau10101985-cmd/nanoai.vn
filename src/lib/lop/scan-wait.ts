const KEY_PREFIX = 'nanoai-exam-paper-deadline:'

export function paperDeadlineStorageKey(code: string): string {
  return `${KEY_PREFIX}${code.trim().toUpperCase()}`
}

/** Mốc hết giờ của đề đang chiếu. Cùng một trình duyệt, mọi chỗ quét đọc chung. */
export function readPaperDeadline(code: string): number | null {
  if (typeof window === 'undefined' || !code.trim()) return null
  const key = paperDeadlineStorageKey(code)
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  } catch {
    return null
  }
  const value = raw ? Number(raw) : NaN
  return Number.isFinite(value) ? value : null
}

export function writePaperDeadline(code: string, at: number): void {
  if (typeof window === 'undefined' || !code.trim()) return
  const key = paperDeadlineStorageKey(code)
  const text = String(at)
  try { window.localStorage.setItem(key, text) } catch { /* ignore */ }
  try { window.sessionStorage.setItem(key, text) } catch { /* ignore */ }
}

export function formatScanClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
