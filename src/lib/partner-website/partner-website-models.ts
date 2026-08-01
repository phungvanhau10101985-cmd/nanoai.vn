import type { WebLocale } from '@/lib/i18n/config'
import { DEEPSEEK_V4_FLASH, DEEPSEEK_V4_PRO } from '@/lib/deepseek-api'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

export type PartnerWebsiteModelProvider = 'deepseek' | 'gemini'

export type PartnerWebsiteModelId =
  | typeof DEEPSEEK_V4_FLASH
  | typeof DEEPSEEK_V4_PRO
  | typeof GEMINI_25_FLASH_NO_THINKING.model
  | typeof GEMINI_25_PRO.model

export type PartnerWebsiteModelEntry = {
  id: PartnerWebsiteModelId
  provider: PartnerWebsiteModelProvider
  label: Record<WebLocale, string>
}

export const PARTNER_WEBSITE_MODELS: PartnerWebsiteModelEntry[] = [
  {
    id: DEEPSEEK_V4_FLASH,
    provider: 'deepseek',
    label: {
      vi: 'DeepSeek V4 Flash',
      en: 'DeepSeek V4 Flash',
      zh: 'DeepSeek V4 Flash',
      ja: 'DeepSeek V4 Flash',
      ko: 'DeepSeek V4 Flash',
    },
  },
  {
    id: DEEPSEEK_V4_PRO,
    provider: 'deepseek',
    label: {
      vi: 'DeepSeek V4 Pro',
      en: 'DeepSeek V4 Pro',
      zh: 'DeepSeek V4 Pro',
      ja: 'DeepSeek V4 Pro',
      ko: 'DeepSeek V4 Pro',
    },
  },
  {
    id: GEMINI_25_FLASH_NO_THINKING.model,
    provider: 'gemini',
    label: {
      vi: 'Gemini 2.5 Flash',
      en: 'Gemini 2.5 Flash',
      zh: 'Gemini 2.5 Flash',
      ja: 'Gemini 2.5 Flash',
      ko: 'Gemini 2.5 Flash',
    },
  },
  {
    id: GEMINI_25_PRO.model,
    provider: 'gemini',
    label: {
      vi: 'Gemini 2.5 Pro',
      en: 'Gemini 2.5 Pro',
      zh: 'Gemini 2.5 Pro',
      ja: 'Gemini 2.5 Pro',
      ko: 'Gemini 2.5 Pro',
    },
  },
]

export const DEFAULT_PARTNER_WEBSITE_MODEL_ID: PartnerWebsiteModelId = DEEPSEEK_V4_FLASH

export function isPartnerWebsiteModelId(value: string): value is PartnerWebsiteModelId {
  return PARTNER_WEBSITE_MODELS.some((m) => m.id === value)
}

export function resolvePartnerWebsiteModelId(raw?: string | null): PartnerWebsiteModelId {
  const trimmed = raw?.trim()
  if (trimmed && isPartnerWebsiteModelId(trimmed)) return trimmed
  return DEFAULT_PARTNER_WEBSITE_MODEL_ID
}

export function partnerWebsiteModelLabel(locale: WebLocale, modelId: PartnerWebsiteModelId): string {
  return PARTNER_WEBSITE_MODELS.find((m) => m.id === modelId)?.label[locale] ?? modelId
}
