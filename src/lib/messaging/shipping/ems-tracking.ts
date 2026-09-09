import type { EmsPhase } from '@/lib/messaging/shipping/ems-types'
import { looksLikeEmsTrackingCode } from '@/lib/messaging/shipping/ems-excel'
import type { EmsTrackingEvent, EmsTrackingPayload } from '@/lib/messaging/shipping/ems-types'

const EMS_CONNECTION_ERROR =
  'Không kết nối được EMS. Hệ thống tự tra lại sau import, hoặc bấm «Tra lại EMS» trên trang vận chuyển.'

const cache = new Map<string, { at: number; payload: EmsTrackingPayload }>()
const CACHE_TTL_MS = 120_000

function cacheGet(key: string): EmsTrackingPayload | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.at) {
    cache.delete(key)
    return null
  }
  return hit.payload
}

function cacheSet(key: string, payload: EmsTrackingPayload) {
  cache.set(key, { at: Date.now() + CACHE_TTL_MS, payload })
}

function myemsItemCode(trackingCode: string): string {
  const code = trackingCode.trim().toUpperCase()
  if (code.endsWith('EMS')) return code
  return `${code}EMS`
}

function parseTracedAt(raw: unknown): string | null {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const formats = [
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
  ]
  for (const re of formats) {
    const m = re.exec(text)
    if (!m) continue
    if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
    return `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}`
  }
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return null
}

function normalizeMyemsEvents(raw: unknown): EmsTrackingEvent[] {
  if (!Array.isArray(raw)) return []
  const events: EmsTrackingEvent[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const description = String(rec.TRANG_THAI || rec.NOI_DUNG || rec.description || '').trim()
    if (!description) continue
    events.push({
      status_code: rec.MA_TRANG_THAI != null ? Number(rec.MA_TRANG_THAI) || null : null,
      description,
      address: String(rec.DIA_CHI || rec.BUU_CUC || rec.address || '').trim() || null,
      traced_at: parseTracedAt(rec.NGAY_TRANG_THAI || rec.NGAY || rec.traced_at),
    })
  }
  return events
}

export function emsPhaseFromDescription(description: string | null | undefined): EmsPhase {
  const text = (description || '').toLowerCase()
  if (text.includes('phát thành công') || text.includes('delivered successfully')) return 'delivered'
  if (text.replace(/\s+/g, '').includes('[cod]trảtiền')) return 'cod_settled'
  if (text.replace(/\s+/g, '').includes('[cod]đãthutiền')) return 'cod_collected'
  if (text.includes('giao bưu tá') || text.includes('out for delivery')) return 'out_for_delivery'
  if (text.includes('vận chuyển') || text.includes('đến bưu cục') || text.includes('arrival at po')) return 'in_transit'
  if (text.includes('chấp nhận gửi') || text.includes('posting / collection')) return 'posted'
  return 'unknown'
}

async function fetchMyemsPublicTracking(code: string): Promise<EmsTrackingPayload> {
  const baseUrl = (process.env.EMS_PUBLIC_API_BASE_URL || process.env.EMS_API_BASE_URL || 'https://api.myems.vn')
    .trim()
    .replace(/\/$/, '')
  const language = Number(process.env.EMS_TRACKING_LANGUAGE || 0) || 0
  const timeoutMs = Number(process.env.EMS_API_TIMEOUT_SECONDS || 15) * 1000 || 15_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = `${baseUrl}/TrackAndTraceItemCode?itemcode=${encodeURIComponent(myemsItemCode(code))}&language=${language}`
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'NanoAI-shop/ems-tracking' },
    })
    if (!resp.ok) {
      return { available: true, tracking_code: code, events: [], error: EMS_CONNECTION_ERROR }
    }
    const body = (await resp.json()) as Record<string, unknown>
    if (!body || body.Code !== '00') {
      const message = String(body?.Message || '').trim()
      return {
        available: true,
        tracking_code: code,
        events: [],
        error: message || 'Không tìm thấy hành trình EMS cho mã vận đơn này.',
      }
    }
    const info = body.TBL_INFO && typeof body.TBL_INFO === 'object' ? (body.TBL_INFO as Record<string, unknown>) : {}
    let events = normalizeMyemsEvents(body.List_TBL_DINH_VI)
    if (!events.length) events = normalizeMyemsEvents(body.List_TBL_DELIVERY)
    const current = String(info.TRANG_THAI || '').trim() || (events[0]?.description ?? null)
    return {
      available: true,
      tracking_code: String(info.MAE1 || code).trim() || code,
      reference_code: String(info.MA_THAM_CHIEU || '').trim() || null,
      current_status: null,
      current_status_description: current,
      events,
      error: null,
    }
  } catch {
    return { available: true, tracking_code: code, events: [], error: EMS_CONNECTION_ERROR }
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchEmsTracking(trackingCode: string): Promise<EmsTrackingPayload> {
  const code = (trackingCode || '').trim().toUpperCase()
  if (!code) return { available: false, events: [], error: 'Thiếu mã vận đơn EMS.' }
  const cacheKey = `ems:${code}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached
  const payload = await fetchMyemsPublicTracking(code)
  cacheSet(cacheKey, payload)
  return payload
}

export function emsLookupCandidates(referenceCode: string, savedTracking?: string | null): string[] {
  const out: string[] = []
  const push = (v: string | null | undefined) => {
    const t = (v || '').trim().toUpperCase()
    if (t && !out.includes(t)) out.push(t)
  }
  push(savedTracking)
  push(referenceCode)
  if (looksLikeEmsTrackingCode(referenceCode) && !referenceCode.toUpperCase().endsWith('EMS')) {
    push(`${referenceCode}EMS`)
  }
  return out
}

export async function fetchEmsWithFallback(codes: string[]): Promise<EmsTrackingPayload> {
  let last: EmsTrackingPayload = { available: false, events: [], error: 'Thiếu mã vận đơn EMS.' }
  for (const code of codes) {
    last = await fetchEmsTracking(code)
    if (last.available && (last.events.length > 0 || last.current_status_description) && !last.error) {
      return last
    }
    if (last.available && last.current_status_description && last.error == null) return last
  }
  return last
}
