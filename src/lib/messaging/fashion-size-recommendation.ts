import { looksLikeChineseJinWeightRange } from './fashion-size-weight-units'
import { inventoryRowLooksLikeShoes } from './partner-ai-fit-question'
import {
  resolvePartnerSizeGuideKind,
  SIZE_GUIDE_APPAREL_FEMALE_HW_ROWS,
  SIZE_GUIDE_APPAREL_FEMALE_ROWS,
  SIZE_GUIDE_APPAREL_MALE_HW_ROWS,
  SIZE_GUIDE_APPAREL_MALE_ROWS,
} from '@/lib/partner-website/shop/partner-site-size-guide'

export type FashionSizeRecommendation = {
  status: 'exact' | 'boundary' | 'unknown'
  /** product = bảng của đúng mã; reference = chuẩn size số đông khi sản phẩm không có bảng. */
  source: 'product' | 'reference' | null
  weightKg: number | null
  heightCm: number | null
  recommendedSize: string | null
  candidateSizes: string[]
  ranges: Array<{ size: string; minKg: number; maxKg: number }>
  askUsualSize: boolean
  /** Size trên chuẩn số đông trước khi kéo về size có trong thông tin sản phẩm. */
  referenceSize: string | null
}

export type FashionSizeProductContext = {
  name?: string | null
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
  /** Mô tả, thông tin sản phẩm, chữ trên ảnh — bảng size của đúng mã. */
  productText?: string | null
}

const CUSTOMER_WEIGHT_RE = /(?:^|[^\d])(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilogram)\b/iu
const CUSTOMER_HEIGHT_CM_RE = /(?:cao|height)?[^0-9]{0,8}(\d{2,3}(?:[.,]\d+)?)\s*cm\b/iu
const CUSTOMER_HEIGHT_M_RE = /(\d)\s*m\s*(\d{1,2})\b/iu
const SIZE_RANGE_RE =
  /^(?:\d{2,3}\s*\/\s*)?([a-z0-9-]{1,12})\s*\(\s*(\d{2,3}(?:[.,]\d+)?)\s*[-–—]\s*(\d{2,3}(?:[.,]\d+)?)\s*(kg|斤|jin|cân\s*tq)?\s*\)$/iu
const SIZE_RANGE_DASH_RE =
  /^((?:5xl|4xl|3xl|xxxl|2xl|xxl|xl|xs|s|m|l))\s*-\s*(\d{2,3}(?:[.,]\d+)?)\s*-\s*(\d{2,3}(?:[.,]\d+)?)\s*(kg|斤|jin|cân\s*tq)?$/iu
const SIZE_TOKEN_RE = /\b(5XL|4XL|3XL|XXXL|2XL|XXL|XL|XS|S|M|L)\b/giu
const BAG_RE = /(?:^|[^\p{L}\p{N}])(?:túi|tui|ba\s*lô|balo|ví|vi|clutch|vali)(?=$|[^\p{L}\p{N}])/iu
const APPAREL_RE =
  /(?:^|[^\p{L}\p{N}])(?:áo|ao|quần|quan|váy|vay|đầm|dam|blazer|vest|khoác|khoac)(?=$|[^\p{L}\p{N}])/iu
const USUAL_SIZE_RE =
  /hay\s*mặc\s*size|thường\s*mặc\s*size|mặc\s*size\s*(?:bao nhiêu|gì|nào)|size\s*(?:hay|thường)\s*mặc/iu
const REFUSAL_SENTENCE_RE =
  /[^.!?\n]*(?:chưa có bảng size|không dám chốt|kiểm tra lại bảng size|kiểm tra bảng size|bảng size thực tế của xưởng)[^.!?\n]*[.!?]?/giu

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']

type RangePair = [number, number]
type ChartRow = {
  size: string
  height: RangePair | null
  weight: RangePair | null
  chest: RangePair | null
  shoulder: RangePair | null
  waist: RangePair | null
}
type BodySignals = {
  weightKg: number | null
  heightCm: number | null
  chest: number | null
  shoulder: number | null
  waist: number | null
}

function numberOf(raw: string): number {
  return Number(raw.replace(',', '.'))
}

function canonicalSize(raw: string): string {
  const u = raw.toUpperCase()
  if (u === '2XL' || u === 'XXL') return 'XXL'
  if (u === 'XXXL') return '3XL'
  return u
}

function parseDashRange(cell: string): RangePair | null {
  const match = String(cell).match(/(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  const min = numberOf(match[1])
  const max = numberOf(match[2])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
  return [min, max]
}

function inRange(value: number | null, range: RangePair | null): boolean {
  if (value == null || !range) return false
  return value >= range[0] && value <= range[1]
}

function parseRange(raw: string): { size: string; minKg: number; maxKg: number } | null {
  const text = raw.trim()
  const match = text.match(SIZE_RANGE_RE) ?? text.match(SIZE_RANGE_DASH_RE)
  if (!match) return null
  let min = numberOf(match[2])
  let max = numberOf(match[3])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null
  const unit = (match[4] ?? '').toLowerCase()
  if (unit === '斤' || unit === 'jin' || unit.includes('cân') || (!unit && looksLikeChineseJinWeightRange(min, max))) {
    min /= 2
    max /= 2
  }
  return { size: canonicalSize(match[1]), minKg: min, maxKg: max }
}

function parseHeightCm(text: string): number | null {
  const meter = text.match(CUSTOMER_HEIGHT_M_RE)
  if (meter) {
    const cmPart = meter[2]
    const cm = cmPart.length === 1 ? Number(cmPart) * 10 : Number(cmPart)
    const total = Number(meter[1]) * 100 + cm
    if (total >= 80 && total <= 230) return total
  }
  const cm = text.match(CUSTOMER_HEIGHT_CM_RE)
  if (cm) {
    const total = numberOf(cm[1])
    if (total >= 80 && total <= 230) return total
  }
  const spoken = text.match(/(?:cao|height)\s*m\s*(\d)(\d{0,2})\b/iu)
  if (spoken) {
    const head = Number(spoken[1])
    const tail = spoken[2] ?? ''
    const total = 100 + head * 10 + (tail ? Number(tail[0]) : 0)
    if (total >= 140 && total <= 220) return total
  }
  const bare = text.match(/(?:cao|height)\s*(\d{3})\b/iu)
  if (!bare) return null
  const bareTotal = Number(bare[1])
  return bareTotal >= 140 && bareTotal <= 220 ? bareTotal : null
}

function parseCaoThenWeight(text: string): { heightCm: number; weightKg: number } | null {
  const paired = text.match(
    /(?:cao|height)\s*(\d{2,3})(?:\s*cm)?\s*(?:[,/]\s*|\s+)(?:nặng|nang|kg|cân)?\s*(\d{2,3})(?:\s*kg)?/iu
  )
  if (!paired) return null
  const heightCm = numberOf(paired[1])
  const weightKg = numberOf(paired[2])
  if (heightCm < 140 || heightCm > 220 || weightKg < 30 || weightKg > 200) return null
  return { heightCm, weightKg }
}

function parseCrossMeasure(text: string): { heightCm: number; weightKg: number } | null {
  const cross = text.match(/(?:^|[^\d])(\d{2,3})\s*[x×]\s*(\d{2,3})(?!\d)/iu)
  if (!cross) return null
  const pair = [numberOf(cross[1]), numberOf(cross[2])]
  const heightCm = pair.find((n) => n >= 140 && n <= 220)
  const weightKg = pair.find((n) => n >= 35 && n <= 160 && n !== heightCm)
  if (heightCm == null || weightKg == null) return null
  return { heightCm, weightKg }
}

function measureAfter(text: string, label: RegExp): number | null {
  const match = text.match(new RegExp(`(?:${label.source})\\s*(?:là|la|:)?\\s*(\\d{2,3}(?:[.,]\\d+)?)`, 'iu'))
  if (!match) return null
  const value = numberOf(match[1])
  return Number.isFinite(value) ? value : null
}

function parseBodySignals(text: string): BodySignals {
  const paired = parseCaoThenWeight(text)
  const cross = parseCrossMeasure(text)
  const weightMatch = text.match(CUSTOMER_WEIGHT_RE)
  let weightKg = weightMatch ? numberOf(weightMatch[1]) : null
  if (weightKg == null) {
    const heavy = text.match(/(?:nặng|nang)\s*(\d{2,3}(?:[.,]\d+)?)(?!\s*cm)/iu)
    if (heavy) {
      const heavyKg = numberOf(heavy[1])
      if (heavyKg >= 30 && heavyKg <= 200) weightKg = heavyKg
    }
  }
  let heightCm = parseHeightCm(text)
  if (paired) {
    heightCm = paired.heightCm
    weightKg = paired.weightKg
  } else if (cross) {
    if (heightCm == null) heightCm = cross.heightCm
    if (weightKg == null) weightKg = cross.weightKg
  }
  return {
    weightKg,
    heightCm,
    chest: measureAfter(text, /vòng\s*ngực|vong\s*nguc|ngực|nguc|chest/iu),
    shoulder: measureAfter(text, /ngang\s*vai|vai|shoulder/iu),
    waist: measureAfter(text, /vòng\s*eo|vòng\s*bụng|bụng|bung|eo|waist/iu),
  }
}

/** Ghép số đo ở tin trước chỉ khi tin hiện tại đang hỏi size / đã có một phần số đo. */
export function sizeSignalTextFromRecentInbound(latest: string, inboundNewestLast: string[]): string {
  const latestTrim = String(latest ?? '').trim()
  const own = parseBodySignals(latestTrim)
  if (own.heightCm != null && own.weightKg != null) return latestTrim
  const looksLikeMeasure =
    own.heightCm != null ||
    own.weightKg != null ||
    /\d{2,3}\s*[x×]\s*\d{2,3}/.test(latestTrim) ||
    /size|cỡ|cao|nặng|nang/i.test(latestTrim)
  if (!looksLikeMeasure) return latestTrim
  const priors = inboundNewestLast
    .map((line) => String(line ?? '').trim())
    .filter((line) => line && line !== latestTrim)
    .slice(-5)
    .filter((line) => {
      const signals = parseBodySignals(line)
      return signals.heightCm != null || signals.weightKg != null || /\d{2,3}\s*[x×]\s*\d{2,3}/.test(line)
    })
  if (!priors.length) return latestTrim
  return `${priors.join('\n')}\n${latestTrim}`
}

function hasBodySignal(signals: BodySignals): boolean {
  return (
    signals.weightKg != null ||
    signals.heightCm != null ||
    signals.chest != null ||
    signals.shoulder != null ||
    signals.waist != null
  )
}

function emptyResult(signals: BodySignals, ranges: FashionSizeRecommendation['ranges']): FashionSizeRecommendation {
  return {
    status: 'unknown',
    source: null,
    weightKg: signals.weightKg,
    heightCm: signals.heightCm,
    recommendedSize: null,
    candidateSizes: [],
    ranges,
    askUsualSize: false,
    referenceSize: null,
  }
}

function mergeChart(
  measureRows: ReadonlyArray<readonly string[]>,
  hwRows: ReadonlyArray<readonly [string, string, string]>
): ChartRow[] {
  const bySize = new Map<string, ChartRow>()
  const ensure = (size: string): ChartRow => {
    const key = canonicalSize(size)
    const existing = bySize.get(key)
    if (existing) return existing
    const row: ChartRow = { size: key, height: null, weight: null, chest: null, shoulder: null, waist: null }
    bySize.set(key, row)
    return row
  }
  for (const row of measureRows) {
    const item = ensure(row[0])
    item.chest = parseDashRange(row[1])
    if (row.length >= 5) {
      item.shoulder = parseDashRange(row[2])
      item.waist = parseDashRange(row[3])
    } else if (row.length >= 4) {
      item.waist = parseDashRange(row[2])
    }
  }
  for (const row of hwRows) {
    const item = ensure(row[0])
    item.height = parseDashRange(row[1])
    item.weight = parseDashRange(row[2])
  }
  return [...bySize.values()]
}

const MALE_REFERENCE = mergeChart(SIZE_GUIDE_APPAREL_MALE_ROWS, SIZE_GUIDE_APPAREL_MALE_HW_ROWS)
const FEMALE_REFERENCE = mergeChart(SIZE_GUIDE_APPAREL_FEMALE_ROWS, SIZE_GUIDE_APPAREL_FEMALE_HW_ROWS)

function scoreRow(row: ChartRow, signals: BodySignals): number {
  let score = 0
  if (inRange(signals.weightKg, row.weight)) score += 3
  if (inRange(signals.chest, row.chest)) score += 2
  if (inRange(signals.waist, row.waist)) score += 2
  if (inRange(signals.shoulder, row.shoulder)) score += 1
  if (inRange(signals.heightCm, row.height)) score += 1
  return score
}

function pickChartSizes(rows: ChartRow[], signals: BodySignals): { status: 'exact' | 'boundary' | 'unknown'; sizes: string[] } {
  const scored = rows
    .map((row) => ({ size: row.size, score: scoreRow(row, signals) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
  if (!scored.length || scored[0].score < 2) return { status: 'unknown', sizes: [] }
  const top = scored.filter((row) => row.score === scored[0].score)
  if (top.length === 1) return { status: 'exact', sizes: [top[0].size] }
  return { status: 'boundary', sizes: top.map((row) => row.size) }
}

function listedApparelSizes(sizes: string[]): string[] {
  const found: string[] = []
  for (const raw of sizes) {
    const matches = raw.match(SIZE_TOKEN_RE)
    if (!matches) continue
    for (const token of matches) {
      const size = canonicalSize(token)
      if (!found.includes(size)) found.push(size)
    }
  }
  return found
}

function nearestListedSize(size: string, listed: string[]): string {
  if (!listed.length || listed.includes(size)) return size
  const index = SIZE_ORDER.indexOf(size)
  if (index < 0) return listed[0]
  let best = listed[0]
  let bestDist = 99
  for (const item of listed) {
    const dist = Math.abs(SIZE_ORDER.indexOf(item) - index)
    if (dist < bestDist || (dist === bestDist && SIZE_ORDER.indexOf(item) > SIZE_ORDER.indexOf(best))) {
      best = item
      bestDist = dist
    }
  }
  return best
}

function measureFromSlice(slice: string, label: RegExp): RangePair | null {
  const match = slice.match(
    new RegExp(`(?:${label.source})\\s*(?:là|la|:)?\\s*(\\d{2,3}(?:[.,]\\d+)?)(?:\\s*[-–—]\\s*(\\d{2,3}(?:[.,]\\d+)?))?`, 'iu')
  )
  if (!match) return null
  const min = numberOf(match[1])
  const max = match[2] ? numberOf(match[2]) : min
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
  return [min, max]
}

function parseProductMeasureChart(text: string): ChartRow[] {
  const hits: Array<{ size: string; index: number }> = []
  SIZE_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SIZE_TOKEN_RE.exec(text))) {
    hits.push({ size: canonicalSize(match[1]), index: match.index })
  }
  const rows: ChartRow[] = []
  for (let i = 0; i < hits.length; i += 1) {
    const slice = text.slice(hits[i].index, Math.min(text.length, (hits[i + 1]?.index ?? hits[i].index + 160)))
    const row: ChartRow = {
      size: hits[i].size,
      height: measureFromSlice(slice, /cao|height/iu),
      weight: measureFromSlice(slice, /nặng|nang|kg|cân/iu),
      chest: measureFromSlice(slice, /vòng\s*ngực|ngực|nguc|chest/iu),
      shoulder: measureFromSlice(slice, /vai|shoulder/iu),
      waist: measureFromSlice(slice, /bụng|bung|eo|waist/iu),
    }
    if (row.chest || row.shoulder || row.waist || row.weight || row.height) rows.push(row)
  }
  return new Set(rows.map((row) => row.size)).size >= 2 ? rows : []
}

function apparelChartKind(context: FashionSizeProductContext | undefined): 'male' | 'female' | 'both' | 'skip' {
  const row = {
    name: context?.name,
    category_l1: context?.categoryL1,
    category_l2: context?.categoryL2,
    category_l3: context?.categoryL3,
  }
  if (inventoryRowLooksLikeShoes(row) || BAG_RE.test(String(context?.name ?? ''))) return 'skip'
  const kind = resolvePartnerSizeGuideKind({
    name: context?.name,
    categoryL1: context?.categoryL1,
    categoryL2: context?.categoryL2,
    categoryL3: context?.categoryL3,
  })
  if (!kind) {
    return APPAREL_RE.test(String(context?.name ?? '')) ? 'both' : 'skip'
  }
  if (kind.startsWith('giay') || kind.includes('tre-em') || kind.includes('bra')) return 'skip'
  if (kind.includes('nu') || kind.includes('bau')) return 'female'
  if (kind.includes('nam') || kind === 'the-thao-da-ngoai') return 'male'
  return APPAREL_RE.test(String(context?.name ?? '')) ? 'both' : 'skip'
}

function referencePick(
  signals: BodySignals,
  kind: 'male' | 'female' | 'both'
): { status: 'exact' | 'boundary' | 'unknown'; sizes: string[] } {
  if (kind === 'male') return pickChartSizes(MALE_REFERENCE, signals)
  if (kind === 'female') return pickChartSizes(FEMALE_REFERENCE, signals)
  const male = pickChartSizes(MALE_REFERENCE, signals)
  const female = pickChartSizes(FEMALE_REFERENCE, signals)
  const maleScore = male.sizes.length ? scoreRow(MALE_REFERENCE.find((row) => row.size === male.sizes[0])!, signals) : 0
  const femaleScore = female.sizes.length
    ? scoreRow(FEMALE_REFERENCE.find((row) => row.size === female.sizes[0])!, signals)
    : 0
  if (maleScore === 0 && femaleScore === 0) return { status: 'unknown', sizes: [] }
  if (femaleScore > maleScore) return female
  return male
}

function listedUniformNumbers(sizes: string[], digits: 2 | 3, min: number, max: number): number[] | null {
  if (sizes.length < 2) return null
  const re = digits === 3 ? /^\d{3}$/ : /^\d{2}$/
  const nums: number[] = []
  for (const raw of sizes) {
    const token = raw.trim()
    if (!re.test(token)) return null
    const value = Number(token)
    if (value < min || value > max) return null
    nums.push(value)
  }
  return nums.sort((a, b) => a - b)
}

function askedShoeEu(text: string): number | null {
  const match = text.match(/(?:size|sz|cỡ|co)\s*(3[2-9]|4[0-9]|50)\b/iu)
  if (!match) return null
  return Number(match[1])
}

function extractAskedListedSize(message: string, sizes: string[]): string | null {
  const listed = listedApparelSizes(sizes)
  if (!listed.length) return null
  const sorted = [...listed].sort((a, b) => b.length - a.length)
  for (const size of sorted) {
    const escaped = size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re =
      size.length <= 2
        ? new RegExp(`(?:size|sz|cỡ|co)\\s*${escaped}\\b`, 'iu')
        : new RegExp(`(?:size|sz|cỡ|co)\\s*${escaped}\\b|\\b${escaped}\\b`, 'iu')
    if (re.test(message)) return size
  }
  return null
}

function productListResult(
  signals: BodySignals,
  ranges: FashionSizeRecommendation['ranges'],
  patch: Partial<FashionSizeRecommendation>
): FashionSizeRecommendation {
  return {
    status: 'unknown',
    source: 'product',
    weightKg: signals.weightKg,
    heightCm: signals.heightCm,
    recommendedSize: null,
    candidateSizes: [],
    ranges,
    askUsualSize: false,
    referenceSize: null,
    ...patch,
  }
}

export function resolveFashionSizeRecommendation(
  customerMessage: string,
  sizes: string[] | null | undefined,
  context?: FashionSizeProductContext
): FashionSizeRecommendation {
  const text = String(customerMessage ?? '')
  const signals = parseBodySignals(text)
  const sizeList = Array.isArray(sizes) ? sizes.map((size) => String(size ?? '')) : []
  const ranges = sizeList.map(parseRange).filter((range): range is NonNullable<typeof range> => Boolean(range))

  if (signals.weightKg && ranges.length > 0) {
    const matches = ranges.filter((range) => signals.weightKg! >= range.minKg && signals.weightKg! <= range.maxKg)
    const candidateSizes = [...new Set(matches.map((range) => range.size))]
    if (candidateSizes.length === 1) {
      return {
        status: 'exact',
        source: 'product',
        weightKg: signals.weightKg,
        heightCm: signals.heightCm,
        recommendedSize: candidateSizes[0],
        candidateSizes,
        ranges,
        askUsualSize: true,
        referenceSize: null,
      }
    }
    return {
      status: candidateSizes.length > 1 ? 'boundary' : 'unknown',
      source: 'product',
      weightKg: signals.weightKg,
      heightCm: signals.heightCm,
      recommendedSize: null,
      candidateSizes,
      ranges,
      askUsualSize: true,
      referenceSize: null,
    }
  }

  const productChart = parseProductMeasureChart(String(context?.productText ?? ''))
  if (productChart.length > 0 && hasBodySignal(signals)) {
    const picked = pickChartSizes(productChart, signals)
    return {
      status: picked.status,
      source: 'product',
      weightKg: signals.weightKg,
      heightCm: signals.heightCm,
      recommendedSize: picked.status === 'exact' ? picked.sizes[0] : null,
      candidateSizes: picked.sizes,
      ranges,
      askUsualSize: true,
      referenceSize: null,
    }
  }

  const heightSizes = listedUniformNumbers(sizeList, 3, 140, 230)
  if (heightSizes) {
    if (signals.heightCm == null) {
      return productListResult(signals, ranges, { candidateSizes: heightSizes.map(String) })
    }
    const chosen = heightSizes.find((n) => n >= signals.heightCm!) ?? heightSizes[heightSizes.length - 1]
    return productListResult(signals, ranges, {
      status: 'exact',
      recommendedSize: String(chosen),
      candidateSizes: heightSizes.map(String),
    })
  }

  const shoeSizes = listedUniformNumbers(sizeList, 2, 32, 50)
  if (shoeSizes) {
    const askedShoe = askedShoeEu(text)
    if (askedShoe != null && shoeSizes.includes(askedShoe)) {
      return productListResult(signals, ranges, {
        status: 'exact',
        recommendedSize: String(askedShoe),
        candidateSizes: shoeSizes.map(String),
      })
    }
    return productListResult(signals, ranges, { candidateSizes: shoeSizes.map(String) })
  }

  if (productChart.length === 0 && ranges.length === 0) {
    const asked = extractAskedListedSize(text, sizeList)
    if (asked) {
      return productListResult(signals, ranges, {
        recommendedSize: asked,
        candidateSizes: [asked],
      })
    }
  }

  const kind = apparelChartKind(context)
  if (kind !== 'skip' && hasBodySignal(signals) && ranges.length === 0) {
    const listed = listedApparelSizes(sizeList)
    if (sizeList.some((size) => size.trim()) && listed.length === 0) {
      return productListResult(signals, ranges, {
        candidateSizes: sizeList.map((size) => size.trim()).filter(Boolean),
      })
    }
    const picked = referencePick(signals, kind)
    const snapped =
      picked.sizes.length > 0 ? [...new Set(picked.sizes.map((size) => nearestListedSize(size, listed)))] : []
    return {
      status: picked.status,
      source: 'reference',
      weightKg: signals.weightKg,
      heightCm: signals.heightCm,
      recommendedSize: picked.status === 'exact' ? snapped[0] ?? null : null,
      candidateSizes: picked.status === 'boundary' ? snapped : picked.sizes,
      ranges,
      askUsualSize: true,
      referenceSize: picked.status === 'exact' ? picked.sizes[0] ?? null : null,
    }
  }

  return emptyResult(signals, ranges)
}

export function fashionSizeRecommendationPrompt(result: FashionSizeRecommendation): string {
  const ask = result.askUsualSize
    ? 'Kèm đúng một câu hỏi: khách hay mặc size gì (nếu khách chưa nói).'
    : ''
  if (result.source === 'product' && result.recommendedSize && /^\d{3}$/.test(result.recommendedSize)) {
    const listed = result.candidateSizes.join(', ')
    const min = result.candidateSizes[0]
    const below = result.heightCm != null && min != null && result.heightCm < Number(min)
    if (below) {
      return `\n\n[Kết quả chọn size — số chiều cao trên sản phẩm]\nDanh sách size là số chiều cao (${listed}), không phải S/M/L. Khách cao ${result.heightCm} cm, thấp hơn size nhỏ nhất ${min}. Nói size nhỏ nhất đang có là ${result.recommendedSize}. Không bịa size chữ.`
    }
    return `\n\n[Kết quả chọn size — số chiều cao trên sản phẩm]\nDanh sách size là số chiều cao (${listed}), không phải S/M/L. Khách cao ${result.heightCm} cm. Tư vấn đúng size ${result.recommendedSize}. Không đổi sang size chữ.`
  }
  if (
    result.source === 'product' &&
    result.status === 'unknown' &&
    result.candidateSizes.length >= 2 &&
    result.candidateSizes.every((size) => /^\d{3}$/.test(size))
  ) {
    return `\n\n[Kết quả chọn size — số chiều cao trên sản phẩm]\nSản phẩm chỉ có size chiều cao ${result.candidateSizes.join(', ')}. Chưa có chiều cao của khách. Hỏi chiều cao. Không bịa S/M/L.`
  }
  if (
    result.source === 'product' &&
    result.status === 'exact' &&
    result.recommendedSize &&
    /^\d{2}$/.test(result.recommendedSize)
  ) {
    return `\n\n[Kết quả chọn size — size giày trong danh sách]\nSản phẩm có size ${result.candidateSizes.join(', ')}. Size ${result.recommendedSize} có trong danh sách. Không nói size ngoài danh sách.`
  }
  if (
    result.source === 'product' &&
    result.status === 'unknown' &&
    result.candidateSizes.length >= 2 &&
    result.candidateSizes.every((size) => /^\d{2}$/.test(size) && Number(size) >= 32 && Number(size) <= 50)
  ) {
    const min = result.candidateSizes[0]
    const max = result.candidateSizes[result.candidateSizes.length - 1]
    return `\n\n[Kết quả chọn size — size giày trong danh sách]\nSản phẩm chỉ có size ${min}–${max}. Không quy đổi số đo cm sang size ngoài danh sách. Không nói size không có.`
  }
  if (
    result.source === 'product' &&
    result.status === 'unknown' &&
    result.ranges.length === 0 &&
    result.candidateSizes.length === 1 &&
    result.recommendedSize
  ) {
    return `\n\n[Kết quả chọn size — size khách hỏi có trong danh sách]\nSize ${result.recommendedSize} có trong thông tin sản phẩm. Không có bảng số đo theo cân hoặc chiều cao nên không kết luận vừa hay không. Không đổi sang size khác.`
  }
  if (result.status === 'exact' && result.source === 'product' && result.recommendedSize) {
    return `\n\n[Kết quả chọn size — thông tin sản phẩm, ưu tiên tuyệt đối]\nKhách nặng ${result.weightKg} kg. Size ${result.recommendedSize} có trong thông tin sản phẩm và khớp số đo. Bắt buộc tư vấn size ${result.recommendedSize}. Không suy đoán size khác. ${ask}`
  }
  if (result.status === 'boundary' && result.source === 'product') {
    return `\n\n[Kết quả chọn size — thông tin sản phẩm, ranh giới]\nCân nặng ${result.weightKg} kg nằm trên ranh giới các size ${result.candidateSizes.join(
      ' / '
    )} trong thông tin sản phẩm. Không chốt một size. ${ask}`
  }
  if (result.source === 'product' && result.weightKg !== null) {
    const listed = result.ranges.map((range) => range.size).join(', ')
    return `\n\n[Kết quả chọn size — thông tin sản phẩm chưa khớp]\nBảng size của sản phẩm không có khoảng khớp chắc ${result.weightKg} kg. Chỉ nhắc các size có trong thông tin sản phẩm${
      listed ? ` (${listed})` : ''
    }. Không bịa size ngoài danh sách. Không nói sẽ kiểm tra bảng size xưởng. ${ask}`
  }
  if (result.status === 'exact' && result.source === 'reference' && result.recommendedSize) {
    const snapped =
      result.referenceSize && result.referenceSize !== result.recommendedSize
        ? ` Chuẩn số đông là ${result.referenceSize}; thông tin sản phẩm không có size đó nên gợi ý size ${result.recommendedSize} (size gần nhất còn trong thông tin sản phẩm).`
        : ` Gợi ý size ${result.recommendedSize}.`
    return `\n\n[Kết quả chọn size — chuẩn tham khảo số đông]\nThông tin sản phẩm không có bảng size. Theo chuẩn size tham khảo của số đông người dùng.${snapped} Nói rõ đây là size tham khảo, không phải số đo xưởng của riêng mã này. ${ask} Cấm nói «không dám chốt», «chưa có bảng size», «em sẽ kiểm tra bảng size xưởng».`
  }
  if (result.status === 'boundary' && result.source === 'reference') {
    return `\n\n[Kết quả chọn size — chuẩn tham khảo số đông, ranh giới]\nThông tin sản phẩm không có bảng size. Số đo nằm giữa các size ${result.candidateSizes.join(
      ' / '
    )} trên chuẩn tham khảo số đông. Nêu các size đó là tham khảo, không chốt một size. ${ask} Cấm nói sẽ kiểm tra bảng size xưởng.`
  }
  if (result.source === 'reference' && result.askUsualSize) {
    return `\n\n[Kết quả chọn size — chưa đủ để chốt chuẩn tham khảo]\nThông tin sản phẩm không có bảng size và số đo chưa đủ để chọn một cỡ trên chuẩn số đông. ${ask} Không nói sẽ kiểm tra bảng size xưởng.`
  }
  return ''
}

export function enforceFashionSizeRecommendation(
  message: string,
  result: FashionSizeRecommendation | null
): string {
  if (!result || result.status !== 'exact' || !result.recommendedSize) return message
  return message.replace(
    /\b(size|cỡ)\s+(?:\d{2,3}\s*\/\s*)?(?:\d?x{0,3}l|[sml]|[2-9]xl)\b/giu,
    (_match, prefix: string) => `${prefix} ${result.recommendedSize}`
  )
}

function rewriteUnlistedShoeSize(message: string, result: FashionSizeRecommendation): string {
  if (result.source !== 'product' || result.status !== 'unknown') return message
  if (result.candidateSizes.length < 2 || !result.candidateSizes.every((size) => /^\d{2}$/.test(size))) return message
  const allowed = new Set(result.candidateSizes)
  const min = result.candidateSizes[0]
  const max = result.candidateSizes[result.candidateSizes.length - 1]
  return message
    .split(/(?<=[.!?\n])\s+/)
    .map((part) => {
      if (/không\s*có|khong\s*co|không\s*thấy|khong\s*thay/i.test(part)) return part
      return part.replace(/\b(?:size|cỡ)\s*(3[2-9]|4[0-9]|50)\b/giu, (full, num: string) =>
        allowed.has(num) ? full : `size ${min}–${max}`
      )
    })
    .join(' ')
}

function whoFromMessage(message: string): string {
  const match = message.match(/(?:^|[^\p{L}])(anh|chị)(?=[^\p{L}]|$)/iu)
  const word = match?.[1] ?? 'Mình'
  return word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1)
}

/** Gỡ câu từ chối chốt size khi đã có chuẩn tham khảo, rồi hỏi size khách hay mặc. */
export function finalizeFashionSizeCustomerMessage(
  message: string,
  result: FashionSizeRecommendation | null
): string {
  let raw = String(message ?? '').trim()
  if (!raw || !result) return message
  if (result.source === 'reference' && result.recommendedSize) {
    REFUSAL_SENTENCE_RE.lastIndex = 0
    if (REFUSAL_SENTENCE_RE.test(raw)) {
      REFUSAL_SENTENCE_RE.lastIndex = 0
      const who = whoFromMessage(raw)
      const advice = `${who} tham khảo size ${result.recommendedSize} theo chuẩn size số đông, vì thông tin sản phẩm chưa có bảng size riêng.`
      raw = raw.replace(REFUSAL_SENTENCE_RE, ' ').replace(/\s{2,}/g, ' ').trim()
      raw = `${advice}${raw ? ` ${raw}` : ''}`
    }
  }
  raw = enforceFashionSizeRecommendation(raw, result)
  raw = rewriteUnlistedShoeSize(raw, result)
  if (!result.askUsualSize || USUAL_SIZE_RE.test(raw)) return raw.trim()
  const who = whoFromMessage(raw)
  return `${raw.trim()} ${who} hay mặc size gì để em đối chiếu thêm nhé?`.trim()
}
