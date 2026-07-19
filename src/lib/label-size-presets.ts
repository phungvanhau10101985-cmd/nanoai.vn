/**
 * Tất cả tỷ lệ Gemini hỗ trợ – dùng chung cho tao-nhan, thiet-ke-bao-bi, ...
 * Cặp xoay 90°: 21:9 ⟷ 9:21, 16:9 ⟷ 9:16, 3:2 ⟷ 2:3, 4:3 ⟷ 3:4, 5:4 ⟷ 4:5
 */
export const GEMINI_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:21', '21:9'] as const

export type GeminiAspectRatio = (typeof GEMINI_ASPECT_RATIOS)[number]

/** Default portrait ratio for peel-and-stick back labels. */
export const DEFAULT_PRODUCT_LABEL_ASPECT_RATIO: GeminiAspectRatio = '2:3'

/** Default square ratio for tamper-evident seal stickers. */
export const DEFAULT_SEAL_STICKER_ASPECT_RATIO: GeminiAspectRatio = '1:1'

export function isValidGeminiAspectRatio(value: string): value is GeminiAspectRatio {
  return (GEMINI_ASPECT_RATIOS as readonly string[]).includes(value)
}

/** Danh sách tỷ lệ dạng {value, label} cho UI (Select, buttons) */
export const GEMINI_ASPECT_RATIO_OPTIONS = GEMINI_ASPECT_RATIOS.map((r) => ({ value: r, label: r }))

const RATIO_VALUES: { str: (typeof GEMINI_ASPECT_RATIOS)[number]; value: number }[] = [
  { str: '1:1', value: 1 },
  { str: '2:3', value: 2 / 3 },
  { str: '3:2', value: 1.5 },
  { str: '3:4', value: 0.75 },
  { str: '4:3', value: 4 / 3 },
  { str: '4:5', value: 0.8 },
  { str: '5:4', value: 1.25 },
  { str: '9:16', value: 9 / 16 },
  { str: '16:9', value: 16 / 9 },
  { str: '9:21', value: 9 / 21 },
  { str: '21:9', value: 21 / 9 },
]

/** Từ kích thước nhãn (mm) suy ra tỷ lệ Gemini gần nhất */
export function getClosestGeminiAspectRatio(widthMm: number, heightMm: number): (typeof GEMINI_ASPECT_RATIOS)[number] {
  if (!widthMm || !heightMm || !Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return '1:1'
  const ratio = widthMm / heightMm
  let best = RATIO_VALUES[0]
  let bestDiff = Infinity
  for (const r of RATIO_VALUES) {
    const diff = Math.abs(r.value - ratio)
    if (diff < bestDiff) {
      bestDiff = diff
      best = r
    }
  }
  return best.str
}

export type LabelSizePreset = {
  id: string
  widthMm: number
  heightMm: number
  aspectRatio: (typeof GEMINI_ASPECT_RATIOS)[number]
  labelVi: string
  labelEn: string
  labelZh: string
  labelJa: string
  labelKo: string
}

/** Các kích thước nhãn sản phẩm phổ biến (mm). aspectRatio = gần nhất với Gemini. */
export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: 'bottle-330', widthMm: 210, heightMm: 85, aspectRatio: '2:3', labelVi: 'Chai 330ml', labelEn: 'Bottle 330ml', labelZh: '330ml瓶', labelJa: '330mlボトル', labelKo: '330ml 병' },
  { id: 'bottle-500', widthMm: 210, heightMm: 100, aspectRatio: '2:3', labelVi: 'Chai 500ml', labelEn: 'Bottle 500ml', labelZh: '500ml瓶', labelJa: '500mlボトル', labelKo: '500ml 병' },
  { id: 'bottle-1l', widthMm: 250, heightMm: 180, aspectRatio: '3:4', labelVi: 'Chai 1L', labelEn: 'Bottle 1L', labelZh: '1升瓶', labelJa: '1Lボトル', labelKo: '1L 병' },
  { id: 'bottle-1.5l', widthMm: 280, heightMm: 200, aspectRatio: '3:4', labelVi: 'Chai 1,5L', labelEn: 'Bottle 1.5L', labelZh: '1.5升瓶', labelJa: '1.5Lボトル', labelKo: '1.5L 병' },
  { id: 'box-square', widthMm: 100, heightMm: 100, aspectRatio: '1:1', labelVi: 'Hộp vuông', labelEn: 'Square box', labelZh: '方盒', labelJa: '角箱', labelKo: '정사각형 상자' },
  { id: 'box-milk', widthMm: 150, heightMm: 80, aspectRatio: '9:16', labelVi: 'Hộp sữa / túi giấy', labelEn: 'Milk carton / paper bag', labelZh: '牛奶盒/纸袋', labelJa: '牛乳パック/紙袋', labelKo: '우유팩/종이백' },
  { id: 'bag-portrait', widthMm: 160, heightMm: 90, aspectRatio: '9:16', labelVi: 'Túi đứng', labelEn: 'Standing pouch', labelZh: '立式袋', labelJa: 'スタンドパウチ', labelKo: '세로 파우치' },
  { id: 'bag-landscape', widthMm: 160, heightMm: 90, aspectRatio: '16:9', labelVi: 'Túi ngang', labelEn: 'Landscape pouch', labelZh: '横式袋', labelJa: '横型パウチ', labelKo: '가로 파우치' },
  { id: 'box-front', widthMm: 120, heightMm: 100, aspectRatio: '4:5', labelVi: 'Mặt trước hộp', labelEn: 'Box front', labelZh: '盒正面', labelJa: '箱前面', labelKo: '상자 앞면' },
  { id: 'can-330', widthMm: 210, heightMm: 95, aspectRatio: '2:3', labelVi: 'Lon 330ml', labelEn: 'Can 330ml', labelZh: '330ml罐', labelJa: '330ml缶', labelKo: '330ml 캔' },
]
