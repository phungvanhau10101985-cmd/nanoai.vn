'use client'

import { useMemo } from 'react'
import { mapsUrlToIframeSrc } from '@/lib/wedding/google-maps-embed-url'
import { cn } from '@/lib/utils'

type Props = {
  mapUrl: string
  title: string
  className?: string
}

/** Bản đồ Google nhúng (iframe) — dùng thiệp công khai / preview chỉnh thiệp. */
export function WeddingMapEmbed({ mapUrl, title, className }: Props) {
  const src = useMemo(() => mapsUrlToIframeSrc(mapUrl), [mapUrl])
  if (!src) return null
  return (
    <div
      className={cn(
        'relative isolate w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-black/10 dark:ring-white/10',
        'aspect-video min-h-[180px] sm:min-h-[200px]',
        className,
      )}
    >
      <iframe
        title={title}
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  )
}
