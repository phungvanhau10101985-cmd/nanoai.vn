/** Chỉ cho quay lại đúng trang làm bài của phiên này. */
export function examReturnPath(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value.startsWith('/lam-bai/')) return null
  if (value.includes('://') || value.includes('\\') || value.includes('//')) return null
  const code = value.slice('/lam-bai/'.length).split(/[?#]/)[0]
  if (!/^[A-Za-z0-9]{4,32}$/.test(code)) return null
  return `/lam-bai/${code.toUpperCase()}`
}
