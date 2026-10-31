import { createGoogleGenerativeAIForUser } from '@/lib/ai/google-api-key-resolver'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  acceptPolishedGuestName,
  type WeddingGuestBulkName,
} from '@/lib/wedding/wedding-guest-bulk-names'

const MODEL = 'gemini-2.5-flash-lite'

function extractJsonArray(raw: string): unknown[] | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Chuẩn hóa dấu và hoa thường. Danh xưng giữ nguyên vì đã tách trước. */
export async function polishWeddingGuestBulkNames(
  userId: string,
  guests: WeddingGuestBulkName[],
): Promise<WeddingGuestBulkName[]> {
  if (!guests.length) return guests
  try {
    const genAI = await createGoogleGenerativeAIForUser(userId)
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    })
    const lines = guests.map((guest, index) => `${index + 1}. ${guest.honorific} ${guest.name}`).join('\n')
    const prompt = [
      'Chuẩn hóa danh sách khách mời tiếng Việt.',
      'Giữ nguyên số dòng, thứ tự và danh xưng. Chỉ sửa hoa thường và dấu thanh của phần tên.',
      'Không thêm khách, không đổi người, không bịa danh xưng.',
      'Trả JSON array đúng số phần tử, mỗi phần tử là {"name":"..."} — chỉ phần tên, không kèm danh xưng.',
      lines,
    ].join('\n')
    const result = await model.generateContent(prompt)
    void trackFromUsageMetadata(result.response.usageMetadata, MODEL, 'wedding-guest-bulk-names', userId)
    const rows = extractJsonArray(result.response.text())
    if (!rows || rows.length !== guests.length) return guests
    return guests.map((guest, index) => {
      const row = rows[index]
      const polished = row && typeof row === 'object' && 'name' in row ? String((row as { name?: unknown }).name ?? '') : ''
      return { ...guest, name: acceptPolishedGuestName(guest.name, polished) }
    })
  } catch (error) {
    console.warn('[wedding-guest-bulk] AI normalize skipped:', error instanceof Error ? error.message : error)
    return guests
  }
}
