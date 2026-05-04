import type { Database } from '@/types/database.types'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { isPgConfigured } from '@/lib/db/pool'
import { updatePartnerInventoryMaterialNoteFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  extractInventorySearchTokens,
  scoreInventoryRowMatch,
} from '@/lib/messaging/partner-inventory-ai-search'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Không dùng `ren` đơn lẻ — tránh nhầm «Phối Ren» trong tên mẫu với hỏi chất ren. */
const ASKS_MATERIAL_RE =
  /(chất\s*liệu|vật\s*liệu|chất\s*liệu\s+gì|vải\s+gì|loại\s+vải|fabric|material|vải\s+thun|vải\s+len|kiểu\s+vải|gồm\s+vải|thành\s+phần|polyester|cotton|lụa|denim|jean|da\s+pu|vải\s+ren|chất\s+ren|có\s+ren|ren\s+gì|ren\s+không|viền\s+ren|đồ\s+ren|váy\s+ren|áo\s+ren|\bda\s+gì\b|\bda\s+này\b|\bloại\s+da\b|\bda\s+thật\b|\bda\s+bò\b)/i

/** Khách đang hỏi về chất liệu / vải. */
export function customerMessageAsksAboutMaterial(body: string): boolean {
  const t = body.replace(/^📷\s*/u, '').trim()
  if (t.length < 2) return false
  return ASKS_MATERIAL_RE.test(t)
}

const FABRIC_HINT_RE =
  /(vải|chất\s*liệu|cotton|polyester|spandex|len|lụa|tơ|satin|voan|thun|jean|denim|kaki|linen|lanh|nỉ|dạ|vải\s*ren|chất\s*ren|mesh|sợi|dệt|knit|woven|lông|da|giả\s*da|PU|nylon|viscose|modal|bamboo|silk|wool)/i

/** Đã có mô tả chất liệu trong text kho (không cần gọi vision). */
export function textBlockLikelyContainsMaterialDetail(text: string): boolean {
  const s = text.trim()
  if (s.length < 3) return false
  return FABRIC_HINT_RE.test(s)
}

function mergeInventoryTextForMaterialScan(r: InvRow): string {
  return [r.description, r.consult_note, r.stock_note, r.material_note].filter(Boolean).join('\n')
}

export function dedupeRowsById(rows: InvRow[]): InvRow[] {
  const seen = new Set<string>()
  const out: InvRow[] = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}

/** Ưu tiên: SKU khớp → mặt hàng đang chọn ảnh → các dòng ngữ cảnh. */
export function pickRowsForMaterialScan(
  explicitSkuRows: InvRow[],
  selectedRow: InvRow | null,
  invForContext: InvRow[]
): InvRow[] {
  return dedupeRowsById([...explicitSkuRows, ...(selectedRow ? [selectedRow] : []), ...invForContext])
}

function hasHttpsProductImage(r: InvRow): boolean {
  return /^https?:\/\//i.test((r.image_url ?? '').trim())
}

function pickBestRowWithImageForMessage(candidates: InvRow[], needles: string[]): InvRow | null {
  const withImg = candidates.filter(hasHttpsProductImage)
  if (!withImg.length) return null
  if (withImg.length === 1) return withImg[0]
  if (!needles.length) return withImg[0]
  let best = withImg[0]
  let bestScore = scoreInventoryRowMatch(best, needles)
  for (let i = 1; i < withImg.length; i++) {
    const r = withImg[i]
    const s = scoreInventoryRowMatch(r, needles)
    if (s > bestScore) {
      bestScore = s
      best = r
    } else if (s === bestScore && r.sort_order < best.sort_order) {
      best = r
    }
  }
  return bestScore > 0 ? best : withImg[0]
}

/**
 * Ảnh tham chiếu gửi Gemini: đúng ảnh sản phẩm (`image_url`) đang tư vấn, gần với ý khách nhất.
 * 1) Khách chọn mẫu từ carousel ảnh (vision).
 * 2) Khớp mã/SKU rõ trong tin nhắn hiện tại.
 * 3) Mặt hàng vừa có trên thẻ AI gần nhất trong hội thoại (`lastConsultedRow`).
 * 4) Trong ngữ cảnh kho: điểm khớp tin nhắn cao nhất.
 */
export function pickInventoryRowForReferenceImage(
  latestCustomerMessage: string,
  explicitSkuRows: InvRow[],
  selectedRow: InvRow | null,
  lastConsultedRow: InvRow | null,
  invForContext: InvRow[]
): InvRow | null {
  const needles = extractInventorySearchTokens(latestCustomerMessage.replace(/^📷\s*/u, '').trim())

  if (selectedRow && hasHttpsProductImage(selectedRow)) return selectedRow

  const fromExplicit = pickBestRowWithImageForMessage(explicitSkuRows, needles)
  if (fromExplicit) return fromExplicit

  if (lastConsultedRow && hasHttpsProductImage(lastConsultedRow)) return lastConsultedRow

  const fromContext = pickBestRowWithImageForMessage(invForContext, needles)
  return fromContext
}

async function fetchImageAsInlinePart(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
    if (!res.ok) return null
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!mime.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    return { mimeType: mime, data: buf.toString('base64') }
  } catch (e) {
    console.warn('[partner-inventory-material] fetch image failed', url.slice(0, 80), e)
    return null
  }
}

async function inferMaterialFromProductImageUrl(
  imageUrl: string,
  partnerId: string
): Promise<string | null> {
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return null
  const inline = await fetchImageAsInlinePart(imageUrl)
  if (!inline) return null
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: GEMINI_25_FLASH_NO_THINKING.model })
  const prompt =
    'Bạn là trợ lý thời trang. Quan sát ảnh sản phẩm (quần áo/phụ kiện). ' +
    'Trả lời MỘT đoạn tiếng Việt ngắn (tối đa 2 câu) về chất liệu/vải có thể suy đoán được từ ảnh (vd: cotton pha polyester, denim, lụa mỏng…). ' +
    'Nếu không nhìn rõ vải/chất liệu, chỉ nói: "Từ ảnh không nhìn rõ chất liệu cụ thể; shop có thể xác nhận thêm." ' +
    'Không bịa tên thương hiệu; không nói về giá hay size.'
  try {
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: inline.mimeType, data: inline.data } },
    ] as never)
    const response = result.response
    const um = response.usageMetadata
    const prompt_tokens = Math.max(0, um?.promptTokenCount ?? 0)
    const completion_tokens = Math.max(0, um?.candidatesTokenCount ?? 0)
    const total_tokens = Math.max(0, um?.totalTokenCount ?? prompt_tokens + completion_tokens)
    void insertPartnerAiTokenUsage({
      partner_id: partnerId,
      provider: 'google',
      model: GEMINI_25_FLASH_NO_THINKING.model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      usage_kind: 'material_infer',
    })
    void trackFromUsageMetadata(
      response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'partner-inventory-material-infer',
      null,
      null
    )
    const raw = response
      .text()
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 1200)
    return raw.length > 0 ? raw : null
  } catch (e) {
    console.warn('[partner-inventory-material] gemini infer failed', e)
    return null
  }
}

function patchRow<T extends InvRow>(rows: T[], id: string, material_note: string): T[] {
  return rows.map((r) => (r.id === id ? ({ ...r, material_note } as T) : r))
}

/**
 * Khi khách hỏi chất liệu: nếu kho đã có (material_note hoặc mô tả) thì giữ nguyên;
 * nếu thiếu và có ảnh HTTPS — gọi Gemini, lưu `material_note` vào DB, trả về bản đã cập nhật.
 */
export async function enrichInventoryRowsWithMaterialIfNeeded(
  partnerId: string,
  latestCustomerMessage: string,
  input: {
    explicitSkuRows: InvRow[]
    invForContext: InvRow[]
    selectedRow: InvRow | null
  }
): Promise<{ explicitSkuRows: InvRow[]; invForContext: InvRow[]; selectedRow: InvRow | null }> {
  if (!isPgConfigured() || !customerMessageAsksAboutMaterial(latestCustomerMessage)) {
    return input
  }
  const candidates = pickRowsForMaterialScan(
    input.explicitSkuRows,
    input.selectedRow,
    input.invForContext
  )
  let target: InvRow | null = null
  for (const r of candidates) {
    const mn = (r.material_note ?? '').trim()
    if (mn.length > 0) continue
    const blob = mergeInventoryTextForMaterialScan(r)
    if (textBlockLikelyContainsMaterialDetail(blob)) continue
    const img = (r.image_url ?? '').trim()
    if (!/^https?:\/\//i.test(img)) continue
    target = r
    break
  }
  if (!target) return input

  const inferred = await inferMaterialFromProductImageUrl(target.image_url.trim(), partnerId)
  if (!inferred) return input

  const ok = await updatePartnerInventoryMaterialNoteFromPg(partnerId, target.id, inferred)
  if (!ok) return input

  const nextNote = inferred.trim().slice(0, 2000)
  return {
    explicitSkuRows: patchRow(input.explicitSkuRows, target.id, nextNote),
    invForContext: patchRow(input.invForContext, target.id, nextNote),
    selectedRow:
      input.selectedRow?.id === target.id
        ? ({ ...input.selectedRow, material_note: nextNote } as InvRow)
        : input.selectedRow,
  }
}
