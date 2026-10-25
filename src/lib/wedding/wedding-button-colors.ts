export const WEDDING_BUTTON_COLOR_IDS = ['bronze', 'red', 'pink', 'black', 'cream'] as const

export type WeddingButtonColorId = (typeof WEDDING_BUTTON_COLOR_IDS)[number]

export type WeddingButtonColor = {
  id: WeddingButtonColorId
  bg: string
  hoverBg: string
  text: string
  border: string
  swatch: string
}

const COLORS: Record<WeddingButtonColorId, WeddingButtonColor> = {
  bronze: { id: 'bronze', bg: '#8a5727', hoverBg: '#70451d', text: '#ffffff', border: '#4a2a0e', swatch: '#8a5727' },
  red: { id: 'red', bg: '#991b1b', hoverBg: '#7f1d1d', text: '#ffffff', border: '#450a0a', swatch: '#991b1b' },
  pink: { id: 'pink', bg: '#be185d', hoverBg: '#9d174d', text: '#ffffff', border: '#831843', swatch: '#be185d' },
  black: { id: 'black', bg: '#1c1917', hoverBg: '#0c0a09', text: '#ffffff', border: '#44403c', swatch: '#1c1917' },
  cream: { id: 'cream', bg: '#f3e0b5', hoverBg: '#e6cf96', text: '#3b2618', border: '#c4a574', swatch: '#f3e0b5' },
}

const STYLE_FALLBACK: Record<string, WeddingButtonColorId> = {
  luxury: 'bronze',
  vintage: 'bronze',
  traditional_vietnamese: 'red',
  floral: 'pink',
  minimal: 'black',
  modern: 'cream',
}

export function isWeddingButtonColorId(value: unknown): value is WeddingButtonColorId {
  return typeof value === 'string' && (WEDDING_BUTTON_COLOR_IDS as readonly string[]).includes(value)
}

export function resolveWeddingButtonColorId(savedId: unknown, styleId?: string | null): WeddingButtonColorId {
  if (isWeddingButtonColorId(savedId)) return savedId
  return STYLE_FALLBACK[styleId || ''] ?? 'bronze'
}

export function resolveWeddingButtonColor(savedId: unknown, styleId?: string | null): WeddingButtonColor {
  return COLORS[resolveWeddingButtonColorId(savedId, styleId)]
}

export function listWeddingButtonColors(): WeddingButtonColor[] {
  return WEDDING_BUTTON_COLOR_IDS.map((id) => COLORS[id])
}

export function weddingButtonFillStyle(color: WeddingButtonColor) {
  return {
    backgroundColor: color.bg,
    color: color.text,
    borderColor: color.border,
    textShadow: color.text === '#ffffff' ? '0 1px 3px rgba(0,0,0,0.45)' : 'none',
  }
}

export function bindWeddingButtonFill(color: WeddingButtonColor) {
  return {
    style: weddingButtonFillStyle(color),
    onMouseEnter: (event: { currentTarget: HTMLElement }) => {
      event.currentTarget.style.backgroundColor = color.hoverBg
    },
    onMouseLeave: (event: { currentTarget: HTMLElement }) => {
      event.currentTarget.style.backgroundColor = color.bg
    },
  }
}
