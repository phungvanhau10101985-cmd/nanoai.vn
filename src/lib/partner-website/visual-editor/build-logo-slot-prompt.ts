import { closestGeminiImageAspectRatio } from './gemini-working-aspect'

export type LogoSlotKind = 'header' | 'footer' | 'other'
export type LogoDeviceKind = 'mobile' | 'desktop'

function hexOrRgbToLabel(color: string): { hex: string; label: string } {
  const raw = String(color || '').trim()
  const rgb = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  let r = 255
  let g = 255
  let b = 255
  if (rgb) {
    r = Number(rgb[1])
    g = Number(rgb[2])
    b = Number(rgb[3])
  } else {
    const hex = raw.replace('#', '')
    if (hex.length === 6 && /^[0-9a-f]+$/i.test(hex)) {
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    }
  }
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
  const avg = (r + g + b) / 3
  const label = avg >= 230 ? 'white' : avg <= 40 ? 'black' : avg >= 180 ? 'light' : 'dark'
  return { hex, label }
}

/** Tỷ lệ Gemini gần nhất với khung người dùng vẽ. */
export function logoAspectFromSize(width: number, height: number): string {
  return closestGeminiImageAspectRatio(width, height)
}

export type LogoSlotPromptInput = {
  shopTitle: string
  slot: LogoSlotKind
  device: LogoDeviceKind
  bgColor: string
  width: number
  height: number
  primaryColor?: string
  accentColor?: string
  buyButtonColor?: string
  bgImageUrl?: string
}

/** Câu màu nền + màu chủ đạo — luôn gửi kèm khi tạo logo. */
export function buildLogoColorFacts(input: Pick<
  LogoSlotPromptInput,
  'bgColor' | 'primaryColor' | 'accentColor' | 'buyButtonColor' | 'bgImageUrl'
>): string {
  const { hex, label } = hexOrRgbToLabel(input.bgColor)
  const primary = input.primaryColor ? hexOrRgbToLabel(input.primaryColor).hex : ''
  const accent = input.accentColor ? hexOrRgbToLabel(input.accentColor).hex : ''
  const buy = input.buyButtonColor ? hexOrRgbToLabel(input.buyButtonColor).hex : ''
  const parts = [
    `Surrounding background is ${hex} (${label}). Generate the logo on a matching ${label} background ${hex}, no extra colored backdrop, no mockup frame.`,
  ]
  if (input.bgImageUrl?.trim()) {
    parts.push(
      'A reference image of the surrounding background area is attached — match that exact backdrop color and texture so the mark sits naturally on the interface.'
    )
  }
  if (primary) {
    parts.push(
      `Shop interface dominant/primary color is ${primary}. Use ${primary} as the main brand color of the logo.`
    )
  }
  if (accent && accent !== primary) {
    parts.push(`Accent color is ${accent}.`)
  }
  if (buy && buy !== primary && buy !== accent) {
    parts.push(`Buy/CTA color is ${buy}.`)
  }
  return parts.join(' ')
}

/** Prompt tạo logo: nền + màu chủ đạo giao diện + kích thước + vị trí. */
export function buildLogoSlotPrompt(input: LogoSlotPromptInput): string {
  const title = String(input.shopTitle || 'Shop').trim() || 'Shop'
  const w = Math.max(24, Math.round(Number(input.width) || 120))
  const h = Math.max(16, Math.round(Number(input.height) || 36))
  const slot =
    input.slot === 'footer' ? 'footer' : input.slot === 'header' ? 'header' : 'brand'
  const device = input.device === 'mobile' ? 'mobile' : 'desktop'
  const aspect = logoAspectFromSize(w, h)
  const wide = w / h >= 1.6
  return [
    `Website logo for "${title}", ${device} ${slot}.`,
    buildLogoColorFacts(input),
    `Drawn slot is ${w}x${h}px (${(w / h).toFixed(2)}:1). Generate at ${aspect} aspect ratio to fill that frame${wide ? ', wide wordmark' : ', compact mark'}.`,
    'Clean, high-contrast, readable at small size, no tiny unreadable text.',
  ].join(' ')
}

/** Giữ ý user, vẫn chèn màu nền + màu chủ đạo nếu prompt chưa có. */
export function mergeLogoSlotPrompt(userPrompt: string, input: LogoSlotPromptInput): string {
  const auto = buildLogoSlotPrompt(input)
  const trimmed = String(userPrompt || '').trim()
  if (trimmed.length < 4) return auto
  const { hex } = hexOrRgbToLabel(input.bgColor)
  const primary = input.primaryColor ? hexOrRgbToLabel(input.primaryColor).hex : ''
  const hasBg = trimmed.toLowerCase().includes(hex.toLowerCase())
  const hasPrimary = !primary || trimmed.toLowerCase().includes(primary.toLowerCase())
  if (hasBg && hasPrimary) return trimmed
  return `${trimmed} ${buildLogoColorFacts(input)}`
}
