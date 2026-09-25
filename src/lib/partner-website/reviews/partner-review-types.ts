import type { WebLocale } from '@/lib/i18n/config'

/**
 * W1.5 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — Đánh giá + Hỏi đáp sản phẩm.
 * Xem docs/188_BEHAVIOR_SPEC.md mục C cho hành vi chi tiết + các lỗ hổng 188 KHÔNG nên copy.
 */

/** Số câu trả lời của khách mua hàng hiển thị công khai / câu hỏi (188 hardcode 2 — ở đây là 1 hằng số). */
export const QA_BUYER_ANSWER_LIMIT = 2

/** 188: admin + user 1 + user 2 trên cùng một câu hỏi. */
export const QA_REPLY_SLOTS = ['admin', 'user_one', 'user_two'] as const
export type QaReplySlot = (typeof QA_REPLY_SLOTS)[number]

export const REVIEW_CONTENT_MAX_LEN = 4000
export const REVIEW_TITLE_MAX_LEN = 200
export const REVIEW_IMAGE_MAX_COUNT = 6
export const QUESTION_CONTENT_MAX_LEN = 1000
export const ANSWER_CONTENT_MAX_LEN = 2000

/** 188 `coalesce_group_rating`: null/0 → 888. */
export const DEFAULT_IMPORT_GROUP = 888

export const PUBLIC_REVIEW_QA_PAGE_SIZE = 100
export const PUBLIC_REVIEW_QA_PAGE_SIZE_MAX = 200

export function coalesceImportGroup(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_IMPORT_GROUP
  return n
}

export type PartnerReviewSourceFilter = 'all' | 'real' | 'imported'

export type PartnerReviewRow = {
  id: string
  partnerId: string
  inventoryId: string | null
  orderId: string | null
  orderLineId: string | null
  guestAccountId: string | null
  linkedUserId: string | null
  reviewerName: string
  rating: number
  title: string
  content: string
  imageUrls: string[]
  isActive: boolean
  usefulCount: number
  userHasVoted?: boolean
  isCurrentUser?: boolean
  merchantReply: string
  merchantReplyBy: string
  merchantReplyAt: string | null
  isImported: boolean
  importGroup: number
  createdAt: string
  updatedAt: string
}

export type PartnerRatingHistogram = Record<'1' | '2' | '3' | '4' | '5', number>

export type PartnerRatingSummary = {
  average: number
  total: number
  histogram: PartnerRatingHistogram
}

export type PartnerQuestionAnswerRow = {
  id: string
  questionId: string
  partnerId: string
  answerType: 'buyer' | 'admin'
  replySlot: QaReplySlot | null
  guestAccountId: string | null
  linkedUserId: string | null
  responderName: string
  content: string
  isVerified: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type QaReplySlots = {
  admin: PartnerQuestionAnswerRow | null
  userOne: PartnerQuestionAnswerRow | null
  userTwo: PartnerQuestionAnswerRow | null
}

/** 188: một admin + tối đa 2 khách (user 1 / user 2). Ưu tiên `reply_slot`, fallback thứ tự cũ. */
type QaReplySlotInput = Pick<PartnerQuestionAnswerRow, 'id' | 'answerType' | 'isActive'> & {
  replySlot?: QaReplySlot | null
}

export function splitQaReplySlots<T extends QaReplySlotInput = PartnerQuestionAnswerRow>(
  answers: T[]
): { admin: T | null; userOne: T | null; userTwo: T | null } {
  const active = answers.filter((a) => a.isActive !== false)
  const bySlot = (slot: QaReplySlot) => active.find((a) => a.replySlot === slot) ?? null
  let admin = bySlot('admin')
  let userOne = bySlot('user_one')
  let userTwo = bySlot('user_two')
  if (!admin) admin = active.find((a) => a.answerType === 'admin') ?? null
  const buyers = active.filter((a) => a.answerType === 'buyer')
  if (!userOne) userOne = buyers.find((a) => a.id !== userTwo?.id) ?? null
  if (!userTwo) userTwo = buyers.find((a) => a.id !== userOne?.id) ?? null
  return { admin, userOne, userTwo }
}

export function qaPublicBuyerReplyCount(slots: {
  userOne: Pick<PartnerQuestionAnswerRow, 'content'> | null
  userTwo: Pick<PartnerQuestionAnswerRow, 'content'> | null
}): number {
  return [slots.userOne, slots.userTwo].filter((row) => Boolean(row?.content?.trim())).length
}

export type PartnerQuestionRow = {
  id: string
  partnerId: string
  inventoryId: string | null
  guestAccountId: string | null
  linkedUserId: string | null
  askerName: string
  content: string
  isActive: boolean
  usefulCount: number
  userHasVoted?: boolean
  isCurrentUser?: boolean
  isImported: boolean
  importGroup: number
  createdAt: string
  updatedAt: string
}

/** 188 VerifiedPurchaserBadge: có user_id hoặc import + còn nội dung. */
export function reviewShowsVerifiedBadge(
  row: Pick<PartnerReviewRow, 'isImported' | 'guestAccountId' | 'linkedUserId' | 'content'>
): boolean {
  if (row.guestAccountId || row.linkedUserId) return true
  return row.isImported && Boolean(row.content?.trim())
}

export function qaBuyerAnswerShowsVerifiedBadge(
  row: Pick<PartnerQuestionAnswerRow, 'isVerified' | 'guestAccountId' | 'linkedUserId' | 'content'>,
  questionImported?: boolean
): boolean {
  if (row.isVerified || row.guestAccountId || row.linkedUserId) return true
  return Boolean(questionImported && row.content?.trim())
}

/** 188 `qaSlotShowsVerifiedPurchaserBadge(q, 1|2)` — user 1 / user 2. */
export function qaSlotShowsVerifiedPurchaserBadge(
  slots: QaReplySlots,
  slot: 1 | 2,
  questionImported?: boolean
): boolean {
  const row = slot === 1 ? slots.userOne : slots.userTwo
  if (!row?.content?.trim()) return false
  if (qaBuyerAnswerShowsVerifiedBadge(row, questionImported)) return true
  return Boolean(questionImported)
}

export type PartnerQuestionWithAnswers = PartnerQuestionRow & {
  answers: PartnerQuestionAnswerRow[]
}

export function clampRating(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 5
  return Math.min(5, Math.max(1, n))
}

export function sanitizeReviewImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const url = item.trim()
    if (!/^https?:\/\//i.test(url)) continue
    if (url.length > 2000) continue
    out.push(url)
    if (out.length >= REVIEW_IMAGE_MAX_COUNT) break
  }
  return out
}

/** Tiêu đề tự sinh khi khách bỏ trống — 5 mẫu theo số sao, dịch đủ WEB_LOCALES. */
const REVIEW_TITLE_TEMPLATES: Record<WebLocale, Record<1 | 2 | 3 | 4 | 5, string>> = {
  vi: {
    1: 'Không hài lòng với sản phẩm',
    2: 'Sản phẩm chưa như mong đợi',
    3: 'Sản phẩm tạm ổn',
    4: 'Sản phẩm khá tốt',
    5: 'Rất hài lòng với sản phẩm',
  },
  en: {
    1: 'Not satisfied with this product',
    2: 'Product did not meet expectations',
    3: 'Product is okay',
    4: 'Pretty good product',
    5: 'Very satisfied with this product',
  },
  zh: {
    1: '对产品不满意',
    2: '产品不如预期',
    3: '产品还可以',
    4: '产品相当不错',
    5: '对产品非常满意',
  },
  ja: {
    1: '商品に満足していません',
    2: '商品は期待通りではありませんでした',
    3: '商品はまあまあです',
    4: '商品はかなり良いです',
    5: '商品にとても満足しています',
  },
  ko: {
    1: '제품에 만족하지 않습니다',
    2: '제품이 기대에 미치지 못했습니다',
    3: '제품은 괜찮습니다',
    4: '제품이 꽤 좋습니다',
    5: '제품에 매우 만족합니다',
  },
}

export function reviewTitleTemplate(rating: number, locale: WebLocale): string {
  const clamped = clampRating(rating) as 1 | 2 | 3 | 4 | 5
  const table = REVIEW_TITLE_TEMPLATES[locale] ?? REVIEW_TITLE_TEMPLATES.vi
  return table[clamped]
}

const VOTE_KEY_PREFIX_RE = /^(guest|user|session):/i

/** UUID thuần — bỏ prefix `guest:` / `user:` nếu client gửi nhầm. */
export function normalizePartnerReviewVoterKey(raw: string | null | undefined): string {
  return String(raw || '').trim().replace(VOTE_KEY_PREFIX_RE, '').trim()
}

/**
 * Khóa vote Hữu ích: ưu tiên tài khoản đã login, rồi guest, rồi fallback.
 * Cùng người có thể đã vote bằng guest UUID trước khi login — phải giữ cả hai khi toggle.
 */
export function partnerReviewVoterKeys(...raw: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    const key = normalizePartnerReviewVoterKey(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function partnerReviewVoterKeysFromVisitor(input: {
  accountKey?: string | null
  guestAccountId?: string | null
  linkedUserId?: string | null
}): string[] {
  return partnerReviewVoterKeys(input.linkedUserId, input.guestAccountId, input.accountKey)
}
