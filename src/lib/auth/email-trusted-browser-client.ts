/** ID trình duyệt ổn định — dùng chung NanoAI login, chat guest, web shop. */
export const EMAIL_TRUSTED_BROWSER_STORAGE_KEY = 'app_email_trusted_browser_id'

export function getStableEmailTrustedBrowserId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const current = window.localStorage.getItem(EMAIL_TRUSTED_BROWSER_STORAGE_KEY)?.trim() || ''
    if (/^[a-z0-9_-]{16,128}$/i.test(current)) return current.toLowerCase()
    const created = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 16)}`
      .replace(/[^a-z0-9_-]/gi, '')
      .toLowerCase()
      .slice(0, 64)
    window.localStorage.setItem(EMAIL_TRUSTED_BROWSER_STORAGE_KEY, created)
    return created
  } catch {
    return ''
  }
}
