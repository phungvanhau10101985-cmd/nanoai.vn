import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { UI_MOCKUP_CREDIT } from '@/lib/hub-chat/hub-studio-types'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const toTenths = (value: number) => Math.round(value * 10)

const OUTPAINT_PROMPT = `Extend this packaging/banner artwork using AI outpainting.
The flat-colored bands at the edges are empty areas that must be filled with background matching the original center artwork.
- ONLY paint inside the flat-colored edge bands. The center region with product, logo and text must stay pixel-identical — do not redraw, blur, move or alter any part of the center artwork.
- Seamlessly continue gradients, textures, leaf shadows, lighting and colors from the existing image into the edge bands only.
- Do NOT add new text, logos, watermarks or extra objects anywhere.
- Keep the same canvas size and aspect ratio as the input image.
Return one final image only.`

export type FaceCropOutpaintResult =
  | { ok: true; resultUrl: string; charged: number }
  | { ok: false; error: string }

export async function runFaceCropOutpaint(input: {
  userId: string
  imageBuffer: Buffer
  mimeType: string
  aspectRatio: string
}): Promise<FaceCropOutpaintResult> {
  let balance = 0
  try {
    balance = await getCreditBalanceByUserId(input.userId)
  } catch {
    return { ok: false, error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balance) < toTenths(UI_MOCKUP_CREDIT)) {
    return { ok: false, error: `Không đủ credits (cần ${UI_MOCKUP_CREDIT}).` }
  }

  const { apiKey } = await requireGoogleApiKeyForUser(input.userId)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K' },
    },
  })

  const prompt = `${OUTPAINT_PROMPT}\nTarget aspect ratio: ${input.aspectRatio}.`
  const imagePart = {
    inlineData: { data: input.imageBuffer.toString('base64'), mimeType: input.mimeType || 'image/png' },
  }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent([prompt, imagePart], { safetySettings })
    trackFromUsageMetadata(
      result.response.usageMetadata,
      GEMINI_3_PRO_IMAGE.model,
      'hub-studio-crop-outpaint',
      input.userId,
      '2K'
    )
    const imagePartRes = result.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      return { ok: false, error: 'AI không trả về ảnh.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${input.userId}/studio_crop_outpaint_${Date.now()}.png`
    const { publicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })
    const deduct = await deductUserCredits(input.userId, UI_MOCKUP_CREDIT)
    if (!deduct.ok) {
      return { ok: false, error: deduct.error || 'Không thể trừ credits.' }
    }
    return { ok: true, resultUrl: publicUrl, charged: UI_MOCKUP_CREDIT }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { ok: false, error: 'Hệ thống quá tải. Vui lòng thử lại sau ít phút.' }
    }
    return { ok: false, error: msg }
  }
}
