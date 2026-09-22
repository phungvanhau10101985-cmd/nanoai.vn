import type { WebLocale } from '@/lib/i18n/config'
import {
  inferOutfitPairFamily,
  outfitFamilyPairReason,
  outfitPairFamilyCompatible,
} from '@/lib/partner-website/shop/pdp-outfit-pair-families'
import type { OutfitSlotId } from '@/lib/partner-website/shop/pdp-outfit-roles'

export const OUTFIT_PRICE_BAND_VND = 300_000
export const OUTFIT_MIN_RELATED_SCORE = 2

export type OutfitScoreSubject = {
  name?: string | null
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
  style?: string | null
  occasion?: string | null
  colorSummary?: string | null
  material?: string | null
  colors?: Array<{ name?: string | null }> | null
  priceAmount?: number | null
  salePriceAmount?: number | null
  purchasesCount?: number | null
}

const COLOR_ALIASES: Array<[string, string]> = [
  ['đen tuyền', 'black'],
  ['đen', 'black'],
  ['black', 'black'],
  ['trắng', 'white'],
  ['white', 'white'],
  ['kem', 'beige'],
  ['be ', 'beige'],
  ['beige', 'beige'],
  ['nâu', 'brown'],
  ['brown', 'brown'],
  ['da bò', 'brown'],
  ['xanh navy', 'blue'],
  ['navy', 'blue'],
  ['xanh dương', 'blue'],
  ['blue', 'blue'],
  ['xanh lá', 'green'],
  ['green', 'green'],
  ['đỏ', 'red'],
  ['red', 'red'],
  ['hồng', 'pink'],
  ['pink', 'pink'],
  ['xám', 'gray'],
  ['grey', 'gray'],
  ['gray', 'gray'],
  ['vàng gold', 'gold'],
  ['gold', 'gold'],
  ['bạc', 'silver'],
  ['silver', 'silver'],
  ['cam', 'orange'],
  ['orange', 'orange'],
  ['tím', 'purple'],
  ['purple', 'purple'],
  ['vàng', 'yellow'],
]

const VIBE_KEYS: Record<string, readonly string[]> = {
  formal: [
    'công sở',
    'cong so',
    'đi làm',
    'di lam',
    'giày tây',
    'giay tay',
    'oxford',
    'loafer',
    'derby',
    'quần âu',
    'quan au',
    'sơ mi',
    'so mi',
    'vest',
    'blazer',
    'dự tiệc',
    'du tiec',
    'thắt lưng da',
    'that lung da',
    'da bóng',
    'formal',
    'office',
  ],
  sport: ['thể thao', 'the thao', 'sneaker', 'chạy bộ', 'chay bo', 'gym', 'training', 'sport', 'giày chạy', 'giay chay'],
  party: ['dự tiệc', 'du tiec', 'cao gót', 'cao got', 'đính đá', 'dinh da', 'kim sa', 'party', 'cocktail'],
  casual: ['casual', 'dạo phố', 'dao pho', 'hằng ngày', 'hang ngay', 'áo thun', 'ao thun', 'hoodie', 'jean', 'jeans', 'short', 'canvas', 'tote'],
}

const VIBE_CONFLICT = new Set(['formal|sport', 'sport|formal', 'party|sport', 'sport|party'])

const STOP_TOKENS = new Set([
  'nam',
  'nữ',
  'nu',
  'màu',
  'mau',
  'size',
  'cm',
  'new',
  'hot',
  'sale',
  'cao',
  'cấp',
  'cap',
  'hàng',
  'hang',
  'loại',
  'loai',
])

function cell(value: unknown): string | null {
  const s = String(value ?? '').trim()
  return s ? s : null
}

function normKey(value: unknown): string | null {
  const text = cell(value)
  if (!text) return null
  return text.toLowerCase().replace(/\s+/g, ' ')
}

function productBlob(row: OutfitScoreSubject): string {
  return [
    row.name,
    row.style,
    row.occasion,
    row.material,
    row.colorSummary,
    row.categoryL1,
    row.categoryL2,
    row.categoryL3,
  ]
    .map((part) => cell(part))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function inferOutfitPairFamilyFromSubject(row: OutfitScoreSubject): string | null {
  return inferOutfitPairFamily(row.categoryL1, row.categoryL2, row.categoryL3, row.name, row.style, row.occasion)
}

export function inferOutfitVibes(row: OutfitScoreSubject): Set<string> {
  const blob = productBlob(row)
  const found = new Set<string>()
  for (const [vibe, keys] of Object.entries(VIBE_KEYS)) {
    if (keys.some((k) => blob.includes(k))) found.add(vibe)
  }
  return found
}

export function inferOutfitMaterials(row: OutfitScoreSubject): Set<string> {
  const blob = productBlob(row)
  const found = new Set<string>()
  if (['da bò', 'da that', 'da thật', 'da ', 'leather'].some((k) => blob.includes(k))) found.add('leather')
  if (blob.includes('canvas')) found.add('canvas')
  if (['vải', 'vai '].some((k) => blob.includes(k))) found.add('fabric')
  if (['nhựa', 'nhua', 'cao su'].some((k) => blob.includes(k))) found.add('synthetic')
  if (['lụa', 'lua '].some((k) => blob.includes(k))) found.add('silk')
  return found
}

export function colorFamiliesFromOutfitSubject(row: OutfitScoreSubject): Set<string> {
  const chunks: string[] = []
  const name = cell(row.name)
  const color = cell(row.colorSummary)
  if (name) chunks.push(name)
  if (color) chunks.push(color)
  for (const item of row.colors ?? []) {
    const n = cell(item?.name)
    if (n) chunks.push(n)
  }
  const blob = chunks.join(' ').toLowerCase()
  const found = new Set<string>()
  for (const [needle, fam] of COLOR_ALIASES) {
    if (needle.trim() && blob.includes(needle)) found.add(fam)
  }
  return found
}

function nameTokens(row: OutfitScoreSubject): Set<string> {
  const raw = normKey(row.name) || ''
  const toks = new Set<string>()
  for (const part of raw.split(/[^\wàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+/i)) {
    const t = part.trim().toLowerCase()
    if (t.length >= 3 && !STOP_TOKENS.has(t)) toks.add(t)
  }
  return toks
}

function floorPrice(row: OutfitScoreSubject): number | null {
  const sale = Number(row.salePriceAmount)
  const base = Number(row.priceAmount)
  const v = sale > 0 ? sale : base
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : null
}

export function scoreOutfitCandidate188(
  anchor: OutfitScoreSubject,
  candidate: OutfitScoreSubject,
  slot: OutfitSlotId
): { score: number; purchases: number; reasons: string[] } {
  const aFam = inferOutfitPairFamilyFromSubject(anchor)
  const cFam = inferOutfitPairFamilyFromSubject(candidate)
  const familyLocked = Boolean(aFam && cFam)
  if (familyLocked && !outfitPairFamilyCompatible(aFam, cFam, slot)) {
    return { score: 0, purchases: 0, reasons: [] }
  }

  const aVibes = inferOutfitVibes(anchor)
  const cVibes = inferOutfitVibes(candidate)
  if (aVibes.size && cVibes.size) {
    let conflict = false
    for (const a of aVibes) {
      for (const b of cVibes) {
        if (VIBE_CONFLICT.has(`${a}|${b}`)) conflict = true
      }
    }
    if (conflict && ![...aVibes].some((v) => cVibes.has(v))) {
      return { score: 0, purchases: 0, reasons: [] }
    }
  }

  let score = 0
  const reasons: string[] = []
  let related = false
  if (familyLocked) {
    score += 3
    related = true
    const famReason = outfitFamilyPairReason(aFam, slot)
    if (famReason) reasons.push(famReason)
  }

  const aStyle = normKey(anchor.style)
  const cStyle = normKey(candidate.style)
  if (aStyle && cStyle && aStyle === cStyle) {
    score += 3
    related = true
    reasons.push(`Cùng phong cách ${cell(anchor.style)}`)
  }

  const aOcc = normKey(anchor.occasion)
  const cOcc = normKey(candidate.occasion)
  if (aOcc && cOcc && aOcc === cOcc) {
    score += 3
    related = true
    reasons.push(`Cùng dịp ${cell(anchor.occasion)}`)
  }

  const sharedVibe = [...aVibes].filter((v) => cVibes.has(v))
  if (sharedVibe.length) {
    score += 3
    related = true
    const label: Record<string, string> = {
      formal: 'Cùng phong cách công sở / lịch sự',
      sport: 'Cùng phong cách thể thao',
      party: 'Cùng dịp dự tiệc',
      casual: 'Cùng phong cách dạo phố',
    }
    for (const v of ['formal', 'party', 'sport', 'casual']) {
      if (sharedVibe.includes(v)) {
        reasons.push(label[v])
        break
      }
    }
  }

  const aColors = colorFamiliesFromOutfitSubject(anchor)
  const cColors = colorFamiliesFromOutfitSubject(candidate)
  const colorHit = Boolean([...aColors].some((c) => cColors.has(c)))
  if (colorHit) {
    score += 1
    reasons.push('Gần màu')
  }

  const mats = [...inferOutfitMaterials(anchor)].filter((m) => inferOutfitMaterials(candidate).has(m))
  if (mats.length) {
    score += 1
    if (colorHit) related = true
    reasons.push('Cùng chất liệu')
  }

  const tokens = [...nameTokens(anchor)].filter((t) => nameTokens(candidate).has(t))
  if (tokens.length >= 2) {
    score += 1
    related = true
  }

  const aPrice = floorPrice(anchor)
  const cPrice = floorPrice(candidate)
  if (aPrice != null && cPrice != null && Math.abs(aPrice - cPrice) <= OUTFIT_PRICE_BAND_VND) {
    score += 1
    reasons.push('Cùng tầm giá')
  }

  if (!related && colorHit && score >= OUTFIT_MIN_RELATED_SCORE) related = true
  if (familyLocked) {
    related = true
    if (score < OUTFIT_MIN_RELATED_SCORE) score = OUTFIT_MIN_RELATED_SCORE
  }
  if (!related || score < OUTFIT_MIN_RELATED_SCORE) {
    return { score: 0, purchases: 0, reasons: [] }
  }

  const purchases = Math.max(0, Number(candidate.purchasesCount) || 0)
  return { score, purchases, reasons: reasons.slice(0, 2) }
}

const REASON_I18N: Record<string, Record<Exclude<WebLocale, 'vi'>, string>> = {
  'Gần màu': { en: 'Close in color', zh: '相近颜色', ja: '近い色味', ko: '비슷한 색' },
  'Cùng chất liệu': { en: 'Same material', zh: '同材质', ja: '同じ素材', ko: '같은 소재' },
  'Cùng tầm giá': { en: 'Similar price', zh: '相近价位', ja: '近い価格帯', ko: '비슷한 가격대' },
  'Cùng phong cách công sở / lịch sự': {
    en: 'Same office / formal look',
    zh: '同商务风格',
    ja: '同じフォーマル',
    ko: '같은 포멀 스타일',
  },
  'Cùng phong cách thể thao': { en: 'Same sport look', zh: '同运动风格', ja: '同じスポーツ', ko: '같은 스포츠 스타일' },
  'Cùng dịp dự tiệc': { en: 'Same party occasion', zh: '同宴会场合', ja: '同じパーティ', ko: '같은 파티 룩' },
  'Cùng phong cách dạo phố': { en: 'Same casual look', zh: '同日常风格', ja: '同じカジュアル', ko: '같은 캐주얼' },
}

export function localizeOutfitReasons(reasons: string[], locale: WebLocale): string[] {
  if (locale === 'vi') return reasons.slice(0, 2)
  return reasons.slice(0, 2).map((reason) => {
    const known = REASON_I18N[reason]
    if (known) return known[locale] || reason
    if (reason.startsWith('Cùng phong cách ')) {
      const prefix = { en: 'Same style ', zh: '同风格 ', ja: '同じスタイル ', ko: '같은 스타일 ' }[locale]
      return `${prefix}${reason.slice('Cùng phong cách '.length)}`
    }
    if (reason.startsWith('Cùng dịp ')) {
      const prefix = { en: 'Same occasion ', zh: '同场合 ', ja: '同じシーン ', ko: '같은 상황 ' }[locale]
      return `${prefix}${reason.slice('Cùng dịp '.length)}`
    }
    if (reason.startsWith('Phối ')) {
      const prefix = { en: 'Pair ', zh: '搭配', ja: '合わせる ', ko: '코디 ' }[locale]
      return `${prefix}${reason.slice('Phối '.length)}`
    }
    return reason
  })
}
