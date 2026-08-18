import type { Database } from '@/types/database.types'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchImageWith1688Bypass, is1688ImageUrl } from '@/lib/fetch-image-1688'
import { updatePartnerInventoryMaterialDetailImageUrlFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import {
  customerMessageAsksAboutMaterial,
  pickInventoryRowForReferenceImage,
} from '@/lib/messaging/partner-inventory-material-enrichment'
import { uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import {
  MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO,
  buildMaterialQualityInfographicPrompt,
} from '@/lib/partner-website/material-quality-infographic-prompt'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const IMAGE_MODEL = GEMINI_3_PRO_IMAGE.model

export type PartnerMaterialDetailFollowup = {
  publicUrl: string
  storagePath: string
  mime: string
  /** Copy ưu điểm chất liệu gửi kèm ảnh trong chat (tăng chuyển đổi). */
  pitchText?: string
}

function mergeInventoryTextForPitch(row: InvRow): string {
  return [row.name, row.material_note, row.description, row.consult_note]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

function buildMaterialCollagePrompt(row: InvRow): string {
  return buildMaterialQualityInfographicPrompt({
    productName: row.name,
    material: row.material_note,
    description: row.description,
    consultNote: row.consult_note,
    locale: 'vi',
  })
}

/** Copy ngắn ưu điểm chất liệu — gửi kèm ảnh chi tiết trong chat. */
async function generateMaterialDetailSalesPitch(row: InvRow, partnerId: string): Promise<string | null> {
  const catalog = mergeInventoryTextForPitch(row).trim()
  if (catalog.length < 3) return null
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return null
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: GEMINI_25_FLASH_NO_THINKING.model })
  const prompt =
    'Bạn là copywriter thời trang e-commerce. Viết 2–3 câu tiếng Việt ngắn gọn về **ưu điểm chất liệu** của sản phẩm — giọng tư vấn thân thiện (em/shop), giúp khách cảm thấy chất liệu **đáng mua** (mềm, bền, thoáng, sang, dễ phối, giữ form…). ' +
    'Chỉ dựa trên dữ liệu shop bên dưới; không bịa loại vải/chất liệu; không hứa y tế, giảm cân hay hiệu quả tuyệt đối. Có thể thêm 1–2 gạch đầu dòng ngắn (mỗi dòng ≤ 8 từ). Không emoji, không URL.\n\n' +
    `Dữ liệu shop:\n${catalog.slice(0, 1800)}`
  try {
    const result = await model.generateContent([{ text: prompt }] as never)
    const response = result.response
    const um = response.usageMetadata
    void insertPartnerAiTokenUsage({
      partner_id: partnerId,
      provider: 'google',
      model: GEMINI_25_FLASH_NO_THINKING.model,
      prompt_tokens: Math.max(0, um?.promptTokenCount ?? 0),
      completion_tokens: Math.max(0, um?.candidatesTokenCount ?? 0),
      total_tokens: Math.max(0, um?.totalTokenCount ?? 0),
      usage_kind: 'material_infer',
    })
    void trackFromUsageMetadata(
      response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'partner-inventory-material-pitch',
      null,
      null
    )
    const raw = response
      .text()
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 900)
    return raw.length > 0 ? raw : null
  } catch (e) {
    console.warn('[material-detail-image] sales pitch gen failed', e)
    return null
  }
}

export function buildMaterialDetailImageChatCaption(followup: PartnerMaterialDetailFollowup): string {
  const pitch = followup.pitchText?.trim()
  const lead = '📷 Chi tiết chất liệu & màu sắc (từ ảnh sản phẩm chính).'
  return pitch ? `${lead}\n\n${pitch}` : lead
}

function patchMaterialDetailImage<T extends InvRow>(rows: T[], id: string, url: string): T[] {
  return rows.map((r) => (r.id === id ? ({ ...r, material_detail_image_url: url } as T) : r))
}

async function fetchImageAsInlinePart(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    let buf: Buffer
    let mime = 'image/jpeg'
    if (is1688ImageUrl(url)) {
      buf = await fetchImageWith1688Bypass(url)
    } else {
      const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
      if (!res.ok) return null
      mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
      if (!mime.startsWith('image/')) return null
      buf = Buffer.from(await res.arrayBuffer())
    }
    if (!buf?.length || buf.length > 8 * 1024 * 1024) return null
    if (buf[0] === 0x89) mime = 'image/png'
    else if (buf[0] === 0xff && buf[1] === 0xd8) mime = 'image/jpeg'
    else if (buf.toString('ascii', 0, 4) === 'RIFF') mime = 'image/webp'
    return { mimeType: mime, data: buf.toString('base64') }
  } catch (e) {
    console.warn('[material-detail-image] fetch ref failed', url.slice(0, 80), e)
    return null
  }
}

async function generateMaterialDetailCollageBuffer(
  productImageUrl: string,
  row: InvRow
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
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: IMAGE_MODEL,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO },
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
        buildMaterialCollagePrompt(row),
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

  const pitchText = (await generateMaterialDetailSalesPitch(focus, partnerId)) ?? undefined

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
        pitchText,
      },
    }
  }

  const gen = await generateMaterialDetailCollageBuffer(focus.image_url.trim(), focus)
  if (!gen?.buffer.length) return emptyFollowup

  const stored = await storeGeneratedMaterialDetailImage(partnerId, focus.id, gen)
  if (!stored) return emptyFollowup

  const nextUrl = stored.publicUrl
  return {
    explicitSkuRows: patchMaterialDetailImage(input.explicitSkuRows, focus.id, nextUrl),
    invForContext: patchMaterialDetailImage(input.invForContext, focus.id, nextUrl),
    selectedRow:
      input.selectedRow?.id === focus.id
        ? ({ ...input.selectedRow, material_detail_image_url: nextUrl } as InvRow)
        : input.selectedRow,
    materialDetailFollowup: {
      publicUrl: nextUrl,
      storagePath: stored.storagePath,
      mime: 'image/png',
      pitchText,
    },
  }
}

async function storeGeneratedMaterialDetailImage(
  partnerId: string,
  inventoryId: string,
  gen: { buffer: Buffer; prompt_tokens: number; completion_tokens: number; total_tokens: number }
): Promise<{ publicUrl: string; storagePath: string } | null> {
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
    return null
  }
  const ok = await updatePartnerInventoryMaterialDetailImageUrlFromPg(partnerId, inventoryId, up.publicUrl)
  if (!ok) return null
  return { publicUrl: up.publicUrl.trim(), storagePath: up.path }
}

/** Tạo lại ảnh chất liệu (bỏ cache) — dùng cho thử SKU / đăng SP. */
export async function regenerateInventoryMaterialDetailImage(
  partnerId: string,
  row: InvRow
): Promise<PartnerMaterialDetailFollowup | null> {
  const src = (row.image_url ?? '').trim()
  if (!/^https?:\/\//i.test(src)) return null
  const gen = await generateMaterialDetailCollageBuffer(src, row)
  if (!gen?.buffer.length) return null
  const stored = await storeGeneratedMaterialDetailImage(partnerId, row.id, gen)
  if (!stored) return null
  const pitchText = (await generateMaterialDetailSalesPitch(row, partnerId)) ?? undefined
  return {
    publicUrl: stored.publicUrl,
    storagePath: stored.storagePath,
    mime: 'image/png',
    pitchText,
  }
}
