import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { parsePartnerOrderVariantImageUrls } from '@/lib/messaging/partner-order-variant-images'

export type ParsedVariantLine = {
  imageUrl: string
  /** Tên mẫu (từ chuỗi Màu / mẫu: …×SL) */
  variantName: string
  qty: number
  size: string
}

function splitCommaSegments(s: string): string[] {
  return String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** `Name×qty` — lấy × cuối làm phân tách số lượng. */
function parseColorSegment(seg: string): { name: string; qty: number } {
  const u = seg.replace(/\s+/g, ' ').trim()
  const last = u.lastIndexOf('×')
  if (last <= 0) {
    return { name: u || '—', qty: 1 }
  }
  const name = u.slice(0, last).trim() || '—'
  const q = Math.max(1, Math.min(99, parseInt(u.slice(last + 1).replace(/\D/g, ''), 10) || 1))
  return { name, qty: q }
}

/** `Name:size` — dấu `:` đầu tiên phân tách size. */
function parseSizeSegment(seg: string): { name: string; size: string } {
  const u = seg.replace(/\s+/g, ' ').trim()
  const c = u.indexOf(':')
  if (c <= 0) {
    return { name: u || '—', size: '—' }
  }
  return {
    name: u.slice(0, c).trim() || '—',
    size: u.slice(c + 1).trim() || '—',
  }
}

/**
 * Ghép URL ảnh (thứ tự lúc đặt) với chuỗi `variant_color` / `variant_size` song song.
 * Trả về `null` nếu không có URL ảnh — UI dùng dạng cũ (chỉ chữ).
 */
export function parsePartnerOrderVariantLines(
  row: Pick<PartnerOrderRow, 'variant_image_urls' | 'variant_color' | 'variant_size'>
): ParsedVariantLine[] | null {
  const urls = parsePartnerOrderVariantImageUrls(row.variant_image_urls)
  if (urls.length === 0) return null

  const colorSegs = splitCommaSegments(String(row.variant_color ?? '')).map(parseColorSegment)
  const sizeSegs = splitCommaSegments(String(row.variant_size ?? '')).map(parseSizeSegment)

  const lines: ParsedVariantLine[] = []
  for (let i = 0; i < urls.length; i++) {
    const c = colorSegs[i]
    const z = sizeSegs[i]
    const variantName = (c?.name ?? z?.name ?? `Mẫu ${i + 1}`).trim() || `Mẫu ${i + 1}`
    const qty = c?.qty ?? 1
    const size = z?.size ?? '—'
    lines.push({
      imageUrl: urls[i],
      variantName,
      qty,
      size,
    })
  }
  return lines
}

export function totalQtyFromVariantLines(lines: ParsedVariantLine[]): number {
  return lines.reduce((s, l) => s + Math.max(1, l.qty), 0)
}
