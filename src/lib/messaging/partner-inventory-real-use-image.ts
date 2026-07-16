import type { Database } from '@/types/database.types'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { countPartnerAiRealUseImagesSentForInventoryInConversationPg } from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { updatePartnerInventoryRealUseImageUrlAtSlotFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { pickInventoryRowForReferenceImage } from '@/lib/messaging/partner-inventory-material-enrichment'
import { uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const IMAGE_MODEL = GEMINI_3_PRO_IMAGE.model

const ASKS_REAL_USE_RE =
  /(ảnh\s+chụp\s+thực\s+tế|thực\s+tế\s+không|ảnh\s+thực\s+tế|có\s+ảnh\s+thật|ảnh\s+thật|ảnh\s+ngoài\s+đời|ảnh\s+mặc|ảnh\s+đeo|ảnh\s+mang|ảnh\s+bên\s+trong|bên\s+trong\s+túi|ngăn\s+trong(\s+túi)?|lót\s+trong(\s+túi)?|real\s*photo|actual\s*photo|on\s*body|worn|try[\s-]?on|inside\s+(the\s+)?bag|interior\s+(shot|photo))/i

const ASKS_SPECIFIC_ANGLE_RE =
  /(bên\s+trong|ngăn\s+trong|lót\s+trong|mặt\s+trước|đằng\s+trước|mặt\s+sau|đằng\s+sau|mặt\s+hông|hai\s+bên|đáy\s+túi|góc\s+cạnh|chi\s+tiết\s+khóa|chi\s+tiết\s+đường\s+may|interior|inside|front\s*view|back\s*view|side\s*view|bottom\s*view|zipper\s*detail|stitch(?:ing)?\s*detail)/i

/** Khách hỏi có ảnh thực tế / mặc thử / dùng thật không. */
export function customerMessageAsksAboutRealUsePhoto(body: string): boolean {
  const t = body.replace(/^📷\s*/u, '').trim()
  if (t.length < 2) return false
  return ASKS_REAL_USE_RE.test(t)
}

/**
 * Khách hỏi góc chụp rất cụ thể (bên trong/trước/sau/đáy/ngăn...).
 * Trường hợp này cần ưu tiên thẻ sản phẩm + điều hướng bấm «Xem chi tiết» trên web,
 * không tạo ảnh AI vì dễ lệch mục tiêu câu hỏi.
 */
export function customerMessageAsksSpecificPhotoAngleDetail(body: string): boolean {
  const t = body.replace(/^📷\s*/u, '').trim()
  if (t.length < 2) return false
  return ASKS_SPECIFIC_ANGLE_RE.test(t)
}

const REAL_USE_PROMPT_SLOT1 = `You are an e-commerce creative assistant. The user attached EXACTLY ONE **primary product image** — the main listing photo of ONE real product (Image A). This is the shop’s canonical product shot used as the **sole source** to synthesize a believable “real customer” lifestyle photo, not a loose reference.

Generate ONE photorealistic image that looks like an **authentic casual phone photo** of a real customer wearing or using the product—not a studio lookbook, not magazine lighting, not a collage.

Style goals (pick what fits apparel vs bag/shoes):
- **Phone camera / UGC vibe**: slightly imperfect framing, natural indoor light (window, warm room light), or soft daylight; optional **mirror selfie** (full-length or upper body in front of a home mirror, subtle reflection context) or **arm-length selfie** angle—like someone took it at home before going out.
- The product must match Image A exactly (same cut, color, material look, hardware)—not a different SKU or colorway.
- Anonymous adult; natural pose; **no** glossy catalog backdrop, **no** professional three-point lighting, **no** runway or e-commerce packshot feel.

**Everyday authenticity (critical):**
- **Ordinary life, not editorial**: believable everyday setting (home, simple street, casual indoor)—avoid fashion-spread staging, fake “perfect” compositions, or looks-like-a-brand-ad shots.
- **Natural look if a person is visible**: everyday, approachable energy—**no heavy glam makeup**, **no** influencer beauty-filter skin or plastic-smooth face; light everyday styling only; skin texture should look **real**, not retouched catalog model.
- **Honest product read**: colors, fabric/sheen, drape, stitching, and hardware must stay **truthful to Image A** in normal light—**no** oversaturation, **no** filters that change how the product appears.

No text, no watermark, no logos, no price tags in frame. Output only the generated image.`

const REAL_USE_PROMPT_SLOT2 = `You are an e-commerce creative assistant. The user attached EXACTLY ONE **primary product image** — the main listing photo of ONE real product (Image A), same as for the first shot.

Create a **second** shot that is clearly different from the first, still **phone-photo authentic** (real customer vibe):
- Change the situation: e.g. if the first was mirror selfie, use a different angle (walking indoor, standing by a window, soft outdoor snap) or vice versa; keep the same **authentic UGC / tự chụp** look—not studio.
- Same exact product as Image A (colors, cut, trims, hardware). Still anonymous adult, natural light, believable everyday place.
- Keep the same **everyday authenticity** as the first image: candid real-life feel, natural (non-glam) appearance if people are visible, and **truthful** product color/texture vs Image A—no beauty filters that distort the item.

No text, no watermark, no logos, no price tags in frame. Output only the generated image.`

export type PartnerRealUseImageFollowup = {
  publicUrl: string
  storagePath: string
  mime: string
  /** Để gắn metadata tin nhắn — đếm tối đa 2 ảnh / cuộc chat / mặt hàng. */
  inventoryId: string
  slot: 1 | 2
}

function patchRealUseImage<T extends InvRow>(rows: T[], id: string, url: string, slot: 1 | 2): T[] {
  return rows.map((r) =>
    r.id === id
      ? ({
          ...r,
          ...(slot === 1 ? { real_use_image_url: url } : { real_use_image_url_2: url }),
        } as T)
      : r
  )
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
    console.warn('[real-use-image] fetch ref failed', url.slice(0, 80), e)
    return null
  }
}

async function generateRealUseLifestyleBuffer(
  productImageUrl: string,
  slot: 1 | 2
): Promise<{
  buffer: Buffer
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
} | null> {
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return null
  const inline = await fetchImageAsInlinePart(productImageUrl)
  if (!inline) return null
  const prompt = slot === 1 ? REAL_USE_PROMPT_SLOT1 : REAL_USE_PROMPT_SLOT2
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: IMAGE_MODEL,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: '3:4' },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]
  try {
    const genResult = await model.generateContent(
      [prompt, { inlineData: { mimeType: inline.mimeType, data: inline.data } }] as never,
      { safetySettings } as never
    )
    const response = genResult.response
    const um = response.usageMetadata
    const prompt_tokens = Math.max(0, um?.promptTokenCount ?? 0)
    const completion_tokens = Math.max(0, um?.candidatesTokenCount ?? 0)
    const total_tokens = Math.max(0, um?.totalTokenCount ?? prompt_tokens + completion_tokens)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) return null
    const buffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    await trackFromUsageMetadata(response.usageMetadata, IMAGE_MODEL, 'partner-inventory-real-use-image', null, '2K')
    return { buffer, prompt_tokens, completion_tokens, total_tokens }
  } catch (e) {
    console.warn('[real-use-image] gemini image gen failed', e)
    return null
  }
}

/**
 * Ảnh đời thường / góc tự nhiên — nhìn sản phẩm chân thực (Gemini, sinh từ **ảnh chính** `image_url` trong kho) — tối đa 2 ảnh / cuộc chat / mặt hàng;
 * cache 2 URL trên kho (toàn shop). Chú thích gửi khách: `partner-ai-deliver`.
 */
export async function enrichInventoryRealUseImageIfNeeded(
  partnerId: string,
  conversationId: string,
  latestCustomerMessage: string,
  input: {
    explicitSkuRows: InvRow[]
    invForContext: InvRow[]
    selectedRow: InvRow | null
    lastConsultedRow: InvRow | null
  }
): Promise<{
  explicitSkuRows: InvRow[]
  invForContext: InvRow[]
  selectedRow: InvRow | null
  realUseFollowup: PartnerRealUseImageFollowup | null
  realUsePhotoLimitExceeded: boolean
}> {
  const empty = {
    ...input,
    realUseFollowup: null as PartnerRealUseImageFollowup | null,
    realUsePhotoLimitExceeded: false,
  }
  if (!isPgConfigured() || !customerMessageAsksAboutRealUsePhoto(latestCustomerMessage)) {
    return empty
  }

  const focus = pickInventoryRowForReferenceImage(
    latestCustomerMessage,
    input.explicitSkuRows,
    input.selectedRow,
    input.lastConsultedRow,
    input.invForContext
  )
  if (!focus) return empty

  let sentCount = 0
  try {
    const c = await countPartnerAiRealUseImagesSentForInventoryInConversationPg(conversationId, focus.id)
    sentCount = c ?? 0
  } catch {
    sentCount = 0
  }

  if (sentCount >= 2) {
    return { ...input, realUseFollowup: null, realUsePhotoLimitExceeded: true }
  }

  const slot: 1 | 2 = sentCount === 0 ? 1 : 2
  const cachedUrl =
    slot === 1
      ? (focus.real_use_image_url ?? '').trim()
      : (focus.real_use_image_url_2 ?? '').trim()

  if (/^https?:\/\//i.test(cachedUrl)) {
    return {
      explicitSkuRows: input.explicitSkuRows,
      invForContext: input.invForContext,
      selectedRow: input.selectedRow,
      realUseFollowup: {
        publicUrl: cachedUrl,
        storagePath: '',
        mime: 'image/png',
        inventoryId: focus.id,
        slot,
      },
      realUsePhotoLimitExceeded: false,
    }
  }

  const gen = await generateRealUseLifestyleBuffer(focus.image_url.trim(), slot)
  if (!gen?.buffer.length) return empty

  await insertPartnerAiTokenUsage({
    partner_id: partnerId,
    provider: 'google',
    model: IMAGE_MODEL,
    prompt_tokens: gen.prompt_tokens,
    completion_tokens: gen.completion_tokens,
    total_tokens: gen.total_tokens,
    usage_kind: 'image_real_use',
  })

  const up = await uploadPartnerChatImageBuffer(partnerId, gen.buffer, 'image/png')
  if ('error' in up) {
    console.warn('[real-use-image] upload failed', up.error)
    return empty
  }

  const ok = await updatePartnerInventoryRealUseImageUrlAtSlotFromPg(partnerId, focus.id, up.publicUrl, slot)
  if (!ok) return empty

  const nextUrl = up.publicUrl.trim()
  return {
    explicitSkuRows: patchRealUseImage(input.explicitSkuRows, focus.id, nextUrl, slot),
    invForContext: patchRealUseImage(input.invForContext, focus.id, nextUrl, slot),
    selectedRow:
      input.selectedRow?.id === focus.id
        ? ({
            ...input.selectedRow,
            ...(slot === 1 ? { real_use_image_url: nextUrl } : { real_use_image_url_2: nextUrl }),
          } as InvRow)
        : input.selectedRow,
    realUseFollowup: {
      publicUrl: nextUrl,
      storagePath: up.path,
      mime: 'image/png',
      inventoryId: focus.id,
      slot,
    },
    realUsePhotoLimitExceeded: false,
  }
}

