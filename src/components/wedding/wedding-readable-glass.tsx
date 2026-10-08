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
  /** Khối trượt lên một lần khi khách cuộn tới, nếu thiệp bật hiệu ứng. */
  reveal?: boolean
}

const VIGNETTE_LIGHT: Record<NonNullable<Props['strength']>, string> = {
  hero: 'bg-[radial-gradient(ellipse_72%_88%_at_50%_40%,rgba(255,253,248,0.82)_0%,rgba(255,248,236,0.42)_42%,transparent_72%)]',
  section:
    'bg-[radial-gradient(ellipse_76%_90%_at_50%_40%,rgba(255,253,248,0.7)_0%,rgba(255,247,232,0.34)_48%,transparent_76%)]',
}

const VIGNETTE_DARK: Record<NonNullable<Props['strength']>, string> = {
  hero: 'bg-[radial-gradient(ellipse_72%_88%_at_50%_40%,rgba(15,23,42,0.7)_0%,rgba(15,23,42,0.36)_42%,transparent_72%)]',
  section:
    'bg-[radial-gradient(ellipse_76%_90%_at_50%_40%,rgba(15,23,42,0.58)_0%,rgba(15,23,42,0.28)_48%,transparent_76%)]',
}

/** Mờ dần hai bên để hoa văn nền lộ ra, không còn cột trắng cắt cạnh. */
const EDGE_FADE =
  '[mask-image:linear-gradient(90deg,transparent_0%,#000_16%,#000_84%,transparent_100%)] [-webkit-mask-image:linear-gradient(90deg,transparent_0%,#000_16%,#000_84%,transparent_100%)]'

/** Khối kính: nền ảnh lộ hai bên, vùng giữa đủ ổn định để đọc chữ trên mọi loại nền AI. */
export function WeddingReadableGlass({ theme, className, children, id, strength = 'section', reveal }: Props) {
  const dark = isWeddingDarkTheme(theme.id)
  const vignette = dark ? VIGNETTE_DARK[strength] : VIGNETTE_LIGHT[strength]

  return (
    <div
      id={id}
      data-wedding-reveal={reveal ? '' : undefined}
      className={cn('relative isolate bg-transparent shadow-none', className)}
      style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          EDGE_FADE,
          'backdrop-blur-xl',
          dark ? 'backdrop-saturate-[1.08]' : 'backdrop-saturate-[1.12]',
        )}
      />
      <div aria-hidden className={cn('pointer-events-none absolute inset-0', EDGE_FADE, vignette)} />
      <div className="relative z-10 w-full min-w-0 [container-type:inline-size]">{children}</div>
    </div>
  )
}
