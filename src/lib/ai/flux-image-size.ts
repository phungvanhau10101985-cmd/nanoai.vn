/** Kích thước FLUX 3. Không gọi mạng. Bậc thấp nhất khách chọn là 1.5K, không có 1K. */

export const FLUX_MIN_SIDE = 256
export const FLUX_MAX_SIDE = 6256
export const FLUX_STEP = 16
export const FLUX_MAX_RATIO = 8
/** Trần pixel khi không có ảnh tham khảo. */
export const FLUX_MAX_PIXELS = 16_822_272
/** Trần pixel khi có ảnh tham khảo. */
export const FLUX_MAX_PIXELS_WITH_IMAGES = 4_194_304
/** Diện tích bậc 1.5K: 1536×1536, khoảng 2 MP. */
export const FLUX_AREA_1_5K = 1536 * 1536
/** Diện tích bậc 2K: 2048×2048. */
export const FLUX_AREA_2K = 2048 * 2048
/** Diện tích bậc 4K: 4096×4096. */
export const FLUX_AREA_4K = 4096 * 4096

export const FLUX_ASPECT_RATIOS = [
  '21:9',
  '2:1',
  '16:9',
  '3:2',
  '7:5',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '5:7',
  '2:3',
  '9:16',
  '1:2',
  '9:21',
] as const

export type FluxPixelSize = { width: number; height: number }

function roundStep(value: number): number {
  return Math.round(value / FLUX_STEP) * FLUX_STEP
}

/** Pixel in 300 dpi, cộng 3 mm tràn mỗi mép, làm tròn lên bội của 16. */
export function fluxPrintPixelsFromMm(widthMm: number, heightMm: number): FluxPixelSize {
  const px = (mm: number) => {
    const raw = ((Math.max(1, mm) + 6) / 25.4) * 300
    return Math.ceil(raw / FLUX_STEP) * FLUX_STEP
  }
  return { width: px(widthMm), height: px(heightMm) }
}

function clampRatio(width: number, height: number): FluxPixelSize {
  let w = Math.max(1, width)
  let h = Math.max(1, height)
  if (w / h > FLUX_MAX_RATIO) w = h * FLUX_MAX_RATIO
  else if (h / w > FLUX_MAX_RATIO) h = w * FLUX_MAX_RATIO
  return { width: w, height: h }
}

/**
 * Giữ tỷ lệ, nâng tới ít nhất bậc đã chọn, rồi kẹp vào trần API.
 * Có ảnh tham khảo thì trần là 4 MP.
 */
export function fitFluxPixels(
  width: number,
  height: number,
  options: { quality: '1.5K' | '2K' | '4K'; hasImages: boolean },
): FluxPixelSize {
  const ratioLocked = clampRatio(width, height)
  let w = ratioLocked.width
  let h = ratioLocked.height
  const cap = options.hasImages ? FLUX_MAX_PIXELS_WITH_IMAGES : FLUX_MAX_PIXELS
  const floorArea = options.quality === '4K' ? FLUX_AREA_4K : options.quality === '1.5K' ? FLUX_AREA_1_5K : FLUX_AREA_2K
  const desired = Math.max(w * h, floorArea)
  const area = Math.min(desired, cap)
  const scale = Math.sqrt(area / (w * h))
  w *= scale
  h *= scale

  const fitSide = () => {
    const long = Math.max(w, h)
    if (long > FLUX_MAX_SIDE) {
      const sideScale = FLUX_MAX_SIDE / long
      w *= sideScale
      h *= sideScale
    }
    const short = Math.min(w, h)
    if (short < FLUX_MIN_SIDE && short > 0) {
      const sideScale = FLUX_MIN_SIDE / short
      w *= sideScale
      h *= sideScale
    }
  }
  fitSide()
  fitSide()

  let rw = Math.min(FLUX_MAX_SIDE, Math.max(FLUX_MIN_SIDE, roundStep(w)))
  let rh = Math.min(FLUX_MAX_SIDE, Math.max(FLUX_MIN_SIDE, roundStep(h)))
  if (rw / rh > FLUX_MAX_RATIO) rw = Math.min(FLUX_MAX_SIDE, Math.max(FLUX_MIN_SIDE, roundStep(rh * FLUX_MAX_RATIO)))
  if (rh / rw > FLUX_MAX_RATIO) rh = Math.min(FLUX_MAX_SIDE, Math.max(FLUX_MIN_SIDE, roundStep(rw * FLUX_MAX_RATIO)))

  const minArea = Math.min(floorArea, cap)
  while (rw * rh < minArea && rw < FLUX_MAX_SIDE && rh < FLUX_MAX_SIDE) {
    const nextW = rw <= rh ? Math.min(FLUX_MAX_SIDE, rw + FLUX_STEP) : rw
    const nextH = rw <= rh ? rh : Math.min(FLUX_MAX_SIDE, rh + FLUX_STEP)
    if (nextW === rw && nextH === rh) break
    if (nextW * nextH > cap) break
    rw = nextW
    rh = nextH
  }
  while (rw * rh > cap && (rw > FLUX_MIN_SIDE || rh > FLUX_MIN_SIDE)) {
    if (rw >= rh && rw > FLUX_MIN_SIDE) rw -= FLUX_STEP
    else if (rh > FLUX_MIN_SIDE) rh -= FLUX_STEP
    else break
  }
  return { width: rw, height: rh }
}

export function fluxPixelsForPrintMm(
  widthMm: number,
  heightMm: number,
  options: { quality: '1.5K' | '2K' | '4K'; hasImages: boolean },
): FluxPixelSize {
  const raw = fluxPrintPixelsFromMm(widthMm, heightMm)
  return fitFluxPixels(raw.width, raw.height, options)
}

export function closestFluxAspectRatio(ratio: string | null | undefined): (typeof FLUX_ASPECT_RATIOS)[number] {
  const raw = String(ratio || '').trim()
  const [a, b] = raw.split(':').map(Number)
  const target = a > 0 && b > 0 ? a / b : 1
  let best: (typeof FLUX_ASPECT_RATIOS)[number] = '1:1'
  let bestDiff = Infinity
  for (const token of FLUX_ASPECT_RATIOS) {
    const [w, h] = token.split(':').map(Number)
    const diff = Math.abs(target - w / h)
    if (diff < bestDiff) {
      bestDiff = diff
      best = token
    }
  }
  return best
}
