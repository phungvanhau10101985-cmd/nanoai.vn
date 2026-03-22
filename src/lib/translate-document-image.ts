import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const TARGET_LANGUAGES: Record<string, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  ja: 'Japanese (Tiếng Nhật)',
  ko: 'Korean (Tiếng Hàn)',
  zh: 'Chinese (Tiếng Trung)',
  'zh-tw': 'Chinese Traditional (Tiếng Trung phồn thể)',
  th: 'Thai (Tiếng Thái)',
  id: 'Indonesian (Tiếng Indonesia)',
  ms: 'Malay (Tiếng Mã Lai)',
  fr: 'French (Tiếng Pháp)',
  de: 'German (Tiếng Đức)',
  es: 'Spanish (Tiếng Tây Ban Nha)',
  it: 'Italian (Tiếng Ý)',
  pt: 'Portuguese (Tiếng Bồ Đào Nha)',
  ru: 'Russian (Tiếng Nga)',
  ar: 'Arabic (Tiếng Ả Rập)',
  hi: 'Hindi (Tiếng Hindi)',
}

/** Định dạng JSON: danh sách từ/cụm từ và tọa độ bbox (x, y, width, height) theo pixel */
export interface WordWithBbox {
  text: string
  bbox: { x: number; y: number; width: number; height: number }
}

function buildTranslatePrompt(sourceLang: string, sourceLang2: string | null, targetLang: string): string {
  const targetName = TARGET_LANGUAGES[targetLang] || targetLang
  const isAuto = sourceLang === 'auto' || !sourceLang
  const sourceDesc = isAuto
    ? 'Detect the source language(s) in the document automatically.'
    : sourceLang2
      ? `${TARGET_LANGUAGES[sourceLang] || sourceLang} and ${TARGET_LANGUAGES[sourceLang2] || sourceLang2}`
      : TARGET_LANGUAGES[sourceLang] || sourceLang
  const translateRule = isAuto
    ? `Translate slowly and carefully. Translate 100% of all source text to ${targetName}. Do not skip or omit any text.`
    : `Translate slowly and carefully. Translate 100% of all text from ${sourceDesc} to ${targetName}. Do not skip or omit any text.`
  return `Translate the document image: replace all text from ${sourceDesc} to ${targetName}. Do NOT modify graphics, layout, logos, or images.

SOURCE: ${sourceDesc}. TARGET: ${targetName}.

Requirements: Output the translated image in PNG format.

Rules:
- ${translateRule} Never translate brand/company names (SANY, Caterpillar, Toyota, etc.).
- Keep numbers, units (mm, kg, °C), formulas, and codes unchanged.
- Preserve font style, size, and relative position.

OUTPUT: PNG image only.`
}

export async function translateOneImage(
  genAI: GoogleGenerativeAI,
  imageBuffer: Buffer,
  imageMime: string,
  sourceLang: string,
  targetLang: string,
  imageQuality: '2K' | '4K',
  userId: string,
  sourceLang2?: string | null,
  options?: { retryRound?: number; logPrefix?: string }
): Promise<{ buffer: Buffer; error?: string; words?: WordWithBbox[] }> {
  const prefix = options?.logPrefix ?? '[Gemini]'
  const retryRound = options?.retryRound ?? 1
  const imageToSend = imageBuffer
  const inputSizeKb = Math.round(imageToSend.length / 1024)
  console.log(`${prefix} [Dịch ảnh] Bắt đầu | input: ${inputSizeKb}KB | ${sourceLang}${sourceLang2 ? '+' + sourceLang2 : ''}→${targetLang} | quality=${imageQuality} | lần=${retryRound}`)

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality },
    },
  })
  const mimeToSend = imageMime || 'image/png'
  const imagePart = { inlineData: { data: imageToSend.toString('base64'), mimeType: mimeToSend } }
  const prompt = buildTranslatePrompt(sourceLang, sourceLang2 || null, targetLang)
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  console.log(`${prefix} [Dịch ảnh] Gửi request tới Gemini...`)
  const result = await model.generateContent([prompt, imagePart], { safetySettings })
  const response = result.response

  const usage = response.usageMetadata
  const candidate = response.candidates?.[0]
  const promptFeedback = response.promptFeedback

  console.log(`${prefix} [Dịch ảnh] Response | usage:`, JSON.stringify(usage ?? {}))
  if (promptFeedback) console.log(`${prefix} [Dịch ảnh] promptFeedback:`, JSON.stringify(promptFeedback))
  if (candidate) {
    console.log(`${prefix} [Dịch ảnh] finishReason:`, candidate.finishReason)
    const parts = candidate.content?.parts ?? []
    console.log(`${prefix} [Dịch ảnh] parts:`, parts.length, '| types:', parts.map((p) => ('inlineData' in p ? 'image' : 'text')).join(', '))
  } else {
    console.log(`${prefix} [Dịch ảnh] Không có candidate`)
  }

  trackFromUsageMetadata(usage, 'gemini-3-pro-image-preview', 'dich-anh-tai-lieu', userId, imageQuality)

  const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imagePartRes || !('inlineData' in imagePartRes)) {
    const textPart = response.candidates?.[0]?.content?.parts?.find((p) => 'text' in p)
    const textPreview = textPart && 'text' in textPart ? String(textPart.text).slice(0, 200) : ''
    console.log(`${prefix} [Dịch ảnh] LỖI: Không có ảnh trong response | finishReason:`, candidate?.finishReason, '| text:', textPreview)
    return { buffer: Buffer.alloc(0), error: 'AI không trả về ảnh hợp lệ.' }
  }

  const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
  console.log(`${prefix} [Dịch ảnh] Nhận ảnh:`, Math.round(resultBuffer.length / 1024), 'KB | heap:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB')

  let words: WordWithBbox[] = []
  const textPart = response.candidates?.[0]?.content?.parts?.find((p) => 'text' in p)
  if (textPart && 'text' in textPart) {
    const rawText = String(textPart.text)
    const jsonMatch = rawText.match(/\{[\s\S]*"words"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { words?: Array<{ text: string; bbox?: { x: number; y: number; width: number; height: number } }> }
        if (Array.isArray(parsed.words)) {
          words = parsed.words
            .filter((w) => w?.text && w?.bbox)
            .map((w) => ({ text: w.text, bbox: w.bbox! }))
          console.log(`${prefix} [Dịch ảnh] JSON từ/tọa độ:`, words.length, 'đoạn')
        }
      } catch (e) {
        console.log(`${prefix} [Dịch ảnh] Không parse được JSON từ response:`, e instanceof Error ? e.message : e)
      }
    }
  }

  console.log(`${prefix} [Dịch ảnh] Hoàn thành`)
  return { buffer: resultBuffer, words: words.length > 0 ? words : undefined }
}
