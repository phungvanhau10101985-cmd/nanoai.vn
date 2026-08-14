/**
 * Tỷ lệ gemini-3-pro-image chấp nhận thật (bỏ 1:4 / 1:8 — runtime reject).
 * Có 4:1 và 8:1 để wordmark header khớp khung vẽ hẹp ngang.
 */
export const GEMINI_WORKING_IMAGE_ASPECT_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:1',
  '4:3',
  '4:5',
  '5:4',
  '8:1',
  '9:16',
  '16:9',
  '21:9',
] as const

const WORKING_RATIO_VALUES: [string, number][] = GEMINI_WORKING_IMAGE_ASPECT_RATIOS.map((ar) => {
  const [w, h] = ar.split(':').map(Number)
  return [ar, w / h]
})

/** Chọn tỷ lệ model gần nhất với khung người dùng vẽ. */
export function closestGeminiImageAspectRatio(width: number, height: number): string {
  const w = Math.max(1, Number(width) || 1)
  const h = Math.max(1, Number(height) || 1)
  const ratio = w / h
  let best = '1:1'
  let bestDiff = Infinity
  for (const [ar, value] of WORKING_RATIO_VALUES) {
    const diff = Math.abs(ratio - value)
    if (diff < bestDiff) {
      bestDiff = diff
      best = ar
    }
  }
  return best
}
