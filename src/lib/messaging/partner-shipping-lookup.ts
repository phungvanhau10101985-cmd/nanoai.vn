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
  /** Mã kho từ cổng shop (vd. 188 `product_sku`: `C0156/XL`). */
  product_sku: string
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
      product_sku: str(row.product_sku || row.sku || row.item_sku || row.product_code, 64),
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

function lookupQueryParam(query: ShippingLookupQuery): 'order_code' | 'phone' | 'ems_code' | 'q' {
  if (query.type === 'order_code') return 'order_code'
  if (query.type === 'phone') return 'phone'
  if (query.type === 'ems_code') return 'ems_code'
  return 'q'
}

function isEndpointMissing404(httpStatus: number, rec: Record<string, unknown>, detail: string): boolean {
  if (httpStatus !== 404) return false
  const err = str(rec.error, 80).toLowerCase()
  return err === 'endpoint not found' || /available_paths_sample/i.test(JSON.stringify(rec)) || /endpoint not found/i.test(detail)
}

function outcomeFromLookupHttp(
  httpStatus: number,
  rec: Record<string, unknown>,
  detail: string
): PartnerShippingLookupOutcome {
  if (httpStatus === 200) {
    const hit = parseHit(rec, httpStatus)
    return hit
      ? { ok: true, hit }
      : { ok: false, httpStatus, detail: detail || 'Invalid lookup payload.' }
  }
  return {
    ok: false,
    httpStatus,
    detail: detail || (httpStatus === 401 ? 'Unauthorized' : httpStatus === 404 ? 'Not found' : `HTTP ${httpStatus}`),
  }
}

async function fetchShippingLookupHttp(
  endpoint: URL,
  apiKey: string,
  init: { method: 'GET' | 'POST'; body?: string }
): Promise<PartnerShippingLookupOutcome> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), LOOKUP_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
    }
    if (init.method === 'POST') headers['Content-Type'] = 'application/json'
    const resp = await fetch(endpoint.toString(), {
      method: init.method,
      headers,
      body: init.body,
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
    return outcomeFromLookupHttp(httpStatus, rec, detail)
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { ok: false, httpStatus: 0, detail: aborted ? 'Lookup timeout.' : 'Lookup request failed.' }
  } finally {
    clearTimeout(timer)
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

  const param = lookupQueryParam(input.query)
  const postUrl = new URL(parsed.toString())
  postUrl.search = ''
  const postOutcome = await fetchShippingLookupHttp(postUrl, key, {
    method: 'POST',
    body: JSON.stringify({ [param]: input.query.value }),
  })
  if (postOutcome.ok) {
    cacheSet(cacheKey, postOutcome)
    return postOutcome
  }
  const postMissing = isEndpointMissing404(postOutcome.httpStatus, { error: postOutcome.detail }, postOutcome.detail)
  const postAuthFail = postOutcome.httpStatus === 401 || postOutcome.httpStatus === 503
  if (!postMissing && (postOutcome.httpStatus === 404 || postOutcome.httpStatus === 400 || postAuthFail)) {
    if (postOutcome.httpStatus === 404) cacheSet(cacheKey, postOutcome)
    return postOutcome
  }

  const getUrl = new URL(parsed.toString())
  getUrl.searchParams.set(param, input.query.value)
  const getOutcome = await fetchShippingLookupHttp(getUrl, key, { method: 'GET' })
  if (getOutcome.ok) {
    cacheSet(cacheKey, getOutcome)
    return getOutcome
  }
  if (getOutcome.httpStatus === 404) cacheSet(cacheKey, getOutcome)
  return getOutcome
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

function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function tidyAddress(value: string): string {
  const parts = collapseWs(value)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    const n = part.normalize('NFC')
    if (out.some((prev) => prev.localeCompare(n, 'vi', { sensitivity: 'accent' }) === 0)) continue
    out.push(n)
  }
  return out.join(', ')
}

/** Bỏ mã bưu cục / tiếng Anh kỹ thuật / chuỗi Zalo dính từ EMS. */
function stripEmsNoise(value: string): string {
  return collapseWs(
    value
      .replace(/\(\d{3,}:\s*[^)]*\)/g, ' ')
      .replace(/\((?:Delivered|Arrival at PO|Transport arrival at PO|Info received|Accepted)\)/gi, ' ')
      .replace(/^EMI\s*[-–]\s*/i, '')
      .replace(/^\[COD\]\s*/i, '[COD] ')
      .replace(/Người nhận\s*:\s*(?:\(\)\s*)?\+*.*$/gi, ' ')
      .replace(/\bshop\s*188\b/gi, ' ')
      .replace(/\bZALO\b/gi, ' ')
      .replace(/\(\)\s*/g, ' ')
      .replace(/\+{2,}/g, ' ')
      .replace(/\s+[.,]/g, '.')
      .replace(/\.{2,}/g, '.')
  )
}

function extractEmsRecipient(raw: string): string {
  const m = String(raw || '').match(/Người nhận\s*:\s*(.+)$/i)
  if (!m) return ''
  const name = collapseWs(
    m[1]
      .replace(/^\(\)\s*/, '')
      .replace(/\++/g, ' ')
      .replace(/\bshop\s*188\b/gi, ' ')
      .replace(/\bZALO\b/gi, ' ')
      .replace(/[.,;:]+$/g, '')
  )
  if (name.length < 2 || !/[A-Za-zÀ-ỹ]/.test(name)) return ''
  return name.slice(0, 48)
}

function isPhoneLookupHit(hit: PartnerShippingLookupHit): boolean {
  return hit.queryType === 'phone' || Boolean(normalizeVnMobileDigits(hit.query))
}

function customerOrderRef(hit: PartnerShippingLookupHit): string {
  if (hit.orderCode && !normalizeVnMobileDigits(hit.orderCode)) return hit.orderCode
  if (!isPhoneLookupHit(hit) && hit.query && !normalizeVnMobileDigits(hit.query)) return hit.query
  return ''
}

function customerStatusText(hit: PartnerShippingLookupHit): string {
  const shop = stripEmsNoise(hit.statusLabel || hit.status)
  const ems = stripEmsNoise(hit.emsStatus)
  const picked =
    shop && ems && shop.localeCompare(ems, 'vi', { sensitivity: 'accent' }) === 0 ? shop : shop || ems
  return collapseWs(picked.replace(/[.,;:]+$/g, ''))
}

function isDeliveredHit(hit: PartnerShippingLookupHit): boolean {
  return /phát thành công|delivered|đã giao(?: hàng)? thành công|giao thành công/i.test(
    `${hit.status} ${hit.statusLabel} ${hit.emsStatus}`
  )
}

function emsEventKind(description: string): string {
  const d = description.toLowerCase()
  if (/thu tiền|\[cod\]/i.test(d)) return 'cod'
  if (/phát thành công|delivered|đã phát/i.test(d)) return 'delivered'
  if (/giao bưu tá|out for delivery|đang phát/i.test(d)) return 'out'
  if (/đến bưu cục|arrival at po|transport arrival/i.test(d)) return 'arrival'
  return collapseWs(d).slice(0, 40) || 'other'
}

function formatEventWhen(raw: string): string {
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`
}

function selectCustomerEmsEvents(
  events: PartnerShippingLookupHit['emsEvents'],
  delivered: boolean
): PartnerShippingLookupHit['emsEvents'] {
  const seen = new Set<string>()
  const out: PartnerShippingLookupHit['emsEvents'] = []
  const limit = delivered ? 2 : 3
  for (const ev of events) {
    const kind = emsEventKind(ev.description)
    if (delivered && kind === 'arrival') continue
    if (kind !== 'other' && seen.has(kind)) continue
    seen.add(kind)
    out.push(ev)
    if (out.length >= limit) break
  }
  return out
}

function formatEmsEvents(
  events: PartnerShippingLookupHit['emsEvents'],
  loc: string,
  delivered: boolean
): string {
  const picked = selectCustomerEmsEvents(events, delivered)
  if (!picked.length) return ''
  const lines = picked.map((ev) => {
    const desc = stripEmsNoise(ev.description)
    const where = tidyAddress(ev.address)
    const locBit = where && !desc.toLowerCase().includes(where.toLowerCase()) ? ` — ${where}` : ''
    const when = formatEventWhen(ev.tracedAt)
    const timeBit = when ? ` (${when})` : ''
    return `• ${desc}${locBit}${timeBit}`
  })
  if (loc.startsWith('en')) return `Tracking updates:\n${lines.join('\n')}`
  if (loc.startsWith('zh')) return `物流节点：\n${lines.join('\n')}`
  if (loc.startsWith('ja')) return `配送履歴：\n${lines.join('\n')}`
  if (loc.startsWith('ko')) return `배송 이력:\n${lines.join('\n')}`
  return `Hành trình:\n${lines.join('\n')}`
}

function lookupIntroLine(hit: PartnerShippingLookupHit, loc: string): string {
  const ref = customerOrderRef(hit)
  const latestPhone = hit.isLatestOrder && isPhoneLookupHit(hit)
  if (loc.startsWith('en')) {
    if (ref && latestPhone) return `We found order ${ref} (latest order for this phone).`
    if (ref) return `We found order ${ref}.`
    if (latestPhone) return 'We found the latest order for this phone number.'
    return 'We found the order.'
  }
  if (loc.startsWith('zh')) {
    if (ref && latestPhone) return `已查到订单 ${ref}（该手机号的最新订单）。`
    if (ref) return `已查到订单 ${ref}。`
    if (latestPhone) return '已查到该手机号的最新订单。'
    return '已查到订单。'
  }
  if (loc.startsWith('ja')) {
    if (ref && latestPhone) return `ご注文 ${ref} を確認しました（この電話番号の最新注文）。`
    if (ref) return `ご注文 ${ref} を確認しました。`
    if (latestPhone) return 'この電話番号の最新注文を確認しました。'
    return 'ご注文を確認しました。'
  }
  if (loc.startsWith('ko')) {
    if (ref && latestPhone) return `주문 ${ref}을(를) 확인했습니다 (이 번호의 최신 주문).`
    if (ref) return `주문 ${ref}을(를) 확인했습니다.`
    if (latestPhone) return '이 번호의 최신 주문을 확인했습니다.'
    return '주문을 확인했습니다.'
  }
  if (ref && latestPhone) return `Dạ em đã tra đơn ${ref} (đơn mới nhất theo SĐT chị gửi) ạ.`
  if (ref) return `Dạ em đã tra đơn ${ref} ạ.`
  if (latestPhone) return 'Dạ em đã tra đơn mới nhất theo SĐT chị gửi ạ.'
  return 'Dạ em đã tra đơn giúp chị ạ.'
}

function lookupClosingLine(
  loc: string,
  opts: { delivered: boolean; depositLike: boolean; shippingLike: boolean }
): string {
  if (loc.startsWith('en')) {
    if (opts.delivered) return 'The parcel has been delivered. Message us if you need anything else.'
    if (opts.depositLike) {
      return 'Thank you for your trust. The order has been sent to packing / warehouse. Estimated delivery is about 8–12 days (except unusual delays).'
    }
    if (opts.shippingLike) return 'Please rest assured — the parcel is on the way. Message us if you need anything else.'
    return 'Message us if you need anything else.'
  }
  if (loc.startsWith('zh')) {
    if (opts.delivered) return '包裹已妥投。如需帮助请再联系我们。'
    if (opts.depositLike) return '感谢信任。订单已转交打包出库，预计约 8–12 天送达（特殊情况除外）。'
    if (opts.shippingLike) return '请放心等待收货。如需帮助请再联系我们。'
    return '如需帮助请再联系我们。'
  }
  if (loc.startsWith('ja')) {
    if (opts.delivered) return 'お届け済みです。ご不明点があればご連絡ください。'
    if (opts.depositLike) return 'ご信頼ありがとうございます。梱包・出荷担当へ回しました。お届け目安は約8〜12日です。'
    if (opts.shippingLike) return '安心してお待ちください。ご不明点があればご連絡ください。'
    return 'ご不明点があればご連絡ください。'
  }
  if (loc.startsWith('ko')) {
    if (opts.delivered) return '배송이 완료되었습니다. 도움이 더 필요하시면 말씀해 주세요.'
    if (opts.depositLike) return '믿고 맡겨 주셔서 감사합니다. 포장·출고로 전달했습니다. 수령 예정은 약 8–12일입니다.'
    if (opts.shippingLike) return '안심하고 수령을 기다려 주세요. 도움이 더 필요하시면 말씀해 주세요.'
    return '도움이 더 필요하시면 말씀해 주세요.'
  }
  if (opts.delivered) return 'Đơn đã giao tới người nhận ạ. Nếu cần em hỗ trợ thêm cứ nhắn ạ.'
  if (opts.depositLike) {
    return 'Em cảm ơn chị đã tin tưởng. Em đã chuyển đơn sang bộ phận đóng hàng xuất kho. Thời gian dự kiến nhận hàng khoảng 8–12 ngày (trừ trường hợp bất thường).'
  }
  if (opts.shippingLike) return 'Chị yên tâm chờ nhận hàng giúp em nhé. Nếu cần em hỗ trợ thêm cứ nhắn ạ.'
  return 'Nếu cần em hỗ trợ thêm cứ nhắn ạ.'
}

/** Tin trả khách từ dữ liệu live — gọn, không lặp SĐT / chuỗi EMS kỹ thuật. */
export function formatShippingLookupCustomerReply(
  hit: PartnerShippingLookupHit,
  uiLocale?: string | null
): string {
  const loc = locPrefix(uiLocale)
  const delivered = isDeliveredHit(hit)
  const status = customerStatusText(hit)
  const recipient = extractEmsRecipient(hit.emsStatus) || extractEmsRecipient(hit.statusLabel)
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
  const recipientLine = recipient
    ? loc.startsWith('en')
      ? `Recipient: ${recipient}.`
      : loc.startsWith('zh')
        ? `收件人：${recipient}。`
        : loc.startsWith('ja')
          ? `受取人：${recipient}。`
          : loc.startsWith('ko')
            ? `수령인: ${recipient}.`
            : `Người nhận: ${recipient}.`
    : ''
  const statusLine = status
    ? loc.startsWith('en')
      ? `Status: ${status}.`
      : loc.startsWith('zh')
        ? `状态：${status}。`
        : loc.startsWith('ja')
          ? `状況：${status}。`
          : loc.startsWith('ko')
            ? `상태: ${status}.`
            : `Tình trạng: ${status}.`
    : ''
  const items = formatItemsLine(hit.items, loc)
  const events = formatEmsEvents(hit.emsEvents, loc, delivered)
  const blob = `${hit.status} ${hit.statusLabel} ${hit.paymentStatusLabel}`
  const waitingDeposit = /waiting_deposit|chờ\s*đặt\s*cọc|cho\s*dat\s*coc|unpaid|pending_payment/i.test(blob)
  const depositLike =
    !waitingDeposit && /deposit_paid|đã\s*(?:nhận\s*)?cọc|đã\s*thanh\s*toán|paid_verified|paid\b/i.test(blob)
  const shippingLike = /ship|giao|gửi|delivered|transit|đang phát/i.test(
    `${hit.status} ${hit.statusLabel} ${hit.emsStatus}`
  )

  return [
    lookupIntroLine(hit, loc),
    statusLine,
    track,
    recipientLine,
    items,
    events,
    lookupClosingLine(loc, { delivered, depositLike, shippingLike: shippingLike && !delivered }),
  ]
    .filter(Boolean)
    .join('\n')
}

/** Lookup không ra đơn — vẫn trả khách, không đẩy sang LLM bán hàng. */
export function formatShippingLookupMissReply(
  query: ShippingLookupQuery,
  outcome: { httpStatus: number; detail: string },
  uiLocale?: string | null
): string {
  const loc = locPrefix(uiLocale)
  const isPhone = query.type === 'phone'
  const code = query.type === 'order_code' || query.type === 'ems_code' ? query.value : ''
  const notFound =
    outcome.httpStatus === 404 ||
    /not found|không tìm thấy|khong tim thay|endpoint not found/i.test(outcome.detail || '')

  if (loc.startsWith('en')) {
    if (notFound && isPhone) {
      return 'We could not find an order for this phone number. Please send the order code (DH…) or tracking number so we can check it right away.'
    }
    if (notFound && code) {
      return `We could not find order ${code}. Please double-check the code, or send the phone number used when ordering / the tracking number.`
    }
    return 'We could not look up the order right now. Please send the order code (DH…) or tracking number and we will check again.'
  }
  if (loc.startsWith('zh')) {
    if (notFound && isPhone) {
      return '未查到该手机号的订单。请再发订单号（DH…）或运单号，我们马上帮您查。'
    }
    if (notFound && code) {
      return `未找到订单 ${code}。请核对订单号，或发送下单手机号 / 运单号。`
    }
    return '暂时无法查询订单。请发送订单号（DH…）或运单号，我们再查一次。'
  }
  if (loc.startsWith('ja')) {
    if (notFound && isPhone) {
      return 'この電話番号の注文が見つかりませんでした。注文番号（DH…）または追跡番号を送っていただければすぐ確認します。'
    }
    if (notFound && code) {
      return `注文 ${code} が見つかりませんでした。番号をご確認いただくか、注文時の電話番号 / 追跡番号をお送りください。`
    }
    return 'ただいま注文を確認できません。注文番号（DH…）または追跡番号をお送りください。'
  }
  if (loc.startsWith('ko')) {
    if (notFound && isPhone) {
      return '이 전화번호로 주문을 찾지 못했습니다. 주문번호(DH…) 또는 운송장 번호를 보내 주시면 바로 확인해 드릴게요.'
    }
    if (notFound && code) {
      return `주문 ${code}을(를) 찾지 못했습니다. 번호를 다시 확인해 주시거나 주문 시 전화번호 / 운송장 번호를 보내 주세요.`
    }
    return '지금은 주문을 조회할 수 없습니다. 주문번호(DH…) 또는 운송장 번호를 보내 주세요.'
  }
  if (notFound && isPhone) {
    return 'Dạ em chưa tìm thấy đơn theo số điện thoại chị gửi ạ. Chị gửi giúp em mã đơn (DH…) hoặc mã vận đơn để em tra chính xác hơn ạ.'
  }
  if (notFound && code) {
    return `Dạ em chưa tìm thấy đơn ${code} ạ. Chị kiểm tra lại mã, hoặc gửi SĐT lúc đặt hàng / mã vận đơn giúp em nhé.`
  }
  return 'Dạ em chưa tra được đơn trên hệ thống lúc này ạ. Chị gửi giúp em mã đơn (DH…) hoặc mã vận đơn, em kiểm tra lại ngay ạ.'
}

/** Đã rõ ý tra đơn nhưng chưa có SĐT / mã DH / mã vận. */
export function formatShippingLookupNeedIdReply(uiLocale?: string | null): string {
  const loc = locPrefix(uiLocale)
  if (loc.startsWith('en')) {
    return 'Please send the phone number used when ordering, or the order code (DH…) / tracking number, and I will check the latest order right away.'
  }
  if (loc.startsWith('zh')) {
    return '请发送下单手机号，或订单号（DH…）/ 运单号，我马上帮您查该号码的最新订单。'
  }
  if (loc.startsWith('ja')) {
    return 'ご注文時の電話番号、または注文番号（DH…）／追跡番号を送っていただければ、最新の注文をすぐ確認します。'
  }
  if (loc.startsWith('ko')) {
    return '주문 시 사용한 전화번호, 또는 주문번호(DH…) / 운송장 번호를 보내 주시면 최신 주문을 바로 확인해 드릴게요.'
  }
  return 'Dạ chị gửi giúp em số điện thoại lúc đặt hàng, hoặc mã đơn (DH…) / mã vận đơn — em tra đơn mới nhất theo số đó ngay ạ.'
}

export function extractShippingLookupQueryFromThread(
  texts: string[],
  opts?: { allowPhone?: boolean }
): ShippingLookupQuery | null {
  for (const text of texts) {
    const q = extractShippingLookupQuery(text, opts)
    if (q) return q
  }
  return null
}
