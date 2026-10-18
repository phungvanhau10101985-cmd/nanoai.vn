import { hashMetaCapiEmail, hashMetaCapiPhone } from '@/lib/tracking/meta-capi-hash'
import { normalizeMetaExternalId, normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'

export type MetaCapiUserDataInput = {
  clientIp?: string | null
  userAgent?: string | null
  fbc?: string | null
  fbp?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  /** ID khách thô. Meta không bắt buộc băm `external_id`. */
  externalId?: string | null
}

/** `user_data` CAPI: IP, UA, fbp, fbc, email/SĐT đã băm, external_id thô. */
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
  const externalId = normalizeMetaExternalId(params.externalId)
  if (externalId) user_data.external_id = [externalId]
  return user_data
}
