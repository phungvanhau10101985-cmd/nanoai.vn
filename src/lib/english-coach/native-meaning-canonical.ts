import { createHash } from 'node:crypto'
import { normalizeDialogueMeaningKey } from '@/lib/english-coach/dialogue-meaning-key'

/** Ngôi thứ nhất cố định, để «em / mình / I / 我» cùng một ý ra một khóa. */
export function nativeFirstPerson(nativeLanguageCode: string, nativeLanguage: string): string {
  const code = String(nativeLanguageCode || '').trim().toLowerCase()
  const label = String(nativeLanguage || '').trim().toLowerCase()
  if (code === 'vi' || label.includes('vietnam') || label.includes('tiếng việt')) return 'Tôi'
  if (code === 'en' || label === 'english' || label.includes('tiếng anh')) return 'I'
  if (code === 'zh' || label.includes('chinese') || label.includes('tiếng trung')) return '我'
  if (code === 'ja' || label.includes('japan') || label.includes('tiếng nhật')) return '私'
  if (code === 'ko' || label.includes('korean') || label.includes('tiếng hàn')) return '나'
  if (code === 'th' || label.includes('thai') || label.includes('tiếng thái')) return 'ฉัน'
  if (code === 'hi' || label.includes('hindi')) return 'मैं'
  return 'Tôi'
}

/** Quy tắc dùng chung cho prompt dịch mic và lần chuẩn hóa câu gõ. */
export function nativeMeaningCanonicalRules(nativeLanguage: string, nativeLanguageCode: string): string {
  const person = nativeFirstPerson(nativeLanguageCode, nativeLanguage)
  const vi = person === 'Tôi'
  return [
    `Câu chuẩn viết bằng ${nativeLanguage}, đúng một mệnh đề.`,
    `Ngôi thứ nhất là "${person}".`,
    'Bỏ từ đệm và cách xưng hô khác.',
    vi ? 'Tiếng Việt dùng "Tôi". Không dùng em, mình, con, ạ, nhé, dạ, vâng.' : '',
    'Giữ đồ vật, tên riêng, phủ định và số lượng. Không đổi ý này thành ý khác.',
    'Không câu thứ hai, không chú thích, không phiên âm.',
  ].filter(Boolean).join('\n')
}

export function buildSpeechMeaningPrompt(input: {
  text: string
  nativeLanguage: string
  nativeLanguageCode: string
  targetLanguage: string
}): string {
  const nativeLanguage = String(input.nativeLanguage || 'Vietnamese').trim()
  const targetLanguage = String(input.targetLanguage || 'English').trim()
  const text = String(input.text || '').replace(/\s+/g, ' ').trim()
  return `Dịch đúng một cụm lời nói của học viên sang ${nativeLanguage}.
Cụm có thể là ${targetLanguage}, ${nativeLanguage}, hoặc trộn cả hai.
${nativeMeaningCanonicalRules(nativeLanguage, input.nativeLanguageCode)}

Cụm: ${text}

JSON, không markdown:
{ "meaning": "..." }`
}

export function buildTypedMeaningCanonicalPrompt(input: {
  text: string
  nativeLanguage: string
  nativeLanguageCode: string
}): string {
  const nativeLanguage = String(input.nativeLanguage || 'Vietnamese').trim()
  const text = String(input.text || '').replace(/\s+/g, ' ').trim()
  return `Viết lại câu tiếng mẹ đẻ của học viên thành câu chuẩn để làm khóa cache.
${nativeMeaningCanonicalRules(nativeLanguage, input.nativeLanguageCode)}

Câu: ${text}

JSON, không markdown:
{ "meaning": "..." }`
}

export function meaningCanonicalCacheKey(nativeLanguageCode: string, source: string): string {
  const key = `${String(nativeLanguageCode || '').trim().toLowerCase()}\n${normalizeDialogueMeaningKey(source)}`
  return createHash('sha256').update(key).digest('hex')
}

export function parseCanonicalMeaning(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  const read = (value: string) => {
    try {
      const parsed = JSON.parse(value) as { meaning?: unknown }
      return String(parsed.meaning || '').replace(/\s+/g, ' ').trim()
    } catch {
      return ''
    }
  }
  const direct = read(cleaned)
  if (direct) return direct
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) return read(cleaned.slice(first, last + 1))
  return ''
}
