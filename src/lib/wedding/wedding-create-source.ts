/**
 * Kênh lúc khách bấm tạo thiệp.
 * Giữ lần chạm mạnh nhất trong 30 ngày: quảng cáo ghi đè, trang giới thiệu giữ lần đầu, vào thẳng không đè kênh đã có.
 * Script đầu trang phải cùng luật với weddingCreateTouchRank / chooseWeddingCreateTouch.
 */

import { classifyWeddingAdSource } from '@/lib/wedding/wedding-ad-source'

export const WEDDING_CREATE_SOURCE_STORAGE_KEY = 'nanoai.wedding.createSource'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const FUTURE_SKEW_MS = 5 * 60 * 1000

export type WeddingCreateSourceKind = 'facebook' | 'tiktok' | 'google_ads' | 'direct' | 'other'

export type WeddingCreateTouch = {
  search: string
  referrer: string
  pageHost: string
  at: number
}

export type WeddingCreateSourcePayload = {
  search: string
  referrer: string
  pageHost: string
}

export type WeddingCreateSourceRecord = {
  source: WeddingCreateSourceKind
  detail: string
}

export type WeddingCreateSourceView = {
  kind: WeddingCreateSourceKind | 'unknown'
  /** Nhãn khi nguồn là trang khác hoặc utm không phải quảng cáo. */
  text: string
  /** utm đầy đủ, khi có chiến dịch. */
  extra: string
}

const NAMED_CHANNELS: Record<string, string> = {
  google: 'Google',
  'google.com': 'Google',
  'google.com.vn': 'Google',
  youtube: 'YouTube',
  'youtube.com': 'YouTube',
  'm.youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  zalo: 'Zalo',
  'zalo.me': 'Zalo',
  'zalo.vn': 'Zalo',
  'chat.zalo.me': 'Zalo',
  'oauth.zaloapp.com': 'Zalo',
  email: 'Email',
  newsletter: 'Email',
  mail: 'Email',
  bing: 'Bing',
  'bing.com': 'Bing',
  coccoc: 'Cốc Cốc',
  'coccoc.com': 'Cốc Cốc',
  yahoo: 'Yahoo',
  'yahoo.com': 'Yahoo',
}

function clipSearch(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F<>]/g, '')
    .slice(0, 500)
}

function clipReferrer(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F<>]/g, '')
    .trim()
    .slice(0, 500)
}

function clipHost(value: unknown): string {
  const host = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .slice(0, 200)
  if (!host || !/^[a-z0-9.:[\]-]+$/.test(host)) return ''
  return host
}

function searchParamsOf(search: string): URLSearchParams {
  const raw = search.trim()
  const query = raw.startsWith('?') ? raw.slice(1) : raw
  return new URLSearchParams(query)
}

function param(params: URLSearchParams, name: string): string {
  return (params.get(name) || '').trim().slice(0, 80)
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
}

function isLoopback(host: string): boolean {
  const bare = bareHost(host)
  return bare === 'localhost' || bare === '127.0.0.1' || bare === '[::1]' || bare === '::1'
}

function isOauthHost(host: string): boolean {
  const bare = bareHost(host)
  return bare === 'accounts.google.com' || bare === 'appleid.apple.com' || bare === 'login.microsoftonline.com'
}

function sameSite(host: string, pageHost: string): boolean {
  if (!host || !pageHost) return false
  if (isLoopback(host) && isLoopback(pageHost)) return true
  const left = bareHost(host)
  const right = bareHost(pageHost)
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
}

/** Trang của app, hoặc đăng nhập Google/Apple, không phải nguồn giới thiệu. */
export function isWeddingCreateOwnHost(host: string, pageHost: string): boolean {
  const current = bareHost(host)
  if (!current) return true
  if (isOauthHost(current)) return true
  const page = bareHost(pageHost)
  if (page && sameSite(current, page)) return true
  if (!page && (current === 'nanoai.vn' || current.endsWith('.nanoai.vn') || isLoopback(current))) return true
  return false
}

export function weddingCreateTouchRank(touch: Pick<WeddingCreateTouch, 'search' | 'referrer' | 'pageHost'>): number {
  if (classifyWeddingAdSource(touch.search, touch.referrer)) return 3
  const params = searchParamsOf(touch.search)
  if (param(params, 'utm_source') || param(params, 'utm_medium') || param(params, 'utm_campaign')) return 2
  const host = referrerHost(touch.referrer)
  if (!host || isWeddingCreateOwnHost(host, touch.pageHost)) return 1
  return 2
}

export function chooseWeddingCreateTouch(
  prev: WeddingCreateTouch | null,
  next: WeddingCreateTouch,
  now: number,
): WeddingCreateTouch {
  if (!prev || !Number.isFinite(prev.at) || prev.at > now + FUTURE_SKEW_MS || now - prev.at >= MAX_AGE_MS) return next
  const prevRank = weddingCreateTouchRank(prev)
  const nextRank = weddingCreateTouchRank(next)
  if (nextRank >= 3) return next
  if (prevRank >= nextRank) return prev
  return next
}

function namedChannel(detail: string): string {
  const first = detail.split(' · ')[0]?.trim().toLowerCase().replace(/^www\./, '') ?? ''
  if (!first) return ''
  const known = NAMED_CHANNELS[first]
  if (known) return known
  if (first.includes('.')) return first.slice(0, 80)
  return first.slice(0, 40)
}

export function resolveWeddingCreateSource(search: string, referrer: string, pageHost = ''): WeddingCreateSourceRecord {
  const safeSearch = clipSearch(search)
  const safeReferrer = clipReferrer(referrer)
  const safeHost = clipHost(pageHost)
  const ad = classifyWeddingAdSource(safeSearch, safeReferrer)
  const params = searchParamsOf(safeSearch)
  const utm = [param(params, 'utm_source'), param(params, 'utm_medium'), param(params, 'utm_campaign')].filter(Boolean)
  const utmDetail = utm.join(' · ').slice(0, 160)
  if (ad === 'facebook' || ad === 'tiktok' || ad === 'google_ads') {
    return { source: ad, detail: utmDetail }
  }
  if (utmDetail) return { source: 'other', detail: utmDetail }
  const host = referrerHost(safeReferrer)
  if (host && !isWeddingCreateOwnHost(host, safeHost)) {
    return { source: 'other', detail: bareHost(host).slice(0, 160) }
  }
  return { source: 'direct', detail: '' }
}

export function weddingCreateSourceView(source: string, detail: string): WeddingCreateSourceView {
  const extra = detail.trim().includes(' · ') ? detail.trim().slice(0, 160) : ''
  if (source === 'facebook' || source === 'tiktok' || source === 'google_ads') {
    return { kind: source, text: '', extra }
  }
  if (source === 'direct') return { kind: 'direct', text: '', extra: '' }
  if (source === 'other') {
    const text = namedChannel(detail.trim())
    return { kind: 'other', text, extra: text && extra && extra.toLowerCase() !== text.toLowerCase() ? extra : '' }
  }
  return { kind: 'unknown', text: '', extra: '' }
}

function parseTouch(raw: string | null): WeddingCreateTouch | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const at = typeof parsed.at === 'number' ? parsed.at : Number(parsed.at)
    if (!Number.isFinite(at)) return null
    return {
      search: clipSearch(parsed.search),
      referrer: clipReferrer(parsed.referrer),
      pageHost: clipHost(parsed.pageHost),
      at,
    }
  } catch {
    return null
  }
}

/** Đọc URL hiện tại, giữ kênh mạnh hơn đã lưu, rồi trả về kênh sẽ ghi lúc tạo thiệp. */
export function rememberWeddingCreateSource(): WeddingCreateSourcePayload {
  if (typeof window === 'undefined') return { search: '', referrer: '', pageHost: '' }
  const now = Date.now()
  const next: WeddingCreateTouch = {
    search: clipSearch(window.location.search),
    referrer: clipReferrer(document.referrer),
    pageHost: clipHost(window.location.hostname),
    at: now,
  }
  let prev: WeddingCreateTouch | null = null
  try {
    prev = parseTouch(window.localStorage.getItem(WEDDING_CREATE_SOURCE_STORAGE_KEY))
  } catch {
    prev = null
  }
  const chosen = chooseWeddingCreateTouch(prev, next, now)
  if (chosen === next) {
    try {
      window.localStorage.setItem(WEDDING_CREATE_SOURCE_STORAGE_KEY, JSON.stringify(chosen))
    } catch {
      /* trình duyệt chặn lưu */
    }
  }
  return { search: chosen.search, referrer: chosen.referrer, pageHost: chosen.pageHost }
}

/** Chạy trước khi React hydrate, để kịp lưu utm nếu khách bấm sang trang khác ngay. */
export function weddingCreateSourceBootstrapJs(): string {
  return `(function(){try{var KEY=${JSON.stringify(WEDDING_CREATE_SOURCE_STORAGE_KEY)};var MAX=2592000000;var SKEW=300000;function params(search){var q=search.charAt(0)==='?'?search.slice(1):search;try{return new URLSearchParams(q);}catch(e){return new URLSearchParams();}}function getp(p,n){return (p.get(n)||'').trim().toLowerCase();}function hostOf(url){try{return new URL(url).hostname.toLowerCase();}catch(e){return '';}}function bare(h){return String(h||'').toLowerCase().replace(/^www\\./,'').replace(/\\.$/,'');}function ends(h,root){return h===root||h.slice(-(root.length+1))==='.'+root;}function loopback(h){var b=bare(h);return b==='localhost'||b==='127.0.0.1'||b==='[::1]'||b==='::1';}function oauth(h){var b=bare(h);return b==='accounts.google.com'||b==='appleid.apple.com'||b==='login.microsoftonline.com';}function own(h,page){if(!h)return true;if(oauth(h))return true;var a=bare(h);var b=bare(page);if(b&&(loopback(a)&&loopback(b)||a===b||a.slice(-(b.length+1))==='.'+b||b.slice(-(a.length+1))==='.'+a))return true;if(!b&&(a==='nanoai.vn'||a.slice(-10)==='.nanoai.vn'||loopback(a)))return true;return false;}function rank(search,referrer,pageHost){var p=params(search);var src=getp(p,'utm_source');var med=getp(p,'utm_medium');var host=hostOf(referrer);if(getp(p,'ttclid')||src==='tiktok'||src==='tiktok.com'||src==='tik_tok'||src==='tiktok_ads'||ends(host,'tiktok.com'))return 3;if(getp(p,'fbclid')||src==='facebook'||src==='facebook.com'||src==='fb'||src==='fbads'||src==='meta'||src==='metaads'||src==='ig'||src==='instagram'||src==='instagram.com'||src==='facebook_ads'||src==='fb_ads'||ends(host,'facebook.com')||ends(host,'fb.com')||ends(host,'fb.me')||ends(host,'instagram.com'))return 3;var paid=med==='cpc'||med==='ppc'||med==='paid'||med==='paidsearch'||med==='paid_search'||med==='display'||med==='cpm'||med==='cpv';if(getp(p,'gclid')||getp(p,'gbraid')||getp(p,'wbraid')||getp(p,'gad_source')||getp(p,'gad_campaignid')||src==='googleads'||src==='google_ads'||src==='google-ads'||src==='adwords'||src==='googleadwords'||((src==='google'||src==='google.com')&&paid))return 3;if(src||getp(p,'utm_medium')||getp(p,'utm_campaign'))return 2;if(!host||own(host,pageHost))return 1;return 2;}var search=String(location.search||'').replace(/[\\u0000-\\u001F<>]/g,'').slice(0,500);var referrer=String(document.referrer||'').replace(/[\\u0000-\\u001F<>]/g,'').trim().slice(0,500);var pageHost=String(location.hostname||'').trim().toLowerCase().replace(/\\.$/,'').slice(0,200);if(pageHost&&!/^[a-z0-9.:\\[\\]-]+$/.test(pageHost))pageHost='';var now=Date.now();var prev=null;try{prev=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}var next={search:search,referrer:referrer,pageHost:pageHost,at:now};var chosen=next;if(prev&&typeof prev.at==='number'&&prev.at<=now+SKEW&&now-prev.at<MAX){var pr=rank(String(prev.search||''),String(prev.referrer||''),String(prev.pageHost||''));var nr=rank(search,referrer,pageHost);if(!(nr>=3)&&pr>=nr)chosen=prev;}if(chosen===next)localStorage.setItem(KEY,JSON.stringify(next));}catch(e){}})();`
}
