import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { buildTransparentPngFromMask } from '@/lib/mask-to-transparent'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import {
  removeBgMaskPrompt,
  type RemoveBgMaskVariant,
} from '@/lib/remove-background-png-prompts'

export type { RemoveBgMaskVariant } from '@/lib/remove-background-png-prompts'
export {
  LOGO_REMOVE_BG_MASK_PROMPT,
  PRODUCT_REMOVE_BG_MASK_PROMPT,
  REMOVE_BG_PNG_CREDIT,
  chargedCreditsForLogoCreate,
  removeBgMaskPrompt,
  requiredCreditsForLogoCreate,
} from '@/lib/remove-background-png-prompts'

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

/** Engine `/xoa-nen-png`: Gemini mask + PIL alpha. Throw nếu không có mask. */
export async function buildTransparentPngWithGeminiMask(input: {
  apiKey: string
  userId: string
  feature: string
  imageBuffer: Buffer
  mimeType?: string
  variant: RemoveBgMaskVariant
  imageSize?: '2K' | '4K'
}): Promise<Buffer> {
  const mimeType = input.mimeType || 'image/png'
  const imageSize = input.imageSize || '2K'
  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize },
    },
  })
  const imagePart = { inlineData: { data: input.imageBuffer.toString('base64'), mimeType } }
  const gemResult = await model.generateContent([removeBgMaskPrompt(input.variant), imagePart] as never, {
    safetySettings: SAFETY_SETTINGS,
  } as never)
  const response = gemResult.response
  trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, input.feature, input.userId, imageSize)

  const maskPart = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!maskPart || !('inlineData' in maskPart)) {
    throw new Error('AI không trả về ảnh mask hợp lệ.')
  }
  const maskBuffer = Buffer.from((maskPart as { inlineData: { data: string } }).inlineData.data, 'base64')
  return buildTransparentPngFromMask(input.imageBuffer, maskBuffer)
}

/**
 * Post-process logo AI → PNG trong suốt (cùng engine `/xoa-nen-png`).
 * Mask thành công → caller trừ `REMOVE_BG_PNG_CREDIT`. Mask lỗi → giữ ảnh gốc, không trừ bước xóa nền.
 */
export async function stripLogoBackgroundToTransparentPng(input: {
  apiKey: string
  userId: string
  feature: string
  imageBuffer: Buffer
  mimeType?: string
}): Promise<{ buffer: Buffer; removed: boolean }> {
  try {
    const buffer = await buildTransparentPngWithGeminiMask({
      ...input,
      variant: 'logo',
      imageSize: '2K',
    })
    return { buffer, removed: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[logo-remove-bg] mask failed, keep original logo:', msg)
    return { buffer: input.imageBuffer, removed: false }
  }
}
