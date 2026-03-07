/** Tất cả tỷ lệ Gemini hỗ trợ (landscape, portrait, square) */
const GEMINI_ASPECT_RATIOS: [string, number][] = [
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3],
  ['5:4', 5 / 4],
  ['4:5', 4 / 5],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['21:9', 21 / 9],
]

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
  for (const [ar, v] of GEMINI_ASPECT_RATIOS) {
    const diff = Math.abs(ratio - v)
    if (diff < bestDiff) {
      bestDiff = diff
      best = ar
    }
  }
  return best
}

export const GEMINI_ASPECT_RATIO_LIST = GEMINI_ASPECT_RATIOS.map(([ar]) => ar)
