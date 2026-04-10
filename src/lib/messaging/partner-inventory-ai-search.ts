import type { Database } from '@/types/database.types'
import {
  fetchPartnerInventoryDefaultForAiFromPg,
  fetchPartnerInventoryRowsByTokenIlikeFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'

export type PartnerInventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Chuỗi lọc kiểu `.or()` (REST) dùng dấu phẩy — loại ký tự làm hỏng filter hoặc LIKE. */
export function sanitizeInventorySearchToken(raw: string): string {
  return raw.replace(/[%_,().]/g, '').trim().slice(0, 64)
}

const SEARCH_TOKEN_MAX = 4
const PER_TOKEN_QUERY_LIMIT = 45
export const PARTNER_AI_INVENTORY_CONTEXT_LIMIT = 50
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
  const out: TokenCandidate[] = []
  const push = (token: string, priority: number) => {
    const t = sanitizeInventorySearchToken(token)
    if (!t) return
    out.push({ token: t, priority })
  }
  // 700k / 700 K / 700ngan -> 700000 (+ variants with separators)
  for (const m of text.matchAll(/\b(\d{1,4})\s*(k|ngan|ngàn|nghin|nghìn)\b/gi)) {
    const n = Number.parseInt(m[1], 10)
    if (!Number.isFinite(n) || n <= 0) continue
    const amount = n * 1000
    push(String(amount), 92)
    push(amount.toLocaleString('vi-VN'), 86)
    push(amount.toLocaleString('en-US'), 84)
  }
  // 1tr2 / 1tr / 1.2tr / 1,2tr -> VND number
  for (const m of text.matchAll(/\b(\d{1,3})(?:[.,](\d{1,2}))?\s*(tr|trieu|triệu)\b/gi)) {
    const major = Number.parseInt(m[1], 10)
    if (!Number.isFinite(major) || major < 0) continue
    const minorRaw = (m[2] ?? '').trim()
    const minor = minorRaw ? Number.parseInt(minorRaw.padEnd(2, '0').slice(0, 2), 10) : 0
    if (!Number.isFinite(minor) || minor < 0) continue
    const amount = major * 1_000_000 + minor * 10_000
    if (amount <= 0) continue
    push(String(amount), 94)
    push(amount.toLocaleString('vi-VN'), 88)
    push(amount.toLocaleString('en-US'), 86)
  }
  return out
}

/** Tokens for coarse inventory match (SKU / name fragments). */
export function extractInventorySearchTokens(message: string): string[] {
  const text = message.replace(/^📷\s*/u, '').trim()
  if (!text) return []
  const candidates = collectTokenCandidates(text)
  candidates.push(...buildPriceUnitHintTokens(text))
  // Keep color/style tokens so text queries can suggest similar products better.
  const styleHints: Array<{ token: string; priority: number }> = []
  const addHint = (token: string, priority: number) => {
    const t = sanitizeInventorySearchToken(token)
    if (!t) return
    styleHints.push({ token: t, priority })
  }
  const lower = text.toLowerCase()
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
  candidates.push(...styleHints)
  candidates.sort((a, b) => b.priority - a.priority || b.token.length - a.token.length)
  return candidates.slice(0, SEARCH_TOKEN_MAX).map((c) => c.token)
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

async function fetchDefaultInventory(partnerId: string): Promise<PartnerInventoryRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await fetchPartnerInventoryDefaultForAiFromPg(partnerId, PARTNER_AI_INVENTORY_CONTEXT_LIMIT)
    return rows ?? []
  } catch (e) {
    console.warn('[partner-inventory-ai-search] fetchDefaultInventory PG failed', e)
    return []
  }
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

/**
 * Up to 50 active rows: prioritize DB ILIKE hits on sku/name/description/price_hint from the customer message,
 * scored in-app; fill remainder with default sort_order list (same as before).
 */
export async function fetchInventoryRowsForPartnerAi(
  partnerId: string,
  customerMessage: string
): Promise<PartnerInventoryRow[]> {
  const needles = extractInventorySearchTokens(customerMessage)

  if (!needles.length) {
    return fetchDefaultInventory(partnerId)
  }

  const [defaultRowsParallel, ...searchChunks] = await Promise.all([
    fetchDefaultInventory(partnerId),
    ...needles.map((t) => fetchRowsMatchingToken(partnerId, t)),
  ])

  const merged = new Map<string, PartnerInventoryRow>()
  for (const chunk of searchChunks) {
    for (const r of chunk) merged.set(r.id, r)
  }

  if (!merged.size) return defaultRowsParallel

  const scored = Array.from(merged.values()).map((r) => ({
    row: r,
    score: scoreInventoryRowMatch(r, needles),
  }))
  scored.sort((a, b) => b.score - a.score || a.row.sort_order - b.row.sort_order)

  const seen = new Set<string>()
  const result: PartnerInventoryRow[] = []
  for (const { row } of scored) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    result.push(row)
    if (result.length >= PARTNER_AI_INVENTORY_CONTEXT_LIMIT) return result
  }

  for (const row of defaultRowsParallel) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    result.push(row)
    if (result.length >= PARTNER_AI_INVENTORY_CONTEXT_LIMIT) break
  }

  return result
}
