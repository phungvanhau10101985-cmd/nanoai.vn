import type { WebLocale } from '@/lib/i18n/config'

/** Cross-category complementary slots — fashion PDP «Phối đồ». */
export const OUTFIT_SLOT_IDS = ['top', 'bottom', 'dress', 'shoes', 'bag', 'accessory'] as const

export type OutfitSlotId = (typeof OUTFIT_SLOT_IDS)[number]
export type OutfitGender = 'male' | 'female' | 'unisex'
export type OutfitNotApplicableReason = 'no_slots'

const SLOT_LABEL: Record<OutfitSlotId, Record<WebLocale, string>> = {
  top: { vi: 'Áo', en: 'Tops', zh: '上装', ja: 'トップス', ko: '상의' },
  bottom: { vi: 'Quần', en: 'Bottoms', zh: '下装', ja: 'ボトムス', ko: '하의' },
  dress: { vi: 'Váy', en: 'Dresses', zh: '连衣裙', ja: 'ワンピース', ko: '원피스' },
  shoes: { vi: 'Giày', en: 'Shoes', zh: '鞋履', ja: 'シューズ', ko: '신발' },
  bag: { vi: 'Túi', en: 'Bags', zh: '包袋', ja: 'バッグ', ko: '가방' },
  accessory: { vi: 'Phụ kiện', en: 'Accessories', zh: '配饰', ja: 'アクセサリー', ko: '액세서리' },
}

const ROLE_LABEL: Record<OutfitSlotId, Record<WebLocale, string>> = {
  top: { vi: 'áo', en: 'top', zh: '上装', ja: 'トップス', ko: '상의' },
  bottom: { vi: 'quần', en: 'bottom', zh: '下装', ja: 'ボトムス', ko: '하의' },
  dress: { vi: 'váy', en: 'dress', zh: '连衣裙', ja: 'ワンピース', ko: '원피스' },
  shoes: { vi: 'giày', en: 'shoes', zh: '鞋', ja: 'シューズ', ko: '신발' },
  bag: { vi: 'túi', en: 'bag', zh: '包', ja: 'バッグ', ko: '가방' },
  accessory: { vi: 'phụ kiện', en: 'accessory', zh: '配饰', ja: '小物', ko: '액세서리' },
}

const TITLE_WITH_ROLE: Record<WebLocale, string> = {
  vi: 'Phối với {role} này',
  en: 'Pair with this {role}',
  zh: '搭配这件{role}',
  ja: 'この{role}に合うアイテム',
  ko: '이 {role}와 코디하기',
}

const TITLE_FALLBACK: Record<WebLocale, string> = {
  vi: 'Phối với món này',
  en: 'Pair with this piece',
  zh: '搭配单品',
  ja: 'このアイテムに合うコーディネート',
  ko: '이 상품과 코디하기',
}

const DRESS_KEYS = [
  'váy',
  'vay ',
  'váy liền',
  'vay lien',
  'đầm',
  'dam ',
  'jumpsuit',
  'jump suit',
  'váy maxi',
  'váy midi',
  'váy ngắn',
  'váy dài',
  'dress',
  'one-piece',
  'onepiece',
  '连衣裙',
  'ワンピ',
  '원피스',
]
const BOTTOM_KEYS = [
  'quần',
  'quan ',
  'jean',
  'jeans',
  'short',
  'shorts',
  'chân váy',
  'chan vay',
  'váy chữ a',
  'skirt',
  'trouser',
  'pants',
  'legging',
  '裤子',
  '半裙',
  'パンツ',
  'スカート',
  '바지',
  '스커트',
]
const TOP_KEYS = [
  'áo',
  'ao ',
  'sơ mi',
  'so mi',
  'thun',
  'khoác',
  'vest',
  'hoodie',
  'blazer',
  'cardigan',
  'len',
  'croptop',
  'crop top',
  'tank',
  'polo',
  'shirt',
  'blouse',
  'tee',
  't-shirt',
  'jacket',
  'coat',
  'sweater',
  '上衣',
  '衬衫',
  'ジャケット',
  'シャツ',
  '상의',
  '셔츠',
]
const SHOE_KEYS = [
  'giày',
  'giay',
  'dép',
  'dep ',
  'sandal',
  'sneaker',
  'boot',
  'loafer',
  'heel',
  'shoe',
  'footwear',
  '鞋',
  '靴',
  'サンダル',
  '신발',
  '구두',
]
const BAG_KEYS = [
  'túi',
  'tui ',
  'balo',
  'clutch',
  'backpack',
  'handbag',
  'tote',
  'bag',
  'wallet',
  'ví ',
  '包',
  'バッグ',
  '가방',
]
const ACCESSORY_KEYS = [
  'phụ kiện',
  'phu kien',
  'trang sức',
  'trang suc',
  'đồng hồ',
  'dong ho',
  'thắt lưng',
  'that lung',
  'mũ',
  'nón',
  'khăn',
  'kính',
  'belt',
  'watch',
  'jewelry',
  'hat',
  'scarf',
  'sunglass',
  'accessory',
  '配饰',
  '手表',
  'アクセ',
  '時計',
  '액세서리',
  '시계',
]

function cell(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function joinParts(...parts: unknown[]): string {
  return parts.map(cell).filter(Boolean).join(' | ')
}

function containsAny(blob: string, keys: readonly string[]): boolean {
  return keys.some((k) => blob.includes(k))
}

export function isOutfitSlotId(value: string): value is OutfitSlotId {
  return (OUTFIT_SLOT_IDS as readonly string[]).includes(value)
}

export function outfitSlotLabel(slot: OutfitSlotId, locale: WebLocale): string {
  return SLOT_LABEL[slot][locale] || SLOT_LABEL[slot].en
}

export function outfitRoleLabel(slot: OutfitSlotId, locale: WebLocale): string {
  return ROLE_LABEL[slot][locale] || ROLE_LABEL[slot].en
}

export function outfitSectionTitle(role: OutfitSlotId | null, locale: WebLocale): string {
  if (!role) return TITLE_FALLBACK[locale] || TITLE_FALLBACK.en
  return (TITLE_WITH_ROLE[locale] || TITLE_WITH_ROLE.en).replace('{role}', outfitRoleLabel(role, locale))
}

export function inferOutfitGender(...labels: unknown[]): OutfitGender {
  const blob = ` ${joinParts(...labels)} `
  const hasToken = (token: string) => blob.includes(` ${token} `) || blob.endsWith(` ${token}`) || blob.includes(` ${token}/`)
  const male =
    hasToken('nam') ||
    hasToken('men') ||
    hasToken('male') ||
    blob.includes('男') ||
    blob.includes('メンズ') ||
    blob.includes('남성')
  const female =
    hasToken('nữ') ||
    hasToken('nu') ||
    hasToken('women') ||
    hasToken('female') ||
    hasToken('ladies') ||
    blob.includes('女') ||
    blob.includes('レディース') ||
    blob.includes('여성')
  if (male && !female) return 'male'
  if (female && !male) return 'female'
  return 'unisex'
}

export function inferOutfitRole(...labels: unknown[]): OutfitSlotId | null {
  const blob = joinParts(...labels)
  if (!blob) return null
  if (containsAny(blob, SHOE_KEYS)) return 'shoes'
  if (containsAny(blob, BAG_KEYS)) return 'bag'
  if (containsAny(blob, ACCESSORY_KEYS) && !containsAny(blob, [...TOP_KEYS, ...BOTTOM_KEYS, ...DRESS_KEYS])) {
    return 'accessory'
  }
  if (containsAny(blob, DRESS_KEYS)) {
    if (blob.includes('chân váy') || blob.includes('chan vay') || blob.includes('váy chữ a') || blob.includes('skirt')) {
      return 'bottom'
    }
    return 'dress'
  }
  if (containsAny(blob, BOTTOM_KEYS)) return 'bottom'
  if (containsAny(blob, TOP_KEYS)) return 'top'
  if (containsAny(blob, ACCESSORY_KEYS)) return 'accessory'
  return null
}

export function slotsForOutfitAnchor(role: OutfitSlotId, gender: OutfitGender): OutfitSlotId[] {
  const female = gender === 'female' || gender === 'unisex'
  const male = gender === 'male' || gender === 'unisex'
  const ordered: OutfitSlotId[] = []
  const add = (slot: OutfitSlotId) => {
    if (slot !== role && !ordered.includes(slot)) ordered.push(slot)
  }
  if (role === 'top') {
    if (male) add('bottom')
    if (female) {
      add('dress')
      add('bottom')
    }
    add('shoes')
    add('bag')
    add('accessory')
  } else if (role === 'bottom') {
    add('top')
    add('shoes')
    add('bag')
    add('accessory')
  } else if (role === 'dress') {
    add('shoes')
    add('bag')
    add('accessory')
  } else if (role === 'shoes') {
    add('top')
    if (male) add('bottom')
    if (female) {
      add('dress')
      add('bottom')
    }
    add('bag')
    add('accessory')
  } else if (role === 'bag') {
    add('top')
    if (female) {
      add('dress')
      add('bottom')
    }
    add('shoes')
    add('accessory')
  } else {
    add('top')
    if (female) {
      add('dress')
      add('bottom')
    }
    add('shoes')
    add('bag')
  }
  return ordered
}

export function classifyOutfitAnchor(labels: unknown[]): {
  role: OutfitSlotId | null
  gender: OutfitGender
  reason: OutfitNotApplicableReason | null
} {
  const gender = inferOutfitGender(...labels)
  const role = inferOutfitRole(...labels)
  if (!role) return { role: null, gender, reason: 'no_slots' }
  return { role, gender, reason: null }
}

export function outfitSlotSearchTokens(slot: OutfitSlotId): string[] {
  if (slot === 'top') return ['áo', 'sơ mi', 'thun', 'khoác', 'shirt', 'blouse']
  if (slot === 'bottom') return ['quần', 'jean', 'short', 'chân váy', 'pants', 'skirt']
  if (slot === 'dress') return ['váy', 'đầm', 'dress', 'jumpsuit']
  if (slot === 'shoes') return ['giày', 'dép', 'sneaker', 'sandal', 'boot']
  if (slot === 'bag') return ['túi', 'balo', 'clutch', 'backpack']
  return ['phụ kiện', 'thắt lưng', 'mũ', 'đồng hồ', 'kính']
}

export function scoreOutfitCandidate(input: {
  anchorPrice: number | null
  candidatePrice: number | null
  anchorGender: OutfitGender
  candidateGender: OutfitGender
  nameOverlap: number
}): number {
  let score = 1
  if (input.candidateGender !== 'unisex' && input.anchorGender !== 'unisex') {
    score += input.candidateGender === input.anchorGender ? 4 : -6
  } else if (input.candidateGender === input.anchorGender) {
    score += 1
  }
  const a = input.anchorPrice
  const c = input.candidatePrice
  if (a != null && c != null && a > 0 && c > 0) {
    const diff = Math.abs(c - a)
    if (diff <= 300_000) score += 3
    else if (diff <= a * 0.35) score += 2
    else if (diff > a) score += 0
  }
  score += Math.min(3, Math.max(0, input.nameOverlap))
  return score
}

export function outfitNameOverlap(anchorName: string, candidateName: string): number {
  const stop = new Set(['áo', 'quần', 'váy', 'giày', 'túi', 'the', 'and', 'cho', 'nữ', 'nam', 'size'])
  const tokens = cell(anchorName)
    .split(/[^a-z0-9à-ỹ]+/i)
    .filter((t) => t.length >= 3 && !stop.has(t))
  const blob = cell(candidateName)
  let n = 0
  for (const t of tokens) {
    if (blob.includes(t)) n += 1
  }
  return n
}

export function outfitMatchReasons(input: {
  locale: WebLocale
  samePriceBand: boolean
  sameGender: boolean
  destSlot: OutfitSlotId
  srcRole: OutfitSlotId
}): string[] {
  const reasons: string[] = []
  if (input.sameGender) {
    reasons.push(
      input.locale === 'vi'
        ? 'Cùng giới tính'
        : input.locale === 'zh'
          ? '同性别'
          : input.locale === 'ja'
            ? '同じジェンダー'
            : input.locale === 'ko'
              ? '같은 성별'
              : 'Same gender'
    )
  }
  if (input.samePriceBand) {
    reasons.push(
      input.locale === 'vi'
        ? 'Cùng tầm giá'
        : input.locale === 'zh'
          ? '相近价位'
          : input.locale === 'ja'
            ? '近い価格帯'
            : input.locale === 'ko'
              ? '비슷한 가격대'
              : 'Similar price'
    )
  }
  const dest = outfitSlotLabel(input.destSlot, input.locale)
  const src = outfitRoleLabel(input.srcRole, input.locale)
  reasons.push(
    input.locale === 'vi'
      ? `Phối ${dest} với ${src}`
      : input.locale === 'zh'
        ? `${dest}搭配${src}`
        : input.locale === 'ja'
          ? `${src}に合う${dest}`
          : input.locale === 'ko'
            ? `${src}와 ${dest} 코디`
            : `Pair ${dest} with ${src}`
  )
  return reasons.slice(0, 2)
}
