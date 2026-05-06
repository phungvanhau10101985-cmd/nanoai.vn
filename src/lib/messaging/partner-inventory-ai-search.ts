import type { Database, Json } from '@/types/database.types'
import {
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByImageUrlFromPg,
  fetchPartnerInventoryRowByProductUrlNormKeyFromPg,
  fetchPartnerInventoryRowsByTokenIlikeFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  fetchInventoryRowsBySemanticTextForPartnerAi,
  tryParseVndAmountForEmbedding,
} from '@/lib/messaging/partner-inventory-text-embedding'
import { fetchTopInventoryRowByConsultCardImageVectorAnn } from '@/lib/messaging/partner-gemini-image-search'
import { isPgConfigured } from '@/lib/db/pool'

export type PartnerInventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Chuỗi lọc kiểu `.or()` (REST) dùng dấu phẩy — loại ký tự làm hỏng filter hoặc LIKE. */
export function sanitizeInventorySearchToken(raw: string): string {
  return raw.replace(/[%_,().]/g, '').trim().slice(0, 64)
}

/**
 * Giới hạn số pattern ILIKE gửi Postgres (đủ để phủ gần hết tin khách; tránh câu cực dài làm query nặng).
 * Trước đây 4–8 token khiến lệch nhiều so với ý khách.
 */
const SEARCH_TOKEN_MAX = 48
const PER_TOKEN_QUERY_LIMIT = 45
/** Số mặt hàng tối đa đưa vào ngữ cảnh AI — chỉ lấy theo vector văn bản (ANN), từ gần đến xa. */
export const PARTNER_AI_INVENTORY_CONTEXT_LIMIT = 20
const EXPLICIT_SKU_MAX = 6

type TokenCandidate = { token: string; priority: number }

function normalizeSkuComparable(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
}

export function extractExplicitSkuCandidates(message: string): string[] {
  const text = message.replace(/^📷\s*/u, '').trim()
  if (!text) return []
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const t = sanitizeInventorySearchToken(raw)
    if (t.length < 2) return
    const k = t.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(t)
  }

  // Ưu tiên mã có nhãn rõ ràng: "mã B3001", "sku: B-3001", "code #A12".
  for (const m of text.matchAll(/(?:mã|ma|sku|code)\s*[:#\-\s]*([A-Za-z0-9][A-Za-z0-9._-]{1,31})/gi)) {
    push(m[1])
    if (out.length >= EXPLICIT_SKU_MAX) return out
  }
  // Bắt dạng mã phổ biến không có từ khóa: B3001, AB123, SP-2201, ...
  for (const m of text.matchAll(/\b([A-Za-z]{1,8}\d{2,}[A-Za-z0-9._-]{0,16})\b/g)) {
    push(m[1])
    if (out.length >= EXPLICIT_SKU_MAX) return out
  }
  // Chuỗi hệ thống chèn khi khách xem SP trên web (widget-guest-post → latestInboundTextForPartnerAi)
  for (const m of text.matchAll(/\[Customer product SKU:\s*([^\]\n]{1,128})\]/gi)) {
    push(m[1].trim())
    if (out.length >= EXPLICIT_SKU_MAX) return out
  }
  // Mã thuần số (4–14 chữ số) sau nhãn mã/SKU — hay gặp trên sàn TMĐT
  for (const m of text.matchAll(
    /(?:mã|ma|sku|code|mã\s*sp|mã\s*sản\s*phẩm)\s*[:#]?\s*(\d{4,14})(?=\s|$|[,.;!?]|[\]\n])/gi
  )) {
    push(m[1])
    if (out.length >= EXPLICIT_SKU_MAX) return out
  }
  return out
}

/**
 * Lấy dòng kho khi khách gửi tin kèm `page_context.sku` (xem SP trên site, không gõ [Customer product SKU]).
 */
export async function fetchInventoryRowsFromPageContextSku(
  partnerId: string,
  rawPayload: Json | null | undefined
): Promise<PartnerInventoryRow[]> {
  if (!isPgConfigured()) return []
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return []
  const pc = (rawPayload as { page_context?: { sku?: string } }).page_context
  const sku = typeof pc?.sku === 'string' ? pc.sku.trim() : ''
  if (sku.length < 2) return []
  /** Khớp trực tiếp SKU trong kho — không qua ILIKE/tin nhắn (tránh nhiễu từ cả đoạn câu dài). */
  const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, sku)
  return row ? [row] : []
}

/**
 * Bấm «Tư vấn» trên thẻ SP: neo đúng dòng kho theo URL/ảnh — không chỉ SKU (nhiều thẻ không có SKU hoặc SKU lệch).
 * Tránh rơi vào tìm vector trên cả câu dài của khách → carousel không liên quan.
 */
export async function fetchInventoryRowsFromProductCardConsultPageContext(
  partnerId: string,
  rawPayload: Json | null | undefined
): Promise<PartnerInventoryRow[]> {
  if (!isPgConfigured()) return []
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return []
  const pc = (rawPayload as {
    page_context?: {
      source?: string
      product_url?: string
      image_url?: string
      inventory_id?: string
    }
  }).page_context
  if (!pc || pc.source !== 'product_card_consult') return []

  const invId = typeof pc.inventory_id === 'string' ? pc.inventory_id.trim() : ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invId)) {
    const byId = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, invId)
    if (byId) return [byId]
  }

  const productUrl = typeof pc.product_url === 'string' ? pc.product_url.trim() : ''
  if (productUrl && /^https?:\/\//i.test(productUrl)) {
    const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, productUrl)
    if (row) return [row]
  }

  const imageUrl = typeof pc.image_url === 'string' ? pc.image_url.trim() : ''
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    const variants = [imageUrl, imageUrl.split('?')[0]].filter((u, idx, a) => u && a.indexOf(u) === idx)
    for (const u of variants) {
      const row = await fetchPartnerInventoryRowByImageUrlFromPg(partnerId, u)
      if (row) return [row]
    }
    /** Thẻ cũ không có `inventory_id`: tải ảnh để embed truy vấn — kho đích vẫn dùng vector đã lưu (pgvector). */
    const rowVec = await fetchTopInventoryRowByConsultCardImageVectorAnn(partnerId, imageUrl)
    if (rowVec) return [rowVec]
  }

  return []
}

/** Một UUID dòng kho cho thẻ «Tư vấn» — dùng làm khóa cache theo SP. */
export async function resolveProductCardConsultInventoryIdFromPg(
  partnerId: string,
  rawPayload: Json | null | undefined
): Promise<string | null> {
  const rows = await fetchInventoryRowsFromProductCardConsultPageContext(partnerId, rawPayload)
  const id = rows[0]?.id?.trim()
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null
}

function collectTokenCandidates(text: string): TokenCandidate[] {
  const best = new Map<string, { token: string; priority: number }>()

  const consider = (raw: string, priority: number) => {
    const t = sanitizeInventorySearchToken(raw)
    if (t.length < 2) return
    if (t.length < 3 && !/\d/.test(t)) return
    const key = t.toLowerCase()
    const prev = best.get(key)
    if (!prev || prev.priority < priority) best.set(key, { token: t, priority })
  }

  for (const m of text.matchAll(/(?:mã|ma|sku|code)\s*[:\s]\s*([A-Za-z0-9][A-Za-z0-9\-]*)/gi)) {
    consider(m[1], 100)
  }

  for (const m of text.matchAll(/\b[A-Za-z0-9]{2,}(?:-[A-Za-z0-9]+)+\b/g)) {
    consider(m[0], 95)
  }

  for (const m of text.matchAll(/\b(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{3,}\b/g)) {
    consider(m[0], 90)
  }

  for (const w of text.split(/[\s,.;:!?'"()[\]{}<>\/\\]+/)) {
    if (w.length >= 2) consider(w, w.length >= 6 ? 55 : w.length >= 4 ? 45 : 35)
  }

  return Array.from(best.values())
}

function buildPriceUnitHintTokens(text: string): TokenCandidate[] {
  const seen = new Set<number>()
  const out: TokenCandidate[] = []
  const addAmount = (amount: number, priDigits: number, priVi: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    if (seen.has(amount)) return
    seen.add(amount)
    const d = String(amount)
    const vi = amount.toLocaleString('vi-VN')
    out.push({ token: sanitizeInventorySearchToken(d) || d, priority: priDigits })
    if (vi && vi !== d) out.push({ token: sanitizeInventorySearchToken(vi) || vi, priority: priVi })
  }
  for (const m of text.matchAll(/\b(\d{1,4})\s*(k|ngan|ngàn|nghin|nghìn)\b/gi)) {
    const n = Number.parseInt(m[1], 10)
    if (!Number.isFinite(n) || n <= 0) continue
    addAmount(n * 1000, 91, 86)
  }
  for (const m of text.matchAll(/\b(\d{1,3})(?:[.,](\d{1,2}))?\s*(tr|trieu|triệu)\b/gi)) {
    const major = Number.parseInt(m[1], 10)
    if (!Number.isFinite(major) || major < 0) continue
    const minorRaw = (m[2] ?? '').trim()
    const minor = minorRaw ? Number.parseInt(minorRaw.padEnd(2, '0').slice(0, 2), 10) : 0
    if (!Number.isFinite(minor) || minor < 0) continue
    const amount = major * 1_000_000 + minor * 10_000
    addAmount(amount, 93, 88)
  }
  return out
}

/** Chuẩn hóa nhẹ: bỏ emoji 📷, gom khoảng trắng — không đổi nội dung tiếng Việt có dấu. */
export function normalizeCustomerMessageForInventorySearch(raw: string): string {
  return raw.replace(/^📷\s*/u, '').replace(/\s+/g, ' ').trim()
}

/** Từ dừng rất ngắn — chỉ lọc nhiễu tìm ILIKE, không “phân loại SP” bằng AI. */
const VI_INVENTORY_STOP_WORDS = new Set([
  'ạ',
  'ơi',
  'nhé',
  'nhá',
  'nak',
  'dạ',
  'em',
  'anh',
  'chị',
  'shop',
  'cho',
  'mình',
  'bạn',
  'với',
  'và',
  'của',
  'có',
  'không',
  'được',
  'giúp',
  'tìm',
  'xin',
  'hỏi',
  'muốn',
  'cần',
  'gì',
  'là',
  'thì',
  'đến',
  'từ',
  'trong',
  'ngoài',
  'để',
  'này',
  'nào',
  'đó',
  'khi',
  'đã',
  'sẽ',
  'bị',
  'bằng',
  'các',
  'một',
  'theo',
  'như',
  'vậy',
  'tầm',
  'khoảng',
  'đồng',
  'vnd',
  'giá',
])

/**
 * Đưa gần như toàn bộ từ/cụm 2 từ có nghĩa từ tin khách (sau lọc stopword) để ILIKE không bỏ sót ý.
 */
function collectFullMessageLexicalTokens(text: string): TokenCandidate[] {
  const out: TokenCandidate[] = []
  const consider = (raw: string, priority: number) => {
    const t = sanitizeInventorySearchToken(raw)
    if (t.length < 2) return
    const lw = t.toLowerCase()
    if (VI_INVENTORY_STOP_WORDS.has(lw)) return
    out.push({ token: t, priority })
  }
  const words = text.split(/[\s,.;:!?'"()[\]{}<>\/\\]+/).filter(Boolean)
  for (const w of words) {
    consider(w, 43)
  }
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].toLowerCase()
    const b = words[i + 1].toLowerCase()
    if (VI_INVENTORY_STOP_WORDS.has(a) || VI_INVENTORY_STOP_WORDS.has(b)) continue
    const phrase = `${words[i]} ${words[i + 1]}`
    const t = sanitizeInventorySearchToken(phrase)
    if (t.length >= 4) consider(phrase, 50)
  }
  return out
}

/** Cụm “loại hàng” thường gặp — ưu tiên cao, bổ sung cho từ tách riêng. */
function collectStandardProductPhrases(lower: string): TokenCandidate[] {
  const phrases: Array<[string, number]> = [
    ['váy maxi', 100],
    ['váy midi', 99],
    ['váy mini', 99],
    ['đầm maxi', 99],
    ['đầm ôm', 96],
    ['đầm suông', 96],
    ['đi biển', 95],
    ['đầm công sở', 97],
    ['công sở', 93],
    ['dạo phố', 93],
    ['đi tiệc', 93],
    ['dự tiệc', 93],
    ['áo khoác', 96],
    ['áo thun', 95],
    ['quần jean', 96],
    ['quần tây', 96],
    ['giày cao gót', 98],
    ['dép quai hậu', 96],
  ]
  const out: TokenCandidate[] = []
  for (const [p, pr] of phrases) {
    if (lower.includes(p)) out.push({ token: p, priority: pr })
  }
  return out
}

/** Tokens for coarse inventory match (SKU / name fragments). */
export function extractInventorySearchTokens(message: string): string[] {
  const text = normalizeCustomerMessageForInventorySearch(message)
  if (!text) return []
  const lower = text.toLowerCase()
  const candidates: TokenCandidate[] = []
  candidates.push(...collectTokenCandidates(text))
  candidates.push(...collectFullMessageLexicalTokens(text))
  candidates.push(...buildPriceUnitHintTokens(text))
  candidates.push(...collectStandardProductPhrases(lower))
  // Keep color/style tokens so text queries can suggest similar products better.
  const styleHints: Array<{ token: string; priority: number }> = []
  const addHint = (token: string, priority: number) => {
    const t = sanitizeInventorySearchToken(token)
    if (!t) return
    styleHints.push({ token: t, priority })
  }
  const hintWords = [
    'đỏ',
    'đen',
    'trắng',
    'nâu',
    'be',
    'xám',
    'hồng',
    'xanh',
    'vàng',
    'cao gót',
    'gót nhọn',
    'gót vuông',
    'boot',
    'sneaker',
    'sandal',
    'loafer',
    'dép',
    'tông',
    'xăng đan',
  ]
  for (const w of hintWords) {
    if (lower.includes(w)) addHint(w, 58)
  }
  // Ưu tiên cao hơn cả biến thể giá (thường ~92) để ILIKE vẫn lấy được name/mô tả «váy maxi» khi khách vừa hỏi kiểu vừa nêu giá.
  const garmentHints: Array<[string, number]> = [
    ['váy maxi', 99],
    ['maxi', 97],
    ['midi', 96],
    ['mini', 96],
    ['váy', 95],
    ['đầm', 95],
    ['đi biển', 94],
    ['dạo phố', 93],
    ['tiệc', 93],
    ['công sở', 93],
  ]
  for (const [w, p] of garmentHints) {
    if (lower.includes(w)) addHint(w, p)
  }
  candidates.push(...styleHints)
  candidates.sort((a, b) => b.priority - a.priority || b.token.length - a.token.length)
  const seenTok = new Set<string>()
  const out: string[] = []
  for (const c of candidates) {
    const k = c.token.toLowerCase()
    if (seenTok.has(k)) continue
    seenTok.add(k)
    out.push(c.token)
    if (out.length >= SEARCH_TOKEN_MAX) break
  }
  return out
}

export function scoreInventoryRowMatch(row: PartnerInventoryRow, needles: string[]): number {
  const sku = (row.sku ?? '').toLowerCase().trim()
  const skuNorm = normalizeSkuComparable(row.sku)
  const name = row.name.toLowerCase().trim()
  const desc = (row.description ?? '').toLowerCase().trim()
  const priceHint = (row.price_hint ?? '').toLowerCase().trim()
  let score = 0
  for (const needle of needles) {
    const n = needle.toLowerCase().trim()
    const nNorm = normalizeSkuComparable(needle)
    if (!n) continue
    if (nNorm && skuNorm && skuNorm === nNorm) score += 260
    else if (nNorm && skuNorm && skuNorm.startsWith(nNorm)) score += 160
    else if (nNorm && skuNorm && skuNorm.includes(nNorm)) score += 110
    if (sku === n) score += 120
    else if (sku.includes(n)) score += 95
    if (name === n) score += 70
    else if (name.includes(n)) score += 50
    if (desc.includes(n)) score += 12
    if (priceHint.includes(n)) score += 26
  }
  return score
}

/**
 * Sau khi ANN đã trả đủ top-k: **chỉ sắp xếp lại** các dòng đó theo độ khớp chữ (tên/SKU/mô tả)
 * với token rút từ tin khách — điểm cao → thấp; cùng điểm giữ thứ tự vector gốc.
 * Không thêm SP ngoài tập vector (tránh lệch loại hàng do ILIKE rộng).
 */
export function rerankInventoryRowsByCustomerTextNameMatch(
  customerMessage: string,
  rows: PartnerInventoryRow[]
): PartnerInventoryRow[] {
  if (rows.length <= 1) return rows
  const needles = extractInventorySearchTokens(customerMessage)
  if (needles.length === 0) return rows
  const scored = rows.map((row, originalIndex) => ({
    row,
    originalIndex,
    score: scoreInventoryRowMatch(row, needles),
  }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.originalIndex - b.originalIndex
  })
  return scored.map((s) => s.row)
}

async function fetchRowsMatchingToken(partnerId: string, token: string): Promise<PartnerInventoryRow[]> {
  const clean = sanitizeInventorySearchToken(token).replace(/[%_]/g, '')
  if (clean.length < 2) return []
  if (!isPgConfigured()) return []
  try {
    const rows = await fetchPartnerInventoryRowsByTokenIlikeFromPg(partnerId, token, PER_TOKEN_QUERY_LIMIT)
    return rows ?? []
  } catch (e) {
    console.warn('[partner-inventory-ai-search] fetchRowsMatchingToken PG failed', e)
    return []
  }
}

/**
 * Khớp chính xác theo mã sản phẩm khách nhắn (SKU/code), chuẩn hoá bỏ khoảng trắng/ký tự ngăn cách.
 * Dùng để "neo" ngữ cảnh cho AI khi khách hỏi kiểu: "mã B3001 còn hàng không?".
 */
export async function fetchInventoryRowsByExplicitSku(
  partnerId: string,
  customerMessage: string
): Promise<PartnerInventoryRow[]> {
  const explicit = extractExplicitSkuCandidates(customerMessage)
  if (!explicit.length) return []

  const candidateChunks = await Promise.all(explicit.map((tok) => fetchRowsMatchingToken(partnerId, tok)))
  const skuNormSet = new Set(explicit.map((x) => normalizeSkuComparable(x)).filter(Boolean))
  const merged = new Map<string, PartnerInventoryRow>()
  for (const chunk of candidateChunks) {
    for (const row of chunk) {
      const rowNorm = normalizeSkuComparable(row.sku)
      if (!rowNorm || !skuNormSet.has(rowNorm)) continue
      merged.set(row.id, row)
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.sort_order - b.sort_order)
}

const BUDGET_PARSE_MIN = 20_000
const BUDGET_PARSE_MAX = 500_000_000
/** Khớp ngân sách khách nêu (vd. «tầm 600k») — ±10% lọc SP theo `price_hint`. */
const BUDGET_BAND_LOW = 0.9
const BUDGET_BAND_HIGH = 1.1

function clampBudgetVnd(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null
  if (v < BUDGET_PARSE_MIN || v > BUDGET_PARSE_MAX) return null
  return v
}

/**
 * Suy ra một mức giá mục tiêu (VNĐ) từ tin khách để lọc kho ±10%.
 * Ưu tiên cụm sau «tầm / khoảng / giá tầm …», sau đó các dạng 600k / 1,5tr / 1.500.000đ.
 */
export function extractCustomerBudgetTargetVnd(raw: string): number | null {
  const text = normalizeCustomerMessageForInventorySearch(raw).trim()
  if (!text) return null

  const hintRe =
    /(?:tầm|tam|khoảng|khoang|chừng|độ|giá\s*tầm|ngân\s*sách|khoảng\s+giá|giá\s*khoảng|~)\s*[:\s]?\s*([^\n,.;!?]{1,55})/gi
  for (const m of text.matchAll(hintRe)) {
    const v = clampBudgetVnd(tryParseVndAmountForEmbedding(m[1].trim()))
    if (v !== null) return v
  }

  const kMatches = [...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*k(?:\s|đ|\b)/gi)]
  for (let i = kMatches.length - 1; i >= 0; i--) {
    const v = clampBudgetVnd(tryParseVndAmountForEmbedding(kMatches[i][0]))
    if (v !== null) return v
  }

  const trMatches = [...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu)\b/gi)]
  for (let i = trMatches.length - 1; i >= 0; i--) {
    const v = clampBudgetVnd(tryParseVndAmountForEmbedding(trMatches[i][0]))
    if (v !== null) return v
  }

  const dotted = text.match(/\b(\d{1,3}(?:\.\d{3})+)\s*đ\b/i)
  if (dotted) {
    const v = clampBudgetVnd(tryParseVndAmountForEmbedding(dotted[0]))
    if (v !== null) return v
  }

  return null
}

/** Giới tính / đối tượng trong tin tìm kho — vector dễ nhầm (áo khoác nam vs nữ). */
export type CustomerGenderSearchIntent = 'male' | 'female' | null

/**
 * Khách nêu rõ nam hoặc nữ (không đồng thời cả hai) → lọc/sắp kết quả ANN.
 */
export function extractCustomerGenderSearchIntent(raw: string): CustomerGenderSearchIntent {
  const t = normalizeCustomerMessageForInventorySearch(raw).toLowerCase()
  if (!t) return null
  if (/\bunisex\b/u.test(t)) return null
  const hasNam = /\bnam\b/u.test(t) || /\bđàn\s*ông\b/u.test(t) || /\bnam\s*giới\b/u.test(t)
  const hasNu = /\bnữ\b/u.test(t) || /\bphụ\s*nữ\b/u.test(t) || /\bnữ\s*giới\b/u.test(t)
  if (hasNam && hasNu) return null
  if (hasNam && !hasNu) return 'male'
  if (hasNu && !hasNam) return 'female'
  return null
}

function expandInventoryEmbeddingQueryWithGender(
  customerMessage: string,
  intent: CustomerGenderSearchIntent
): string {
  if (!intent) return customerMessage
  const base = normalizeCustomerMessageForInventorySearch(customerMessage)
  if (!base) return customerMessage
  if (intent === 'male') {
    return `${base} nam giới đàn ông đồ nam cho nam men's jacket men's`
  }
  return `${base} nữ giới phụ nữ đồ nữ women's ladies`
}

function inventoryRowGenderAffinityScore(row: PartnerInventoryRow, intent: CustomerGenderSearchIntent): number {
  if (!intent) return 0
  const blob = `${row.name} ${row.description ?? ''} ${row.consult_note ?? ''}`.toLowerCase()
  if (intent === 'male') {
    let s = 0
    if (/\bnam\b|nam\s*giới|đàn\s*ông|\bmen'?s\b/i.test(blob)) s += 95
    if (/\bunisex\b/i.test(blob)) s += 20
    if (/\bnữ\b|phụ\s*nữ/i.test(blob) && !/\bnam\b/i.test(blob)) s -= 160
    if (/váy|đầm(?:\s|$)|chân\s*váy|váy\s*liền/i.test(blob) && !/\bnam\b/i.test(blob)) s -= 140
    return s
  }
  if (intent === 'female') {
    let s = 0
    if (/\bnữ\b|phụ\s*nữ|nữ\s*giới/i.test(blob)) s += 95
    if (/\bunisex\b/i.test(blob)) s += 20
    if (/\b(?:quần|giày|dép|áo|blazer)\s+nam\b/i.test(blob) && !/\bnữ\b/i.test(blob)) s -= 130
    return s
  }
  return 0
}

/** Sắp lại ứng viên vector sau khi khách nêu nam/nữ — đẩy mặt hàng trái giới xuống. */
export function reorderInventoryRowsByGenderIntent(
  rows: PartnerInventoryRow[],
  intent: CustomerGenderSearchIntent
): PartnerInventoryRow[] {
  if (!intent || rows.length < 2) return rows
  return [...rows].sort(
    (a, b) => inventoryRowGenderAffinityScore(b, intent) - inventoryRowGenderAffinityScore(a, intent)
  )
}

/** Chuỗi đưa vào Gemini embed (ANN) — bổ sung từ khóa giới khi cần. */
export function buildInventoryEmbeddingQueryWithGenderHint(customerMessage: string): string {
  return expandInventoryEmbeddingQueryWithGender(
    customerMessage,
    extractCustomerGenderSearchIntent(customerMessage)
  )
}

export function reorderSemanticInventoryRowsByCustomerGender(
  rows: PartnerInventoryRow[],
  customerMessage: string
): PartnerInventoryRow[] {
  return reorderInventoryRowsByGenderIntent(rows, extractCustomerGenderSearchIntent(customerMessage))
}

/** Widget / UI gợi ý: cùng pipeline hợp nhất ILIKE + vector + giới như `fetchInventoryRowsForPartnerAi`. */
export async function enrichSemanticInventoryRowsForWidget(
  partnerId: string,
  originalCustomerMessage: string,
  vectorRows: PartnerInventoryRow[],
  maxRows: number
): Promise<PartnerInventoryRow[]> {
  let rows: PartnerInventoryRow[]
  if (vectorRows.length > 0) {
    rows = rerankInventoryRowsByCustomerTextNameMatch(originalCustomerMessage, vectorRows)
  } else {
    rows = await mergeVectorRowsWithLexicalTokenSearch(partnerId, originalCustomerMessage, vectorRows, maxRows)
  }
  const gender = extractCustomerGenderSearchIntent(originalCustomerMessage)
  rows = reorderInventoryRowsByGenderIntent(rows, gender)
  rows = excludeRowsConflictingWithMaleIntent(rows, gender)
  return rows.slice(0, maxRows)
}

/** Điểm tối thiểu để đưa dòng ILIKE lên trước ANN — tránh nhiễu từ token quá ngắn. */
const LEXICAL_MERGE_MIN_SCORE = 28
const LEXICAL_TOKEN_QUERIES_MAX = 14
/** Số dòng lấy từ ILIKE ưu tiên (đầu danh sách) khi hợp nhất với vector. */
const LEXICAL_PRIORITY_CAP = 14

/**
 * ANN dễ lệch (áo khoác nam vs set nữ). Gộp kết quả ILIKE theo từ khóa tin khách —
 * ưu tiên mặt hàng có tên/mô tả **trùng chữ** với câu hỏi, rồi mới nối ứng viên vector.
 * Khi vector rỗng (embed lỗi / chưa sync), coi đây là nguồn chính.
 */
async function mergeVectorRowsWithLexicalTokenSearch(
  partnerId: string,
  messageForTokens: string,
  vectorRows: PartnerInventoryRow[],
  maxRows: number
): Promise<PartnerInventoryRow[]> {
  const needles = extractInventorySearchTokens(messageForTokens)
  if (needles.length === 0) return vectorRows

  const tokenSlice = needles.slice(0, LEXICAL_TOKEN_QUERIES_MAX)
  const chunks = await Promise.all(tokenSlice.map((t) => fetchRowsMatchingToken(partnerId, t)))
  const bestById = new Map<string, { row: PartnerInventoryRow; score: number }>()
  for (const chunk of chunks) {
    for (const r of chunk) {
      const sc = scoreInventoryRowMatch(r, needles)
      const prev = bestById.get(r.id)
      if (!prev || sc > prev.score) bestById.set(r.id, { row: r, score: sc })
    }
  }

  const lexicalSorted = [...bestById.values()]
    .filter((x) => x.score >= LEXICAL_MERGE_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row)

  const seen = new Set<string>()
  const out: PartnerInventoryRow[] = []

  for (const r of lexicalSorted.slice(0, LEXICAL_PRIORITY_CAP)) {
    if (seen.has(r.id)) continue
    out.push(r)
    seen.add(r.id)
  }
  for (const r of vectorRows) {
    if (seen.has(r.id)) continue
    out.push(r)
    seen.add(r.id)
    if (out.length >= maxRows) break
  }
  return out.slice(0, maxRows)
}

/** Bỏ mặt hàng rõ ràng chỉ nữ (váy/đầm + không ghi nam) khi khách hỏi đồ nam — nếu còn đủ lựa chọn. */
function excludeRowsConflictingWithMaleIntent(
  rows: PartnerInventoryRow[],
  intent: CustomerGenderSearchIntent
): PartnerInventoryRow[] {
  if (intent !== 'male' || rows.length <= 5) return rows
  const blob = (r: PartnerInventoryRow) =>
    `${r.name} ${r.description ?? ''} ${r.consult_note ?? ''}`.toLowerCase()
  const isFemaleOnly = (r: PartnerInventoryRow) => {
    const b = blob(r)
    if (/\bnam\b|nam\s*giới|đàn\s*ông|unisex/i.test(b)) return false
    if (/\bnữ\b|phụ\s*nữ/i.test(b)) return true
    if (/váy|đầm(?:\s|$)|chân\s*váy|set\s*nữ/i.test(b)) return true
    return false
  }
  const kept = rows.filter((r) => !isFemaleOnly(r))
  return kept.length >= 5 ? kept : rows
}

/** Ưu tiên SP có giá parse được nằm trong [budget×0.9, budget×1.1]; nếu không có SP nào trong dải → giữ thứ tự gốc. */
function reorderInventoryRowsByBudgetBand(
  rows: PartnerInventoryRow[],
  budgetVnd: number,
  limit: number
): PartnerInventoryRow[] {
  if (rows.length === 0) return []
  const minV = Math.round(budgetVnd * BUDGET_BAND_LOW)
  const maxV = Math.round(budgetVnd * BUDGET_BAND_HIGH)
  const inRange: PartnerInventoryRow[] = []
  const outRange: PartnerInventoryRow[] = []
  for (const r of rows) {
    const p = tryParseVndAmountForEmbedding(String(r.price_hint ?? '').trim())
    if (p !== null && p >= minV && p <= maxV) inRange.push(r)
    else outRange.push(r)
  }
  if (inRange.length === 0) return rows.slice(0, limit)
  return [...inRange, ...outRange].slice(0, limit)
}

/**
 * Top `PARTNER_AI_INVENTORY_CONTEXT_LIMIT` mặt hàng theo **vector văn bản** (ANN), điểm cao → thấp.
 * Không gộp ILIKE / điểm từ khóa; không lấy danh sách mặc định khi vector rỗng.
 * Khi khách nêu ngân sách (vd. tầm 600k): lấy thêm ứng viên vector rồi **ưu tiên** SP có giá trong ±10%.
 */
export async function fetchInventoryRowsForPartnerAi(
  partnerId: string,
  customerMessage: string,
  opts?: { budgetSourceMessage?: string; preferredGender?: CustomerGenderSearchIntent }
): Promise<PartnerInventoryRow[]> {
  const lim = PARTNER_AI_INVENTORY_CONTEXT_LIMIT
  const hintSource = opts?.budgetSourceMessage ?? customerMessage
  const budget = extractCustomerBudgetTargetVnd(hintSource)
  const genderIntent = extractCustomerGenderSearchIntent(hintSource) ?? opts?.preferredGender ?? null
  const queryForEmbedding = expandInventoryEmbeddingQueryWithGender(customerMessage, genderIntent)
  const fetchLim = budget !== null ? Math.min(50, lim * 3) : lim
  let rows = await fetchInventoryRowsBySemanticTextForPartnerAi(partnerId, queryForEmbedding, fetchLim)
  if (rows.length > 0) {
    rows = rerankInventoryRowsByCustomerTextNameMatch(hintSource, rows)
  } else {
    rows = await mergeVectorRowsWithLexicalTokenSearch(partnerId, hintSource, rows, fetchLim)
  }
  if (!rows.length) return []
  rows = reorderInventoryRowsByGenderIntent(rows, genderIntent)
  rows = excludeRowsConflictingWithMaleIntent(rows, genderIntent)
  if (budget === null) return rows.slice(0, lim)
  return reorderInventoryRowsByBudgetBand(rows, budget, lim)
}

/**
 * Chuẩn hóa tin nhắn trước heuristic «hỏi tiếp»: gom khoảng trắng, thường hóa, mở rộng viết tắt chat hay gặp.
 * Không gọi từ `extractExplicitSkuCandidates` (vẫn dùng tin gốc).
 */
function normalizeTextForFollowUpHeuristic(raw: string): string {
  let s = normalizeCustomerMessageForInventorySearch(raw).toLowerCase()
  if (!s) return ''
  s = s.replace(/\b(ko|khong)\b/g, 'không')
  s = s.replace(/\b(sz)\b/g, 'size')
  s = s.replace(/\b(đc|dc)\b/g, 'được')
  s = s.replace(/\b(ib|ibox|inbox)\b/g, 'inbox')
  s = s.replace(/\b(rep|reply)\b/g, 'trả lời')
  s = s.replace(/(có|còn|size|cỡ|màu|mầu|loại|hàng|sp)\s+j\b/g, '$1 gì')
  s = s.replace(/\bj\b(?=\s*\?)/g, 'gì')
  /** Lỗi gõ: «mẫu khach / mẫu khách» → «mẫu khác» (không đụng «khách hàng»). JS `\b` không khớp ranh giới Unicode → không dùng `\b`. */
  s = s.replace(/(mẫu|kiểu|loại)\s+khách(?!\s*hàng)/gi, '$1 khác')
  s = s.replace(/(mẫu|kiểu|loại)\s+khach(?!\s*hàng)/gi, '$1 khác')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Khách muốn **xem thêm mẫu / SP tương tự** so với mẫu đang bàn (không phải chỉ hỏi thuộc tính một mẫu).
 * Dùng để: lấy ANN **embedding ảnh** của SP neo + so khắp cả kho; không khóa chế độ «một dòng kho».
 */
/** Cùng nhóm ý: «có mẫu/loại khác không», «tương tự», «gần giống»… — nhánh A (carousel + vector), tách nhánh B. */
const SIMILAR_CATALOG_INTENT_RE = new RegExp(
  [
    'có\\s+(?:được\\s+)?(?:còn\\s+)?(?:mẫu|kiểu|loại|sp|hàng|sản\\s*phẩm)\\s+khác|còn\\s+(?:mẫu|kiểu|loại|sp|hàng)\\s+khác',
    '(?:cho\\s+)?(?:em\\s+)?(?:xem\\s+)?thêm\\s+(?:mẫu|kiểu|loại|sp|hàng|sản\\s*phẩm)(?:\\s+nào)?',
    'kiểu\\s+dáng\\s+khác|dáng\\s+khác|form\\s+khác|design\\s+khác',
    'mẫu(?:\\s+nào)?\\s+khác|kiểu(?:\\s+nào)?\\s+khác|loại(?:\\s+nào)?\\s+khác|mẫu\\s+tương\\s+tự|sp\\s+khác|hàng\\s+khác|sản\\s*phẩm\\s+khác|sản\\s*phẩm\\s+tương\\s+tự',
    'gần\\s+giống|giống\\s+nhau|na\\s+ná|tương\\s+tự|hàng\\s+tương\\s+tự|cùng\\s+kiểu|cùng\\s+loại',
    'so\\s+sánh|khác\\s+nhau|khác\\s+gì|đổi\\s+mẫu|thay\\s+mẫu|lựa\\s+khác|gợi\\s+ý\\s+khác|gợi\\s+ý\\s+thêm|option\\s+khác',
  ].join('|'),
  'i'
)

export function customerMessageWantsSimilarCatalogVersusLastConsulted(message: string): boolean {
  const text = normalizeTextForFollowUpHeuristic(message)
  if (!text) return false
  return SIMILAR_CATALOG_INTENT_RE.test(text)
}

/**
 * Neo vector + prompt với SP vừa tư vấn khi tin là «hỏi tiếp» (không dùng model phân loại riêng).
 * Chỉ theo **nhóm từ**: đại từ / (loại hàng + này đó) / FOLLOWUP_ATTR_* (kèm phân nhánh standalone + STRONG khi cần).
 * - Câu dài giống tìm mới + chỉ trùng từ khóa rộng (vd. cotton) → không neo trừ khi trùng STRONG.
 * - Có mã/SKU trong câu → không gộp.
 *
 * **Câu mẫu khách (hỏi tiếp — neo SP shop vừa tư vấn):**
 * - Màu / size / giá / tồn / ship / chất / form / ảnh / sale / đổi trả / chi tiết (cổ tay ống…)
 * - Viết tắt: «có j», «sz M», «ko», «còn ko», «ship bnhieu»
 * - Chỉ thị: «cái này», «mẫu đó», «trong ảnh», «tin vừa», «sp shop rep»
 * - Mẫu khác / gần giống / tương tự (so với SP vừa bàn): «có mẫu khác gần giống không», «có mẫu nào khác không», «sp tương tự», «na ná»
 */
const FOLLOWUP_ATTR_HINT_RE = new RegExp(
  [
    // mẫu khác / tương tự / so sánh (neo last consulted); kèm «mẫu nào khác»
    'có\\s+(?:được\\s+)?(?:còn\\s+)?(?:mẫu|kiểu|loại|sp|hàng|sản\\s*phẩm)\\s+khác|còn\\s+(?:mẫu|kiểu|loại|sp|hàng)\\s+khác',
    '(?:cho\\s+)?(?:em\\s+)?(?:xem\\s+)?thêm\\s+(?:mẫu|kiểu|loại|sp|hàng|sản\\s*phẩm)(?:\\s+nào)?',
    'kiểu\\s+dáng\\s+khác|dáng\\s+khác|form\\s+khác|design\\s+khác',
    'mẫu(?:\\s+nào)?\\s+khác|kiểu(?:\\s+nào)?\\s+khác|loại(?:\\s+nào)?\\s+khác|mẫu\\s+tương\\s+tự|sp\\s+khác|hàng\\s+khác|sản\\s*phẩm\\s+khác|sản\\s*phẩm\\s+tương\\s+tự',
    'gần\\s+giống|giống\\s+nhau|na\\s+ná|tương\\s+tự|hàng\\s+tương\\s+tự|cùng\\s+kiểu|cùng\\s+loại',
    'so\\s+sánh|khác\\s+nhau|khác\\s+gì|đổi\\s+mẫu|lựa\\s+khác|gợi\\s+ý\\s+khác|gợi\\s+ý\\s+thêm|thay\\s+mẫu|option\\s+khác',
    // màu / ngoại hình
    'màu|mầu|tone|đậm|nhạt|be\\s*ige|kem|nude|pastel|neon',
    // size / form
    'size|cỡ|big\\s*size|free\\s*size|oversize|over\\s*size|form|dáng|ôm|rộng|suông|body|a\\s*line|croptop|lệch\\s*vai',
    // giá / KM (hint rộng; chữ «km» viết tắt KM chỉ khi có ngữ cảnh khuyến mãi)
    'giá|giá\\s*cả|bao\\s*nhiêu|tổng\\s*tiền|sale|flash\\s*sale|giảm|khuyến\\s*mãi|voucher|tích\\s*điểm|freeship|free\\s*ship',
    // tồn / đặt
    'tồn|kho|còn\\s*hàng|hết\\s*hàng|sold\\s*out|restock|nhập\\s*hàng|về\\s*hàng|order|đặt\\s*hàng|booking|cọc',
    // giao / thanh toán (hint; câu dài «tìm shop có cod» không ép follow-up nếu không trùng STRONG)
    'ship|giao\\s*hàng|giao\\s*nhanh|cod|chuyển\\s*khoản|thanh\\s*toán|momo|zalopay|ví|lấy\\s*hàng',
    // chất liệu / phụ kiện may
    'chất\\s*liệu|vải|cotton|polyester|len|lụa|linen|jean|jeans|denim|kaki|thun|ren|voan|satin|da|pu|lót|đệm',
    // giày / váy chi tiết
    'số\\s*(?:giày|chân)|đế|gót|quai|khóa|dây\\s*kéo|ống|tay\\s*áo|tà|eo|cổ|dài|ngắn|chiều\\s*dài',
    // media / uy tín
    'ảnh\\s*thật|ảnh\\s*live|xem\\s*thêm|thêm\\s*ảnh|video|clip|feedback(?:\\s*thật)?|review',
    // chính sách
    'bảo\\s*hành|đổi\\s*trả|warranty|giặt|sấy|bạc\\s*màu|co\\s*giãn',
    // hỏi mở (thường hỏi tiếp)
    'những\\s+gì|có\\s+gì|mấy\\s+loại|mấy\\s+màu|kiểu\\s+nào|giống\\s+vậy|như\\s+vậy|nữa\\s+không|còn\\s+không|thế\\s+nào|sao\\s+rồi|ổn\\s+không',
    'bảng\\s*size|mặc\\s+thử|mẫu\\s+thử',
  ].join('|'),
  'i'
)

/**
 * Thuộc tính «hỏi tiếp» rõ — dùng khi câu dài + trông như tìm mới (standalone) nhưng vẫn có thể là follow-up.
 * Tránh đưa từ quá rộng (vd. cotton, cod) — chỉ dùng kèm HINT và nhánh standalone.
 */
const FOLLOWUP_ATTR_STRONG_RE = new RegExp(
  [
    'có\\s+(?:được\\s+)?(?:còn\\s+)?(?:mẫu|kiểu|loại|sp|hàng|sản\\s*phẩm)\\s+khác|còn\\s+(?:mẫu|kiểu|loại|sp|hàng)\\s+khác',
    '(?:cho\\s+)?(?:em\\s+)?(?:xem\\s+)?thêm\\s+(?:mẫu|kiểu|loại|sp|hàng|sản\\s*phẩm)(?:\\s+nào)?',
    'kiểu\\s+dáng\\s+khác|dáng\\s+khác|form\\s+khác|design\\s+khác',
    'mẫu(?:\\s+nào)?\\s+khác|kiểu(?:\\s+nào)?\\s+khác|loại(?:\\s+nào)?\\s+khác|mẫu\\s+tương\\s+tự|sp\\s+khác|hàng\\s+khác|sản\\s*phẩm\\s+khác|sản\\s*phẩm\\s+tương\\s+tự',
    'gần\\s+giống|giống\\s+nhau|na\\s+ná|tương\\s+tự|hàng\\s+tương\\s+tự|cùng\\s+kiểu|cùng\\s+loại',
    'so\\s+sánh|khác\\s+nhau|khác\\s+gì|đổi\\s+mẫu|thay\\s+mẫu|lựa\\s+khác|gợi\\s+ý\\s+khác|gợi\\s+ý\\s+thêm|option\\s+khác',
    'chất\\s*liệu|vải|màu|mầu|tồn|còn\\s*hàng|ship|giao\\s*hàng|đế|gót|bảo\\s*hành|đổi\\s*trả',
    'những\\s+gì|có\\s+gì|mấy\\s+loại|mấy\\s+màu|kiểu\\s+nào|giống\\s+vậy|như\\s+vậy|nữa\\s+không|còn\\s+không',
    'số\\s*(?:giày|chân)|bao\\s+nhiêu|form|dáng|ôm|rộng',
    'ảnh\\s*thật|ảnh\\s*live|xem\\s+thêm|thêm\\s+ảnh|video|sale|giảm|khuyến\\s*mãi|bảng\\s*size|mặc\\s+thử',
    'thế\\s+nào|ổn\\s+không',
  ].join('|'),
  'i'
)

/**
 * Tham chiếu tới SP / lượt trước (cái này, hàng này, cái cũ…) — luôn neo ngữ cảnh, không phải tìm mới.
 * Giữ đồng bộ với CATEGORY_WITH_DEICTIC (loại hàng + này/đó/…).
 */
const CONTEXT_REFERENCE_DEICTIC_RE = new RegExp(
  [
    '(?:^|[\\s,.;:!?])',
    '(?:',
    [
      'nó|nó\\s+này|nó\\s+vừa\\s+rồi',
      'cái\\s+đó|cái\\s+này|cái\\s+cũ|cái\\s+mới|cái\\s+vừa|cái\\s+(?:trước|hồi\\s+nãy|nãy|đó)',
      'mẫu\\s+đó|mẫu\\s+này|mẫu\\s+cũ|mẫu\\s+vừa\\s+rồi',
      'loại\\s+đó|loại\\s+này',
      'sp\\s+đó|sp\\s+này|hàng\\s+đó|hàng\\s+này|hàng\\s+vừa|hàng\\s+nãy',
      'món\\s+này|món\\s+đó|đôi\\s+này|đôi\\s+đó|chiếc\\s+này|chiếc\\s+đó',
      'sản\\s*phẩm\\s+đó|sản\\s*phẩm\\s+này',
      'cái\\s+vừa\\s+nói|cái\\s+vừa\\s+gửi|cái\\s+vừa\\s+tư\\s*vấn|cái\\s+(?:đang|vừa)\\s+xem',
      'shop\\s+vừa\\s+gửi|shop\\s+vừa\\s+rep|shop\\s+vừa\\s+trả\\s*lời',
      'bên\\s+em\\s+vừa|bên\\s+shop\\s+vừa',
      'mã\\s+đó|mã\\s+này',
      'vừa\\s+nói|vừa\\s+tư\\s*vấn|vừa\\s+show|vừa\\s+inbox',
      'trong\\s+(?:ảnh|hình|tin)|ảnh\\s+(?:trên|vừa|shop\\s+gửi)|tin\\s+(?:vừa|trên|nhắn\\s+vừa)|đoạn\\s+(?:chat\\s+)?vừa',
      'câu\\s+(?:vừa|trên)|mess(?:age)?\\s+vừa',
      'bạn\\s+vừa|ad\\s+vừa',
    ].join('|'),
    ')',
    '(?:$|[\\s,.;:!?]|\\b)',
  ].join(''),
  'i'
)

/** Đại từ / từ chỉ thị — alias tới CONTEXT_REFERENCE_DEICTIC_RE (dùng trong shouldAugment). */
const FOLLOWUP_DEICTIC_RE = CONTEXT_REFERENCE_DEICTIC_RE

/** Danh từ loại hàng phổ biến — có trong câu thường là chủ đề tìm/mô tả mới (câu độc lập). */
const PRODUCT_CATEGORY_WORD_SOURCE = [
  'giày|giay|dép|dep|sandal|boots?|guốc|guoc|loafer|sneaker',
  'váy|vay|đầm|dam|áo|ao|quần|quan|blazer|vest|khoác|khoac|cardigan|sơ\\s*mi|so\\s*mi|som|quần\\s*tây|quan\\s*tay',
  'jumpsuit|bodysuit|chân\\s*váy|chan\\s*vay|shorts?|legging|bộ\\s+đồ|bo\\s+do|set\\s*(?:bộ|bo)?',
  'túi(?:\\s*xách)?|tui(?:\\s*xach)?|xách|xach|ví|vi|balo|ba\\s*lô|backpack|bags?|handbags?|tote|clutch|crossbody|purse|wallet',
  'phụ\\s*kiện|phu\\s*kien|accessor(?:y|ies)|mũ|mu|nón|non|khăn|khan',
  'đồng\\s*hồ|dong\\s*ho|watch|kính|kinh|glasses|sunglasses',
  'thắt\\s*lưng|that\\s*lung|dây\\s*nịt|day\\s*nit|dây\\s*nịch|day\\s*nich|belt',
  'vòng\\s*tay|vong\\s*tay|dây\\s*chuyền|day\\s*chuyen',
].join('|')
const PRODUCT_CATEGORY_CJK_SOURCE = '包包?|手提包|钱包|バッグ|鞄|가방|핸드백|지갑'
const PRODUCT_CATEGORY_TOKEN_RE = new RegExp(
  `(?:^|[\\s,.;!?])(?:${PRODUCT_CATEGORY_WORD_SOURCE})(?=$|[\\s,.;!?])|(?:${PRODUCT_CATEGORY_CJK_SOURCE})`,
  'i'
)

/**
 * «có / còn + loại hàng» (vd. «có váy ngắn không», «còn giày nam không») — tìm trong kho / embed vector,
 * không phải hỏi thuộc tính neo SP cũ. Khác «có màu gì» (không mở bằng loại hàng ngay sau có/còn).
 */
const STANDALONE_CO_CON_PLUS_CATEGORY_RE = new RegExp(
  `\\b(?:có|co|còn|con|bán|ban)\\s+(?:một\\s+|mot\\s+|mấy\\s+|may\\s+|vài\\s+|vai\\s+|các\\s+|cac\\s+)?(?:${PRODUCT_CATEGORY_TOKEN_RE.source})\\b`,
  'i'
)

/**
 * «Loại SP + đại từ» (giày này giá bao nhiêu, có màu gì…) — hỏi tiếp theo SP đang bàn, không phải tìm mới.
 */
const CATEGORY_WITH_DEICTIC_RE =
  /(?:giày|dép|sandal|boot|váy|đầm|túi|áo|quần|blazer|vest|khoác|cardigan|sơ\s*mi|som|quần\s*tây|jumpsuit|bodysuit|chân\s*váy|shorts?|legging|set|combo|bộ|kính|balo)\s+(?:này|đó|kia|ấy|cũ|mới|vừa\s+rồi|vừa\s+gửi|vừa\s+nói|nãy|trước|trên)|(?:mẫu|đôi|kiểu|loại|cái|sp|chiếc|bộ)\s+(?:này|đó|kia|ấy|cũ|mới)|(?:đôi|chiếc)\s+(?:này|đó|kia|ấy)/i

/** Ý tìm / xem / hỏi mua rõ — thường là câu đầy đủ chủ đích. */
const STANDALONE_INTENT_RE =
  /\b(?:tìm|tìm\s+giúp|cho\s+(?:em|mình|anh|chị)\s+(?:xem|biết)|(?:shop|bên)\s+(?:có|bán)|cần\s+(?:mua|xem)|muốn\s+(?:mua|xem)|giới\s*thiệu|tham\s*khảo|đặt\s+hàng)\b/i

/** Ngữ cảnh / đối tượng — thường đi kèm loại hàng trong câu mô tả đầy đủ. */
const STANDALONE_CONTEXT_RE =
  /\b(?:nam|nữ|unisex|trẻ\s*em|đi\s+làm|đi\s+tiệc|đi\s+biển|công\s+sở|thể\s+thao|dạo\s+phố)\b/i

const STANDALONE_MIN_LEN_WITH_CATEGORY = 30

const PRODUCT_CATEGORY_SOURCE = `(?:(?:${PRODUCT_CATEGORY_WORD_SOURCE})(?=$|[\\s,.;!?])|(?:${PRODUCT_CATEGORY_CJK_SOURCE}))`

/**
 * Khách mở **nhu cầu / loại hàng mới** thay vì hỏi tiếp SP vừa tư vấn.
 * Bao phủ các cách nói tự nhiên: không cần prefix shop, không dấu, viết tắt k/ko,
 * "cho xem…", "túi xách thì sao", "giá túi khoảng bao nhiêu", "không lấy váy nữa, có túi không",
 * và một số category tiếng Anh / CJK thường gặp.
 */
export function customerMessageOpensNewProductSearch(customerMessage: string): boolean {
  const text = normalizeTextForFollowUpHeuristic(customerMessage)
  if (!text) return false

  const hasCategory = PRODUCT_CATEGORY_TOKEN_RE.test(text)
  const availability = '(?:có|co|còn|con|bán|ban|have|has|available)'
  const negOrQuestion = '(?:không|khong|ko|k|kh|nhỉ|nhi|ạ|a|\\?)'

  /** Đổi ý rõ, dù trong câu có đại từ "mẫu này/cái này". */
  const switchToNewCategoryRe = new RegExp(
    [
      `(?:không|khong)\\s+(?:lấy|lay|xem|ưng|ung|thích|thich)\\s+[^.!?]{0,50}\\b(?:nữa|nua)\\b[^.!?]{0,80}(?:${PRODUCT_CATEGORY_SOURCE})`,
      `(?:mẫu|mau|cái|sp|sản\\s*phẩm|san\\s*pham)\\s+(?:này|nay|đó|do)\\s+(?:không|khong)\\s+(?:hợp|hop|ưng|ung|thích|thich)[^.!?]{0,80}(?:${PRODUCT_CATEGORY_SOURCE})`,
      `(?:đổi|doi|chuyển|chuyen|qua|sang)\\s+(?:xem\\s+)?(?:${PRODUCT_CATEGORY_SOURCE})`,
      `(?:thay|đổi|doi)\\s+(?:mẫu|mau|loại|loai|hàng|hang)\\s+(?:${PRODUCT_CATEGORY_SOURCE})`,
    ].join('|'),
    'i'
  )
  if (switchToNewCategoryRe.test(text)) return true

  /** Chỉ thị rõ tới SP đang bàn thì không mở search mới, trừ các mẫu đổi ý ở trên. */
  if (CONTEXT_REFERENCE_DEICTIC_RE.test(text)) return false
  if (CATEGORY_WITH_DEICTIC_RE.test(text)) return false
  if (!hasCategory) {
    if (
      /\b(?:có|co|còn|con|cho\s+xem|xem|tìm|tim)\s+(?:cái|cai|mẫu|mau|loại|loai|món|mon)?\s*(?:nào|nao)?\s*(?:đựng|dung|để\s+đựng|de\s+dung|đeo|deo|mang|chứa|chua)\s+(?:laptop|máy\s*tính|may\s*tinh|ipad|điện\s*thoại|dien\s*thoai|đồ|do)\b/i.test(
        text
      )
    ) {
      return true
    }
    return /(?:do\s+you\s+have|does\s+(?:the\s+)?shop\s+have)\s+(?:bags?|handbags?|wallet|purse|shoes?|dress(?:es)?|shirt|pants?)/i.test(
      text
    )
  }

  if (STANDALONE_CO_CON_PLUS_CATEGORY_RE.test(text)) return true

  const shopPrefixRe = new RegExp(
    `(?:^|[\\s,.;!?])(?:shop|shoppe|bên\\s+(?:em|mình|minh|shop)|ben\\s+(?:em|minh|shop)|cửa\\s*hàng|cua\\s*hang)\\s+${availability}\\s+[^.!?]{0,80}(?:${PRODUCT_CATEGORY_SOURCE})`,
    'i'
  )
  if (shopPrefixRe.test(text)) return true

  const categoryAvailabilityRe = new RegExp(
    [
      `(?:^|[\\s,.;!?])${availability}\\s+[^.!?]{0,50}(?:${PRODUCT_CATEGORY_SOURCE})(?:\\b|[\\s,.;!?])[^.!?]{0,60}${negOrQuestion}`,
      `(?:${PRODUCT_CATEGORY_SOURCE})(?:\\b|[\\s,.;!?])[^.!?]{0,70}\\b(?:${availability}|${negOrQuestion})\\b`,
    ].join('|'),
    'i'
  )
  if (categoryAvailabilityRe.test(text)) return true

  const showCategoryRe = new RegExp(
    `(?:cho\\s+(?:em|anh|chị|chi|mình|minh|tôi|toi)\\s+)?(?:xem|coi|show|gửi|gui|tham\\s*khảo|tham\\s*khao|tư\\s*vấn|tu\\s*van)\\s+(?:(?:mấy|may|vài|vai|các|cac)\\s+)?(?:(?:mẫu|mau|loại|loai|hàng|hang|sp|sản\\s*phẩm|san\\s*pham)\\s+)?(?:${PRODUCT_CATEGORY_SOURCE})`,
    'i'
  )
  if (showCategoryRe.test(text)) return true

  const categoryTopicRe = new RegExp(
    `(?:${PRODUCT_CATEGORY_SOURCE})(?:\\b|[\\s,.;!?])[^.!?]{0,60}(?:thì\\s+sao|thi\\s+sao|mẫu\\s+nào|mau\\s+nao|loại\\s+nào|loai\\s+nao|giá|gia|khoảng\\s+bao\\s+nhiêu|khoang\\s+bao\\s+nhieu|bao\\s+nhiêu|bao\\s+nhieu|màu|mau|size|cỡ|co)`,
    'i'
  )
  if (categoryTopicRe.test(text)) return true

  if (/\b(?:do\s+you\s+have|does\s+(?:the\s+)?shop\s+have|show\s+me|any)\b/i.test(text)) return true
  if (/[包バッグ鞄가방지갑].*(?:吗|嗎|か|요|\?)/i.test(text)) return true

  return false
}

/**
 * Câu có **loại sản phẩm** + dấu hiệu câu độc lập (chủ/vị đủ) → tìm kho theo đúng ý khách, không neo SP cũ.
 * Gồm cả «có/còn + loại hàng» (vd. có váy ngắn không) → embed/vector kho, không xếp nhầm vào hỏi tiếp vì từ ngắn/dài.
 * Không dùng parser tiếng Việt; proxy bằng độ dài + intent + ngân sách + ngữ cảnh mặc.
 */
export function looksLikeStandaloneProductQuestion(customerMessage: string): boolean {
  const text = normalizeTextForFollowUpHeuristic(customerMessage)
  if (!text) return false
  if (customerMessageOpensNewProductSearch(customerMessage)) return true
  /** Câu chỉ trỏ «cái này / hàng này / cái cũ…» — không bao giờ là tìm kiếm độc lập. */
  if (CONTEXT_REFERENCE_DEICTIC_RE.test(text)) return false
  if (CATEGORY_WITH_DEICTIC_RE.test(text)) return false
  if (STANDALONE_CO_CON_PLUS_CATEGORY_RE.test(text)) return true
  if (!PRODUCT_CATEGORY_TOKEN_RE.test(text)) return false
  if (extractExplicitSkuCandidates(customerMessage).length > 0) return true
  if (extractCustomerBudgetTargetVnd(text) !== null) return true
  if (STANDALONE_INTENT_RE.test(text)) return true
  if (STANDALONE_CONTEXT_RE.test(text)) return true
  if (text.length >= STANDALONE_MIN_LEN_WITH_CATEGORY) return true
  return false
}

/**
 * «Giày/sandal… cao gót» = **loại hàng** (tìm trong cả kho), không phải hỏi chiều **gót** của mẫu đang xem.
 * Từ `gót` trong FOLLOWUP_ATTR_* khớp nhầm → neo SP cũ (vd. dép nam) + một dòng kho → AI báo shop không có giày cao gót.
 */
function messageQueriesHighHeelFootwearCategory(text: string): boolean {
  return /\b(?:giày|sandal|dép|guốc)\s+cao\s+gót\b/i.test(text)
}

export function shouldAugmentInventorySearchWithLastConsulted(
  customerMessage: string,
  opts?: { visionInventorySelected?: boolean }
): boolean {
  if (opts?.visionInventorySelected) return false
  const text = normalizeTextForFollowUpHeuristic(customerMessage)
  if (!text) return false
  if (extractExplicitSkuCandidates(customerMessage).length > 0) return false
  if (messageQueriesHighHeelFootwearCategory(text)) return false
  if (customerMessageOpensNewProductSearch(customerMessage)) return false

  if (FOLLOWUP_DEICTIC_RE.test(text)) return true
  if (CATEGORY_WITH_DEICTIC_RE.test(text)) return true

  if (FOLLOWUP_ATTR_HINT_RE.test(text)) {
    if (!looksLikeStandaloneProductQuestion(customerMessage)) return true
    return FOLLOWUP_ATTR_STRONG_RE.test(text)
  }

  return false
}

/**
 * Tin khách có phải dạng «hỏi tiếp theo SP shop vừa tư vấn» không (cùng logic neo vector / ngữ cảnh):
 * chỉ khi khớp đại từ / loại+này đó / `FOLLOWUP_*` (không còn neo theo độ dài tin).
 * Dùng khi cần gói câu hỏi + snapshot SP cho prompt AI.
 */
export function customerMessageIsFollowUpContextQuery(
  customerMessage: string,
  opts?: { visionInventorySelected?: boolean }
): boolean {
  return shouldAugmentInventorySearchWithLastConsulted(customerMessage, opts)
}

/**
 * Chỉ dựa vào nội dung tin khách (không cần lastConsultedRow) — cùng heuristic với neo ngữ cảnh.
 * Dùng ở widget: **không** gắn thanh gợi ý vector cho «có màu gì» / tin hỏi tiếp ngắn (tránh lệch sang tìm kho rộng).
 */
export function inboundTextLooksLikeFollowUpConsultHeuristic(message: string): boolean {
  return shouldAugmentInventorySearchWithLastConsulted(message, { visionInventorySelected: false })
}

/** Chuỗi đưa vào embedding + ANN: neo SP đang bàn + ý khách. */
export function buildInventorySearchQueryWithLastConsulted(
  row: PartnerInventoryRow,
  customerMessage: string
): string {
  const name = row.name?.trim() ?? ''
  const sku = row.sku?.trim() ?? ''
  const tail = normalizeCustomerMessageForInventorySearch(customerMessage)
  return [name, sku, tail].filter(Boolean).join(' ').trim()
}

/**
 * Token loại hàng thô từ tên/mô tả/ghi chú (cùng tập pattern với tìm kiếm «câu độc lập»).
 * Dùng để lọc kết quả «mẫu tương tự» — tránh carousel lệch ngành (vd. giày → thắt lưng).
 */
export function extractCoarseCategoryTokensFromInventoryBlob(blob: string): string[] {
  const s = blob.trim()
  if (!s) return []
  const seen = new Set<string>()
  const flags = PRODUCT_CATEGORY_TOKEN_RE.flags.includes('g')
    ? PRODUCT_CATEGORY_TOKEN_RE.flags
    : `${PRODUCT_CATEGORY_TOKEN_RE.flags}g`
  const re = new RegExp(PRODUCT_CATEGORY_TOKEN_RE.source, flags)
  for (const m of s.matchAll(re)) {
    const raw = m[0].trim().replace(/\s+/g, ' ').toLowerCase()
    const t = normalizeCoarseCategoryToken(raw)
    if (t) seen.add(t)
  }
  return [...seen]
}

function normalizeCoarseCategoryToken(raw: string): string {
  const t = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  if (/(vay|dam|dress|gown|chan vay|skirt)/i.test(t)) return 'dress_skirt'
  if (/(ao|shirt|blouse|top|hoodie|jacket|coat|blazer|vest|khoac|cardigan|so mi|som)/i.test(t)) return 'top_outerwear'
  if (/(quan|pants|trousers|jeans|shorts|legging)/i.test(t)) return 'pants_bottom'
  if (/(set|bo do|jumpsuit|bodysuit|combo)/i.test(t)) return 'set_outfit'
  if (/(giay|dep|sandal|boot|guoc|loafer|sneaker|shoe)/i.test(t)) return 'footwear'
  if (/(tui|xach|vi|balo|backpack|bag|handbag|tote|clutch|crossbody|purse|wallet|包|手提包|钱包|バッグ|鞄|가방|핸드백|지갑)/i.test(t)) {
    return 'bag_wallet'
  }
  if (/(that lung|day nit|day nich|belt)/i.test(t)) return 'belt'
  if (/(dong ho|watch)/i.test(t)) return 'watch'
  if (/(kinh|glasses|sunglasses)/i.test(t)) return 'glasses'
  if (/(vong tay|day chuyen)/i.test(t)) return 'jewelry'
  if (/(phu kien|accessory|accessories|mu|non|khan)/i.test(t)) return 'accessory'
  return t
}

/** Giữ mặt hàng có **ít nhất một** nhóm loại trùng với anchor (áo/váy/giày/túi…). */
export function filterInventoryRowsBySharedCoarseCategory(
  anchor: PartnerInventoryRow,
  rows: PartnerInventoryRow[]
): PartnerInventoryRow[] {
  const anchorBlob = [anchor.name, anchor.description, anchor.consult_note].filter(Boolean).join('\n')
  const anchorTok = extractCoarseCategoryTokensFromInventoryBlob(anchorBlob)
  if (!anchorTok.length || !rows.length) return rows
  const anchorSet = new Set(anchorTok)
  return rows.filter((r) => {
    const b = [r.name, r.description, r.consult_note].filter(Boolean).join('\n')
    const rowTok = extractCoarseCategoryTokensFromInventoryBlob(b)
    if (!rowTok.length) return false
    return rowTok.some((t) => anchorSet.has(t))
  })
}
