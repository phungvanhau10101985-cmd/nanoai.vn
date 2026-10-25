'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import {
  listWeddingButtonColors,
  weddingButtonColorName,
  type WeddingButtonColorId,
} from '@/lib/wedding/wedding-button-colors'

export function WeddingButtonColorPicker(props: {
  value: WeddingButtonColorId
  locale: WebLocale
  label: string
  hint: string
  chooseLabel: string
  okLabel: string
  cancelLabel: string
  onChange: (id: WeddingButtonColorId) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<WeddingButtonColorId>(props.value)
  const current = listWeddingButtonColors().find((color) => color.id === props.value) ?? listWeddingButtonColors()[0]
  const currentName = weddingButtonColorName(current.id, props.locale)

  return (
    <div>
      <p className="text-sm font-medium text-slate-900">{props.label}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{props.hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800">
          <span
            aria-hidden
            className="h-5 w-5 rounded-full border"
            style={{ backgroundColor: current.swatch, borderColor: current.border }}
          />
          {currentName}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft(props.value)
            setOpen(true)
          }}
        >
          {props.chooseLabel}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setDraft(props.value)
        }}
      >
        <DialogContent className="flex max-h-[min(36rem,calc(100dvh-2rem))] max-w-lg flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{props.label}</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5" role="listbox" aria-label={props.label}>
            {listWeddingButtonColors().map((color) => {
              const selected = color.id === draft
              const name = weddingButtonColorName(color.id, props.locale)
              return (
                <button
                  key={color.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={name}
                  onClick={() => setDraft(color.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-4',
                    selected ? 'border-slate-900 bg-slate-50 text-slate-950 ring-2 ring-slate-900/15' : 'border-slate-200 text-slate-600',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-8 w-8 rounded-full border"
                    style={{ backgroundColor: color.swatch, borderColor: color.border }}
                  />
                  {name}
                </button>
              )
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {props.cancelLabel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                props.onChange(draft)
                setOpen(false)
              }}
            >
              {props.okLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
