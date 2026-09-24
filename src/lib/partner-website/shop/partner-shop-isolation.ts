/** Host ảnh / web của dự án shop mẫu — không được nằm trên shop SaaS khác. */
const FOREIGN_PROJECT_URL =
  /188comvn\.b-cdn\.net|cdn\.188\.com\.vn|(?:^|\/\/|\.)(?:www\.)?188\.com\.vn(?:\/|$)/i

const OTHER_PARTNER_MEDIA = /messaging-partner\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

export const PARTNER_ISOLATION_ACK_IDS = [
  'ads_account',
  'merchant_center',
  'ads_billing',
  'search_console',
  'company_page',
] as const

export type PartnerIsolationAckId = (typeof PARTNER_ISOLATION_ACK_IDS)[number]

export type PartnerIsolationItemId =
  | 'brand'
  | 'domain'
  | 'phone'
  | 'bank'
  | 'return_address'
  | 'google_ads'
  | 'ga4'
  | 'gtm'
  | 'images'
  | 'meta_pixel'
  | 'tiktok_pixel'
  | PartnerIsolationAckId

export type PartnerIsolationState = 'ok' | 'missing' | 'shared' | 'unused'

export type PartnerIsolationItem = {
  id: PartnerIsolationItemId
  required: boolean
  done: boolean
  state: PartnerIsolationState
}

export type PartnerIsolationFacts = {
  brandKey: string
  brandShared: boolean
  domainHost: string
  domainShared: boolean
  phoneKey: string
  phoneShared: boolean
  bankKey: string
  bankShared: boolean
  sepayKey: string
  sepayShared: boolean
  returnKey: string
  returnShared: boolean
  adsKey: string
  adsShared: boolean
  ga4Key: string
  ga4Shared: boolean
  gtmKey: string
  gtmShared: boolean
  metaKey: string
  metaShared: boolean
  tiktokKey: string
  tiktokShared: boolean
  inventoryCount: number
  foreignImageCount: number
  foreignBrandAsset: boolean
  ack: Partial<Record<PartnerIsolationAckId, boolean>>
}

export function isPartnerIsolationAckId(value: string): value is PartnerIsolationAckId {
  return (PARTNER_ISOLATION_ACK_IDS as readonly string[]).includes(value)
}

/** Ảnh, logo, favicon hoặc origin còn trỏ sang dự án / workspace khác. */
export function isolationUrlTiedToOtherProject(url: string, partnerId: string): boolean {
  const text = String(url || '').trim()
  if (!text) return false
  if (FOREIGN_PROJECT_URL.test(text)) return true
  const match = text.match(OTHER_PARTNER_MEDIA)
  if (!match?.[1]) return false
  return match[1].toLowerCase() !== String(partnerId || '').trim().toLowerCase()
}

function filledUnique(key: string, shared: boolean, minLen: number): PartnerIsolationState {
  if (key.trim().length < minLen) return 'missing'
  return shared ? 'shared' : 'ok'
}

function item(id: PartnerIsolationItemId, required: boolean, state: PartnerIsolationState): PartnerIsolationItem {
  return { id, required, state, done: state === 'ok' || state === 'unused' }
}

function bankState(facts: PartnerIsolationFacts): PartnerIsolationState {
  const bank = facts.bankKey.length >= 6 ? (facts.bankShared ? 'shared' : 'ok') : 'missing'
  const sepay = facts.sepayKey.length >= 6 ? (facts.sepayShared ? 'shared' : 'ok') : 'missing'
  if (bank === 'shared' || sepay === 'shared') return 'shared'
  if (bank === 'ok' || sepay === 'ok') return 'ok'
  return 'missing'
}

function imagesState(facts: PartnerIsolationFacts): PartnerIsolationState {
  if (facts.foreignImageCount > 0 || facts.foreignBrandAsset) return 'shared'
  if (facts.inventoryCount > 0) return 'ok'
  return 'missing'
}

function optionalPixel(key: string, shared: boolean): PartnerIsolationState {
  if (!key.trim()) return 'unused'
  return shared ? 'shared' : 'ok'
}

export function buildPartnerIsolationChecklist(facts: PartnerIsolationFacts): PartnerIsolationItem[] {
  const items: PartnerIsolationItem[] = [
    item('brand', true, filledUnique(facts.brandKey, facts.brandShared, 2)),
    item('domain', true, filledUnique(facts.domainHost, facts.domainShared, 3)),
    item('phone', true, filledUnique(facts.phoneKey, facts.phoneShared, 8)),
    item('bank', true, bankState(facts)),
    item('return_address', true, filledUnique(facts.returnKey, facts.returnShared, 8)),
    item('google_ads', true, filledUnique(facts.adsKey, facts.adsShared, 4)),
    item('ga4', true, filledUnique(facts.ga4Key, facts.ga4Shared, 4)),
    item('gtm', true, filledUnique(facts.gtmKey, facts.gtmShared, 4)),
    item('images', true, imagesState(facts)),
    item('meta_pixel', false, optionalPixel(facts.metaKey, facts.metaShared)),
    item('tiktok_pixel', false, optionalPixel(facts.tiktokKey, facts.tiktokShared)),
  ]
  for (const id of PARTNER_ISOLATION_ACK_IDS) {
    const done = facts.ack[id] === true
    items.push({ id, required: true, done, state: done ? 'ok' : 'missing' })
  }
  return items
}

export function partnerIsolationProgress(items: PartnerIsolationItem[]): {
  requiredDone: number
  requiredTotal: number
  ready: boolean
} {
  const required = items.filter((item) => item.required)
  const requiredDone = required.filter((item) => item.done).length
  const shared = items.some((item) => item.state === 'shared')
  return {
    requiredDone,
    requiredTotal: required.length,
    ready: required.length > 0 && requiredDone === required.length && !shared,
  }
}

export function partnerIsolationSectionForItem(id: PartnerIsolationItemId): string {
  switch (id) {
    case 'brand':
      return 'brand'
    case 'domain':
    case 'search_console':
      return 'domains'
    case 'phone':
      return 'channels'
    case 'bank':
      return 'payment'
    case 'return_address':
      return 'shipping'
    case 'images':
      return 'inventory'
    case 'company_page':
      return 'partner-website-editor'
    default:
      return 'analytics-ads'
  }
}
