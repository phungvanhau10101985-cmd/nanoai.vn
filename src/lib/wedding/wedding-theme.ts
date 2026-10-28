export type WeddingTheme = {
  id: string
  label: string
  ornament: string
  pageBg: string
  heroGradient: string
  softGradient: string
  /** Khối nội dung chính — trong suốt, nhìn xuyên nền ảnh */
  panel: string
  /** Khối phụ — nhẹ hơn panel, không che nền */
  panelStrong: string
  /** Vỏ thiệp mở / overlay siêu mỏng */
  panelGlass: string
  text: string
  mutedText: string
  accent: string
  accentText: string
  ring: string
  nav: string
  button: string
  /** Nút mở Google Maps — nền đặc, tương phản cao trên panel kính */
  mapButton: string
  /** Tăng độ đọc chữ trên nền ảnh hoa */
  textGlow: string
  /** Tiêu đề lớn trên nền chi tiết (rồng/phượng, hoa dày) */
  textGlowHeading: string
  /** Khối UI tương tác (nhạc, form) — đục hơn một chút */
  panelUi: string
}

const MAP_BUTTON_READABLE =
  'relative z-20 border font-bold tracking-wide no-underline antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.45)] shadow-[0_6px_18px_rgba(0,0,0,0.28)] [&_svg]:shrink-0'
const MAP_BUTTON_READABLE_DARK =
  'relative z-20 border font-bold tracking-wide no-underline antialiased [text-shadow:none] shadow-[0_6px_18px_rgba(0,0,0,0.28)] [&_svg]:shrink-0'

/** Đọc được trên nền AI sáng/tối/rối — halo kem + viền chữ tối nhẹ */
const TEXT_GLOW_UNIVERSAL =
  '[text-shadow:0_0_1px_rgba(255,255,255,0.96),0_1px_2px_rgba(255,255,255,0.82),0_1px_4px_rgba(0,0,0,0.14),0_0_18px_rgba(255,252,245,0.5)]'
const TEXT_GLOW_UNIVERSAL_HEADING =
  '[text-shadow:0_0_2px_rgba(255,255,255,1),0_1px_3px_rgba(255,255,255,0.9),0_2px_8px_rgba(0,0,0,0.16),0_0_26px_rgba(255,252,245,0.58)]'
const TEXT_GLOW_BODY = TEXT_GLOW_UNIVERSAL
const TEXT_GLOW_HEADING = TEXT_GLOW_UNIVERSAL_HEADING
const TEXT_GLOW_DARK =
  '[text-shadow:0_0_10px_rgba(0,0,0,0.62),0_1px_3px_rgba(0,0,0,0.48),0_2px_8px_rgba(0,0,0,0.36),0_0_16px_rgba(0,0,0,0.28)]'
const TEXT_GLOW_HEADING_DARK =
  '[text-shadow:0_0_14px_rgba(0,0,0,0.72),0_2px_6px_rgba(0,0,0,0.52),0_0_22px_rgba(0,0,0,0.38)]'

/** Nền chữ trong nội dung thiệp: trong suốt, không kính mờ. */
const PANEL_CLEAR = 'bg-transparent shadow-none'

const WEDDING_THEMES: Record<string, WeddingTheme> = {
  luxury: {
    id: 'luxury',
    label: 'Luxury',
    ornament: '✦',
    pageBg: 'bg-[#fbf5ec]',
    heroGradient: 'linear-gradient(135deg, #fff7ed 0%, #fff1f2 45%, #f6e7bf 100%)',
    softGradient: 'bg-gradient-to-br from-amber-50 via-white to-rose-50',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-[#2f241f]',
    mutedText: 'text-[#4a3a32]',
    accent: 'text-[#a66a2d]',
    accentText: 'text-[#7a4b1f]',
    ring: 'ring-amber-200/40',
    nav: 'border-white/25 bg-[#fffdf8]/92 text-[#684520] shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
    button: `${MAP_BUTTON_READABLE} !bg-[#8a5727] !text-white hover:!bg-[#70451d] border-[#4a2a0e]/40 [&_svg]:!text-white shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE} !bg-[#7a4a1f] !text-white hover:!bg-[#623a18] border-[#4a2a0e]/40 [&_svg]:!text-white`,
    textGlow: TEXT_GLOW_BODY,
    textGlowHeading: TEXT_GLOW_HEADING,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    ornament: '—',
    pageBg: 'bg-stone-50',
    heroGradient: 'linear-gradient(135deg, #fafaf9 0%, #ffffff 52%, #dbe7dd 100%)',
    softGradient: 'bg-gradient-to-br from-stone-50 via-white to-emerald-50',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-stone-950',
    mutedText: 'text-stone-800',
    accent: 'text-emerald-700',
    accentText: 'text-emerald-800',
    ring: 'ring-stone-200/50',
    nav: 'border-white/30 bg-white/92 text-stone-700 shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
    button: `${MAP_BUTTON_READABLE} !bg-stone-950 !text-white hover:!bg-stone-900 border-stone-800/50 [&_svg]:!text-white shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE} !bg-stone-950 !text-white hover:!bg-stone-900 border-stone-800/50 [&_svg]:!text-white`,
    textGlow: TEXT_GLOW_BODY,
    textGlowHeading: TEXT_GLOW_HEADING,
  },
  traditional_vietnamese: {
    id: 'traditional_vietnamese',
    label: 'Traditional Vietnamese',
    ornament: '囍',
    pageBg: 'bg-[#fff7ed]',
    heroGradient: 'linear-gradient(135deg, #7f1d1d 0%, #be123c 48%, #f6c453 100%)',
    softGradient: 'bg-gradient-to-br from-red-50 via-rose-50 to-amber-50',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-[#2a1210]',
    mutedText: 'text-[#4a2018]',
    accent: 'text-red-800',
    accentText: 'text-red-900',
    ring: 'ring-amber-300/45',
    nav: 'border-amber-100/40 bg-[#fff4de]/92 text-red-900 shadow-[0_4px_24px_rgba(0,0,0,0.07)]',
    button: `${MAP_BUTTON_READABLE} !bg-[#991b1b] !text-white hover:!bg-[#7f1d1d] border-[#450a0a]/45 [&_svg]:!text-white shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE} !bg-[#991b1b] !text-white hover:!bg-[#7f1d1d] border-[#450a0a]/45 [&_svg]:!text-white`,
    textGlow: TEXT_GLOW_BODY,
    textGlowHeading: TEXT_GLOW_HEADING,
  },
  ethereal: {
    id: 'ethereal',
    label: 'Ethereal',
    ornament: '∿',
    pageBg: 'bg-[#fbf8f4]',
    heroGradient: 'linear-gradient(135deg, #fbf8f4 0%, #fffdfb 52%, #f3e4ea 100%)',
    softGradient: 'bg-gradient-to-br from-stone-50 via-white to-rose-50',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-[#2c2825]',
    mutedText: 'text-[#5c534c]',
    accent: 'text-[#8d6e63]',
    accentText: 'text-[#6d4c41]',
    ring: 'ring-stone-200/50',
    nav: 'border-white/30 bg-[#fffdfb]/92 text-[#5c534c] shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
    button: `${MAP_BUTTON_READABLE} !bg-[#6d4c41] !text-white hover:!bg-[#5d4037] border-[#3e2723]/40 [&_svg]:!text-white shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE} !bg-[#6d4c41] !text-white hover:!bg-[#5d4037] border-[#3e2723]/40 [&_svg]:!text-white`,
    textGlow: TEXT_GLOW_BODY,
    textGlowHeading: TEXT_GLOW_HEADING,
  },
  floral: {
    id: 'floral',
    label: 'Floral',
    ornament: '❀',
    pageBg: 'bg-[#fff7f8]',
    heroGradient: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 48%, #dff3e8 100%)',
    softGradient: 'bg-gradient-to-br from-pink-50 via-white to-emerald-50',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-[#2d3824]',
    mutedText: 'text-[#445538]',
    accent: 'text-rose-700',
    accentText: 'text-[#4a5c3c]',
    ring: 'ring-rose-200/45',
    nav: 'border-white/28 bg-white/92 text-rose-800 shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
    button: `${MAP_BUTTON_READABLE} !bg-rose-700 !text-white hover:!bg-rose-800 border-rose-900/40 [&_svg]:!text-white shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE} !bg-rose-700 !text-white hover:!bg-rose-800 border-rose-900/40 [&_svg]:!text-white`,
    textGlow: TEXT_GLOW_BODY,
    textGlowHeading: TEXT_GLOW_HEADING,
  },
  vintage: {
    id: 'vintage',
    label: 'Vintage',
    ornament: '❦',
    pageBg: 'bg-[#f7ead7]',
    heroGradient: 'linear-gradient(135deg, #f5deb8 0%, #fff7ed 46%, #d8a48f 100%)',
    softGradient: 'bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-[#3b2618]',
    mutedText: 'text-[#523820]',
    accent: 'text-[#9a5b2e]',
    accentText: 'text-[#7b431f]',
    ring: 'ring-orange-200/45',
    nav: 'border-orange-100/35 bg-[#fff2dc]/92 text-[#6c4328] shadow-[0_4px_24px_rgba(0,0,0,0.07)]',
    button: `${MAP_BUTTON_READABLE} !bg-[#6b3418] !text-white hover:!bg-[#552812] border-[#3d1c0d]/45 [&_svg]:!text-white shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE} !bg-[#6b3418] !text-white hover:!bg-[#552812] border-[#3d1c0d]/45 [&_svg]:!text-white`,
    textGlow: TEXT_GLOW_BODY,
    textGlowHeading: TEXT_GLOW_HEADING,
  },
  modern: {
    id: 'modern',
    label: 'Modern',
    ornament: '◇',
    pageBg: 'bg-slate-950',
    heroGradient: 'linear-gradient(135deg, #020617 0%, #334155 56%, #d6a84f 100%)',
    softGradient: 'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-900',
    panel: PANEL_CLEAR,
    panelStrong: PANEL_CLEAR,
    panelGlass: PANEL_CLEAR,
    panelUi: PANEL_CLEAR,
    text: 'text-white',
    mutedText: 'text-slate-100',
    accent: 'text-amber-300',
    accentText: 'text-amber-200',
    ring: 'ring-amber-300/25',
    nav: 'border-white/12 bg-slate-950/90 text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
    button: `${MAP_BUTTON_READABLE_DARK} !bg-amber-400 !text-slate-950 hover:!bg-amber-300 border-amber-500/55 [&_svg]:!text-slate-950 shadow-md`,
    mapButton: `${MAP_BUTTON_READABLE_DARK} !bg-amber-400 !text-slate-950 hover:!bg-amber-300 border-amber-500/55 [&_svg]:!text-slate-950`,
    textGlow: TEXT_GLOW_DARK,
    textGlowHeading: TEXT_GLOW_HEADING_DARK,
  },
}

export function getWeddingTheme(styleId: string | null | undefined): WeddingTheme {
  return WEDDING_THEMES[styleId || 'luxury'] ?? WEDDING_THEMES.luxury
}

export function isWeddingDarkTheme(themeId: string | null | undefined): boolean {
  return (themeId || 'luxury') === 'modern'
}

export function weddingNavLinkClass(theme: WeddingTheme): string {
  return isWeddingDarkTheme(theme.id)
    ? 'rounded-full px-3.5 py-1.5 transition-colors hover:bg-white/10 active:bg-white/15'
    : 'rounded-full px-3.5 py-1.5 transition-colors hover:bg-black/[0.06] active:bg-black/[0.09]'
}

export type WeddingMapButtonColors = {
  bg: string
  hoverBg: string
  text: string
  border: string
}

const WEDDING_MAP_BUTTON_COLORS: Record<string, WeddingMapButtonColors> = {
  luxury: { bg: '#7a4a1f', hoverBg: '#623a18', text: '#ffffff', border: '#4a2a0e' },
  minimal: { bg: '#0c0a09', hoverBg: '#1c1917', text: '#ffffff', border: '#292524' },
  traditional_vietnamese: { bg: '#991b1b', hoverBg: '#7f1d1d', text: '#ffffff', border: '#450a0a' },
  floral: { bg: '#be185d', hoverBg: '#9d174d', text: '#ffffff', border: '#831843' },
  ethereal: { bg: '#6d4c41', hoverBg: '#5d4037', text: '#ffffff', border: '#3e2723' },
  vintage: { bg: '#6b3418', hoverBg: '#552812', text: '#ffffff', border: '#3d1c0d' },
  modern: { bg: '#fbbf24', hoverBg: '#f59e0b', text: '#020617', border: '#d97706' },
}

export function getWeddingMapButtonColors(themeId: string | null | undefined): WeddingMapButtonColors {
  return WEDDING_MAP_BUTTON_COLORS[themeId || 'luxury'] ?? WEDDING_MAP_BUTTON_COLORS.luxury
}

/** Lớp phủ nhẹ — nền hoa/ảnh AI vẫn hiện rõ, chữ đọc được nhờ textGlow trên theme. */
export const WEDDING_BG_OVERLAY = {
  cover: 0.22,
  hero: 0.28,
  section: 0.34,
  dense: 0.42,
} as const

export function weddingBackgroundStyle(
  imageUrl: string | null | undefined,
  theme: WeddingTheme,
  overlayOpacity: number = WEDDING_BG_OVERLAY.section,
  opts?: { readingVignette?: boolean; omitImage?: boolean },
) {
  const cleanUrl = imageUrl?.trim()
  const showImage = Boolean(cleanUrl) && !opts?.omitImage
  if (overlayOpacity <= 0 && !opts?.readingVignette) {
    return {
      backgroundImage: showImage ? `url(${cleanUrl})` : opts?.omitImage && cleanUrl ? undefined : theme.heroGradient,
      backgroundSize: showImage ? ('cover' as const) : undefined,
      backgroundPosition: showImage ? ('center' as const) : undefined,
      backgroundRepeat: showImage ? ('no-repeat' as const) : undefined,
    }
  }
  const dark = isWeddingDarkTheme(theme.id)
  const top = Math.max(0, overlayOpacity * 0.55)
  const bottom = Math.max(0, Math.min(0.55, overlayOpacity))
  const wash = dark
    ? `linear-gradient(to bottom, rgba(15,23,42,${top}), rgba(15,23,42,${bottom})), `
    : `linear-gradient(to bottom, rgba(255,253,248,${top}), rgba(255,250,242,${bottom})), `
  const edgeVignette = dark
    ? 'radial-gradient(ellipse 105% 90% at 50% 44%, transparent 38%, rgba(2,6,23,0.42) 100%), '
    : 'radial-gradient(ellipse 105% 92% at 50% 42%, transparent 42%, rgba(18,12,8,0.1) 100%), '
  const readingVignette = opts?.readingVignette
    ? dark
      ? 'radial-gradient(ellipse 88% 74% at 50% 42%, rgba(15,23,42,0.52) 0%, rgba(15,23,42,0.22) 52%, transparent 78%), '
      : 'radial-gradient(ellipse 88% 74% at 50% 42%, rgba(255,252,245,0.52) 0%, rgba(255,248,236,0.24) 52%, transparent 78%), '
    : ''
  return {
    backgroundImage: showImage
      ? `${edgeVignette}${readingVignette}${wash}url(${cleanUrl})`
      : opts?.omitImage && cleanUrl
        ? `${edgeVignette}${readingVignette}${wash.slice(0, -2)}`
        : theme.heroGradient,
    backgroundSize: showImage ? ('cover' as const) : undefined,
    backgroundPosition: showImage ? ('center' as const) : undefined,
    backgroundRepeat: showImage ? ('no-repeat' as const) : undefined,
  }
}
