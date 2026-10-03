import { convertJinWeightText, hasChineseText } from './image-localization-classifier'
import { IMAGE_LOC_FACTORY_INTRO_KEYWORDS, IMAGE_LOC_URGENT_DELETE_KEYWORDS } from './image-localization-keywords'
import { normalizeImageUrl } from './image-localization-config'
import type { ImageLocOcrBlock } from './image-localization-types'

export const IMAGE_CONSULT_MAX_LINES = 40
export const IMAGE_CONSULT_MAX_LINE_CHARS = 200
export const IMAGE_CONSULT_MAX_JSON_CHARS = 6000
export const IMAGE_CONSULT_PROMPT_MAX_CHARS = 1200

const SELLER_LOCATION_PHRASES = [
  '实力工厂',
  '生产车间',
  '厂家地址',
  '工厂地址',
  '生产地址',
  '发货地',
  '生产地',
  '所在地',
  '制造商',
  '产地',
  '厂址',
  '厂家',
  '地址',
]

/** Cụm bán hàng / liên hệ. Không gồm một chữ như 价, 换 — dễ cắt mất số đo. */
const SELLER_CHANNEL_PHRASES = [
  '一件代发',
  '一手货源',
  '货源充足',
  '大量现货',
  '批发现货',
  '批发价格',
  '批发价',
  '批发商',
  '价格优惠',
  '量大从优',
  '量大价优',
  '价格表',
  '报价单',
  '价目表',
  '优惠价格',
  '微信联系',
  'QQ联系',
  '电话联系',
  '手机号码',
  '热线电话',
  '当天发货',
  '当天发出',
  '免费送货',
  '立即购买',
  '点击进入',
  '热卖推荐',
  '爆款推荐',
  '新品推荐',
  '热卖促销',
  '限时优惠',
  '限时特价',
  '限时抢购',
  '限时秒杀',
  '官方立减',
  '下单立减',
  '百亿补贴',
  '购物津贴',
  '券后价',
  '促销价',
  '活动价',
  '品质保证',
  '关于退换',
  '七天退换',
  '7天退换',
  '特此声明',
  '郑重声明',
  '本店所有',
  '本店货源',
  '本店产品',
  '我公司',
  '本公司',
  '库存处理',
  '尾货清仓',
  '清库存',
  '清仓处理',
  '工厂直销',
  '直销',
  '代发',
  '批发',
  '货源',
  '热卖',
  '爆款',
  '促销',
  '特价',
  '秒杀',
  '包邮',
  '优惠',
  '折扣',
  '清仓',
  '微信',
  '薇信',
  'wechat',
  'hot sale',
  'big sale',
  'on sale',
  'buy now',
  'click here',
  'free ship',
]

const SELLER_PHRASES = uniquePhrases([
  ...IMAGE_LOC_FACTORY_INTRO_KEYWORDS,
  ...IMAGE_LOC_URGENT_DELETE_KEYWORDS.filter((phrase) => phrase.trim().length >= 4 && !/^\d{4}$/.test(phrase.trim())),
  ...SELLER_LOCATION_PHRASES,
  ...SELLER_CHANNEL_PHRASES,
]).sort((a, b) => b.length - a.length)

export type ImageConsultLine = { src: string; vi: string }

export type ImageConsultImage = {
  url: string
  lines: ImageConsultLine[]
  /** Ảnh đã bị xóa sau OCR (bảng size, hướng dẫn). Giữ chữ cho lần bản địa hóa sau. */
  retained?: boolean
}

export type ImageConsultContext = {
  captured_at: string
  language: string
  images: ImageConsultImage[]
}

function uniquePhrases(phrases: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const phrase of phrases) {
    const value = phrase.trim()
    if (value.length < 2) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[\s\u3000]+/g, '')
}

function hasProductSignal(text: string): boolean {
  if (/\d/.test(text)) return true
  if (/(?:cm|mm|kg|ml|kw|mah|hz|inch|%)/i.test(text)) return true
  if (/(?:^|[^a-z])(?:w|v)(?:[^a-z]|$)/i.test(text)) return true
  return [...text.replace(/\s+/g, '')].length >= 4
}

export function filterImageConsultSourceLine(raw: string): string | null {
  const original = convertJinWeightText(String(raw || '')).trim()
  if (!original) return null
  let text = original
  text = text.replace(/https?:\/\/\S+/gi, ' ')
  text = text.replace(/\b[\w.-]+\.(?:com|cn|net|org|vn)\b/gi, ' ')
  text = text.replace(/[¥￥]\s*\d+(?:[.,]\d+)?/g, ' ')
  text = text.replace(/\d+(?:[.,]\d+)?\s*元/g, ' ')
  text = text.replace(/(?:微信|薇信|wechat|vx)\s*[:：]?\s*[A-Za-z0-9_-]{3,}/gi, ' ')
  text = text.replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, ' ')
  text = text.replace(/(?:\+?84|0)\d{8,10}/g, ' ')
  let strippedSeller = false
  for (const phrase of SELLER_PHRASES) {
    const next = text.replace(new RegExp(escapeRegExp(phrase), 'gi'), ' ')
    if (next !== text) strippedSeller = true
    text = next
  }
  text = text.replace(/\s+/g, ' ').trim()
  if (isConsultJunk(text)) return null
  if (strippedSeller && !hasProductSignal(text)) return null
  if (text.length > IMAGE_CONSULT_MAX_LINE_CHARS) text = text.slice(0, IMAGE_CONSULT_MAX_LINE_CHARS).trim()
  return text || null
}

function isConsultJunk(text: string): boolean {
  const compact = text.replace(/\s+/g, '')
  if (!compact) return true
  if (!/[\p{L}\p{N}]/u.test(compact)) return true
  if ([...compact].length <= 1) return true
  if (/^(?:19|20)\d{2}$/.test(compact)) return true
  return false
}

export function collectImageConsultSourceLines(blocks: ImageLocOcrBlock[]): string[] {
  const sorted = [...blocks].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
  const out: string[] = []
  const seen = new Set<string>()
  for (const block of sorted) {
    const kept = filterImageConsultSourceLine(block.text || '')
    if (!kept) continue
    const key = compactKey(kept)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(kept)
    if (out.length >= IMAGE_CONSULT_MAX_LINES) break
  }
  return out
}

export function parseImageConsultContext(raw: unknown): ImageConsultContext | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as { captured_at?: unknown; language?: unknown; images?: unknown }
  if (!Array.isArray(record.images)) return null
  const images: ImageConsultImage[] = []
  for (const item of record.images) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const image = item as { url?: unknown; lines?: unknown; retained?: unknown }
    const url = typeof image.url === 'string' ? normalizeImageUrl(image.url) : ''
    if (!url || !Array.isArray(image.lines)) continue
    const lines: ImageConsultLine[] = []
    for (const line of image.lines) {
      if (!line || typeof line !== 'object' || Array.isArray(line)) continue
      const src = String((line as { src?: unknown }).src || '').trim()
      const vi = String((line as { vi?: unknown }).vi || '').trim()
      if (!src && !vi) continue
      lines.push({ src: src || vi, vi })
    }
    if (!lines.length) continue
    images.push({ url, lines, ...(image.retained === true ? { retained: true } : {}) })
  }
  if (!images.length) return null
  return {
    captured_at: typeof record.captured_at === 'string' ? record.captured_at : '',
    language: typeof record.language === 'string' ? record.language : 'vi',
    images,
  }
}

function aliveFinalUrl(finalUrl: string | null | undefined): string {
  const value = normalizeImageUrl(finalUrl || '')
  if (!value || value.toUpperCase() === 'DELETED') return ''
  return value
}

export function mergeImageConsultContext(input: {
  previous: unknown
  results: Record<string, { consult_sources?: string[]; final_url?: string | null }>
  stillHostedUrls: readonly string[]
  language: string
  capturedAt?: string
}): { touched: boolean; context: ImageConsultContext | null; pendingSources: string[] } {
  const previous = parseImageConsultContext(input.previous)
  const next = new Map<string, ImageConsultImage>()
  for (const image of previous?.images || []) next.set(image.url, image)

  let touched = false
  const written = new Set<string>()
  for (const [rawUrl, result] of Object.entries(input.results)) {
    if (!result || result.consult_sources === undefined) continue
    touched = true
    const original = normalizeImageUrl(rawUrl)
    const storedUrl = aliveFinalUrl(result.final_url) || original
    next.delete(original)
    if (storedUrl !== original) next.delete(storedUrl)
    const sources = result.consult_sources.map((line) => line.trim()).filter(Boolean)
    if (!sources.length) continue
    const lines = sources.map((src) => ({ src, vi: hasChineseText(src) ? '' : src }))
    next.set(storedUrl, {
      url: storedUrl,
      lines,
      ...(aliveFinalUrl(result.final_url) ? {} : { retained: true }),
    })
    written.add(storedUrl)
  }

  const hosted = new Set(input.stillHostedUrls.map((url) => normalizeImageUrl(url)).filter(Boolean))
  for (const [url, image] of next) {
    if (written.has(url)) continue
    if (image.retained) continue
    if (hosted.has(url)) continue
    next.delete(url)
  }

  const pending = new Set<string>()
  for (const image of next.values()) {
    for (const line of image.lines) {
      if (!line.vi && hasChineseText(line.src)) pending.add(line.src)
    }
  }

  const context = compactImageConsultContext({
    captured_at: input.capturedAt || new Date().toISOString(),
    language: input.language || previous?.language || 'vi',
    images: [...next.values()],
  })
  return { touched, context, pendingSources: [...pending] }
}

export function fillImageConsultTranslations(
  context: ImageConsultContext,
  translatedBySource: ReadonlyMap<string, string>
): ImageConsultContext {
  return compactImageConsultContext({
    ...context,
    images: context.images.map((image) => ({
      ...image,
      lines: image.lines.map((line) => {
        if (line.vi) return line
        const translated = translatedBySource.get(line.src)?.trim()
        return { src: line.src, vi: translated || line.src }
      }),
    })),
  }) || context
}

export function compactImageConsultContext(context: ImageConsultContext): ImageConsultContext | null {
  const images: ImageConsultImage[] = []
  const seen = new Set<string>()
  let lineCount = 0
  for (const image of context.images) {
    const lines: ImageConsultLine[] = []
    for (const line of image.lines) {
      const src = line.src.trim()
      const vi = line.vi.trim()
      const display = vi || src
      if (!display) continue
      const key = compactKey(display)
      if (seen.has(key)) continue
      if (lineCount >= IMAGE_CONSULT_MAX_LINES) break
      seen.add(key)
      lineCount += 1
      lines.push({ src: src || display, vi })
    }
    if (!lines.length) continue
    images.push({ url: image.url, lines, ...(image.retained ? { retained: true } : {}) })
    if (lineCount >= IMAGE_CONSULT_MAX_LINES) break
  }
  if (!images.length) return null
  let packed: ImageConsultContext = {
    captured_at: context.captured_at,
    language: context.language,
    images,
  }
  while (JSON.stringify(packed).length > IMAGE_CONSULT_MAX_JSON_CHARS) {
    const last = packed.images[packed.images.length - 1]
    if (!last) return null
    last.lines.pop()
    if (!last.lines.length) packed.images.pop()
    if (!packed.images.length) return null
    packed = { ...packed, images: packed.images }
  }
  return packed
}

const EXTERNAL_CATALOG_IMAGE_URL = 'external-catalog'

/**
 * Chuẩn hóa payload web khách thành cột `image_consult_context`.
 * Nhận object `{ language, lines: [{ src, vi }] }` hoặc đúng shape đã lưu `{ images: [...] }`.
 * Thiếu / rỗng / toàn dòng xưởng-giá-liên hệ → `null` (không ghi đè cột đang có).
 */
export function normalizeExternalImageConsultContext(raw: unknown): ImageConsultContext | null {
  const parsed = parseExternalImageConsultPayload(raw)
  if (!parsed) return null
  return compactImageConsultContext(parsed)
}

function parseExternalImageConsultPayload(raw: unknown): ImageConsultContext | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return parseExternalImageConsultPayload(JSON.parse(text) as unknown)
      } catch {
        return null
      }
    }
    return null
  }
  if (Array.isArray(raw)) {
    return linesToExternalContext(raw, 'vi')
  }
  if (typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const language =
    typeof record.language === 'string' && record.language.trim()
      ? record.language.trim().slice(0, 12)
      : 'vi'
  if (Array.isArray(record.images)) {
    const stored = parseImageConsultContext(raw)
    if (!stored) return null
    return refilterExternalContext({ ...stored, language: stored.language || language })
  }
  if (!Array.isArray(record.lines)) return null
  const capturedAt = typeof record.captured_at === 'string' ? record.captured_at : new Date().toISOString()
  const context = linesToExternalContext(record.lines, language)
  if (!context) return null
  return { ...context, captured_at: capturedAt || context.captured_at }
}

function linesToExternalContext(lines: unknown[], language: string): ImageConsultContext | null {
  const kept: ImageConsultLine[] = []
  for (const item of lines) {
    const line = keepExternalConsultLine(item)
    if (line) kept.push(line)
  }
  if (!kept.length) return null
  return {
    captured_at: new Date().toISOString(),
    language: language || 'vi',
    images: [{ url: EXTERNAL_CATALOG_IMAGE_URL, lines: kept }],
  }
}

function refilterExternalContext(context: ImageConsultContext): ImageConsultContext | null {
  const images: ImageConsultImage[] = []
  for (const image of context.images) {
    const lines: ImageConsultLine[] = []
    for (const line of image.lines) {
      const kept = keepExternalConsultLine(line)
      if (kept) lines.push(kept)
    }
    if (!lines.length) continue
    images.push({ url: image.url, lines, ...(image.retained ? { retained: true } : {}) })
  }
  if (!images.length) return null
  return { ...context, images }
}

function keepExternalConsultLine(raw: unknown): ImageConsultLine | null {
  const line =
    typeof raw === 'string'
      ? { src: raw, vi: '' }
      : raw && typeof raw === 'object' && !Array.isArray(raw)
        ? {
            src: String((raw as { src?: unknown }).src || '').trim(),
            vi: String((raw as { vi?: unknown }).vi || '').trim(),
          }
        : null
  if (!line) return null
  const source = line.src || line.vi
  const src = filterImageConsultSourceLine(source)
  if (!src) return null
  const viRaw = line.vi && line.vi !== source ? filterImageConsultSourceLine(line.vi) : ''
  const vi = viRaw || (hasChineseText(src) ? '' : src)
  return { src, vi }
}

export function imageConsultContextHasLines(raw: unknown): boolean {
  return Boolean(parseImageConsultContext(raw)?.images.length)
}

export function shouldAttachImageConsultContext(intent: string | null | undefined): boolean {
  return (
    intent === 'follow_up_current_product' ||
    intent === 'explicit_sku_consult' ||
    intent === 'card_consult_isolated' ||
    intent === 'purchase_or_order'
  )
}

export function formatImageConsultContextForPrompt(raw: unknown): string {
  const context = parseImageConsultContext(raw)
  if (!context) return ''
  const lines: string[] = []
  let chars = 0
  for (const image of context.images) {
    for (const line of image.lines) {
      const text = (line.vi || line.src).trim()
      if (!text) continue
      if (chars + text.length > IMAGE_CONSULT_PROMPT_MAX_CHARS) break
      lines.push(text)
      chars += text.length
    }
    if (chars >= IMAGE_CONSULT_PROMPT_MAX_CHARS) break
  }
  if (!lines.length) return ''
  return `

[Thông tin đọc trên ảnh sản phẩm — chỉ đúng mã đang tư vấn]
${lines.map((line) => `- ${line}`).join('\n')}
Chỉ dùng các dòng trên cho chất liệu, kích thước, cách chọn size, cách dùng, công suất và thông số của chính sản phẩm. Không lấy giá, tiền cọc, nơi sản xuất, xưởng, liên hệ hay thời gian giao từ đây. Số liệu không có trong danh sách thì nói chưa thấy trên ảnh, không bịa.`
}
