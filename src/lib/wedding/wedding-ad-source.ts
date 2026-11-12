/** Nguồn khách mở thiệp công khai: Facebook (gồm Instagram), TikTok, Google Ads. */

export type WeddingAdSource = 'facebook' | 'tiktok' | 'google_ads'

export type WeddingAdVisitCounts = {
  facebook: number
  tiktok: number
  googleAds: number
}

export function emptyWeddingAdVisitCounts(): WeddingAdVisitCounts {
  return { facebook: 0, tiktok: 0, googleAds: 0 }
}

const BOT_UA_RE =
  /bot|crawler|spider|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|slackbot|whatsapp|telegrambot|twitterbot|linkedinbot|bingbot|googlebot|yandex|duckduckbot|embedly|quora link preview|pinterest|discordbot|applebot|headless/i

const FACEBOOK_SOURCES = new Set([
  'facebook',
  'facebook.com',
  'fb',
  'fbads',
  'meta',
  'metaads',
  'ig',
  'instagram',
  'instagram.com',
  'facebook_ads',
  'fb_ads',
])

const TIKTOK_SOURCES = new Set(['tiktok', 'tiktok.com', 'tik_tok', 'tiktok_ads'])

const GOOGLE_ADS_SOURCES = new Set(['googleads', 'google_ads', 'google-ads', 'adwords', 'googleadwords'])

const GOOGLE_PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'display', 'cpm', 'cpv'])

function searchParamsOf(search: string): URLSearchParams {
  const raw = search.trim()
  const query = raw.startsWith('?') ? raw.slice(1) : raw
  return new URLSearchParams(query)
}

function param(params: URLSearchParams, name: string): string {
  return (params.get(name) || '').trim().toLowerCase()
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function hostIs(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`)
}

function isFacebookHost(host: string): boolean {
  return hostIs(host, 'facebook.com') || hostIs(host, 'fb.com') || hostIs(host, 'fb.me') || hostIs(host, 'instagram.com')
}

function isTikTokHost(host: string): boolean {
  return hostIs(host, 'tiktok.com')
}

/** Bỏ lượt từ khung sửa thiệp, xem mẫu, hoặc bản xem trước. */
export function weddingAdVisitShouldIgnore(search: string): boolean {
  const params = searchParamsOf(search)
  if (params.get('demo') === '1') return true
  if (params.get('layout') === 'full') return true
  if ((params.get('look') || '').trim()) return true
  if ((params.get('ornamentEdit') || '').trim()) return true
  if (params.get('sheet') === '1') return true
  return false
}

/**
 * Phân loại URL và referrer lúc khách mở thiệp.
 * Google chỉ tính quảng cáo (click id hoặc utm trả phí). Facebook gồm cả Instagram.
 */
export function classifyWeddingAdSource(search: string, referrer: string): WeddingAdSource | null {
  const params = searchParamsOf(search)
  const utmSource = param(params, 'utm_source')
  const utmMedium = param(params, 'utm_medium')
  const host = referrerHost(referrer)

  if (param(params, 'ttclid') || TIKTOK_SOURCES.has(utmSource) || isTikTokHost(host)) return 'tiktok'
  if (param(params, 'fbclid') || FACEBOOK_SOURCES.has(utmSource) || isFacebookHost(host)) return 'facebook'

  const googleClick =
    param(params, 'gclid') ||
    param(params, 'gbraid') ||
    param(params, 'wbraid') ||
    param(params, 'gad_source') ||
    param(params, 'gad_campaignid')
  const googleAdsUtm =
    GOOGLE_ADS_SOURCES.has(utmSource) ||
    ((utmSource === 'google' || utmSource === 'google.com') && GOOGLE_PAID_MEDIUMS.has(utmMedium))
  if (googleClick || googleAdsUtm) return 'google_ads'
  return null
}

/** User-Agent máy chủ: bỏ trình thu thập và chuỗi rỗng. */
export function isWeddingTrafficBotUserAgent(userAgent: string): boolean {
  const ua = userAgent.trim()
  if (ua.length < 12) return true
  return BOT_UA_RE.test(ua)
}
