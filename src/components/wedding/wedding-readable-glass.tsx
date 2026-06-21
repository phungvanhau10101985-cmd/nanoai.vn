'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { isWeddingDarkTheme, type WeddingTheme } from '@/lib/wedding/wedding-theme'

type Props = {
  theme: WeddingTheme
  className?: string
  children: ReactNode
  id?: string
  /** Hero / mở thiệp: vignette mạnh hơn ở vùng chữ */
  strength?: 'hero' | 'section'
}

const VIGNETTE_LIGHT: Record<NonNullable<Props['strength']>, string> = {
  hero: 'bg-[radial-gradient(ellipse_94%_86%_at_50%_38%,rgba(255,253,248,0.84)_0%,rgba(255,248,236,0.56)_44%,rgba(255,242,225,0.2)_74%,transparent_100%)]',
  section:
    'bg-[radial-gradient(ellipse_98%_90%_at_50%_36%,rgba(255,253,248,0.72)_0%,rgba(255,247,232,0.46)_50%,rgba(255,242,225,0.14)_100%)]',
}

const VIGNETTE_DARK: Record<NonNullable<Props['strength']>, string> = {
  hero: 'bg-[radial-gradient(ellipse_94%_86%_at_50%_38%,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.48)_44%,rgba(15,23,42,0.16)_74%,transparent_100%)]',
  section:
    'bg-[radial-gradient(ellipse_98%_90%_at_50%_36%,rgba(15,23,42,0.62)_0%,rgba(15,23,42,0.38)_50%,rgba(15,23,42,0.12)_100%)]',
}

/** Viền sáng mỏng — tách khối khỏi nền ảnh rối mà không che hoa văn. */
const EDGE_SHINE =
  'pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_0_0_1px_rgba(255,255,255,0.12)]'
const EDGE_SHINE_DARK =
  'pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.06)]'

/** Khối kính: nền ảnh vẫn lộ quanh viền, vùng giữa đủ ổn định để đọc chữ trên mọi loại nền AI. */
export function WeddingReadableGlass({ theme, className, children, id, strength = 'section' }: Props) {
  const dark = isWeddingDarkTheme(theme.id)
  const vignette = dark ? VIGNETTE_DARK[strength] : VIGNETTE_LIGHT[strength]

  return (
    <div id={id} className={cn('relative isolate overflow-hidden', theme.panelGlass, className)}>
      <div aria-hidden className={cn('pointer-events-none absolute inset-0', vignette)} />
      <div aria-hidden className={cn(dark ? EDGE_SHINE_DARK : EDGE_SHINE)} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
