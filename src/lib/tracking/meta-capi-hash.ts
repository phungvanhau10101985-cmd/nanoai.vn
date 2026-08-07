import { createHash } from 'node:crypto'

/**
 * S0.3 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — hash SHA-256 cho email/SĐT trước khi gửi
 * Meta CAPI (Advanced Matching). Xem docs/188_BEHAVIOR_SPEC.md mục E.4 — bắt buộc chuẩn hoá trước
 * khi hash: email lowercase+trim, SĐT chỉ giữ chữ số + về định dạng quốc gia (VN: 84xxxxxxxxx).
 */

export function hashMetaCapiEmail(rawEmail: string | null | undefined): string | null {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return createHash('sha256').update(email).digest('hex')
}

/** Chuẩn hoá SĐT VN về dạng quốc tế không dấu `+` (vd `0987654321` -> `84987654321`) trước khi hash. */
export function normalizeVnPhoneForMetaCapi(rawPhone: string | null | undefined): string | null {
  const digits = String(rawPhone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('84') && digits.length >= 10) return digits
  if (digits.startsWith('0') && digits.length >= 9) return `84${digits.slice(1)}`
  if (digits.length >= 9) return `84${digits}`
  return null
}

export function hashMetaCapiPhone(rawPhone: string | null | undefined): string | null {
  const normalized = normalizeVnPhoneForMetaCapi(rawPhone)
  if (!normalized) return null
  return createHash('sha256').update(normalized).digest('hex')
}
