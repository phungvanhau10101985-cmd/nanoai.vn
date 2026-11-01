import { createGoogleGenerativeAIForUser } from '@/lib/ai/google-api-key-resolver'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  acceptPolishedGuestName,
  parseWeddingGuestBulkText,
  splitWeddingGuestBulkBatch,
  WEDDING_GUEST_BULK_AI_CHUNK_CHARS,
  WEDDING_GUEST_BULK_HONORIFICS,
  WEDDING_GUEST_BULK_MAX_CHARS,
  weddingGuestBulkNameKey,
  weddingGuestsFromArrangedRows,
  type WeddingGuestBulkName,
  type WeddingGuestBulkReject,
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

async function arrangeWeddingGuestBulkPiece(userId: string, source: string) {
  const genAI = await createGoogleGenerativeAIForUser(userId)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' },
  })
  const prompt = [
    'Tách khách mời đám cưới từ đoạn chữ tiếng Việt viết tự do.',
    'Chữ có thể bất quy tắc: dính liền, thiếu dấu, sai chính tả, gõ telex (banj = bạn, luongw = lương), hoa thường lẫn, nhiều dấu câu, số thứ tự, gạch đầu dòng.',
    'Phải tách hết người trong đoạn này. Không bỏ khách chỉ vì viết sai. Không dừng giữa danh sách.',
    'Mỗi khách trả về tên đầy đủ gồm danh xưng và tên, không viết dính nhiều người trong một tên.',
    'Ví dụ "bạn Hoa Bạn Mai Bạn Lương" là đúng 3 khách: Bạn Hoa, Bạn Mai, Bạn Lương.',
    `Danh xưng chỉ được chọn trong danh sách, sửa về dạng đúng trong danh sách: ${WEDDING_GUEST_BULK_HONORIFICS.join(', ')}.`,
    'Sửa dấu và chính tả của tên khi chắc chắn cùng một người. Giữ đúng người, đúng thứ tự.',
    'Không thêm người không có trong chữ. Không bịa danh xưng cho tên đứng một mình.',
    'Tên không kèm danh xưng thì bỏ qua.',
    'Trả JSON array. Mỗi phần tử là {"honorific":"...","name":"..."}.',
    source,
  ].join('\n')
  const result = await model.generateContent(prompt)
  void trackFromUsageMetadata(result.response.usageMetadata, MODEL, 'wedding-guest-bulk-arrange', userId)
  const rows = extractJsonArray(result.response.text())
  if (!rows) return null
  return weddingGuestsFromArrangedRows(rows)
}

/** Tách đoạn chữ tự do thành danh sách khách. Chia đoạn để AI trả hết, không cắt giữa danh sách. */
export async function arrangeWeddingGuestBulkText(userId: string, text: string) {
  const source = text.trim().slice(0, WEDDING_GUEST_BULK_MAX_CHARS)
  if (!source) return { guests: [], rejected: [] }
  const guests: WeddingGuestBulkName[] = []
  const rejected: WeddingGuestBulkReject[] = []
  const seen = new Set<string>()
  let rest = source
  while (rest.trim()) {
    const cut = splitWeddingGuestBulkBatch(rest, WEDDING_GUEST_BULK_AI_CHUNK_CHARS)
    if (!cut.batch.trim()) break
    const local = parseWeddingGuestBulkText(cut.batch)
    let chosen = local
    try {
      const arranged = await arrangeWeddingGuestBulkPiece(userId, cut.batch)
      if (arranged && arranged.guests.length >= local.guests.length) chosen = arranged
    } catch (error) {
      console.warn('[wedding-guest-bulk] AI arrange skipped:', error instanceof Error ? error.message : error)
    }
    for (const guest of chosen.guests) {
      const key = weddingGuestBulkNameKey(guest.honorific, guest.name)
      if (seen.has(key)) continue
      seen.add(key)
      guests.push(guest)
    }
    rejected.push(...chosen.rejected)
    if (!cut.rest || cut.rest === rest) break
    rest = cut.rest
  }
  return { guests, rejected }
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
      generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' },
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
