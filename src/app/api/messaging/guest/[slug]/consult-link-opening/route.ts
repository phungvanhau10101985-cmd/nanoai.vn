import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ConsultGreetingKind = 'anh' | 'chi' | 'anh_chi'

/** Suy từ tên + mô tả — không dùng trong câu chào dài. */
function inferConsultGreetingKind(blob: string): ConsultGreetingKind {
  const t = blob.toLowerCase()
  const femaleHints =
    /nữ|đầm|váy|bra|bikini|kẹp tóc|váy đầm|chân váy|giày cao gót|son môi|mỹ phẩm nữ|túi xách nữ|đầm nữ/i
  const maleHints =
    /\bđồ nam\b|\bquần nam\b|\báo nam\b|\bgiày nam\b|thắt lưng nam|đồng hồ nam|quần âu nam|áo khoác nam/i
  if (femaleHints.test(t) && !maleHints.test(t)) return 'chi'
  if (maleHints.test(t) && !femaleHints.test(t)) return 'anh'
  return 'anh_chi'
}

function consultGreetingLine(kind: ConsultGreetingKind): string {
  if (kind === 'anh') return 'Chào anh!'
  if (kind === 'chi') return 'Chào chị!'
  return 'Chào anh/chị!'
}

/** Gợi ý ngắn loại hàng — không lặp cả dòng tên SEO. */
function shortProductKindHint(productName: string): string {
  const t = productName.toLowerCase()
  if (/váy|đầm/i.test(t)) return 'Mẫu váy đầm này'
  if (/áo khoác|khoác|áo\b/i.test(t)) return 'Mẫu áo này'
  if (/quần/i.test(t)) return 'Mẫu quần này'
  if (/giày|dép/i.test(t)) return 'Mẫu giày/dép này'
  return 'Mẫu này'
}

function askFollowLine(kind: ConsultGreetingKind): string {
  if (kind === 'anh') return 'Anh nhắn em nếu cần hỏi size, màu, thử hàng hay đặt mua nhé.'
  if (kind === 'chi') return 'Chị nhắn em nếu cần hỏi size, màu, thử hàng hay đặt mua nhé.'
  return 'Anh/chị nhắn em nếu cần hỏi size, màu, thử hàng hay đặt mua nhé.'
}

/** Không Gemini: chào anh/chị → 1 câu ưu điểm (không nhét cả tên SP) → gợi ý hỏi thêm. */
function fallbackOpeningMessage(productName: string, extraContext: string): string {
  const blob = `${productName}\n${extraContext}`
  const kind = inferConsultGreetingKind(blob)
  const greet = consultGreetingLine(kind)
  const ctx = extraContext.trim().replace(/\s+/g, ' ')
  let mid: string
  if (ctx) {
    const first = ctx.split(/[.。!?]/)[0]?.trim() || ctx
    mid = first.length > 160 ? `${first.slice(0, 157)}…` : first
    if (!/[.!?…]$/.test(mid)) mid = `${mid}.`
  } else {
    const hint = shortProductKindHint(productName)
    mid = `${hint} form gọn, dễ phối — em có thể tư vấn chi tiết hơn khi nhận tin.`
  }
  const tail = askFollowLine(kind)
  return `${greet} ${mid} ${tail}`
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let body: { inventoryId?: string; sku?: string; productUrl?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const inventoryId = typeof body.inventoryId === 'string' ? body.inventoryId.trim() : ''
  const sku = typeof body.sku === 'string' ? body.sku.trim().slice(0, 128) : ''

  let productName = ''
  let extraContext = ''

  if (isPgConfigured() && inventoryId && UUID_RE.test(inventoryId)) {
    const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, inventoryId)
    if (row) {
      productName = (row.name ?? '').trim()
      const d = (row.description ?? '').trim()
      const n = (row.consult_note ?? '').trim()
      extraContext = [d, n].filter(Boolean).join('\n').slice(0, 600)
    }
  }

  if (!productName && sku) productName = sku
  if (!productName) productName = 'sản phẩm'

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ text: fallbackOpeningMessage(productName, extraContext) })
  }

  const prompt = `Viết MỘT tin nhắn tiếng Việt (đúng 3 câu hoặc 3 ý ngăn bằng dấu cách, tối đa 420 ký tự), không markdown, không bọc ngoặc kép toàn bộ.

Cấu trúc bắt buộc theo thứ tự:
1) **Câu 1 — chỉ lời chào**, đứng một mình: phải là "Chào anh!" HOẶC "Chào chị!" HOẶC "Chào anh/chị!" — suy từ tên + mô tả xem sản phẩm chủ yếu nam / nữ / không rõ. **Cấm** nhét tên sản phẩm dài, **cấm** mã SKU, **cấm** dấu «…» ở câu này.
2) **Câu 2 — một câu** nêu ưu điểm hoặc giá trị: chỉ dựa trên mô tả/ghi chú thật; nếu không đủ dữ liệu thì nói gọn theo **loại hàng** (vd "váy", "áo") bằng cụm như "Mẫu váy này…" — **không** copy nguyên cả dòng tên sản phẩm SEO. Không bịa công dụng y tế.
3) **Câu 3 — một câu** gợi ý khách nhắn tin để hỏi thêm (size, màu, thử hàng, đặt mua…); xưng "em" là nhân viên.

Dữ liệu tham chiếu (không dán nguyên tên dài vào câu chào):
Tên sản phẩm: ${productName}
${sku ? `SKU: ${sku}` : ''}
${extraContext ? `Mô tả / ghi chú:\n${extraContext}` : 'Không có mô tả — câu 2 chỉ nói gọn theo loại từ tên (vd váy đầm, áo khoác), không bịa chi tiết.'}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const models = ['gemini-2.0-flash', 'gemini-2.5-flash'] as const
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      void trackFromUsageMetadata(result.response.usageMetadata, modelName, 'messaging-consult-link-opening', null, null)
      const text = result.response.text()?.trim() ?? ''
      const cleaned = text.replace(/^["']|["']$/g, '').trim()
      if (cleaned.length >= 40 && cleaned.length <= 520) {
        return NextResponse.json({ text: cleaned })
      }
    } catch {
      continue
    }
  }

  return NextResponse.json({ text: fallbackOpeningMessage(productName, extraContext) })
}
