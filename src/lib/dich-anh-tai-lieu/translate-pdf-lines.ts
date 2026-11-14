import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'
import { documentTranslatePromptName } from '@/lib/document-translate-languages'
import { keepTermsPromptBlock } from '@/lib/dich-anh-tai-lieu/pdf-keep-terms'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

function parseLinesJson(raw: string): string[] {
  const fenced = raw.replace(/```json/gi, '').replace(/```/g, '')
  const match = /\{[\s\S]*"lines"[\s\S]*\}/.exec(fenced)
  if (!match) throw new Error('Không có JSON dòng chữ.')
  const parsed = JSON.parse(match[0]) as { lines?: unknown }
  if (!Array.isArray(parsed.lines)) throw new Error('JSON thiếu mảng lines.')
  return parsed.lines.map((line) => (typeof line === 'string' ? line : String(line ?? '')))
}

/** Đọc chữ đang hiện trên ảnh đã dịch, để gắn lớp copy. Không dịch lại. */
export async function readVisibleLines(input: {
  genAI: GoogleGenerativeAI
  userId: string
  png: Buffer
}): Promise<string[]> {
  const model = input.genAI.getGenerativeModel({ model: GEMINI_25_FLASH_TEXT_NO_THINKING.model })
  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/png', data: input.png.toString('base64') } },
    'Read every visible text line from top to bottom. Return JSON only, no markdown: {"lines":["..."]}. Copy the text as printed. Do not translate. Do not invent a line.',
  ])
  await trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_FLASH_TEXT_NO_THINKING.model,
    'dich-anh-tai-lieu',
    input.userId,
    null
  )
  return parseLinesJson(result.response.text()).map((line) => line.trim()).filter(Boolean)
}

/** Dịch từng dòng, giữ số dòng. Dòng thiếu thì giữ câu gốc để ô chữ không bị trống. */
export async function translatePdfLines(input: {
  genAI: GoogleGenerativeAI
  userId: string
  sourceLang: string
  targetLang: string
  lines: string[]
  keepTerms: string[]
}): Promise<string[]> {
  const targetName = documentTranslatePromptName(input.targetLang)
  const sourceName =
    input.sourceLang === 'auto' || !input.sourceLang
      ? 'Detect the source language.'
      : documentTranslatePromptName(input.sourceLang)
  const numbered = input.lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
  const prompt = `Translate each numbered line into ${targetName}. SOURCE: ${sourceName}.
Return JSON only, no markdown: {"lines":["..."]}
The lines array must contain exactly ${input.lines.length} strings, in the same order.
Keep digits, model codes, phone numbers, emails, and URLs unchanged.
Do not merge lines. Do not add a line. Do not drop a line. If a line should stay as written, copy it.
${keepTermsPromptBlock(input.keepTerms)}
LINES:
${numbered}`
  const model = input.genAI.getGenerativeModel({ model: GEMINI_25_FLASH_TEXT_NO_THINKING.model })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  await trackFromUsageMetadata(result.response.usageMetadata, GEMINI_25_FLASH_TEXT_NO_THINKING.model, 'dich-anh-tai-lieu', input.userId, null)
  const translated = parseLinesJson(text)
  return input.lines.map((original, index) => {
    const line = translated[index]
    return typeof line === 'string' && line.trim() ? line : original
  })
}
