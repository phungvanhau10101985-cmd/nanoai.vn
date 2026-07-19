import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  PACKAGING_PRINT_COLORS,
  findPackagingPrintColor,
  packagingPrintColorLabel,
  type PackagingPrintColor,
} from '@/lib/packaging/packaging-discovery-choices'

/** Extra UI / web brand colors (hex-locked for AI generation). */
const STUDIO_EXTRA_UI_COLORS: PackagingPrintColor[] = [
  {
    key: 'navy',
    hex: '#1E3A5F',
    labels: { vi: 'Navy', en: 'Navy', zh: '藏青', ja: 'ネイビー', ko: '네이비' },
    brief: { vi: 'navy', en: 'navy', zh: '藏青', ja: 'ネイビー', ko: '네이비' },
  },
  {
    key: 'teal',
    hex: '#0D9488',
    labels: { vi: 'Teal', en: 'Teal', zh: '青绿', ja: 'ティール', ko: '틸' },
    brief: { vi: 'teal', en: 'teal', zh: '青绿', ja: 'ティール', ko: '틸' },
  },
  {
    key: 'coral',
    hex: '#FF6B6B',
    labels: { vi: 'Coral', en: 'Coral', zh: '珊瑚', ja: 'コーラル', ko: '코랄' },
    brief: { vi: 'coral', en: 'coral', zh: '珊瑚', ja: 'コーラル', ko: '코랄' },
  },
  {
    key: 'rose',
    hex: '#FB7185',
    labels: { vi: 'Hồng rose', en: 'Rose', zh: '玫瑰粉', ja: 'ローズ', ko: '로즈' },
    brief: { vi: 'hồng rose', en: 'rose', zh: '玫瑰粉', ja: 'ローズ', ko: '로즈' },
  },
  {
    key: 'indigo',
    hex: '#4F46E5',
    labels: { vi: 'Indigo', en: 'Indigo', zh: '靛蓝', ja: 'インディゴ', ko: '인디고' },
    brief: { vi: 'indigo', en: 'indigo', zh: '靛蓝', ja: 'インディゴ', ko: '인디고' },
  },
  {
    key: 'slate',
    hex: '#64748B',
    labels: { vi: 'Slate', en: 'Slate', zh: '石板灰', ja: 'スレート', ko: '슬레이트' },
    brief: { vi: 'slate', en: 'slate', zh: '石板灰', ja: 'スレート', ko: '슬레이트' },
  },
  {
    key: 'beige',
    hex: '#F5F0E8',
    labels: { vi: 'Beige', en: 'Beige', zh: '米色', ja: 'ベージュ', ko: '베이지' },
    brief: { vi: 'beige', en: 'beige', zh: '米色', ja: 'ベージュ', ko: '베이지' },
  },
]

export const STUDIO_BRAND_COLORS: PackagingPrintColor[] = [
  ...PACKAGING_PRINT_COLORS,
  ...STUDIO_EXTRA_UI_COLORS.filter(
    (extra) => !PACKAGING_PRINT_COLORS.some((c) => c.hex.toUpperCase() === extra.hex.toUpperCase())
  ),
]

export type StudioColorRole = 'primary' | 'secondary'

export type StudioColorSelection = {
  key: string
  role: StudioColorRole
}

export type ResolvedStudioColorSelection = {
  color: PackagingPrintColor
  role: StudioColorRole
}

const CUSTOM_KEY_PREFIX = 'custom:'

const ROLE_SECTION_LABELS: Record<
  WebLocale,
  { primary: string; secondary: string }
> = {
  vi: { primary: 'Màu chính', secondary: 'Màu phụ' },
  en: { primary: 'Primary', secondary: 'Secondary' },
  zh: { primary: '主色', secondary: '辅色' },
  ja: { primary: 'メインカラー', secondary: 'サブカラー' },
  ko: { primary: '주색', secondary: '보조색' },
}

export function normalizeStudioHexColor(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null
  return withHash.toUpperCase()
}

export function resolveStudioBrandColor(key: string): PackagingPrintColor | null {
  const trimmed = key.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().startsWith(CUSTOM_KEY_PREFIX)) {
    const hex = normalizeStudioHexColor(trimmed.slice(CUSTOM_KEY_PREFIX.length))
    if (!hex) return null
    return {
      key: `${CUSTOM_KEY_PREFIX}${hex}`,
      hex,
      labels: { vi: hex, en: hex, zh: hex, ja: hex, ko: hex },
      brief: { vi: hex, en: hex, zh: hex, ja: hex, ko: hex },
    }
  }
  return (
    findPackagingPrintColor(trimmed) ??
    STUDIO_EXTRA_UI_COLORS.find((c) => c.key === trimmed) ??
    null
  )
}

export function resolveStudioBrandColors(keys: string[]): PackagingPrintColor[] {
  const seen = new Set<string>()
  const out: PackagingPrintColor[] = []
  for (const key of keys) {
    const color = resolveStudioBrandColor(key)
    if (!color || seen.has(color.key)) continue
    seen.add(color.key)
    out.push(color)
  }
  return out
}

export function normalizeStudioColorSelections(
  selection?: StudioColorSelection[],
  legacyKeys?: string[]
): StudioColorSelection[] {
  if (selection?.length) {
    const seen = new Set<string>()
    const out: StudioColorSelection[] = []
    for (const item of selection) {
      const key = item.key.trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({ key, role: item.role === 'secondary' ? 'secondary' : 'primary' })
    }
    return out
  }
  const keys = legacyKeys ?? []
  return keys.map((key, index) => ({
    key,
    role: index === 0 ? 'primary' : 'secondary',
  }))
}

export function resolveStudioColorSelections(
  selections: StudioColorSelection[]
): ResolvedStudioColorSelection[] {
  const out: ResolvedStudioColorSelection[] = []
  const seen = new Set<string>()
  for (const item of selections) {
    const color = resolveStudioBrandColor(item.key)
    if (!color || seen.has(color.key)) continue
    seen.add(color.key)
    out.push({ color, role: item.role === 'secondary' ? 'secondary' : 'primary' })
  }
  return out
}

export function formatStudioColorEntry(color: PackagingPrintColor, locale: WebLocale): string {
  const label = packagingPrintColorLabel(color, locale)
  return `${label} (${color.hex})`
}

function formatRoleGroup(
  items: ResolvedStudioColorSelection[],
  role: StudioColorRole,
  locale: WebLocale
): string {
  const labels = ROLE_SECTION_LABELS[locale]
  const sectionLabel = role === 'primary' ? labels.primary : labels.secondary
  const entries = items
    .filter((item) => item.role === role)
    .map((item) => formatStudioColorEntry(item.color, locale))
  if (!entries.length) return ''
  return `${sectionLabel}: ${entries.join(', ')}`
}

/** Stored in briefNotes.color_palette — primary/secondary groups with exact hex. */
export function formatStudioColorPaletteBriefFromSelections(
  selections: StudioColorSelection[],
  locale: WebLocale
): string {
  const resolved = resolveStudioColorSelections(selections)
  const primary = formatRoleGroup(resolved, 'primary', locale)
  const secondary = formatRoleGroup(resolved, 'secondary', locale)
  return [primary, secondary].filter(Boolean).join('. ')
}

/** @deprecated Use formatStudioColorPaletteBriefFromSelections */
export function formatStudioColorPaletteBriefValue(
  colors: PackagingPrintColor[],
  locale: WebLocale
): string {
  return formatStudioColorPaletteBriefFromSelections(
    colors.map((color, index) => ({
      key: color.key,
      role: index === 0 ? 'primary' : 'secondary',
    })),
    locale
  )
}

export function studioColorPaletteUserLabel(
  selections: StudioColorSelection[],
  locale: WebLocale
): string {
  const resolved = resolveStudioColorSelections(selections)
  const labels = ROLE_SECTION_LABELS[locale]
  const primary = resolved
    .filter((item) => item.role === 'primary')
    .map((item) => packagingPrintColorLabel(item.color, locale))
    .join(', ')
  const secondary = resolved
    .filter((item) => item.role === 'secondary')
    .map((item) => packagingPrintColorLabel(item.color, locale))
    .join(', ')
  const parts = [
    primary ? `${labels.primary}: ${primary}` : '',
    secondary ? `${labels.secondary}: ${secondary}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function studioColorPaletteLabel(colors: PackagingPrintColor[], locale: WebLocale): string {
  return colors.map((c) => packagingPrintColorLabel(c, locale)).join(', ')
}

export function isStudioColorPalettePickerStep(stepKey: string | null | undefined): boolean {
  return stepKey === 'color_palette'
}

function extractHexLines(section: string): string[] {
  const hexMatches = [...section.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase())
  return [...new Set(hexMatches)]
}

function parseColorPaletteBriefSections(raw: string): { primary: string; secondary: string } {
  const primaryMatch = raw.match(
    /(?:Màu chính|Primary|主色|メインカラー|주색)\s*:\s*([^]*?)(?=(?:Màu phụ|Secondary|辅色|サブカラー|보조색)\s*:|$)/i
  )
  const secondaryMatch = raw.match(
    /(?:Màu phụ|Secondary|辅色|サブカラー|보조색)\s*:\s*([^]*?)$/i
  )
  return {
    primary: primaryMatch?.[1]?.trim().replace(/\.\s*$/, '') ?? '',
    secondary: secondaryMatch?.[1]?.trim().replace(/\.\s*$/, '') ?? '',
  }
}

function formatHexPromptLines(section: string): string[] {
  if (!section.trim()) return []
  const parts = section.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.map((part) => {
    const hex = part.match(/#[0-9A-Fa-f]{6}/)?.[0]?.toUpperCase()
    const label = part.replace(/\([^)]*\)/g, '').trim() || hex || part
    return hex ? `- ${label}: ${hex}` : `- ${label}`
  })
}

/** Strict hex block for UI/logo/banner generation. */
export function formatStudioUiColorPalettePromptBlock(session: HubStudioSession): string {
  const raw = session.briefNotes.color_palette?.trim() ?? ''
  if (!raw) return ''

  const { primary, secondary } = parseColorPaletteBriefSections(raw)
  const hasRoleSections = Boolean(primary || secondary)

  if (hasRoleSections) {
    const primaryLines = formatHexPromptLines(primary)
    const secondaryLines = formatHexPromptLines(secondary)
    const blocks = [
      primaryLines.length
        ? `PRIMARY / DOMINANT (~60–75% of colored UI — hero, headers, main CTAs, primary buttons, large backgrounds):\n${primaryLines.join('\n')}`
        : '',
      secondaryLines.length
        ? `SECONDARY / SUPPORTING (~25–40% — borders, icons, badges, hover states, subtle fills, secondary accents):\n${secondaryLines.join('\n')}`
        : '',
    ].filter(Boolean)
    return `MANDATORY BRAND COLOR PALETTE — use these EXACT hex values. Primary colors must appear MORE prominently than secondary on every screen. Do NOT substitute similar shades or invent new colors:
${blocks.join('\n\n')}
Apply consistently across all UI components. Reference images define layout/component style only; colors MUST match this palette exactly.`
  }

  const uniqueHex = extractHexLines(raw)
  if (uniqueHex.length) {
    const lines = uniqueHex.map((hex, i) => {
      const segment = raw.split(',').find((part) => part.toUpperCase().includes(hex))
      const label = segment?.replace(/\([^)]*\)/g, '').trim() || `Color ${i + 1}`
      return `- ${label}: ${hex}`
    })
    return `MANDATORY BRAND COLOR PALETTE — use these EXACT hex values for UI backgrounds, buttons, accents, links, and typography highlights. Do NOT substitute similar shades or invent new colors:
${lines.join('\n')}
Apply consistently across all UI components. Reference images define layout/component style only; colors MUST match this palette exactly.`
  }

  return `MANDATORY BRAND COLOR PALETTE — use these colors exactly as specified (do not substitute similar shades):
${raw}
Apply consistently across all UI components.`
}

export function appendStudioUiColorPaletteToPrompt(
  prompt: string,
  session: HubStudioSession,
  generator: string | null | undefined
): string {
  const usesPalette =
    generator === 'ui_mockup' ||
    generator === 'ui_desktop' ||
    generator === 'logo' ||
    generator === 'banner'
  if (!usesPalette) return prompt
  const block = formatStudioUiColorPalettePromptBlock(session)
  if (!block) return prompt
  return `${prompt}\n\n${block}`
}

export function studioColorSelectionHasPrimary(selections: StudioColorSelection[]): boolean {
  return selections.some((item) => item.role === 'primary')
}
