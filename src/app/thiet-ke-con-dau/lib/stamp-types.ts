/**
 * Định nghĩa các loại con dấu và cấu hình trường theo từng loại.
 * Tham chiếu: docs/thiet-ke-con-dau-requirements.md
 */

export type StampType =
  | 'doanh-nghiep'
  | 'chi-nhanh'
  | 'chuc-danh'
  | 'dia-chi'
  | 'da-thu-tien'
  | 'trang-tri'

export const STAMP_TYPES: Record<
  StampType,
  {
    defaultMainText?: string
    fields: {
      key: string
      required: boolean
    }[]
  }
> = {
  'doanh-nghiep': {
    fields: [
      { key: 'companyName', required: true },
      { key: 'taxCode', required: true },
      { key: 'address', required: false },
    ],
  },
  'chi-nhanh': {
    fields: [
      { key: 'companyName', required: true },
      { key: 'taxCode', required: true },
      { key: 'branchName', required: true },
      { key: 'address', required: false },
    ],
  },
  'chuc-danh': {
    fields: [
      { key: 'companyName', required: true },
      { key: 'taxCode', required: true },
      { key: 'position', required: true },
      { key: 'holderName', required: true },
      { key: 'address', required: false },
    ],
  },
  'dia-chi': {
    fields: [
      { key: 'address', required: true },
      { key: 'companyName', required: false },
    ],
  },
  'da-thu-tien': {
    defaultMainText: 'ĐÃ THU TIỀN',
    fields: [
      { key: 'mainText', required: true },
      { key: 'subText', required: false },
    ],
  },
  'trang-tri': {
    fields: [
      { key: 'mainText', required: true },
      { key: 'subText', required: false },
    ],
  },
}

export const SHAPE_OPTIONS = [
  { value: 'tron' },
  { value: 'vuong' },
  { value: 'elip' },
  { value: 'chu-nhat' },
] as const

/** Tỷ lệ khung hình tự động theo hình dạng – người dùng không chọn */
export const SHAPE_TO_ASPECT_RATIO: Record<string, string> = {
  tron: '1:1',
  vuong: '1:1',
  elip: '3:2',
  'chu-nhat': '4:3',
}

export const COLOR_OPTIONS = [
  { value: 'do' },
  { value: 'xanh-la' },
  { value: 'xanh-duong' },
  { value: 'den' },
  { value: 'vang' },
  { value: 'cam' },
] as const

export const SIZE_OPTIONS_MM = [20, 22, 25, 30, 35, 40, 45] as const

/** Tỷ lệ ảnh mà API ảnh hỗ trợ; hình chữ nhật chọn mm → map sang tỷ lệ gần nhất */
export const VALID_STAMP_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4'] as const

function aspectRatioStringToNumber(s: string): number {
  const [a, b] = s.split(':').map(Number)
  if (!a || !b) return 1
  return a / b
}

export function closestAspectRatioFromMmSize(
  widthMm: number,
  heightMm: number
): (typeof VALID_STAMP_ASPECT_RATIOS)[number] {
  if (!(widthMm > 0) || !(heightMm > 0)) return '4:3'
  const target = widthMm / heightMm
  let best: (typeof VALID_STAMP_ASPECT_RATIOS)[number] = '4:3'
  let bestDiff = Infinity
  for (const r of VALID_STAMP_ASPECT_RATIOS) {
    const d = Math.abs(aspectRatioStringToNumber(r) - target)
    if (d < bestDiff) {
      bestDiff = d
      best = r
    }
  }
  return best
}

export function nearestSizeMmOption(n: number): (typeof SIZE_OPTIONS_MM)[number] {
  if (!Number.isFinite(n)) return 25
  return SIZE_OPTIONS_MM.reduce(
    (best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best),
    SIZE_OPTIONS_MM[0]!
  )
}
