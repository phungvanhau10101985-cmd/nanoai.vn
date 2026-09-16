'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  SETTINGS_DATA_ROLE_BOX_CLASS,
  SETTINGS_DATA_ROLE_LABEL_CLASS,
  SETTINGS_DATA_ROLE_SWATCH_CLASS,
  type SettingsDataRole,
  type SettingsDataRoleCopy,
} from '@/lib/messaging/settings-data-role'

export function SettingsDataRoleLegend({
  copy,
  className,
}: {
  copy: SettingsDataRoleCopy
  className?: string
}) {
  const rows: Array<{ role: SettingsDataRole; text: string }> = [
    { role: 'internal', text: copy.legendInternal },
    { role: 'issued', text: copy.legendIssued },
    { role: 'inbound', text: copy.legendInbound },
  ]
  return (
    <div
      className={cn(
        'mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/40',
        className
      )}
      role="note"
    >
      <p className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-100">{copy.legendTitle}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li
            key={row.role}
            className={cn('flex gap-2 leading-snug', SETTINGS_DATA_ROLE_LABEL_CLASS[row.role])}
          >
            <span
              className={cn('mt-0.5 h-3 w-3 shrink-0 rounded-sm', SETTINGS_DATA_ROLE_SWATCH_CLASS[row.role])}
              aria-hidden
            />
            <span>{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SettingsDataRoleBox({
  role,
  copy,
  children,
  className,
}: {
  role: SettingsDataRole
  copy: SettingsDataRoleCopy
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-settings-data-role={role}
      className={cn('space-y-2 rounded-md border p-2.5', SETTINGS_DATA_ROLE_BOX_CLASS[role], className)}
    >
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          SETTINGS_DATA_ROLE_LABEL_CLASS[role]
        )}
      >
        {copy.badge[role]}
      </p>
      {children}
    </div>
  )
}
