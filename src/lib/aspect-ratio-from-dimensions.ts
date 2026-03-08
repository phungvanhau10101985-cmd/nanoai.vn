import { GEMINI_ASPECT_RATIOS } from '@/lib/label-size-presets'

const RATIO_VALUES: [string, number][] = GEMINI_ASPECT_RATIOS.map((ar) => {
  const [w, h] = ar.split(':').map(Number)
  return [ar, w / h]
})

/**
 * Chọn tỷ lệ khung hình khớp nhất với kích thước.
 * - horizontal (quay ngang): chữ nằm ngang theo chiều dài → aspect ratio theo L/W
 * - vertical (quay dọc): chữ nằm ngang theo chiều ngắn → aspect ratio theo W/L (swap)
 */
export function getAspectRatioFromDimensions(
  lengthMm: number,
  widthMm: number,
  textOrientation: 'horizontal' | 'vertical' = 'horizontal'
): string {
  const [long, short] = lengthMm >= widthMm ? [lengthMm, widthMm] : [widthMm, lengthMm]
  const ratio = textOrientation === 'horizontal' ? long / short : short / long
  let best = '1:1'
  let bestDiff = Infinity
  for (const [ar, v] of RATIO_VALUES) {
    const diff = Math.abs(ratio - v)
    if (diff < bestDiff) {
      bestDiff = diff
      best = ar
    }
  }
  return best
}

export const GEMINI_ASPECT_RATIO_LIST = GEMINI_ASPECT_RATIOS
