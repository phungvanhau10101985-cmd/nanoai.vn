import type { Database } from '@/types/database.types'
import { fetchPartnerInventoryRowsByTokenIlikeFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  fetchInventoryRowsBySemanticTextForPartnerAi,
  tryParseVndAmountForEmbedding,
} from '@/lib/messaging/partner-inventory-text-embedding'
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
  return out
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
  customerMessage: string
): Promise<PartnerInventoryRow[]> {
  const lim = PARTNER_AI_INVENTORY_CONTEXT_LIMIT
  const budget = extractCustomerBudgetTargetVnd(customerMessage)
  const fetchLim = budget !== null ? Math.min(50, lim * 3) : lim
  const rows = await fetchInventoryRowsBySemanticTextForPartnerAi(partnerId, customerMessage, fetchLim)
  if (!rows.length) return []
  if (budget === null) return rows.slice(0, lim)
  return reorderInventoryRowsByBudgetBand(rows, budget, lim)
}
