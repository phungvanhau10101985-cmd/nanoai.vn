import { invitationComposeBrief, invitationComposeNamesReady } from '@/lib/wedding/invitation-compose'
import { invitationEditorCopy, normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { isWeddingSamplePhotoUrl } from '@/lib/wedding/wedding-sample-cards'
import { mergeWeddingSectionConfig, parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'

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

/** Tên đủ để khỏi hỏi lại. Cưới, hỏi, kỷ niệm cần hai tên. Loại một người chỉ cần tên chính. */
export function weddingCoupleNamesReady(
  source: { groomName?: string | null; brideName?: string | null },
  occasionKey: unknown,
): boolean {
  return invitationComposeNamesReady({
    occasionKey,
    primaryName: source.groomName,
    secondaryName: source.brideName,
  })
}

export type WeddingSampleNameReuse = { ask: true } | { ask: false; donorId: string | null }

/**
 * Modal tên chỉ khi thiệp đang mở và các thiệp đã lưu chưa đủ tên của đúng loại.
 * Đủ tên thì giữ thiệp đó. Thiệp khác đã đủ tên thì bê sang mẫu mới.
 */
export function resolveWeddingSampleNameReuse(input: {
  current: { id?: string; groomName?: string | null; brideName?: string | null }
  saved: Array<{ id?: string; groomName?: string | null; brideName?: string | null }>
  occasionKey: unknown
}): WeddingSampleNameReuse {
  if (weddingCoupleNamesReady(input.current, input.occasionKey)) return { ask: false, donorId: null }
  const donor = input.saved.find(
    (row) => Boolean(row.id) && row.id !== input.current.id && weddingCoupleNamesReady(row, input.occasionKey),
  )
  if (donor?.id) return { ask: false, donorId: donor.id }
  return { ask: true }
}

/** Thiệp mới chỉ dùng ngày khách vừa gõ. Không lấy ngày hay địa chỉ của thiệp đang mở. */
export function newCardComposeSources(input: {
  creating: boolean
  composeDate: string
  openDate?: string | null
  openAddresses?: string[]
}): { weddingDate: string; addresses: string[] } {
  const typed = input.composeDate.trim()
  if (input.creating) return { weddingDate: typed, addresses: [] }
  return {
    weddingDate: typed || String(input.openDate ?? '').trim(),
    addresses: input.openAddresses ?? [],
  }
}

const WEDDING_SAMPLE_TEXT_FACTS = [
  'groomName',
  'brideName',
  'weddingTime',
  'partyStartTime',
  'venue',
  'mapUrl',
  'invitationText',
  'invitationTextEn',
  'storyText',
  'coupleIntro',
  'loveQuote',
  'eventTimeline',
  'dressCode',
  'thankYouText',
  'groomParents',
  'brideParents',
  'groomHometown',
  'brideHometown',
  'groomInviteAddress',
  'groomInviteMapUrl',
  'groomInviteReceptionTime',
  'groomInvitePartyStartTime',
  'groomInviteText',
  'groomInviteTextEn',
  'groomInviteEventTimeline',
  'groomInviteDressCode',
  'groomInviteContact',
  'groomInviteDefaultPersonalMessage',
  'groomInviteThankYouText',
  'brideInviteAddress',
  'brideInviteMapUrl',
  'brideInviteReceptionTime',
  'brideInvitePartyStartTime',
  'brideInviteText',
  'brideInviteTextEn',
  'brideInviteEventTimeline',
  'brideInviteDressCode',
  'brideInviteContact',
  'brideInviteDefaultPersonalMessage',
  'brideInviteThankYouText',
  'musicUrl',
  'giftQrImageUrl',
  'groomGiftBankId',
  'groomGiftAccountNo',
  'groomGiftAccountName',
  'brideGiftBankId',
  'brideGiftAccountNo',
  'brideGiftAccountName',
] as const

const WEDDING_SAMPLE_PHOTO_FACTS = [
  'groomImageUrl',
  'brideImageUrl',
  'groomInviteCoverImageUrl',
  'brideInviteCoverImageUrl',
] as const

export type WeddingSampleFactCard = {
  weddingDate: string | null
  groomInviteWeddingDate: string | null
  brideInviteWeddingDate: string | null
  albumImageUrls: string[]
  musicPlayStartSec: number | null
  musicPlayEndSec: number | null
  giftQrEnabled: boolean
  sectionConfig: string
} & Record<(typeof WEDDING_SAMPLE_TEXT_FACTS)[number], string> &
  Record<(typeof WEDDING_SAMPLE_PHOTO_FACTS)[number], string>

function carryText(current: string, incoming: string): string {
  return current.trim() ? current : incoming
}

function carryPhoto(current: string, incoming: string): string {
  if (current.trim()) return current
  if (!incoming.trim() || isWeddingSamplePhotoUrl(incoming)) return current
  return incoming
}

function carryDate(current: string | null, incoming: string | null): string | null {
  return String(current ?? '').trim() ? current : incoming
}

/** Điền chỗ trống trên mẫu mới bằng thông tin thiệp đã có. Nền, khung và id thiệp mới giữ nguyên. */
export function carryWeddingSampleFacts<T extends WeddingSampleFactCard>(visual: T, donor: WeddingSampleFactCard): T {
  const next: T = { ...visual }
  for (const key of WEDDING_SAMPLE_TEXT_FACTS) next[key] = carryText(next[key], donor[key])
  for (const key of WEDDING_SAMPLE_PHOTO_FACTS) next[key] = carryPhoto(next[key], donor[key])
  next.weddingDate = carryDate(next.weddingDate, donor.weddingDate)
  next.groomInviteWeddingDate = carryDate(next.groomInviteWeddingDate, donor.groomInviteWeddingDate)
  next.brideInviteWeddingDate = carryDate(next.brideInviteWeddingDate, donor.brideInviteWeddingDate)
  if (next.albumImageUrls.length === 0) {
    const album = donor.albumImageUrls.filter((url) => url.trim() && !isWeddingSamplePhotoUrl(url))
    if (album.length) next.albumImageUrls = album
  }
  if (next.musicPlayStartSec == null && donor.musicPlayStartSec != null) next.musicPlayStartSec = donor.musicPlayStartSec
  if (next.musicPlayEndSec == null && donor.musicPlayEndSec != null) next.musicPlayEndSec = donor.musicPlayEndSec
  const visualGift = [visual.giftQrImageUrl, visual.groomGiftAccountNo, visual.brideGiftAccountNo].some((value) => value.trim())
  const donorGift = [donor.giftQrImageUrl, donor.groomGiftAccountNo, donor.brideGiftAccountNo].some((value) => value.trim())
  if (!visualGift && donorGift) next.giftQrEnabled = donor.giftQrEnabled
  const visualCover = parseWeddingSectionConfig(next.sectionConfig).coverPhotoUrl?.trim() || ''
  const donorCover = parseWeddingSectionConfig(donor.sectionConfig).coverPhotoUrl?.trim() || ''
  if (!visualCover && donorCover && !isWeddingSamplePhotoUrl(donorCover)) {
    next.sectionConfig = mergeWeddingSectionConfig(next.sectionConfig, { coverPhotoUrl: donorCover })
  }
  return next
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

export type WeddingCardOpeningCopy = {
  groomName: string
  brideName: string
  coupleIntro: string
  loveQuote: string
  storyText: string
  thankYouText: string
  weddingDate: string
}

/** Ô đang gõ trên modal thắng state React khi trình duyệt điền sẵn mà không bắn onChange. */
export function preferComposeFieldValue(stateValue: string, domValue?: string | null): string {
  const typed = String(domValue ?? '').trim()
  if (typed) return typed
  return stateValue.trim()
}

/** Phần ghi cùng lúc với insert. Rỗng hoàn toàn thì không gửi, để khỏi đè thiệp trắng. */
export function weddingCardOpeningFromCompose(
  copy: WeddingSampleComposeFields | null | undefined,
  weddingDate?: string | null,
): WeddingCardOpeningCopy | null {
  const opening: WeddingCardOpeningCopy = {
    groomName: copy?.groomName.trim() ?? '',
    brideName: copy?.brideName.trim() ?? '',
    coupleIntro: copy?.coupleIntro.trim() ?? '',
    loveQuote: copy?.loveQuote.trim() ?? '',
    storyText: copy?.storyText.trim() ?? '',
    thankYouText: copy?.thankYouText.trim() ?? '',
    weddingDate: String(weddingDate ?? '').trim(),
  }
  const hasText = [
    opening.groomName,
    opening.brideName,
    opening.coupleIntro,
    opening.loveQuote,
    opening.storyText,
    opening.thankYouText,
    opening.weddingDate,
  ].some((part) => part.length > 0)
  return hasText ? opening : null
}

/**
 * Gắn lời AI vào đúng thiệp vừa insert.
 * Ref trình soạn vẫn là thiệp đang mở cho đến lần render sau — không lấy thiệp đó làm gốc.
 */
export function weddingComposeNamesOnly(groomName: string, brideName: string): WeddingSampleComposeFields | null {
  const groom = groomName.trim()
  const bride = brideName.trim()
  if (!groom && !bride) return null
  return {
    groomName: groom,
    brideName: bride,
    coupleIntro: '',
    loveQuote: '',
    storyText: '',
    thankYouText: '',
  }
}

export function weddingComposeCopyHasWords(copy: WeddingSampleComposeFields): boolean {
  return [copy.coupleIntro, copy.loveQuote, copy.storyText, copy.thankYouText].some((part) => part.trim().length > 0)
}

export function weddingCardAfterCreate<
  T extends {
    groomName: string
    brideName: string
    coupleIntro: string
    loveQuote: string
    storyText: string
    thankYouText: string
    dressCode: string
    weddingDate: string | null
    occasionKey?: string
  },
>(
  created: T,
  copy?: WeddingSampleComposeFields | null,
  dateIso?: string | null,
  occasionKey?: unknown,
): T {
  const base = {
    ...created,
    weddingDate: dateIso || created.weddingDate,
    ...(occasionKey != null ? { occasionKey: normalizeInvitationOccasion(occasionKey) } : {}),
  }
  return copy ? applyComposeCopyToCard(base, copy) : base
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
  const brief = invitationComposeBrief(occasionKey)
  const notes = input.storyNotes.trim()
  const names = [input.groomName.trim(), input.brideName.trim()].filter(Boolean).join(' và ')
  const lines = [
    `Loại thiệp: ${editor.label}. Viết đúng loại này, không viết như thiệp khác.`,
    `${brief.namesLine}: ${names || '…'}.`,
    input.weddingDate?.trim() ? `${brief.dateLabel} (chỉ nhắc nếu hợp đoạn): ${input.weddingDate.trim()}.` : '',
    `Viết tiếng Việt. ${brief.toneBrief}`,
    'Cấm địa chỉ, tên đường, tên nhà hàng, thôn xã, quận huyện và cụm «tại …».',
    notes
      ? 'Chỉ dùng sự kiện khách đã ghi bên dưới. Cấm bịa thêm ngày, nơi, nghề, quê, tên người khác hay kỷ niệm không có trong ghi chú.'
      : `Khách chưa kể chuyện. Viết chung chung từ tên đã có. Cấm bịa ngày, nơi, nghề, quê hay một kỷ niệm cụ thể.`,
    'Trả về đúng một JSON, không markdown, với bốn khóa đúng cấu trúc loại thiệp này:',
    `- ${brief.introBrief}`,
    `- ${brief.quoteBrief}`,
    `- ${brief.storyBrief}`,
    `- ${brief.thanksBrief}`,
    notes ? `Ghi chú của khách:\n${notes}` : '',
  ]
  return lines.filter(Boolean).join('\n\n')
}
