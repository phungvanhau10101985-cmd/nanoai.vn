'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'

type Props = {
  theme: WeddingTheme
  title?: string
  children: ReactNode
  id?: string
  className?: string
  contentClassName?: string
}

/** Khối nội dung trên nền ảnh AI — kính mờ trung tính, tiêu đề tinh tế. */
export function WeddingSectionCard({ theme, title, children, id, className, contentClassName }: Props) {
  return (
    <WeddingReadableGlass
      theme={theme}
      strength="section"
      id={id}
      className={cn('rounded-[1.75rem] px-4 py-5 sm:rounded-[2rem] sm:px-5 sm:py-6 md:px-8 md:py-7', className)}
    >
      {title ? (
        <h2
          className={cn(
            'text-center text-lg font-semibold sm:text-xl md:text-2xl',
            theme.text,
            theme.textGlowHeading,
          )}
        >
          {title}
        </h2>
      ) : null}
      <div className={cn(title ? 'mt-4 sm:mt-5' : undefined, contentClassName)}>{children}</div>
    </WeddingReadableGlass>
  )
}
