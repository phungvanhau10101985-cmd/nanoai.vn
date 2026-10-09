import sharp from 'sharp'
import { imageLocInkBleedModel } from './image-localization-config'
import { ImageLocalizationError } from './gemini-adapter'
import { parseInkBleedVerdict } from './gpt-verify'

const PROMPT = `Look only for ink bleed on the printed text: strokes that smear, a gray or colored halo around letters, or color running into the background past the letter edge. Normal anti-aliasing and a flat filled background are not bleed.
Return JSON only: {"bleed":false,"where":""}
If bleed is true, "where" is a short place such as "size table" or "laundry text".`

function geminiTextKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
}

async function previewJpeg(imageBytes: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBytes, { limitInputPixels: false }).metadata()
  const width = meta.width || 1
  const height = meta.height || 1
  const longEdge = Math.max(width, height)
  const pipeline = sharp(imageBytes, { limitInputPixels: false })
  if (longEdge > 1600) {
    pipeline.resize({ width: width >= height ? 1600 : undefined, height: height > width ? 1600 : undefined, fit: 'inside' })
  }
  return pipeline.jpeg({ quality: 80 }).toBuffer()
}

/** Gemini Flash-Lite nhìn ảnh và trả có mực loang hay không. Không vẽ lại. */
export async function detectInkBleed(imageBytes: Buffer): Promise<{ bleed: boolean; where: string }> {
  const apiKey = geminiTextKey()
  if (apiKey.length < 10) {
    throw new ImageLocalizationError('Thiếu GOOGLE_API_KEY để kiểm tra mực loang.')
  }
  const jpeg = await previewJpeg(imageBytes)
  const model = imageLocInkBleedModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 45_000)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 120, responseMimeType: 'application/json' },
      }),
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ImageLocalizationError(`Kiểm tra mực loang lỗi HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const body = (await res.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  } | null
  const raw = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
  const verdict = parseInkBleedVerdict(raw)
  if (!verdict) throw new ImageLocalizationError('Kiểm tra mực loang không trả JSON dùng được.')
  return verdict
}
