'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'

function presetLines(list: string) {
  return list
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Nút mở danh sách câu chúc soạn sẵn. Bấm một câu thì điền vào ô lời chúc. */
export function WeddingWishPresetPicker(props: {
  openLabel: string
  closeLabel: string
  list: string
  value: string
  disabled?: boolean
  theme: WeddingTheme
  onPick: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const presets = presetLines(props.list)
  if (presets.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex min-h-11 items-center rounded-full border border-current/20 px-4 text-sm font-semibold',
          props.theme.accentText,
          props.theme.textGlow,
        )}
      >
        {open ? props.closeLabel : props.openLabel}
      </button>
      {open ? (
        <div className="space-y-2" role="listbox" aria-label={props.openLabel}>
          {presets.map((text) => {
            const selected = props.value.trim() === text
            return (
              <button
                key={text}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={props.disabled}
                onClick={() => {
                  props.onPick(text)
                  setOpen(false)
                }}
                className={cn(
                  'w-full rounded-2xl px-3 py-2.5 text-left text-sm leading-6',
                  props.theme.panelStrong,
                  props.theme.text,
                  props.theme.textGlow,
                  selected && 'ring-2 ring-current',
                )}
              >
                {text}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
