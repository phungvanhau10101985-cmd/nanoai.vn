import type { WebLocale } from '@/lib/i18n/config'
import { STUDIO_PRESET_EN } from './en'
import { STUDIO_PRESET_JA } from './ja'
import { STUDIO_PRESET_KO } from './ko'
import { STUDIO_PRESET_VI } from './vi'
import { STUDIO_PRESET_ZH } from './zh'

export function getStudioPresetCopy(locale: WebLocale) {
  switch (locale) {
    case 'en':
      return STUDIO_PRESET_EN
    case 'zh':
      return STUDIO_PRESET_ZH
    case 'ja':
      return STUDIO_PRESET_JA
    case 'ko':
      return STUDIO_PRESET_KO
    case 'vi':
    default:
      return STUDIO_PRESET_VI
  }
}

export type StudioPresetCopyMap = typeof STUDIO_PRESET_VI
