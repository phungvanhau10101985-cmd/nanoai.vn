import type { Database } from '@/types/database.types'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { isPgConfigured } from '@/lib/db/pool'
import { updatePartnerInventoryMaterialDetailImageUrlFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  customerMessageAsksAboutMaterial,
  pickInventoryRowForReferenceImage,
} from '@/lib/messaging/partner-inventory-material-enrichment'
import { uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const IMAGE_MODEL = 'gemini-3-pro-image-preview' as const

const MATERIAL_COLLAGE_PROMPT = `You are an e-commerce creative assistant. The user attached EXACTLY ONE **primary product image** — the main listing photo of ONE real product (Image A — full product or packshot). This is the authoritative product photo, not an optional reference.

Task: generate ONE composite "material & fabric detail" image (Image B) that looks like a professional listing zoom sheet for THAT SAME garment/accessory only, derived only from Image A.

Rules (strict):
- Treat Image A as the only source of truth for silhouette, color, fabric type, trims, hardware, and patterns. Do NOT depict a different product, different colorway, or generic stock fabric.
- Simulate extreme close-ups and tight crops AS IF the camera zoomed into specific regions of Image A (neckline/collar, sleeve/cuff, side seam, hem, zipper/buttons, strap, bag leather grain, shoe upper stitching, etc.—pick regions that exist on this product). Panels should read as magnified fragments of this item, not unrelated textiles.
- Layout: one larger panel may echo the overall product context; surrounding panels are macro detail shots (texture, weave/knit, sheer vs opaque layers, stitching, hem). Optional small comparison strips with pinked/zigzag edges showing color/material consistency with Image A.
- Photorealistic, soft bright lighting, clean neutral accents, no text, no watermark, no logos.
- Output only the generated image.`

export type PartnerMaterialDetailFollowup = {
  publicUrl: string
  storagePath: string
  mime: string
}

function patchMaterialDetailImage<T extends InvRow>(rows: T[], id: string, url: string): T[] {
  return rows.map((r) => (r.id === id ? ({ ...r, material_detail_image_url: url } as T) : r))
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
    console.warn('[material-detail-image] fetch ref failed', url.slice(0, 80), e)
    return null
  }
}

async function generateMaterialDetailCollageBuffer(productImageUrl: string): Promise<{
  buffer: Buffer
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
} | null> {
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return null
  const inline = await fetchImageAsInlinePart(productImageUrl)
  if (!inline) return null
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: IMAGE_MODEL,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: '1:1' },
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
      [
        MATERIAL_COLLAGE_PROMPT,
        { inlineData: { mimeType: inline.mimeType, data: inline.data } },
      ] as never,
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
    await trackFromUsageMetadata(response.usageMetadata, IMAGE_MODEL, 'partner-inventory-material-detail-image', null, '2K')
    return { buffer, prompt_tokens, completion_tokens, total_tokens }
  } catch (e) {
    console.warn('[material-detail-image] gemini image gen failed', e)
    return null
  }
}

/**
 * Khi khách hỏi chất liệu: đảm bảo có URL ảnh collage chi tiết (cache DB hoặc tạo mới bằng Gemini từ **ảnh chính** `image_url`).
 * Trả về thông tin để gửi kèm tin nhắn (widget/Facebook…).
 */
export async function enrichInventoryMaterialDetailCollageIfNeeded(
  partnerId: string,
  latestCustomerMessage: string,
  input: {
    explicitSkuRows: InvRow[]
    invForContext: InvRow[]
    selectedRow: InvRow | null
    /** Thẻ sản phẩm AI vừa gửi — neo đúng ảnh chính khi khách hỏi chung. */
    lastConsultedRow: InvRow | null
  }
): Promise<{
  explicitSkuRows: InvRow[]
  invForContext: InvRow[]
  selectedRow: InvRow | null
  materialDetailFollowup: PartnerMaterialDetailFollowup | null
}> {
  const emptyFollowup = { ...input, materialDetailFollowup: null as PartnerMaterialDetailFollowup | null }
  if (!isPgConfigured() || !customerMessageAsksAboutMaterial(latestCustomerMessage)) {
    return emptyFollowup
  }

  const focus = pickInventoryRowForReferenceImage(
    latestCustomerMessage,
    input.explicitSkuRows,
    input.selectedRow,
    input.lastConsultedRow,
    input.invForContext
  )
  if (!focus) return emptyFollowup

  const existing = (focus.material_detail_image_url ?? '').trim()
  if (/^https?:\/\//i.test(existing)) {
    return {
      explicitSkuRows: input.explicitSkuRows,
      invForContext: input.invForContext,
      selectedRow: input.selectedRow,
      materialDetailFollowup: {
        publicUrl: existing,
        storagePath: '',
        mime: 'image/png',
      },
    }
  }

  const gen = await generateMaterialDetailCollageBuffer(focus.image_url.trim())
  if (!gen?.buffer.length) return emptyFollowup

  await insertPartnerAiTokenUsage({
    partner_id: partnerId,
    provider: 'google',
    model: IMAGE_MODEL,
    prompt_tokens: gen.prompt_tokens,
    completion_tokens: gen.completion_tokens,
    total_tokens: gen.total_tokens,
    usage_kind: 'image_material_detail',
  })

  const up = await uploadPartnerChatImageBuffer(partnerId, gen.buffer, 'image/png')
  if ('error' in up) {
    console.warn('[material-detail-image] upload failed', up.error)
    return emptyFollowup
  }

  const ok = await updatePartnerInventoryMaterialDetailImageUrlFromPg(partnerId, focus.id, up.publicUrl)
  if (!ok) return emptyFollowup

  const nextUrl = up.publicUrl.trim()
  return {
    explicitSkuRows: patchMaterialDetailImage(input.explicitSkuRows, focus.id, nextUrl),
    invForContext: patchMaterialDetailImage(input.invForContext, focus.id, nextUrl),
    selectedRow:
      input.selectedRow?.id === focus.id
        ? ({ ...input.selectedRow, material_detail_image_url: nextUrl } as InvRow)
        : input.selectedRow,
    materialDetailFollowup: {
      publicUrl: nextUrl,
      storagePath: up.path,
      mime: 'image/png',
    },
  }
}
