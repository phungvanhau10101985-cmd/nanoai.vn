import { createHash } from 'node:crypto'
import { hashMetaCapiEmail, hashMetaCapiPhone } from '@/lib/tracking/meta-capi-hash'
import { normalizeMetaExternalId, normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'

export type MetaCapiCustomerInfo = {
  fn?: string | null
  ln?: string | null
  ge?: string | null
  db?: string | null
  ct?: string | null
  st?: string | null
  zp?: string | null
  country?: string | null
}

const CAPI_INFO_KEYS = ['fn', 'ln', 'ge', 'db', 'ct', 'st', 'zp', 'country'] as const

export type MetaCapiUserDataInput = {
  clientIp?: string | null
  userAgent?: string | null
  fbc?: string | null
  fbp?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  /** ID khách thô. Meta không bắt buộc băm `external_id`. */
  externalId?: string | null
  /** Tên, giới tính, ngày sinh, địa chỉ — plaintext đã chuẩn hoá, băm tại đây. */
  customerInfo?: MetaCapiCustomerInfo | null
}

function hashNormalizedInfo(key: (typeof CAPI_INFO_KEYS)[number], raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value || value.length > 80) return null
  if (key === 'ge' && value !== 'm' && value !== 'f') return null
  if (key === 'db' && !/^\d{8}$/.test(value)) return null
  if (key === 'country' && !/^[a-z]{2}$/.test(value)) return null
  if (key === 'zp' && !/^[a-z0-9]{3,10}$/.test(value)) return null
  if ((key === 'fn' || key === 'ln') && !/^[a-z0-9 ]+$/.test(value)) return null
  if ((key === 'ct' || key === 'st') && !/^[a-z0-9]+$/.test(value)) return null
  return createHash('sha256').update(value).digest('hex')
}

/** `user_data` CAPI: IP, UA, fbp, fbc, email/SĐT/tên/địa chỉ đã băm, external_id thô. */
export function buildMetaCapiUserData(params: MetaCapiUserDataInput): Record<string, string | string[]> {
  const user_data: Record<string, string | string[]> = {}
  const ip = String(params.clientIp ?? '').trim()
  if (ip && /^[\d.:a-fA-Fx]+$/.test(ip)) user_data.client_ip_address = ip
  const ua = String(params.userAgent ?? '').trim()
  if (ua) user_data.client_user_agent = ua.slice(0, 512)
  const fbc = normalizeMetaFbc(params.fbc)
  if (fbc) user_data.fbc = fbc
  const fbp = normalizeMetaFbp(params.fbp)
  if (fbp) user_data.fbp = fbp
  const emHash = hashMetaCapiEmail(params.customerEmail)
  if (emHash) user_data.em = [emHash]
  const phHash = hashMetaCapiPhone(params.customerPhone)
  if (phHash) user_data.ph = [phHash]
  const info = params.customerInfo
  if (info) {
    for (const key of CAPI_INFO_KEYS) {
      const hashed = hashNormalizedInfo(key, info[key])
      if (hashed) user_data[key] = [hashed]
    }
  }
  const externalId = normalizeMetaExternalId(params.externalId)
  if (externalId) user_data.external_id = [externalId]
  return user_data
}
