'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { getWeddingMapButtonColors } from '@/lib/wedding/wedding-theme'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  weddingThemeId?: string
  children: ReactNode
  compact?: boolean
}

/** Nút CTA đặc — đọc rõ trên panel kính / nền AI (Mở thiệp, Maps, …). */
export function WeddingSolidCtaButton({ weddingThemeId, children, compact, className, ...rest }: Props) {
  const colors = getWeddingMapButtonColors(weddingThemeId)

  return (
    <button
      type="button"
      {...rest}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
        textShadow: colors.text === '#ffffff' ? '0 1px 3px rgba(0,0,0,0.45)' : undefined,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = colors.hoverBg
        rest.onMouseEnter?.(event)
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = colors.bg
        rest.onMouseLeave?.(event)
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-full border-2 font-bold tracking-wide',
        'no-underline antialiased shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-transform active:scale-[0.98]',
        compact ? 'h-8 px-4 text-[10px]' : 'h-11 px-8 text-sm',
        className,
      )}
    >
      {children}
    </button>
  )
}
