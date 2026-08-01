import { createEmptyMenuDish, type MenuDishItem } from '@/lib/hub-chat/menu-dish-items'

/** Giá VND: 20.000 · 350000 · 35.000 VNĐ — không dùng «đ/d» vì /i khớp nhầm «Đ» đầu tên món. */
const PRICE_TOKEN_RE = /(\d{1,3}(?:\.\d{3})+|\d{4,9})(?:\s*(?:VNĐ|VND))?/gi

const PRICE_AT_END_RE = /(\d{1,3}(?:\.\d{3})+|\d{4,9})(?:\s*(?:VNĐ|VND))?\s*$/i

const HEADER_LINE_RE =
  /^(?:tên\s+món|đơn\s+vị|giá\s*(?:\(vnd\))?|dish|unit|price|no\.?|stt)\b/i

/** Dòng chỉ là tiêu đề nhóm (vd. «1. 🧆 Khai Vị…») — không có giá. */
const CATEGORY_LINE_RE = /^\d+\.\s*[\p{Extended_Pictographic}\uFE0F]/u

const UNIT_SUFFIX_RE =
  /(Đĩa\s*lớn|Đĩa(?:\s*\([^)]+\))?|Chục(?:\s*\([^)]+\))?|Tô(?:\s*\([^)]+\))?|Quả|Con(?:\s*\([^)]+\))?|Cái(?:\s*\/\s*Đĩa)?|Nồi(?:\s*\([^)]+\))?|Mẹt|Ca\s*1\s*Lít|Ca|Cốc|Chai(?:\s*\/\s*Lon)?|Chai(?:\s*\([^)]+\))?|Lon(?:\s*\([^)]+\))?)\s*$/i

export type MenuDishBulkParseResult =
  | { ok: true; dishes: MenuDishItem[]; skippedLines: number }
  | { ok: false; error: 'EMPTY' | 'NO_ITEMS' }

function normalizePriceDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

function splitSegmentsByPrice(text: string): string[] {
  const segments: string[] = []
  const re = new RegExp(PRICE_TOKEN_RE.source, 'gi')
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length
    const chunk = text.slice(lastIndex, end).trim()
    if (chunk.length >= 4) segments.push(chunk)
    lastIndex = end
  }
  const tail = text.slice(lastIndex).trim()
  if (tail.length >= 4 && /\d/.test(tail)) segments.push(tail)
  return segments
}

function parseComboLine(line: string): Omit<MenuDishItem, 'id' | 'order'> | null {
  const combo = line.match(
    /^(.+?):\s*(\d{1,3}(?:\.\d{3})+|\d{4,9})\s*(?:VNĐ|VND)?\s*\/\s*(Mẹt|Đĩa|Nồi|Tô)(?:\s*\((.+)\))?/i
  )
  if (!combo) return null
  const namePart = combo[1]!.trim()
  const priceVnd = normalizePriceDigits(combo[2]!)
  const unit = combo[3]!.trim()
  const extra = combo[4]?.trim()
  const name = extra ? `${namePart} (${extra})` : namePart
  if (!name || !priceVnd) return null
  return { name, unit, priceVnd }
}

function parseDotSeparatedLine(line: string): Omit<MenuDishItem, 'id' | 'order'> | null {
  const m = line.match(
    /^(.+?)\s*[·•\-|]\s*(.+?)\s*[·•\-|]\s*(\d{1,3}(?:\.\d{3})+|\d{4,9})(?:\s*(?:VNĐ|VND))?\s*$/i
  )
  if (!m) return null
  const name = m[1]!.trim()
  const unit = m[2]!.trim()
  const priceVnd = normalizePriceDigits(m[3]!)
  if (!name || name.length < 2 || !priceVnd || Number(priceVnd) < 1000) return null
  return { name, unit, priceVnd }
}

function parsePriceSegment(segment: string): Omit<MenuDishItem, 'id' | 'order'> | null {
  const combo = parseComboLine(segment)
  if (combo) return combo

  const priceMatch = segment.match(PRICE_AT_END_RE)
  if (!priceMatch) return null
  const priceVnd = normalizePriceDigits(priceMatch[1]!)
  if (!priceVnd || Number(priceVnd) < 1000) return null

  let beforePrice = segment.slice(0, priceMatch.index).trim()
  if (!beforePrice) return null

  let unit = ''
  const unitMatch = beforePrice.match(UNIT_SUFFIX_RE)
  if (unitMatch) {
    unit = unitMatch[1]!.trim()
    beforePrice = beforePrice.slice(0, unitMatch.index).trim()
  }

  const name = beforePrice.replace(/\s+/g, ' ').trim()
  if (!name || name.length < 2) return null
  if (HEADER_LINE_RE.test(name)) return null

  return { name, unit, priceVnd }
}

const INLINE_TABLE_HEADER_PREFIX_RE =
  /^tên\s*món(?:đơn\s*vị\s*tính\s*giá(?:\s*\((?:VNĐ|VND)\))?|\s+đơn\s+vị(?:\s+tính)?(?:\s+giá(?:\s*\((?:VNĐ|VND)\))?)?)\s*/i

/** Chèn ngắt trước tiêu đề nhóm «1. 🧆 …» khi dán liền một dòng. */
const CATEGORY_SPLIT_RE = /(?=\d+\.\s*[\p{Extended_Pictographic}\uFE0F])/gu

/** Chèn ngắt trước hàng tiêu đề bảng «Tên Món…» dính liền. */
const TABLE_HEADER_SPLIT_RE = /(?=tên\s*món(?:đơn|\s+đơn))/gi

function expandBulkLines(raw: string): string[] {
  const expanded: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const categoryParts = trimmed.split(CATEGORY_SPLIT_RE).map((p) => p.trim()).filter(Boolean)
    for (const categoryPart of categoryParts) {
      const headerParts = categoryPart.split(TABLE_HEADER_SPLIT_RE).map((p) => p.trim()).filter(Boolean)
      for (const part of headerParts) {
        expanded.push(part)
      }
    }
  }
  return expanded
}

function stripInlineTableHeader(line: string): string {
  return line.replace(INLINE_TABLE_HEADER_PREFIX_RE, '').trim()
}

function shouldSkipLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true

  const compact = t.replace(/\s+/g, ' ')
  const withoutHeader = stripInlineTableHeader(t)
  const hasDishPayload =
    (withoutHeader && withoutHeader !== t && splitSegmentsByPrice(withoutHeader).length > 0) ||
    parseComboLine(t) !== null ||
    parseDotSeparatedLine(t) !== null

  if (hasDishPayload) return false

  if (HEADER_LINE_RE.test(t)) return true
  if (CATEGORY_LINE_RE.test(t)) return true
  if (/tên\s*món.*đơn\s*vị.*giá/i.test(compact)) return true
  if (/^tên\s*món.*giá/i.test(compact)) return true
  if (
    /^\d+\.\s*[\p{Extended_Pictographic}\uFE0F].*$/u.test(t) &&
    !PRICE_AT_END_RE.test(t) &&
    splitSegmentsByPrice(t).length === 0
  ) {
    return true
  }
  return false
}

/**
 * Phân tích văn xuôi / bảng dán từ Word, Zalo, Excel… thành danh sách món.
 * Hỗ trợ nhiều món nối liền trên một dòng (vd. «…Đĩa20.000…»).
 */
export function parseMenuDishesFromBulkText(text: string): MenuDishBulkParseResult {
  const raw = text.trim()
  if (!raw) return { ok: false, error: 'EMPTY' }

  const parsed: Omit<MenuDishItem, 'id' | 'order'>[] = []
  let skippedLines = 0

  const lines = expandBulkLines(raw)
  for (const line of lines) {
    let trimmed = line.trim()
    if (shouldSkipLine(trimmed)) {
      if (trimmed) skippedLines += 1
      continue
    }

    trimmed = stripInlineTableHeader(trimmed)
    if (!trimmed) {
      skippedLines += 1
      continue
    }
    if (shouldSkipLine(trimmed)) {
      skippedLines += 1
      continue
    }

    const comboRow = parseComboLine(trimmed)
    if (comboRow) {
      parsed.push(comboRow)
      continue
    }

    const dotRow = parseDotSeparatedLine(trimmed)
    if (dotRow) {
      parsed.push(dotRow)
      continue
    }

    const segments = splitSegmentsByPrice(trimmed)
    if (segments.length === 0) {
      skippedLines += 1
      continue
    }

    let lineHits = 0
    for (const segment of segments) {
      const row = parsePriceSegment(segment)
      if (row) {
        parsed.push(row)
        lineHits += 1
      }
    }
    if (lineHits === 0) skippedLines += 1
  }

  if (parsed.length === 0) return { ok: false, error: 'NO_ITEMS' }

  const dishes: MenuDishItem[] = parsed.map((row, index) => ({
    ...createEmptyMenuDish(`dish-bulk-${index}-${Date.now()}`),
    order: String(index + 1),
    name: row.name,
    unit: row.unit,
    priceVnd: row.priceVnd,
  }))

  return { ok: true, dishes, skippedLines }
}
