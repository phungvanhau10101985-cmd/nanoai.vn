import { closestGeminiImageAspectRatio } from './gemini-working-aspect'

export type LogoSlotKind = 'header' | 'footer' | 'other'
export type LogoDeviceKind = 'mobile' | 'tablet' | 'desktop'

function parseRgb(color: string): { r: number; g: number; b: number } {
  const raw = String(color || '').trim()
  const rgb = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  }
  const hex = raw.replace('#', '')
  if (hex.length === 6 && /^[0-9a-f]+$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  return { r: 255, g: 255, b: 255 }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const n = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${n(r)}${n(g)}${n(b)}`
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function hexOrRgbToLabel(color: string): { hex: string; label: string; rgb: { r: number; g: number; b: number } } {
  const rgb = parseRgb(color)
  const lum = relativeLuminance(rgb)
  const hex = toHex(rgb)
  const label = lum >= 0.85 ? 'white' : lum >= 0.72 ? 'light' : lum <= 0.08 ? 'black' : 'dark'
  return { hex, label, rgb }
}

/** Tỷ lệ Gemini gần nhất với khung người dùng vẽ hoặc chọn. */
export function logoAspectFromSize(width: number, height: number): string {
  return closestGeminiImageAspectRatio(width, height)
}

/** Kích thước ô logo ban đầu theo tỷ lệ đã chọn. */
export function logoSizeFromAspect(aspect: string, device: LogoDeviceKind): { w: number; h: number } {
  const [aw, ah] = String(aspect || '4:1').split(':').map(Number)
  const rw = Number.isFinite(aw) && aw > 0 ? aw : 4
  const rh = Number.isFinite(ah) && ah > 0 ? ah : 1
  const maxW = device === 'mobile' ? 168 : device === 'tablet' ? 196 : 220
  const maxH = device === 'mobile' ? 52 : device === 'tablet' ? 58 : 64
  let w = maxW
  let h = Math.round((w * rh) / rw)
  if (h > maxH) {
    h = maxH
    w = Math.round((h * rw) / rh)
  }
  return { w: Math.max(24, w), h: Math.max(18, h) }
}

export type LogoSlotPromptInput = {
  shopTitle: string
  slot: LogoSlotKind
  device: LogoDeviceKind
  bgColor: string
  width: number
  height: number
  inkColor?: string
  aspectRatio?: string
}

function aspectValue(aspect: string, width: number, height: number): number {
  const [aw, ah] = String(aspect || '').split(':').map(Number)
  if (Number.isFinite(aw) && Number.isFinite(ah) && aw > 0 && ah > 0) return aw / ah
  return Math.max(1, width) / Math.max(1, height)
}

/** Câu màu: chỉ hex user chọn ở bảng Màu nền / Màu logo — không lấy màu giao diện. */
export function buildLogoColorFacts(input: Pick<LogoSlotPromptInput, 'bgColor' | 'inkColor'>): string {
  const canvas = hexOrRgbToLabel(input.bgColor)
  const rawInk = input.inkColor?.trim() || ''
  const inkLooksLikeColor = /^#|^rgba?\(/i.test(rawInk)
  const chosenInk = rawInk && inkLooksLikeColor ? hexOrRgbToLabel(rawInk) : null
  const inkHex = chosenInk ? chosenInk.hex : rawInk || '#ffffff'
  const inkLabel = chosenInk ? (inkHex === '#ffffff' ? 'white' : inkHex) : rawInk || 'white'
  return [
    `Use ONLY the two colors the user picked in the editor. Do not sample colors from the shop UI, header photo, theme tokens, or any attached page screenshot.`,
    `The entire generated image canvas MUST be a flat fill of exactly ${canvas.hex} (user-picked background), edge to edge, including the bottom 20% and all four borders.`,
    `No second plate, card, circle, badge, or colored box behind the letters.`,
    `Isolate the mark on that flat fill so the background can be cut out to a transparent PNG. No texture, gradient, or photo scene.`,
    `Lettering and icon marks MUST be exactly ${inkLabel} (${inkHex}) — the user-picked logo color. Do not substitute another brand or interface color.`,
    `Forbidden: any color that is not ${canvas.hex} or ${inkHex}. No mockup frame, no drop shadow panel.`,
    `Forbidden: a white, cream, beige, grey, or lighter stripe/bar at the top or bottom (letterboxing, film-gate, app-icon shelf). Do not pad the canvas.`,
    `The user picked logo ink ${inkHex}. Do not invent a third color.`,
  ].join(' ')
}

/** Sắp xếp lockup cho vừa và to nhất theo tỷ lệ khung — vuông thì xếp dọc, không wordmark ngang. */
export function buildLogoLayoutFacts(aspect: string, width: number, height: number): string {
  const w = Math.max(24, Math.round(Number(width) || 120))
  const h = Math.max(16, Math.round(Number(height) || 36))
  const ratio = aspectValue(aspect, w, h)
  const frame = `Chosen frame is ${w}x${h}px at ${aspect} aspect ratio. Generate at ${aspect} and fill that exact frame.`
  if (ratio <= 1.2) {
    return [
      frame,
      'SQUARE LOCKUP: stack the icon/mark ABOVE the wordmark (never side-by-side in one thin row).',
      'Scale the stacked lockup to the largest size that still fits — occupy at least 85% of both width and height, with even padding on all four sides — padding is the same background color, never white.',
      'Forbidden: a wide horizontal strip (lotus + domain in one line) floating in the middle of the square with empty bands above and below.',
      'Forbidden: a white or cream footer band under the wordmark.',
      'If the brand has an icon and text, put the icon on top and the text underneath, both large enough to read.',
    ].join(' ')
  }
  if (ratio >= 2.2) {
    return [
      frame,
      'WIDE WORDMARK: icon and text in one horizontal row, scaled to fill the width and height.',
      'Occupy at least 85% of the frame. No unused color bands.',
    ].join(' ')
  }
  return [
    frame,
    'Compose the lockup at the largest readable size for this aspect ratio.',
    'Fill the frame. Do not leave large unused bands. Do not force a skinny horizontal strip if a taller stacked lockup fills the frame better.',
  ].join(' ')
}

/** Prompt tạo logo: chỉ màu user chọn + sắp xếp theo tỷ lệ khung. */
export function buildLogoSlotPrompt(input: LogoSlotPromptInput): string {
  const title = String(input.shopTitle || 'Shop').trim() || 'Shop'
  const w = Math.max(24, Math.round(Number(input.width) || 120))
  const h = Math.max(16, Math.round(Number(input.height) || 36))
  const slot =
    input.slot === 'footer' ? 'footer' : input.slot === 'header' ? 'header' : 'brand'
  const device = input.device === 'mobile' || input.device === 'tablet' ? input.device : 'desktop'
  const aspect = String(input.aspectRatio || '').trim() || logoAspectFromSize(w, h)
  return [
    `Website logo for "${title}", ${device} ${slot}.`,
    buildLogoColorFacts(input),
    buildLogoLayoutFacts(aspect, w, h),
    'Clean, high-contrast, readable at small size, no tiny unreadable text.',
  ].join(' ')
}

/** Ý user (tuỳ ý) + prompt kỹ thuật ẩn: nền, màu, kích thước, vị trí. */
export function mergeLogoSlotPrompt(userPrompt: string, input: LogoSlotPromptInput): string {
  const auto = buildLogoSlotPrompt(input)
  const trimmed = String(userPrompt || '').trim()
  if (!trimmed) return auto
  if (/website logo for|drawn slot is/i.test(trimmed)) return trimmed.includes(auto.slice(0, 24)) ? trimmed : auto
  return `${trimmed}. ${auto}`
}
