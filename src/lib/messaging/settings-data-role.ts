import type { Dictionary } from '@/lib/i18n/dictionaries'

/** Phân loại trường trên Quản trị cài đặt theo hướng dữ liệu. */
export type SettingsDataRole = 'internal' | 'issued' | 'inbound'

export type SettingsDataRoleCopy = {
  legendTitle: string
  legendInternal: string
  legendIssued: string
  legendInbound: string
  badge: Record<SettingsDataRole, string>
}

export const SETTINGS_DATA_ROLE_BOX_CLASS: Record<SettingsDataRole, string> = {
  internal:
    'border-zinc-400 bg-white text-zinc-900 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100',
  issued:
    'border-blue-500 bg-blue-50/80 text-blue-950 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100',
  inbound:
    'border-emerald-600 bg-emerald-50/80 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
}

export const SETTINGS_DATA_ROLE_LABEL_CLASS: Record<SettingsDataRole, string> = {
  internal: 'text-zinc-900 dark:text-zinc-100',
  issued: 'text-blue-800 dark:text-blue-200',
  inbound: 'text-emerald-800 dark:text-emerald-200',
}

export const SETTINGS_DATA_ROLE_INPUT_CLASS: Record<SettingsDataRole, string> = {
  internal: 'border-zinc-400 text-zinc-900 dark:text-zinc-100',
  issued: 'border-blue-500 focus-visible:ring-blue-500',
  inbound: 'border-emerald-600 focus-visible:ring-emerald-600',
}

export const SETTINGS_DATA_ROLE_SWATCH_CLASS: Record<SettingsDataRole, string> = {
  internal: 'bg-zinc-900 dark:bg-zinc-100',
  issued: 'bg-blue-600',
  inbound: 'bg-emerald-600',
}

export function settingsDataRoleCopy(t: Dictionary['partnerMessaging']): SettingsDataRoleCopy {
  return {
    legendTitle: t.settingsDataRoleLegendTitle,
    legendInternal: t.settingsDataRoleLegendInternal,
    legendIssued: t.settingsDataRoleLegendIssued,
    legendInbound: t.settingsDataRoleLegendInbound,
    badge: {
      internal: t.settingsDataRoleBadgeInternal,
      issued: t.settingsDataRoleBadgeIssued,
      inbound: t.settingsDataRoleBadgeInbound,
    },
  }
}
