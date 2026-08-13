/**
 * Cổng tra cứu vận chuyển web shop — NanoAI gọi server-to-server.
 * Contract: GET/POST {url}?q=… với X-Api-Key / Bearer (tài liệu shop, vd. 188.com.vn).
 */

import { fetchMessagingPartnerShippingLookupAuthFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'

export type ShippingLookupQueryType = 'order_code' | 'phone' | 'ems_code' | 'q'

export type ShippingLookupQuery = {
  type: ShippingLookupQueryType
  value: string
}

export type PartnerShippingLookupOrderItem = {
  product_name: string
  selected_size: string
  selected_color_name: string
  quantity: number
}

export type PartnerShippingLookupHit = {
  query: string
  queryType: string
  isLatestOrder: boolean
  trackingNumber: string
  shippingProvider: string
  orderCode: string
  status: string
  statusLabel: string
  paymentStatusLabel: string
  shippingMethod: string
  items: PartnerShippingLookupOrderItem[]
  emsStatus: string
  emsEvents: Array<{ description: string; address: string; tracedAt: string }>
  httpStatus: number
}

export type PartnerShippingLookupOutcome =
  | { ok: true; hit: PartnerShippingLookupHit }
  | { ok: false; httpStatus: number; detail: string }

const LOOKUP_TIMEOUT_MS = 12_000
const CACHE_TTL_MS = 90_000
const CACHE_MAX = 200

const cache = new Map<string, { at: number; outcome: PartnerShippingLookupOutcome }>()

const ORDER_CODE_RE = /\b((?:DH|ĐH|DC|ĐC|dh|đh|dc|đc)\s*[-_]?\s*\d{2,})\b/i
const EMS_OR_VNPOST_RE = /\b([A-Z]{2}\d{8,}VN)\b/i
const HO_TRACK_RE = /\b(HO\d{6,})\b/i
const VN_MOBILE_RE = /(?:\+?84|0)(?:3|5|7|8|9)[\d\s().-]{7,}/g

function locPrefix(uiLocale: string | null | undefined): string {
  return String(uiLocale ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 8)
}

export function normalizeVnMobileDigits(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D+/g, '')
  if (!digits) return null
  const local =
    digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits
  if (!/^0(?:3|5|7|8|9)\d{8}$/.test(local)) return null
  return local
}

/** DH/DC → order_code; mã …VN → ems_code; SĐT VN → phone; còn lại q. */
export function classifyShippingLookupQuery(raw: string): ShippingLookupQuery | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const order = s.match(ORDER_CODE_RE)
  if (order) {
    const compact = order[1].replace(/[\s_-]+/g, '').toUpperCase().replace(/^ĐH/, 'DH').replace(/^ĐC/, 'DC')
    return { type: 'order_code', value: compact }
  }
  const ems = s.match(EMS_OR_VNPOST_RE)
  if (ems) return { type: 'ems_code', value: ems[1].toUpperCase() }
  const ho = s.match(HO_TRACK_RE)
  if (ho) return { type: 'q', value: ho[1].toUpperCase() }
  const phone = normalizeVnMobileDigits(s)
  if (phone && s.replace(/\D+/g, '').length <= 13) return { type: 'phone', value: phone }
  return { type: 'q', value: s.slice(0, 64) }
}

/**
 * Lấy mã tra cứu từ tin/OCR. Ưu tiên mã đơn → vận đơn → SĐT (khi tin hậu mãi hoặc tin gần như chỉ có SĐT).
 */
export function extractShippingLookupQuery(
  text: string,
  opts?: { allowPhone?: boolean }
): ShippingLookupQuery | null {
  const t = String(text ?? '')
  if (!t.trim()) return null
  const order = t.match(ORDER_CODE_RE)
  if (order) return classifyShippingLookupQuery(order[1])
  const ems = t.match(EMS_OR_VNPOST_RE)
  if (ems) return classifyShippingLookupQuery(ems[1])
  const ho = t.match(HO_TRACK_RE)
  if (ho) return classifyShippingLookupQuery(ho[1])
  if (opts?.allowPhone === false) return null
  const phones = t.match(VN_MOBILE_RE) ?? []
  for (const p of phones) {
    const n = normalizeVnMobileDigits(p)
    if (n) return { type: 'phone', value: n }
  }
  return null
}

export function assertPublicHttpsShippingLookupUrl(urlStr: string): URL | null {
  let u: URL
  try {
    u = new URL(urlStr.trim())
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const allowLocalHttp =
    process.env.NODE_ENV === 'development' &&
    (host === 'localhost' || host === '127.0.0.1') &&
    (u.protocol === 'http:' || u.protocol === 'https:')
  if (!allowLocalHttp && u.protocol !== 'https:') return null
  if (!allowLocalHttp) {
    if (host === 'localhost' || host.endsWith('.localhost')) return null
    if (/^127\./.test(host) || host === '0.0.0.0') return null
    if (/^10\./.test(host)) return null
    if (/^192\.168\./.test(host)) return null
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null
  }
  return u
}

function cacheGet(key: string): PartnerShippingLookupOutcome | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.outcome
}

function cacheSet(key: string, outcome: PartnerShippingLookupOutcome): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (typeof first === 'string') cache.delete(first)
  }
  cache.set(key, { at: Date.now(), outcome })
}

function str(v: unknown, max = 240): string {
  if (v == null) return ''
  return String(v).trim().slice(0, max)
}

function parseHit(payload: Record<string, unknown>, httpStatus: number): PartnerShippingLookupHit | null {
  if (payload.ok !== true) return null
  const order = payload.order && typeof payload.order === 'object' && !Array.isArray(payload.order)
    ? (payload.order as Record<string, unknown>)
    : null
  const emsTracking =
    payload.ems_tracking && typeof payload.ems_tracking === 'object' && !Array.isArray(payload.ems_tracking)
      ? (payload.ems_tracking as Record<string, unknown>)
      : null
  const emsRecord =
    payload.ems_record && typeof payload.ems_record === 'object' && !Array.isArray(payload.ems_record)
      ? (payload.ems_record as Record<string, unknown>)
      : null
  const itemsRaw = order && Array.isArray(order.items) ? order.items : []
  const items: PartnerShippingLookupOrderItem[] = []
  for (const it of itemsRaw.slice(0, 8)) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue
    const row = it as Record<string, unknown>
    const name = str(row.product_name, 160)
    if (!name) continue
    items.push({
      product_name: name,
      selected_size: str(row.selected_size, 32),
      selected_color_name: str(row.selected_color_name || row.selected_color, 48),
      quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
    })
  }
  const eventsRaw = emsTracking && Array.isArray(emsTracking.events) ? emsTracking.events : []
  const emsEvents: PartnerShippingLookupHit['emsEvents'] = []
  for (const ev of eventsRaw.slice(0, 6)) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) continue
    const row = ev as Record<string, unknown>
    const description = str(row.description, 200)
    if (!description) continue
    emsEvents.push({
      description,
      address: str(row.address, 120),
      tracedAt: str(row.traced_at, 40),
    })
  }
  return {
    query: str(payload.query, 80),
    queryType: str(payload.query_type, 32),
    isLatestOrder: payload.is_latest_order === true,
    trackingNumber: str(
      payload.tracking_number || order?.tracking_number || emsTracking?.tracking_code || emsRecord?.ems_tracking_code,
      64
    ),
    shippingProvider: str(payload.shipping_provider || order?.shipping_provider || order?.shipping_method, 40),
    orderCode: str(order?.order_code, 32),
    status: str(order?.status, 40),
    statusLabel: str(order?.status_label, 80),
    paymentStatusLabel: str(order?.payment_status_label, 80),
    shippingMethod: str(order?.shipping_method, 40),
    items,
    emsStatus: str(
      emsTracking?.current_status_description || emsRecord?.ems_status || emsRecord?.ems_phase_label,
      160
    ),
    emsEvents,
    httpStatus,
  }
}

export async function lookupPartnerShipping(input: {
  url: string
  apiKey: string
  query: ShippingLookupQuery
}): Promise<PartnerShippingLookupOutcome> {
  const parsed = assertPublicHttpsShippingLookupUrl(input.url)
  const key = input.apiKey.trim()
  if (!parsed || !key) {
    return { ok: false, httpStatus: 0, detail: 'Shipping lookup is not configured.' }
  }
  const cacheKey = `${parsed.origin}${parsed.pathname}|${input.query.type}|${input.query.value}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const param =
    input.query.type === 'order_code'
      ? 'order_code'
      : input.query.type === 'phone'
        ? 'phone'
        : input.query.type === 'ems_code'
          ? 'ems_code'
          : 'q'
  const endpoint = new URL(parsed.toString())
  endpoint.searchParams.set(param, input.query.value)

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), LOOKUP_TIMEOUT_MS)
  try {
    const resp = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': key,
      },
      signal: ac.signal,
      redirect: 'error',
    })
    const httpStatus = resp.status
    let body: unknown = null
    try {
      body = await resp.json()
    } catch {
      body = null
    }
    const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
    const detail = str(rec.detail || rec.error || rec.message, 240)
    if (httpStatus === 200) {
      const hit = parseHit(rec, httpStatus)
      const outcome: PartnerShippingLookupOutcome = hit
        ? { ok: true, hit }
        : { ok: false, httpStatus, detail: detail || 'Invalid lookup payload.' }
      cacheSet(cacheKey, outcome)
      return outcome
    }
    const outcome: PartnerShippingLookupOutcome = {
      ok: false,
      httpStatus,
      detail: detail || (httpStatus === 401 ? 'Unauthorized' : httpStatus === 404 ? 'Not found' : `HTTP ${httpStatus}`),
    }
    if (httpStatus === 404) cacheSet(cacheKey, outcome)
    return outcome
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { ok: false, httpStatus: 0, detail: aborted ? 'Lookup timeout.' : 'Lookup request failed.' }
  } finally {
    clearTimeout(timer)
  }
}

export async function lookupPartnerShippingFromPg(
  partnerId: string,
  query: ShippingLookupQuery
): Promise<PartnerShippingLookupOutcome | null> {
  const auth = await fetchMessagingPartnerShippingLookupAuthFromPg(partnerId)
  const url = auth?.shipping_lookup_url?.trim() ?? ''
  const apiKey = auth?.shipping_lookup_api_key?.trim() ?? ''
  if (!url || !apiKey) return null
  return lookupPartnerShipping({ url, apiKey, query })
}

function formatItemsLine(items: PartnerShippingLookupOrderItem[], loc: string): string {
  if (!items.length) return ''
  const parts = items.map((it) => {
    const qty = it.quantity > 1 ? ` x${it.quantity}` : ''
    const size = it.selected_size ? ` size ${it.selected_size}` : ''
    const color = it.selected_color_name ? ` (${it.selected_color_name})` : ''
    return `${it.product_name}${size}${color}${qty}`
  })
  if (loc.startsWith('en')) return `Items: ${parts.join('; ')}.`
  if (loc.startsWith('zh')) return `商品：${parts.join('；')}。`
  if (loc.startsWith('ja')) return `商品：${parts.join('、')}。`
  if (loc.startsWith('ko')) return `상품: ${parts.join('; ')}.`
  return `Sản phẩm: ${parts.join('; ')}.`
}

function formatEmsEvents(events: PartnerShippingLookupHit['emsEvents'], loc: string): string {
  if (!events.length) return ''
  const lines = events.slice(0, 4).map((ev) => {
    const where = ev.address ? ` — ${ev.address}` : ''
    return `• ${ev.description}${where}`
  })
  if (loc.startsWith('en')) return `Tracking updates:\n${lines.join('\n')}`
  if (loc.startsWith('zh')) return `物流节点：\n${lines.join('\n')}`
  if (loc.startsWith('ja')) return `配送履歴：\n${lines.join('\n')}`
  if (loc.startsWith('ko')) return `배송 이력:\n${lines.join('\n')}`
  return `Hành trình gần nhất:\n${lines.join('\n')}`
}

/** Tin trả khách từ dữ liệu live — không lặp SĐT/địa chỉ. */
export function formatShippingLookupCustomerReply(
  hit: PartnerShippingLookupHit,
  uiLocale?: string | null
): string {
  const loc = locPrefix(uiLocale)
  const code = hit.orderCode ? ` ${hit.orderCode}` : hit.query ? ` ${hit.query}` : ''
  const latest = hit.isLatestOrder
  const status = hit.statusLabel || hit.emsStatus || hit.status
  const track = hit.trackingNumber
    ? loc.startsWith('en')
      ? `Tracking: ${hit.trackingNumber}${hit.shippingProvider ? ` (${hit.shippingProvider})` : ''}.`
      : loc.startsWith('zh')
        ? `运单号：${hit.trackingNumber}${hit.shippingProvider ? `（${hit.shippingProvider}）` : ''}。`
        : loc.startsWith('ja')
          ? `追跡番号：${hit.trackingNumber}${hit.shippingProvider ? `（${hit.shippingProvider}）` : ''}。`
          : loc.startsWith('ko')
            ? `운송장: ${hit.trackingNumber}${hit.shippingProvider ? ` (${hit.shippingProvider})` : ''}.`
            : `Mã vận đơn: ${hit.trackingNumber}${hit.shippingProvider ? ` (${hit.shippingProvider})` : ''}.`
    : ''
  const emsNow = hit.emsStatus
    ? loc.startsWith('en')
      ? `Carrier status: ${hit.emsStatus}.`
      : loc.startsWith('zh')
        ? `承运商状态：${hit.emsStatus}。`
        : loc.startsWith('ja')
          ? `配送状況：${hit.emsStatus}。`
          : loc.startsWith('ko')
            ? `배송 상태: ${hit.emsStatus}.`
            : `Trạng thái vận chuyển: ${hit.emsStatus}.`
    : ''
  const items = formatItemsLine(hit.items, loc)
  const events = formatEmsEvents(hit.emsEvents, loc)
  const depositLike = /deposit|cọc|coc|waiting_deposit|deposit_paid/i.test(`${hit.status} ${hit.statusLabel}`)
  const shippingLike = /ship|giao|gửi|delivered|transit/i.test(`${hit.status} ${hit.statusLabel} ${hit.emsStatus}`)

  if (loc.startsWith('en')) {
    return [
      `We found order${code}${latest ? ' (latest order for this phone)' : ''}.`,
      status ? `Status: ${status}.` : '',
      track,
      emsNow,
      items,
      events,
      depositLike
        ? 'Thank you for your trust. The order has been sent to packing / warehouse. Estimated delivery is about 8–12 days (except unusual delays).'
        : shippingLike
          ? 'Please rest assured — the parcel is on the way. Message us if you need anything else.'
          : 'Message us if you need anything else.',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('zh')) {
    return [
      `已查到订单${code}${latest ? '（该手机号的最新订单）' : ''}。`,
      status ? `状态：${status}。` : '',
      track,
      emsNow,
      items,
      events,
      depositLike
        ? '感谢信任。订单已转交打包出库，预计约 8–12 天送达（特殊情况除外）。'
        : shippingLike
          ? '请放心等待收货。如需帮助请再联系我们。'
          : '如需帮助请再联系我们。',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('ja')) {
    return [
      `ご注文${code}を確認しました${latest ? '（この電話番号の最新注文）' : ''}。`,
      status ? `状況：${status}。` : '',
      track,
      emsNow,
      items,
      events,
      depositLike
        ? 'ご信頼ありがとうございます。梱包・出荷担当へ回しました。お届け目安は約8〜12日です。'
        : shippingLike
          ? '安心してお待ちください。ご不明点があればご連絡ください。'
          : 'ご不明点があればご連絡ください。',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (loc.startsWith('ko')) {
    return [
      `주문${code}을(를) 확인했습니다${latest ? ' (이 번호의 최신 주문)' : ''}.`,
      status ? `상태: ${status}.` : '',
      track,
      emsNow,
      items,
      events,
      depositLike
        ? '믿고 맡겨 주셔서 감사합니다. 포장·출고로 전달했습니다. 수령 예정은 약 8–12일입니다.'
        : shippingLike
          ? '안심하고 수령을 기다려 주세요. 도움이 더 필요하시면 말씀해 주세요.'
          : '도움이 더 필요하시면 말씀해 주세요.',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    `Dạ em đã tra đơn${code}${latest ? ' (đơn mới nhất theo SĐT chị gửi)' : ''} ạ.`,
    status ? `Tình trạng: ${status}.` : '',
    track,
    emsNow,
    items,
    events,
    depositLike
      ? 'Em cảm ơn chị đã tin tưởng. Em đã chuyển đơn sang bộ phận đóng hàng xuất kho. Thời gian dự kiến nhận hàng khoảng 8–12 ngày (trừ trường hợp bất thường).'
      : shippingLike
        ? 'Chị yên tâm chờ nhận hàng giúp em nhé. Nếu cần em hỗ trợ thêm cứ nhắn ạ.'
        : 'Nếu cần em hỗ trợ thêm cứ nhắn ạ.',
  ]
    .filter(Boolean)
    .join('\n')
}
