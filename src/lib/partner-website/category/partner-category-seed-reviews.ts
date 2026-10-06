/**
 * 100 đánh giá import cho nhóm đánh giá của danh mục cấp 3 mới.
 * Nội dung bám loại hàng. Tên khách: nữ / nam / trộn khi không phân biệt giới.
 */
import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { insertImportedPartnerProductReviewsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import type { ImportedReviewDraft } from '@/lib/partner-website/reviews/partner-reviews-qa-excel'

export const SEED_REVIEW_COUNT = 100

const HO = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
] as const
const TEN_NU = [
  'Lan', 'Hương', 'Trang', 'Ngọc', 'Linh', 'Hà', 'Vy', 'Chi', 'Nhung', 'Thảo',
  'Huyền', 'Trâm', 'Yến', 'Mai', 'Hạnh', 'Dung', 'Phương', 'Quỳnh', 'Oanh', 'My',
] as const
const TEN_NAM = [
  'Minh', 'Hùng', 'Dũng', 'Tuấn', 'Long', 'Khoa', 'Phong', 'Đạt', 'Kiên', 'Tùng',
  'Huy', 'Quân', 'Bảo', 'Thắng', 'Cường', 'Sơn', 'Việt', 'Đức', 'Nam', 'Quang',
] as const
const TEN_NU_SET = new Set(TEN_NU.map((t) => t.toLowerCase()))
const TEN_NAM_SET = new Set(TEN_NAM.map((t) => t.toLowerCase()))

const REPLY_5 = [
  'Cảm ơn {p} đã đánh giá ạ.',
  'Dạ {shop} cảm ơn {p} đã chia sẻ ạ.',
  '{shop} cảm ơn {p} đã ủng hộ.',
  'Cảm ơn {p} đã đặt hàng tại {shop} ạ.',
]
const REPLY_4 = [
  'Dạ {shop} cảm ơn {p} đã góp ý, shop ghi nhận ạ.',
  'Cảm ơn {p} đã phản hồi thật, {shop} sẽ xem lại ạ.',
  '{shop} cảm ơn {p}, góp ý này shop lưu lại.',
]

export type ReviewAudience = 'female' | 'male' | 'unisex'

export function reviewAudience(cat1: string, cat2: string, cat3: string): ReviewAudience {
  const blob = ` ${cat1} ${cat2} ${cat3} `.toLowerCase()
  const hasNu = blob.includes(' nữ')
  const hasNam = blob.includes(' nam')
  if (hasNu && hasNam) return 'unisex'
  if (hasNu) return 'female'
  if (hasNam) return 'male'
  return 'unisex'
}

export function productNoun(cat3: string): string {
  let name = (cat3 || '').replace(/\s+/g, ' ').trim()
  const lowered = name.toLowerCase()
  for (const suffix of [' nam nữ', ' nữ', ' nam']) {
    if (lowered.endsWith(suffix)) {
      name = name.slice(0, -suffix.length).trim()
      break
    }
  }
  return name || (cat3 || '').trim() || 'sản phẩm'
}

/** Cách khách hay gọi, không dán nguyên tên danh mục. «Dép quai ngang» → «dép». */
const SPOKEN_HEADS: Array<[string, string]> = [
  ['vòng cổ', 'vòng cổ'],
  ['dây chuyền', 'dây chuyền'],
  ['bông tai', 'bông tai'],
  ['đồng hồ', 'đồng hồ'],
  ['chân váy', 'chân váy'],
  ['dây dắt', 'dây dắt'],
  ['đồ ngủ', 'đồ ngủ'],
  ['đồ bộ', 'bộ đồ'],
  ['dép', 'dép'],
  ['sandal', 'sandal'],
  ['sneaker', 'giày'],
  ['giày', 'giày'],
  ['boot', 'boot'],
  ['túi', 'túi'],
  ['balo', 'balo'],
  ['vali', 'vali'],
  ['áo', 'áo'],
  ['quần', 'quần'],
  ['váy', 'váy'],
  ['đầm', 'đầm'],
  ['vest', 'vest'],
  ['nhẫn', 'nhẫn'],
  ['lắc', 'lắc'],
  ['vòng', 'vòng'],
  ['ví', 'ví'],
]

export function spokenReviewNoun(cat3: string): string {
  const name = productNoun(cat3).toLowerCase()
  const heads = [...SPOKEN_HEADS].sort((a, b) => b[0].length - a[0].length)
  for (const [head, spoken] of heads) {
    if (name.includes(head)) return spoken
  }
  return name.split(' ').filter(Boolean)[0] || 'món này'
}

function reviewKind(path: string): string {
  const t = path.toLowerCase()
  if (['chó', 'mèo', 'thú cưng', 'thú nuôi'].some((k) => t.includes(k))) return 'generic'
  if (['vali', 'hành lý'].some((k) => t.includes(k))) return 'luggage'
  if (['giày', 'dép', 'sandal', 'boot', 'sneaker'].some((k) => t.includes(k))) return 'footwear'
  if (['túi', 'balo', 'ví '].some((k) => t.includes(k))) return 'bag'
  if (t.includes('đồng hồ')) return 'watch'
  if (['nhẫn', 'vòng', 'lắc', 'bông tai', 'dây chuyền'].some((k) => t.includes(k))) return 'jewelry'
  if (['áo', 'quần', 'váy', 'đầm', 'đồ bộ', 'đồ ngủ', 'vest', 'chân váy'].some((k) => t.includes(k))) return 'apparel'
  return 'generic'
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = out[i]
    out[i] = out[j] as T
    out[j] = tmp as T
  }
  return out
}

function namePool(tens: readonly string[], rnd: () => number): string[] {
  const pool: string[] = []
  for (const ho of HO) {
    for (const ten of tens) pool.push(`${ho} ${ten}`)
  }
  return shuffle(pool, rnd)
}

export function reviewerNameGender(userName: string): 'female' | 'male' | '' {
  const parts = (userName || '').trim().split(/\s+/)
  const given = (parts[parts.length - 1] || '').toLowerCase()
  if (TEN_NU_SET.has(given)) return 'female'
  if (TEN_NAM_SET.has(given)) return 'male'
  return ''
}

function reviewers(audience: ReviewAudience, rnd: () => number, count: number): Array<[string, string]> {
  if (audience === 'female') return namePool(TEN_NU, rnd).slice(0, count).map((name) => [name, 'chị'])
  if (audience === 'male') return namePool(TEN_NAM, rnd).slice(0, count).map((name) => [name, 'anh'])
  const half = Math.floor(count / 2)
  const female = namePool(TEN_NU, rnd)
    .slice(0, half + (count % 2))
    .map((name) => [name, 'chị'] as [string, string])
  const male = namePool(TEN_NAM, rnd)
    .slice(0, half)
    .map((name) => [name, 'anh'] as [string, string])
  return shuffle([...female, ...male], rnd).slice(0, count)
}

function withNoun(line: string, noun: string): string {
  const text = line.split('{n}').join(noun)
  if (text.toLowerCase().startsWith(noun)) {
    return noun.charAt(0).toUpperCase() + noun.slice(1) + text.slice(noun.length)
  }
  return text
}

function linesFor(kind: string, noun: string): [string[], string] {
  const common = [
    'Nhận {n} đúng như hình, gói cũng chắc.',
    'Giao {n} nhanh, về là dùng được luôn.',
    '{n} ổn so với giá, có khi mình mua lại.',
    'Đặt {n} lần đầu, về đúng như mô tả.',
    'Shop gói {n} cẩn thận, không móp.',
  ]
  const footwear =
    noun === 'dép' || noun === 'sandal'
      ? [
          'Đi {n} êm, không cấn ngón.',
          'Quai {n} chắc, mưa nhỏ không tuột.',
          'Mang {n} nửa ngày vẫn ổn.',
          '{n} nhẹ, đi trong nhà hay ra đường đều được.',
          'Đi {n} cả buổi không đau chân.',
        ]
      : [
          'Đi {n} êm, size vừa chân.',
          'Đế {n} bám, mưa nhỏ không trơn.',
          'Mang {n} nửa ngày không đau mũi.',
          '{n} ôm chân, không rộng gót.',
          'Mang {n} đi làm cả ngày vẫn ổn.',
        ]
  const specific: Record<string, string[]> = {
    apparel: [
      'Mặc {n} lên form vừa, vải không xù.',
      '{n} mặc thoáng, đường may gọn.',
      '{n} đúng size mình chọn, mặc cả ngày vẫn ổn.',
      'Vải {n} mát, giặt xong không nhăn nhiều.',
      '{n} lên dáng tự nhiên, không bị bóng.',
    ],
    footwear,
    bag: [
      '{n} đựng vừa đồ hàng ngày, khóa kéo mượt.',
      'Quai {n} chắc, đeo vai không tuột.',
      'Ngăn {n} chia rõ, lấy đồ nhanh.',
      '{n} may đều, không chỉ thừa.',
      '{n} đứng form, để vài ngày không xẹp.',
    ],
    luggage: [
      'Kéo {n} nhẹ tay, bánh xe chạy êm.',
      'Khóa {n} khớp, đựng đồ đi chơi cuối tuần vừa.',
      '{n} đứng vững, kéo không bị đổ.',
      'Tay cầm {n} chắc, kéo trên sàn không kêu to.',
      '{n} gọn hơn mình nghĩ, cho vào cốp xe vừa.',
    ],
    watch: [
      'Đeo {n} vừa cổ tay, mặt nhìn rõ.',
      'Dây {n} không cấn, khóa giữ ổn.',
      '{n} nhẹ, đeo cả ngày không khó chịu.',
      'Kim {n} chạy đều, ngoài trời vẫn thấy giờ.',
      '{n} đúng mẫu mình chọn, hộp giao kèm đủ.',
    ],
    jewelry: [
      'Đeo {n} vừa, không kẹt khóa.',
      '{n} sáng nhẹ, đeo đi làm không vướng.',
      'Khóa {n} đóng chắc, đeo cả buổi không tuột.',
      '{n} nhẹ, đeo không bị kích.',
      'Hộp {n} gói gọn, bên trong đúng mô tả.',
    ],
    generic: [
      '{n} dùng ổn, đúng như mô tả.',
      'Mở {n} ra kiểm tra, không thiếu gì.',
      '{n} lắp dùng được ngay, không phải chỉnh nhiều.',
      'Dùng {n} vài ngày vẫn ổn, chưa thấy lỗi.',
      '{n} gọn, để dùng hàng ngày tiện.',
    ],
  }
  const caveats: Record<string, string> = {
    apparel: 'size hơi rộng hơn số mình hay mặc.',
    footwear: 'đi mới hơi cứng, mang thêm vài bữa thì êm hơn.',
    bag: 'quai hơi cứng lúc mới đeo.',
    luggage: 'hơi nặng hơn mình tưởng một chút.',
    watch: 'dây hơi cứng những ngày đầu.',
    jewelry: 'khóa hơi nhỏ, đeo vẫn được.',
    generic: 'giao chậm hơn dự kiến khoảng một hôm.',
  }
  const lines = common.concat(specific[kind] ?? specific.generic).map((line) => withNoun(line, noun))
  return [lines, caveats[kind] ?? caveats.generic]
}

function contentFor(kind: string, noun: string, index: number, star: number): string {
  const [lines, caveat] = linesFor(kind, noun)
  const closers = [
    '',
    ' Mình nhận hàng rồi dùng luôn.',
    ' Sẽ giới thiệu cho người nhà.',
    ' Hộp không móp.',
    ' Khớp phần mô tả trên web.',
    ' Mình giữ lại dùng tiếp.',
    ' Không phải đổi trả.',
    ' Người nhà xem cũng ưng.',
    ' Lần này đặt đúng món cần.',
    ' Để dùng hàng ngày ổn.',
  ]
  let text = `${lines[index % lines.length]}${closers[Math.floor(index / lines.length)] ?? ''}`.trim()
  if (star === 4) text = `${text} Chỉ có điều ${caveat}`
  if (!text.toLowerCase().includes(noun.toLowerCase())) text = `Mình lấy ${noun}. ${text}`
  return text.slice(0, 500)
}

export function buildSeedReviewDrafts(input: {
  groupId: number
  cat1: string
  cat2: string
  cat3: string
  shopName: string
  now?: Date
}): ImportedReviewDraft[] {
  const gid = Math.round(Number(input.groupId) || 0)
  const shop = (input.shopName || '').trim() || 'Shop'
  const audience = reviewAudience(input.cat1, input.cat2, input.cat3)
  const noun = spokenReviewNoun(input.cat3)
  const kind = reviewKind(`${input.cat1} ${input.cat2} ${input.cat3}`)
  const rnd = mulberry32(gid || 1)
  const people = reviewers(audience, rnd, SEED_REVIEW_COUNT)
  const now = input.now ?? new Date()
  const drafts: ImportedReviewDraft[] = []
  for (let i = 0; i < SEED_REVIEW_COUNT; i += 1) {
    const star = i % 10 === 7 ? 4 : 5
    const [userName, pronoun] = people[i] as [string, string]
    const replyTpl = star === 4 ? REPLY_4[i % REPLY_4.length] : REPLY_5[i % REPLY_5.length]
    const createdAt = new Date(now.getTime() - ((2 + (i % 17)) * 86400000 + ((i * 3) % 20) * 3600000))
    drafts.push({
      reviewerName: userName,
      rating: star,
      title: star === 4 ? 'Hài Lòng' : 'Cực Hài Lòng',
      content: contentFor(kind, noun, i, star),
      merchantReplyBy: shop,
      merchantReply: (replyTpl ?? '').split('{p}').join(pronoun).split('{shop}').join(shop),
      usefulCount: i % 5 === 0 ? 0 : 1 + ((i * 3) % 18),
      importGroup: gid,
      imageUrls: [],
      createdAt,
    })
  }
  return drafts
}

export async function seedReviewsForNewRatingGroup(input: {
  partnerId: string
  groupId: number
  cat1: string
  cat2: string
  cat3: string
  shopName: string
}): Promise<number> {
  const gid = Math.round(Number(input.groupId) || 0)
  const partnerId = input.partnerId.trim()
  if (!partnerId || gid <= 0 || !isPgConfigured()) return 0
  const existing = await pgQuery<{ one: number }>(
    `select 1 as one
     from public.messaging_partner_product_reviews
     where coalesce(is_imported, false) = true
       and import_group = $1
     limit 1`,
    [gid]
  )
  if (existing.length > 0) return 0
  const drafts = buildSeedReviewDrafts(input)
  return insertImportedPartnerProductReviewsFromPg(partnerId, drafts)
}
