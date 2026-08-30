/**
 * Ảnh sản phẩm: đọc chữ/mã trên ảnh trước (OCR / SKU) nằm ở widget.
 * Không đọc được gì → vector. Top ≥ 86% thì khóa tư vấn mẫu đó; dưới 86% thì carousel 36 thẻ.
 */

import type { Json } from '@/types/database.types'

const PHOTO_ITEM_CONSULT_RE = new RegExp(
  [
    String.raw`(?:áo|ao|quần|quan|túi|tui|giày|giay|váy|vay|đầm|dam|balo|mẫu|mau|sp|sản\s*phẩm)\s*(?:này|nay|đó|do)`,
    String.raw`mẫu\s*này`,
    String.raw`áo\s*mình\s*chọn`,
    String.raw`ao\s*minh\s*chon`,
    String.raw`mẫu\s*(?:gửi|gui)\s*(?:đó|do|đấy|day)`,
    String.raw`mau\s*(?:gui|goi)\s*(?:do|day)`,
    String.raw`mặc\s*(?:mùa\s*)?hè`,
    String.raw`mac\s*(?:mua\s*)?he`,
    String.raw`nóng\s*(?:ko|không|k|dc|được)?`,
    String.raw`nong\s*(?:ko|khong|k)?`,
    String.raw`dệt\s*kim|det\s*kim`,
    String.raw`chất\s*liệu|chat\s*lieu`,
    String.raw`this\s+(?:one|item|shirt|jacket|bag)`,
    String.raw`tôi\s*muốn\s*xem\s*mẫu\s*này`,
    String.raw`toi\s*muon\s*xem\s*mau\s*nay`,
    String.raw`(?:mã|ma)\s*(?:sp|sản\s*phẩm|san\s*pham)`,
    String.raw`(?:sku|product\s*code)`,
  ].join('|'),
  'i'
)

const ASK_SKU_OF_THIS_PHOTO_RE =
  /(?:mã|ma)\s*(?:sp|sản\s*phẩm|san\s*pham).{0,24}(?:mẫu|mau|ảnh|anh|hình|hinh|này|nay)|(?:sku|product\s*code).{0,16}(?:this|photo|image)/i

/** «Mã SP mẫu này» — hỏi mã của ảnh vừa gửi, không phải mã đơn DH. */
export function inboundTextLooksLikeAskSkuOfThisPhotoItem(text: string): boolean {
  const c = String(text ?? '')
    .replace(/^📷\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!c) return false
  return ASK_SKU_OF_THIS_PHOTO_RE.test(c)
}

export function captionLooksLikeConsultThisPhotoItem(caption: string): boolean {
  const c = String(caption ?? '')
    .replace(/^📷\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!c) return false
  return PHOTO_ITEM_CONSULT_RE.test(c)
}

export function inboundTextLooksLikeConsultThisPhotoItem(text: string): boolean {
  return captionLooksLikeConsultThisPhotoItem(text)
}

/** Vector ảnh: từ ngưỡng này trở lên tư vấn luôn mẫu gần nhất. */
export const PHOTO_ITEM_LOCK_MIN_SCORE = 0.86

function finiteScore(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Top vector ≥ 86% → khóa mẫu đó (không cần khoảng cách với #2). */
export function shouldLockTopVisionMatch(input: {
  topScore: number | null | undefined
  caption?: string
}): boolean {
  const top = finiteScore(input.topScore)
  return top !== null && top >= PHOTO_ITEM_LOCK_MIN_SCORE
}

export type VisionTopCandidateRef = {
  inventoryId: string
  sku: string
  score?: number
}

function parseVisionCandidate(rec: Record<string, unknown>): VisionTopCandidateRef | null {
  const id = String(rec.inventoryId ?? rec.inventory_id ?? '').trim()
  if (!id) return null
  const score = finiteScore(typeof rec.score === 'number' ? rec.score : null)
  return {
    inventoryId: id,
    sku: String(rec.sku ?? '').trim(),
    ...(score !== null ? { score } : {}),
  }
}

export function visionCandidateRefsFromRaw(
  raw: Json | null | undefined,
  max = 1
): VisionTopCandidateRef[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const arr = (raw as { vision_candidates?: unknown }).vision_candidates
  if (!Array.isArray(arr) || arr.length === 0) return []
  const out: VisionTopCandidateRef[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const parsed = parseVisionCandidate(item as Record<string, unknown>)
    if (!parsed) continue
    out.push(parsed)
    if (out.length >= max) break
  }
  return out
}

export function topVisionCandidateFromRaw(raw: Json | null | undefined): VisionTopCandidateRef | null {
  return visionCandidateRefsFromRaw(raw, 1)[0] ?? null
}

/** Tin ảnh đã khóa mẫu (OCR mã / vector ≥ 86%) — không phải đang chờ chọn 36 thẻ. */
export function visionAutoLockedFromRaw(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const o = raw as Record<string, unknown>
  if (o.vision_pick_required === true) return false
  if (o.vision_auto_selected === true) return true
  const pc = o.page_context
  if (!pc || typeof pc !== 'object' || Array.isArray(pc)) return false
  const src = typeof (pc as { source?: unknown }).source === 'string' ? (pc as { source: string }).source.trim() : ''
  return src === 'image_sku_match' || src === 'image_visual_lock'
}

export function lockedVisionTopFromRaw(raw: Json | null | undefined): VisionTopCandidateRef | null {
  if (!visionAutoLockedFromRaw(raw) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const selectedId =
    typeof o.vision_selected_inventory_id === 'string' ? o.vision_selected_inventory_id.trim() : ''
  const pc = o.page_context
  const pcObj = pc && typeof pc === 'object' && !Array.isArray(pc) ? (pc as Record<string, unknown>) : null
  const pcId = typeof pcObj?.inventory_id === 'string' ? pcObj.inventory_id.trim() : ''
  const pcSku = typeof pcObj?.sku === 'string' ? pcObj.sku.trim() : ''
  if (selectedId) return { inventoryId: selectedId, sku: pcSku }
  if (pcId) return { inventoryId: pcId, sku: pcSku }
  return topVisionCandidateFromRaw(raw)
}

export function findLatestLockedVisionTop(
  lines: Array<{ raw_payload?: Json | null }>
): VisionTopCandidateRef | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const hit = lockedVisionTopFromRaw(lines[i]?.raw_payload ?? null)
    if (hit) return hit
  }
  return null
}

export function findLatestVisionTopCandidate(
  lines: Array<{ raw_payload?: Json | null }>
): VisionTopCandidateRef | null {
  return findLatestLockedVisionTop(lines)
}
