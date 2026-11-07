'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeddingCouplePhotoRestyleId } from '@/lib/wedding/restyle-wedding-couple-photo'

type WeddingRestylePhotoApi = {
  label: string
  busyLabel: string
  hint: string
  downloadLabel: string
  busySlot: string | null
  onRestyle: (slot: WeddingCouplePhotoRestyleId) => void
}

const WeddingRestylePhotoContext = createContext<WeddingRestylePhotoApi | null>(null)

export function WeddingRestylePhotoProvider(props: {
  enabled: boolean
  label: string
  busyLabel: string
  hint: string
  downloadLabel: string
  busySlot: string | null
  onRestyle: (slot: WeddingCouplePhotoRestyleId) => void
  children: ReactNode
}) {
  const value = useMemo<WeddingRestylePhotoApi | null>(() => {
    if (!props.enabled) return null
    return {
      label: props.label,
      busyLabel: props.busyLabel,
      hint: props.hint,
      downloadLabel: props.downloadLabel,
      busySlot: props.busySlot,
      onRestyle: props.onRestyle,
    }
  }, [props.busyLabel, props.busySlot, props.downloadLabel, props.enabled, props.hint, props.label, props.onRestyle])

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
    </button>
  )
}

async function saveWeddingPhoto(url: string) {
  const filename = 'anh-cuoi.jpg'
  let href = url
  let revoke = false
  try {
    const res = await fetch(url)
    if (res.ok) {
      href = URL.createObjectURL(await res.blob())
      revoke = true
    }
  } catch {
    // Ảnh ngoài origin vẫn mở bằng chính địa chỉ ảnh.
  }
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
  if (revoke) URL.revokeObjectURL(href)
}

/** Icon tải ảnh. Chỉ hiện khi đang sửa thiệp. */
export function WeddingPhotoDownloadButton(props: { url: string; className?: string }) {
  const api = useContext(WeddingRestylePhotoContext)
  const url = props.url.trim()
  if (!api || !url) return null
  return (
    <button
      type="button"
      aria-label={api.downloadLabel}
      className={cn(
        'pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow',
        props.className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void saveWeddingPhoto(url)
      }}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}
