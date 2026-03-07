/** Kích thước nhãn phổ biến (mm) – dùng cho client, không import sharp/pdf-lib */

export type PrintSizePreset = { value: string; widthMm: number; heightMm: number; label: string }

export const PRINT_SIZE_PRESETS: PrintSizePreset[] = [
  { value: '25x25', widthMm: 25, heightMm: 25, label: '25×25 mm' },
  { value: '40x60', widthMm: 40, heightMm: 60, label: '40×60 mm' },
  { value: '50x50', widthMm: 50, heightMm: 50, label: '50×50 mm' },
  { value: '50x70', widthMm: 50, heightMm: 70, label: '50×70 mm' },
  { value: '60x40', widthMm: 60, heightMm: 40, label: '60×40 mm' },
  { value: '70x50', widthMm: 70, heightMm: 50, label: '70×50 mm' },
  { value: '70x100', widthMm: 70, heightMm: 100, label: '70×100 mm' },
  { value: '100x70', widthMm: 100, heightMm: 70, label: '100×70 mm' },
  { value: '80x100', widthMm: 80, heightMm: 100, label: '80×100 mm (4:5)' },
  { value: '100x80', widthMm: 100, heightMm: 80, label: '100×80 mm (5:4)' },
  { value: '100x100', widthMm: 100, heightMm: 100, label: '100×100 mm' },
  { value: '70x124', widthMm: 70, heightMm: 124, label: '70×124 mm (9:16)' },
  { value: '124x70', widthMm: 124, heightMm: 70, label: '124×70 mm (16:9)' },
  { value: 'a6', widthMm: 105, heightMm: 148, label: 'A6 (105×148 mm)' },
  { value: 'a6-landscape', widthMm: 148, heightMm: 105, label: 'A6 ngang (148×105 mm)' },
  { value: 'a5', widthMm: 148, heightMm: 210, label: 'A5 (148×210 mm)' },
  { value: 'a5-landscape', widthMm: 210, heightMm: 148, label: 'A5 ngang (210×148 mm)' },
  { value: 'a4', widthMm: 210, heightMm: 297, label: 'A4 (210×297 mm)' },
  { value: 'a4-landscape', widthMm: 297, heightMm: 210, label: 'A4 ngang (297×210 mm)' },
  { value: '21x9-banner', widthMm: 210, heightMm: 90, label: '210×90 mm (21:9)' },
]

const ASPECT_TOLERANCE = 0.08

/** Parse "1:1", "3:4", "16:9" → số thực (width/height) */
function parseAspectRatio(ratioStr: string): number {
  const parts = ratioStr.trim().split(':').map(Number)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return 1
  return parts[0] / parts[1]
}

/** Tỷ lệ chuẩn để map từ kích thước ảnh */
const KNOWN_RATIOS: { str: string; value: number }[] = [
  { str: '1:1', value: 1 },
  { str: '2:3', value: 2 / 3 },
  { str: '3:2', value: 1.5 },
  { str: '3:4', value: 0.75 },
  { str: '4:3', value: 4 / 3 },
  { str: '4:5', value: 0.8 },
  { str: '5:4', value: 1.25 },
  { str: '9:16', value: 9 / 16 },
  { str: '16:9', value: 16 / 9 },
  { str: '21:9', value: 21 / 9 },
]

/** Từ kích thước ảnh (width, height) suy ra tỷ lệ chuẩn gần nhất */
export function inferAspectRatioFromDimensions(width: number, height: number): string | null {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return null
  const ratio = width / height
  let best = KNOWN_RATIOS[0]
  let bestDiff = Infinity
  for (const r of KNOWN_RATIOS) {
    const diff = Math.abs(r.value - ratio) / Math.max(ratio, 0.01)
    if (diff < bestDiff && diff <= ASPECT_TOLERANCE) {
      bestDiff = diff
      best = r
    }
  }
  return bestDiff <= ASPECT_TOLERANCE ? best.str : null
}

/**
 * Lọc preset chỉ giữ những kích thước phù hợp tỷ lệ ảnh.
 * Mỗi ảnh chỉ in đúng với khổ có cùng tỷ lệ.
 * Phải đúng cả chiều: 21:9 (ngang) → 210×90 (rộng×cao), 9:16 (dọc) → 70×124.
 */
export function getPresetsForAspectRatio(aspectRatio: string | undefined): PrintSizePreset[] {
  if (!aspectRatio?.trim()) return []
  const target = parseAspectRatio(aspectRatio)
  if (!Number.isFinite(target)) return []
  return PRINT_SIZE_PRESETS.filter((p) => {
    const presetRatio = p.widthMm / p.heightMm
    const diff = Math.abs(presetRatio - target) / Math.max(target, 0.01)
    if (diff > ASPECT_TOLERANCE) return false
    const isLandscape = target > 1
    const isPortrait = target < 1
    const isSquare = Math.abs(target - 1) < 0.01
    const presetLandscape = p.widthMm > p.heightMm
    const presetPortrait = p.widthMm < p.heightMm
    const presetSquare = Math.abs(presetRatio - 1) < 0.01
    if (isLandscape && !presetLandscape) return false
    if (isPortrait && !presetPortrait) return false
    if (isSquare && !presetSquare) return false
    return true
  })
}
