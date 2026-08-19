/**
 * Tỷ lệ gemini-3-pro-image chấp nhận thật (bỏ 1:4 / 1:8 — runtime reject).
 * Có 4:1 và 8:1 cho banner leaderboard / LED — không dùng cho logo.
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

/**
 * Tỷ lệ tạo logo — chỉ ratio Gemini image API chấp nhận ổn định.
 * Không gồm 4:1 / 8:1 (model cũ và một số key reject 400).
 */
export const LOGO_GEMINI_ASPECT_RATIOS = [
  '1:1',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '4:5',
  '5:4',
  '16:9',
  '9:16',
  '21:9',
] as const

export type LogoGeminiAspectRatio = (typeof LOGO_GEMINI_ASPECT_RATIOS)[number]

export const DEFAULT_LOGO_GEMINI_ASPECT_RATIO: LogoGeminiAspectRatio = '16:9'

const LEGACY_LOGO_ASPECT_MAP: Record<string, LogoGeminiAspectRatio> = {
  '4:1': '16:9',
  '8:1': '21:9',
  '4:5': '3:4',
  '5:4': '4:3',
}

function ratioValues(allowed: readonly string[]): [string, number][] {
  return allowed.map((ar) => {
    const [w, h] = ar.split(':').map(Number)
    return [ar, w / h]
  })
}

function closestFromList(width: number, height: number, allowed: readonly string[]): string {
  const w = Math.max(1, Number(width) || 1)
  const h = Math.max(1, Number(height) || 1)
  const ratio = w / h
  let best = allowed[0] ?? '1:1'
  let bestDiff = Infinity
  for (const [ar, value] of ratioValues(allowed)) {
    const diff = Math.abs(ratio - value)
    if (diff < bestDiff) {
      bestDiff = diff
      best = ar
    }
  }
  return best
}

/** Chọn tỷ lệ model gần nhất với khung người dùng vẽ (banner / ảnh chung). */
export function closestGeminiImageAspectRatio(width: number, height: number): string {
  return closestFromList(width, height, GEMINI_WORKING_IMAGE_ASPECT_RATIOS)
}

/** Chọn tỷ lệ logo gần nhất — chỉ trong LOGO_GEMINI_ASPECT_RATIOS. */
export function closestLogoGeminiAspectRatio(width: number, height: number): LogoGeminiAspectRatio {
  return normalizeLogoAspectRatioForGemini(closestFromList(width, height, LOGO_GEMINI_ASPECT_RATIOS))
}

/** Chuẩn hóa tỷ lệ logo trước khi gọi Gemini — tránh 400 aspect ratio not supported. */
export function normalizeLogoAspectRatioForGemini(ratio: string | undefined | null): LogoGeminiAspectRatio {
  const raw = String(ratio ?? '').trim()
  if ((LOGO_GEMINI_ASPECT_RATIOS as readonly string[]).includes(raw)) {
    return raw as LogoGeminiAspectRatio
  }
  const mapped = LEGACY_LOGO_ASPECT_MAP[raw]
  if (mapped) return mapped
  return DEFAULT_LOGO_GEMINI_ASPECT_RATIO
}
