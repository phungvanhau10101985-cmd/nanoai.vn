import { looksLikeChineseJinWeightRange } from './fashion-size-weight-units'

export type FashionSizeRecommendation = {
  status: 'exact' | 'boundary' | 'unknown'
  weightKg: number | null
  heightCm: number | null
  recommendedSize: string | null
  candidateSizes: string[]
  ranges: Array<{ size: string; minKg: number; maxKg: number }>
}

const CUSTOMER_WEIGHT_RE = /(?:^|\s)(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilogram)\b/iu
const CUSTOMER_HEIGHT_RE = /(?:^|\s)(\d{2,3}(?:[.,]\d+)?)\s*(?:cm|centimet)/iu
const SIZE_RANGE_RE =
  /^(?:\d{2,3}\s*\/\s*)?([a-z0-9-]{1,12})\s*\(\s*(\d{2,3}(?:[.,]\d+)?)\s*[-–—]\s*(\d{2,3}(?:[.,]\d+)?)\s*(kg|斤|jin|cân\s*tq)?\s*\)$/iu

function numberOf(raw: string): number {
  return Number(raw.replace(',', '.'))
}

function parseRange(raw: string): { size: string; minKg: number; maxKg: number } | null {
  const match = raw.trim().match(SIZE_RANGE_RE)
  if (!match) return null
  let min = numberOf(match[2])
  let max = numberOf(match[3])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null
  const unit = (match[4] ?? '').toLowerCase()
  if (unit === '斤' || unit === 'jin' || unit.includes('cân') || (!unit && looksLikeChineseJinWeightRange(min, max))) {
    min /= 2
    max /= 2
  }
  return { size: match[1].toUpperCase(), minKg: min, maxKg: max }
}

export function resolveFashionSizeRecommendation(
  customerMessage: string,
  sizes: string[] | null | undefined
): FashionSizeRecommendation {
  const weightMatch = String(customerMessage ?? '').match(CUSTOMER_WEIGHT_RE)
  const heightMatch = String(customerMessage ?? '').match(CUSTOMER_HEIGHT_RE)
  const weightKg = weightMatch ? numberOf(weightMatch[1]) : null
  const heightCm = heightMatch ? numberOf(heightMatch[1]) : null
  const ranges = (Array.isArray(sizes) ? sizes : [])
    .map(parseRange)
    .filter((range): range is NonNullable<typeof range> => Boolean(range))

  if (!weightKg || ranges.length === 0) {
    return {
      status: 'unknown',
      weightKg,
      heightCm,
      recommendedSize: null,
      candidateSizes: [],
      ranges,
    }
  }

  const matches = ranges.filter((range) => weightKg >= range.minKg && weightKg <= range.maxKg)
  const candidateSizes = [...new Set(matches.map((range) => range.size))]
  if (candidateSizes.length === 1) {
    return {
      status: 'exact',
      weightKg,
      heightCm,
      recommendedSize: candidateSizes[0],
      candidateSizes,
      ranges,
    }
  }
  return {
    status: candidateSizes.length > 1 ? 'boundary' : 'unknown',
    weightKg,
    heightCm,
    recommendedSize: null,
    candidateSizes,
    ranges,
  }
}

export function fashionSizeRecommendationPrompt(result: FashionSizeRecommendation): string {
  if (result.status === 'exact' && result.recommendedSize) {
    return `\n\n[Kết quả chọn size deterministic — ưu tiên tuyệt đối]\nKhách nặng ${result.weightKg} kg; bảng sizes_json khớp duy nhất size ${result.recommendedSize}. Bắt buộc tư vấn size ${result.recommendedSize}; không tự suy đoán size khác.`
  }
  if (result.status === 'boundary') {
    return `\n\n[Kết quả chọn size deterministic — ranh giới]\nCân nặng ${result.weightKg} kg nằm trên ranh giới các size ${result.candidateSizes.join(
      ' / '
    )}. Không chốt một size duy nhất; hỏi thêm số đo/form mặc mong muốn.`
  }
  if (result.weightKg !== null) {
    return `\n\n[Kết quả chọn size deterministic — chưa đủ dữ liệu]\nKhông có khoảng sizes_json nào khớp chắc chắn ${result.weightKg} kg. Không đoán size; nói rõ cần shop kiểm tra hoặc hỏi thêm số đo.`
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
