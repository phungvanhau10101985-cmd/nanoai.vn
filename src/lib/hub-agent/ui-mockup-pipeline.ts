import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { UI_MOCKUP_CREDIT } from '@/lib/hub-chat/hub-studio-types'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

const toTenths = (value: number) => Math.round(value * 10)

export type RunUiMockupInput = {
  userId: string
  screenLabel: string
  brief: string
  projectTitle?: string
  referenceImageUrls?: string[]
}

export type RunUiMockupResult =
  | { ok: true; resultUrl: string; charged: number }
  | { ok: false; error: string }

export async function runUiMockupPipeline(input: RunUiMockupInput): Promise<RunUiMockupResult> {
  const briefEn = await normalizeToEnglish(input.brief)
  const screenEn = await normalizeToEnglish(input.screenLabel)
  const projectEn = input.projectTitle ? await normalizeToEnglish(input.projectTitle) : 'mobile shopping app'

  let balance = 0
  try {
    balance = await getCreditBalanceByUserId(input.userId)
  } catch {
    return { ok: false, error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balance) < toTenths(UI_MOCKUP_CREDIT)) {
    return { ok: false, error: `Không đủ credits (cần ${UI_MOCKUP_CREDIT}).` }
  }

  const styleNote =
    input.referenceImageUrls?.length ?
      'Match the visual style, color palette, typography mood, and component language of the attached reference screen(s). Keep consistency across the app.'
    : 'Modern, clean mobile e-commerce UI. Professional Figma-like mockup quality.'

  const prompt = `Design a high-fidelity MOBILE APP UI mockup screen (portrait phone frame).
Project: ${projectEn}
Screen: ${screenEn}
User requirements: ${briefEn}
${styleNote}
Show realistic mobile layout with status bar, navigation, cards, buttons, and readable placeholder text in the design language.
Flat UI design mockup only — return ONE image of the screen, no extra explanation text on the image borders.`

  const { apiKey } = await requireGoogleApiKeyForUser(input.userId)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: '9:16' },
    },
  })

  const parts: object[] = [{ text: prompt }]
  for (const url of input.referenceImageUrls ?? []) {
    const loaded = await loadImageBufferFromUrl(url)
    if (loaded) {
      parts.push({
        inlineData: { data: loaded.buffer.toString('base64'), mimeType: loaded.mimeType || 'image/png' },
      })
    }
  }

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent(parts as never, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'hub-studio-ui', input.userId, '2K')
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      return { ok: false, error: 'AI không trả về ảnh giao diện.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${input.userId}/studio_ui_${Date.now()}.png`
    const { publicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(input.userId, UI_MOCKUP_CREDIT, 'hub-studio-ui')
    if (!d.ok) return { ok: false, error: d.error || 'Không thể trừ credits.' }

    return { ok: true, resultUrl: publicUrl, charged: UI_MOCKUP_CREDIT }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Tạo giao diện thất bại: ${msg}` }
  }
}
