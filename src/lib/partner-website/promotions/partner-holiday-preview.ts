import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  isPartnerHolidayThemeId,
  type PartnerHolidayThemeId,
} from '@/lib/partner-website/promotions/partner-holiday-schedule'

export const PARTNER_HOLIDAY_PREVIEW_TTL_SECONDS = 10 * 60
export const PARTNER_HOLIDAY_PREVIEW_MS = PARTNER_HOLIDAY_PREVIEW_TTL_SECONDS * 1000
export const PARTNER_HOLIDAY_ADMIN_PREVIEW_KEY = 'nanoai-holiday-admin-preview'

function previewSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev'
}

export function issuePartnerHolidayPreviewToken(
  code: string,
  now = Math.floor(Date.now() / 1000)
): { token: string; expiresAt: number } {
  if (!isPartnerHolidayThemeId(code)) {
    throw new Error('Dịp lễ không có trong danh sách')
  }
  const expiresAt = now + PARTNER_HOLIDAY_PREVIEW_TTL_SECONDS
  const payload = `${code}.${expiresAt}`
  const sig = createHmac('sha256', previewSecret()).update(payload).digest('hex').slice(0, 32)
  return { token: `${payload}.${sig}`, expiresAt }
}

export function parsePartnerHolidayPreviewToken(
  token: string,
  now = Math.floor(Date.now() / 1000)
): { code: PartnerHolidayThemeId; expiresAt: number } | null {
  const parts = String(token || '').trim().split('.')
  if (parts.length !== 3) return null
  const [code, expText, sig] = parts
  if (!isPartnerHolidayThemeId(code) || !/^\d+$/.test(expText) || sig.length !== 32) return null
  const payload = `${code}.${expText}`
  const expected = createHmac('sha256', previewSecret()).update(payload).digest('hex').slice(0, 32)
  const left = Buffer.from(expected)
  const right = Buffer.from(sig)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  const expiresAt = Number(expText)
  if (!Number.isFinite(expiresAt) || now >= expiresAt) return null
  return { code, expiresAt }
}

