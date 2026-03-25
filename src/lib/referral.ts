/** Lưu UUID người mời khi khách mở ?ref= hoặc ?invite= */
export const REFERRAL_STORAGE_KEY = 'nanoai_referrer_id'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseReferrerUuid(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s || !UUID_RE.test(s)) return null
  return s.toLowerCase()
}
