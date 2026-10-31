import { invitationEditorCopy, normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'

/** Bốn đoạn AI điền khi khách chọn mẫu: mở đầu, quote, câu chuyện, lời cảm ơn. */
export const WEDDING_SAMPLE_COMPOSE_FIELDS = ['coupleIntro', 'loveQuote', 'storyText', 'thankYouText'] as const

/** Soạn lời khi chọn mẫu: miễn phí. Tối ưu AI từng đoạn sau đó vẫn trừ riêng. */
export const WEDDING_SAMPLE_COMPOSE_CREDIT = 0

export const WEDDING_SAMPLE_COMPOSE_LIMITS = {
  coupleIntro: 2000,
  loveQuote: 600,
  storyText: 2000,
  thankYouText: 2000,
} as const

export type WeddingSampleComposeCopy = {
  coupleIntro: string
  loveQuote: string
  storyText: string
  thankYouText: string
}

export type WeddingSampleComposeFields = WeddingSampleComposeCopy & {
  groomName: string
  brideName: string
}

/** Gợi ý ngày gặp nhau chỉ khi mẫu là thiệp cưới. */
export function weddingSampleShowsLoveStoryHints(sample: { occasionKey?: string | null }): boolean {
  return normalizeInvitationOccasion(sample.occasionKey ?? 'wedding') === 'wedding'
}

export function appendWeddingComposeSuggestion(notes: string, line: string): string {
  const marker = line.replace(/:\s*$/, '').trim()
  if (!marker) return notes
  if (notes.includes(marker)) return notes
  const trimmed = notes.trim()
  return trimmed ? `${trimmed}\n${line}` : line
}

export function applyComposeCopyToCard<
  T extends {
    groomName: string
    brideName: string
    coupleIntro: string
    loveQuote: string
    storyText: string
    thankYouText: string
    dressCode: string
  },
>(card: T, copy: WeddingSampleComposeFields, sampleDressCode?: string): T {
  return {
    ...card,
    groomName: copy.groomName,
    brideName: copy.brideName,
    coupleIntro: copy.coupleIntro,
    loveQuote: copy.loveQuote,
    storyText: copy.storyText,
    thankYouText: copy.thankYouText,
    dressCode: card.dressCode.trim() ? card.dressCode : sampleDressCode?.trim() || card.dressCode,
  }
}

function clipField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function parseWeddingSampleComposeCopy(raw: string): WeddingSampleComposeCopy | null {
  let text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const json = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const copy: WeddingSampleComposeCopy = {
      coupleIntro: clipField(json.coupleIntro, WEDDING_SAMPLE_COMPOSE_LIMITS.coupleIntro),
      loveQuote: clipField(json.loveQuote, WEDDING_SAMPLE_COMPOSE_LIMITS.loveQuote),
      storyText: clipField(json.storyText, WEDDING_SAMPLE_COMPOSE_LIMITS.storyText),
      thankYouText: clipField(json.thankYouText, WEDDING_SAMPLE_COMPOSE_LIMITS.thankYouText),
    }
    if (!copy.coupleIntro || !copy.loveQuote || !copy.storyText || !copy.thankYouText) return null
    return copy
  } catch {
    return null
  }
}

export function buildWeddingSampleComposePrompt(input: {
  groomName: string
  brideName: string
  storyNotes: string
  weddingDate?: string
  occasionKey?: string | null
}): string {
  const occasionKey = normalizeInvitationOccasion(input.occasionKey ?? 'wedding')
  const editor = invitationEditorCopy(occasionKey)
  const wedding = occasionKey === 'wedding'
  const notes = input.storyNotes.trim()
  const names = [input.groomName.trim(), input.brideName.trim()].filter(Boolean).join(' và ')
  const lines = [
    `Loại thiệp: ${editor.label}.`,
    `Tên: ${names}.`,
    input.weddingDate?.trim() ? `Ngày trên thiệp (chỉ nhắc nếu hợp đoạn): ${input.weddingDate.trim()}.` : '',
    wedding
      ? 'Viết tiếng Việt, giọng thiệp cưới: thi vị, ấm, không khẩu hiệu, không sáo rỗng.'
      : `Viết tiếng Việt, giọng phù hợp ${editor.label}, trang nhã, không khẩu hiệu.`,
    'Cấm địa chỉ, tên đường, tên nhà hàng, thôn xã, quận huyện và cụm «tại …».',
    notes
      ? 'Chỉ dùng sự kiện khách đã ghi bên dưới. Cấm bịa thêm ngày gặp, nơi gặp, nghề, quê, tên bố mẹ hay kỷ niệm không có trong ghi chú.'
      : 'Khách chưa kể chuyện. Viết chung chung từ hai tên. Cấm bịa ngày gặp, nơi gặp, nghề, quê, tên bố mẹ hay một kỷ niệm cụ thể.',
    'Trả về đúng một JSON, không markdown, với bốn khóa:',
    '- coupleIntro: lời mở đầu, 2–4 câu.',
    '- loveQuote: đúng một câu ngắn, khoảng 8–14 từ, không ngoặc kép hai đầu.',
    '- storyText: câu chuyện, 2–4 câu.',
    '- thankYouText: lời cảm ơn, 1–2 câu. Có thể dùng tên hai người.',
    notes ? `Ghi chú của khách:\n${notes}` : '',
  ]
  return lines.filter(Boolean).join('\n\n')
}
