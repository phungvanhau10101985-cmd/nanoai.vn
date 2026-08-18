import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import {
  MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO,
  buildMaterialQualityInfographicPrompt,
} from '@/lib/partner-website/material-quality-infographic-prompt'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/**
 * L3.4 — Ảnh section "material": image-edit ảnh SP thật thành infographic chất liệu
 * (cùng prompt `buildMaterialQualityInfographicPrompt` với inbox + Product Studio).
 */

const IMAGE_MODEL = GEMINI_3_PRO_IMAGE.model

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
    console.warn('[landing-ai-material-image] fetch ref failed', url.slice(0, 80), e)
    return null
  }
}

function buildMaterialCollagePrompt(input: {
  material: string
  callouts: string[]
  productName?: string
  locale?: string
  description?: string
}): string {
  return buildMaterialQualityInfographicPrompt({
    productName: input.productName,
    material: input.material,
    description: input.description,
    callouts: input.callouts,
    locale: input.locale,
  })
}

export async function generateLandingMaterialImage(input: {
  partnerId: string
  landingId: string
  productImageUrl: string
  material: string
  callouts: string[]
  productName?: string
  locale?: string
  description?: string
}): Promise<{ imageUrl: string } | null> {
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return null
  const inline = await fetchImageAsInlinePart(input.productImageUrl)
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
    const prompt = buildMaterialCollagePrompt(input)
    const result = await model.generateContent(
      [prompt, { inlineData: { mimeType: inline.mimeType, data: inline.data } }] as never,
      { safetySettings } as never
    )
    const response = result.response
    const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePart || !('inlineData' in imagePart)) return null
    const buffer = Buffer.from((imagePart as { inlineData: { data: string } }).inlineData.data, 'base64')

    const um = response.usageMetadata
    await insertPartnerAiTokenUsage({
      partner_id: input.partnerId,
      provider: 'google',
      model: IMAGE_MODEL,
      prompt_tokens: Math.max(0, um?.promptTokenCount ?? 0),
      completion_tokens: Math.max(0, um?.candidatesTokenCount ?? 0),
      total_tokens: Math.max(0, um?.totalTokenCount ?? 0),
      usage_kind: 'image_landing_material',
    })
    void trackFromUsageMetadata(um, IMAGE_MODEL, 'ladipage-ai-material-image', null, '2K')

    const up = await uploadPartnerChatImageBuffer(input.partnerId, buffer, 'image/png')
    if ('error' in up) {
      console.warn('[landing-ai-material-image] upload failed', up.error)
      return null
    }
    return { imageUrl: up.publicUrl }
  } catch (e) {
    console.warn('[landing-ai-material-image] gemini image gen failed', e)
    return null
  }
}
