/**
 * So khớp nâng cao Meta (tham số thứ ba của `fbq('init')`).
 * Giá trị plaintext đã chuẩn hoá — pixel tự băm SHA-256. Không gửi email giả.
 */
import { parseIsoDateOfBirth } from '@/lib/partner-website/shop/partner-site-profile-demographics'
import { matchVietnamProvince } from '@/lib/partner-website/shop/vietnam-provinces'

export const META_ADVANCED_MATCHING_KEYS = [
  'em',
  'ph',
  'fn',
  'ln',
  'ge',
  'db',
  'ct',
  'st',
  'zp',
  'country',
  'external_id',
] as const

export type MetaAdvancedMatchingKey = (typeof META_ADVANCED_MATCHING_KEYS)[number]

/** Trường CAPI băm thêm (email / SĐT / external_id đi đường riêng). */
export const META_CAPI_INFO_KEYS = ['fn', 'ln', 'ge', 'db', 'ct', 'st', 'zp', 'country'] as const

const VN_MUNICIPALITIES = new Set(['Hà Nội', 'Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ'])

export type PartnerSiteMetaAdvancedMatching = {
  email?: string | null
  phone?: string | null
  fullName?: string | null
  externalId?: string | null
  gender?: string | null
  dateOfBirth?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  shippingAddress?: string | null
}

export function partnerSiteMetaAmStorageKey(siteSlug: string): string {
  const slug = siteSlug.trim().toLowerCase()
  return slug ? `pw_meta_am:${slug}` : ''
}

function foldMetaText(raw: string): string {
  return raw
    .replace(/đ/gi, 'd')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function foldMetaCompact(raw: string): string {
  return foldMetaText(raw).replace(/\s+/g, '')
}

function splitPersonName(fullName: string): { fn?: string; ln?: string } {
  const folded = foldMetaText(fullName)
  if (!folded) return {}
  const parts = folded.split(' ')
  if (parts.length === 1) return { fn: parts[0] }
  return { ln: parts[0], fn: parts.slice(1).join(' ') }
}

/** SĐT về dạng chữ số có mã quốc gia, không dấu `+`. Số nội địa coi là Việt Nam. */
export function normalizeMetaAdvancedPhone(raw: string | null | undefined): string | undefined {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return undefined
  if (digits.startsWith('84') && digits.length >= 10) return digits
  if (digits.startsWith('0') && digits.length >= 9) return `84${digits.slice(1)}`
  if (digits.length >= 9) return `84${digits}`
  return undefined
}

function normalizeEmail(raw: string | null | undefined): string | undefined {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined
  return email
}

function normalizeGender(raw: string | null | undefined): 'm' | 'f' | undefined {
  const g = foldMetaText(String(raw ?? ''))
  if (g === 'm' || g === 'male' || g === 'nam') return 'm'
  if (g === 'f' || g === 'female' || g === 'nu') return 'f'
  return undefined
}

function normalizeDob(raw: string | null | undefined): string | undefined {
  const text = String(raw ?? '').trim()
  if (!text) return undefined
  const digits = text.replace(/\D/g, '')
  const iso = /^\d{8}$/.test(digits)
    ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    : text.slice(0, 10)
  if (!parseIsoDateOfBirth(iso)) return undefined
  return iso.replace(/-/g, '')
}

function normalizeCountry(raw: string | null | undefined): string | undefined {
  const compact = foldMetaCompact(String(raw ?? ''))
  if (!compact) return undefined
  if (compact === 'vn' || compact === 'vietnam') return 'vn'
  if (/^[a-z]{2}$/.test(compact)) return compact
  return undefined
}

function normalizeZip(raw: string | null | undefined): string | undefined {
  const zip = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (zip.length < 3 || zip.length > 10) return undefined
  return zip
}

/** Mã bưu chính 6 số nếu khách đã ghi trong địa chỉ. Không đoán mã theo tỉnh. */
export function metaPostalCodeFromAddress(raw: string | null | undefined): string | undefined {
  const match = String(raw ?? '').match(/(?:^|[^\d])(\d{6})(?=[^\d]|$)/)
  return match?.[1]
}

function normalizeExternalId(raw: string | null | undefined): string | undefined {
  const id = String(raw ?? '').trim()
  if (id.length < 2 || id.length > 128) return undefined
  if (id.includes('@') || /\s/.test(id)) return undefined
  return id
}

export function pickMetaAdvancedMatching(src: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!src) return out
  for (const key of META_ADVANCED_MATCHING_KEYS) {
    const value = src[key]
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

export function partnerSiteMetaCapiCustomerInfo(
  matching: Record<string, string>
): Partial<Record<(typeof META_CAPI_INFO_KEYS)[number], string>> {
  const out: Partial<Record<(typeof META_CAPI_INFO_KEYS)[number], string>> = {}
  for (const key of META_CAPI_INFO_KEYS) {
    if (matching[key]) out[key] = matching[key]
  }
  return out
}

/** Tham số thứ ba của `fbq('init', pixelId, params)`. Bỏ khóa trống. */
export function partnerSiteMetaMatchingParams(src: PartnerSiteMetaAdvancedMatching): Record<string, string> {
  const out: Record<string, string> = {}
  const email = normalizeEmail(src.email)
  if (email) out.em = email
  const phone = normalizeMetaAdvancedPhone(src.phone)
  if (phone) out.ph = phone
  const names = splitPersonName(src.fullName || '')
  if (names.fn) out.fn = names.fn
  if (names.ln) out.ln = names.ln
  const gender = normalizeGender(src.gender)
  if (gender) out.ge = gender
  const dob = normalizeDob(src.dateOfBirth)
  if (dob) out.db = dob

  const province =
    matchVietnamProvince(src.state) ||
    matchVietnamProvince(src.shippingAddress) ||
    matchVietnamProvince(src.city) ||
    null
  const stateCompact = foldMetaCompact(province || src.state || '')
  if (stateCompact) out.st = stateCompact
  const cityCompact = foldMetaCompact(src.city || '')
  if (cityCompact) out.ct = cityCompact
  else if (province && VN_MUNICIPALITIES.has(province) && stateCompact) out.ct = stateCompact
  const zip = normalizeZip(src.zip) || metaPostalCodeFromAddress(src.shippingAddress)
  if (zip) out.zp = zip
  const country = normalizeCountry(src.country) || (province || phone?.startsWith('84') ? 'vn' : undefined)
  if (country) out.country = country

  const externalId = normalizeExternalId(src.externalId)
  if (externalId) out.external_id = externalId
  return out
}

function jsSingleQuoted(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Khách NanoAI.vn (pixel nền tảng), tách khỏi `pw_meta_am:{shop}`. */
export const PLATFORM_META_AM_STORAGE_KEY = 'nano_meta_am'

function buildMetaPixelInitArgsJs(pixelId: string, storageKey: string, stampJs: string): string {
  const key = jsSingleQuoted(storageKey)
  const id = jsSingleQuoted(pixelId.trim())
  return `(function(){var keys=['em','ph','fn','ln','ge','db','ct','st','zp','country','external_id'];var ud={em:'',ph:'',fn:'',ln:'',ge:'',db:'',ct:'',st:'',zp:'',country:'',external_id:''};function take(p){if(!p)return;for(var i=0;i<keys.length;i++){var k=keys[i];var v=p[k];if(typeof v==='string'&&v)ud[k]=v;}}try{var key='${key}';if(key)take(JSON.parse(localStorage.getItem(key)||'null'));}catch(e){}try{if(!ud.external_id){var xid=String(localStorage.getItem('app_guest_account_id')||localStorage.getItem('nanoai_guest_account_id')||'').trim();if(xid&&xid.length>=2&&xid.length<=128&&xid.indexOf('@')<0)ud.external_id=xid;}}catch(e){}var out={};for(var i=0;i<keys.length;i++){if(ud[keys[i]])out[keys[i]]=ud[keys[i]];}try{${stampJs}}catch(e){}return out;})()`
}

/**
 * Biểu thức JS: đọc dữ liệu khách đã lưu rồi trả object cho `fbq('init', id, …)`.
 * Chạy trước PageView. Không nhúng email thật vào HTML.
 */
export function metaPixelInitArgsJs(pixelId: string, siteSlug?: string | null): string {
  const id = jsSingleQuoted(pixelId.trim())
  return buildMetaPixelInitArgsJs(
    pixelId,
    partnerSiteMetaAmStorageKey(siteSlug || ''),
    `window.__nanoShopMetaAm=out;window.__nanoShopMetaPixels=window.__nanoShopMetaPixels||{};window.__nanoShopMetaPixels['${id}']=1;`
  )
}

/** Tham số thứ ba của pixel NanoAI.vn. Cùng các khóa Meta liệt kê trong chẩn đoán. */
export function platformMetaPixelInitArgsJs(pixelId: string): string {
  const id = jsSingleQuoted(pixelId.trim())
  return buildMetaPixelInitArgsJs(
    pixelId,
    PLATFORM_META_AM_STORAGE_KEY,
    `window.__nanoPlatformMetaAm=out;window.__nanoPlatformMetaPixelId='${id}';`
  )
}
