'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { WeddingCouplePhotoRestyleId } from '@/lib/wedding/restyle-wedding-couple-photo'

type WeddingRestylePhotoApi = {
  label: string
  creditLabel: string
  busyLabel: string
  hint: string
  busySlot: string | null
  onRestyle: (slot: WeddingCouplePhotoRestyleId) => void
}

const WeddingRestylePhotoContext = createContext<WeddingRestylePhotoApi | null>(null)

export function WeddingRestylePhotoProvider(props: {
  enabled: boolean
  label: string
  creditLabel: string
  busyLabel: string
  hint: string
  busySlot: string | null
  onRestyle: (slot: WeddingCouplePhotoRestyleId) => void
  children: ReactNode
}) {
  const value = useMemo<WeddingRestylePhotoApi | null>(() => {
    if (!props.enabled) return null
    return {
      label: props.label,
      creditLabel: props.creditLabel,
      busyLabel: props.busyLabel,
      hint: props.hint,
      busySlot: props.busySlot,
      onRestyle: props.onRestyle,
    }
  }, [props.busyLabel, props.busySlot, props.creditLabel, props.enabled, props.hint, props.label, props.onRestyle])

  if (!value) return props.children
  return <WeddingRestylePhotoContext.Provider value={value}>{props.children}</WeddingRestylePhotoContext.Provider>
}

/** Nút trên ảnh đã tải. Không hiện khi khách xem thiệp. */
export function WeddingRestylePhotoButton(props: {
  slot: WeddingCouplePhotoRestyleId
  hasPhoto: boolean
  className?: string
}) {
  const api = useContext(WeddingRestylePhotoContext)
  if (!api || !props.hasPhoto) return null
  const busy = api.busySlot === props.slot
  const locked = api.busySlot != null
  return (
    <button
      type="button"
      disabled={locked}
      title={api.hint}
      aria-busy={busy}
      className={cn(
        'pointer-events-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#f0c14b] px-2.5 py-1 text-[10px] font-semibold text-[#3f2a12] shadow disabled:opacity-60',
        props.className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!locked) api.onRestyle(props.slot)
      }}
    >
      {busy ? api.busyLabel : api.label}
      {busy ? null : (
        <span className="rounded-full bg-[#3f2a12] px-1.5 py-px text-[9px] font-bold leading-none text-[#f0c14b]">
          {api.creditLabel}
        </span>
      )}
    </button>
  )
}
