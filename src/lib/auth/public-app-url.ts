/**
 * URL gốc công khai (https://domain) — dùng trong email magic link; không có dấu / cuối.
 * Ưu tiên APP_URL (chỉ server) để link trong email đúng domain production dù NEXT_PUBLIC_* build cũ.
 */
export function getPublicAppUrlForServer(): string {
  const candidates = [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_BASE_URL]
  for (const c of candidates) {
    const t = c?.trim().replace(/\/$/, '')
    if (t) return t
  }
  return 'http://localhost:3000'
}
