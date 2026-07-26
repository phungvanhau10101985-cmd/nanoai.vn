import type { WebLocale } from '@/lib/i18n/config'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'
import type { BannerAspectRatio } from '@/lib/banner-ad-presets'

export type MenuFormatPresetId =
  | 'menu_a4_portrait'
  | 'menu_a4_landscape'
  | 'menu_table_tent'
  | 'menu_board_vertical'
  | 'menu_board_wide'

export type MenuFormatPreset = {
  id: MenuFormatPresetId
  aspectRatio: BannerAspectRatio
  labelKey: keyof (typeof import('@/lib/i18n/studio-preset-copy/vi').STUDIO_PRESET_VI)['food_menu']['steps']
}

export const MENU_FORMAT_PRESETS: MenuFormatPreset[] = [
  { id: 'menu_a4_portrait', aspectRatio: '3:4', labelKey: 'menu_a4_portrait' },
  { id: 'menu_a4_landscape', aspectRatio: '4:3', labelKey: 'menu_a4_landscape' },
  { id: 'menu_table_tent', aspectRatio: '1:1', labelKey: 'menu_table_tent' },
  { id: 'menu_board_vertical', aspectRatio: '9:16', labelKey: 'menu_board_vertical' },
  { id: 'menu_board_wide', aspectRatio: '16:9', labelKey: 'menu_board_wide' },
]

const MENU_FORMAT_PRESET_IDS = new Set<string>(MENU_FORMAT_PRESETS.map((p) => p.id))

export function normalizeMenuFormatPresetId(id: string): MenuFormatPresetId | '' {
  const raw = id.trim()
  if (MENU_FORMAT_PRESET_IDS.has(raw)) return raw as MenuFormatPresetId
  return ''
}

export function getMenuFormatPresetById(id: MenuFormatPresetId): MenuFormatPreset {
  return MENU_FORMAT_PRESETS.find((p) => p.id === id) ?? MENU_FORMAT_PRESETS[0]!
}

export function getMenuFormatPresetLabel(preset: MenuFormatPreset, locale: WebLocale): string {
  const copy = getStudioPresetCopy(locale)
  return copy.food_menu.steps[preset.labelKey]
}
