'use client'

import type { ReactNode } from 'react'
import { weddingTimelineIconKind, weddingTimelineIconSrc } from '@/lib/wedding/wedding-timeline-icons'
import { cn } from '@/lib/utils'

export type WeddingTimelineListItem = {
  key: string
  time: string
  content: ReactNode
  /** Chữ thuần để chọn icon theo chủ đề. */
  label?: string
}

type Props = {
  items: WeddingTimelineListItem[]
  panelClassName: string
  textClassName: string
  mutedClassName: string
  accentTextClassName: string
  textGlow?: string
  className?: string
  compact?: boolean
}

function timelineLabel(item: WeddingTimelineListItem): string {
  if (item.label) return item.label
  return typeof item.content === 'string' ? item.content : ''
}

export function WeddingTimelineList({
  items,
  panelClassName,
  textClassName,
  mutedClassName,
  accentTextClassName,
  textGlow,
  className,
  compact = false,
}: Props) {
  if (items.length === 0) return null
  return (
    <div
      className={cn(
        'mx-auto grid w-fit max-w-full grid-cols-[auto_minmax(0,auto)] items-center',
        compact ? 'mt-2 gap-x-1.5 gap-y-1' : 'mt-6 gap-x-2.5 gap-y-3 sm:gap-x-3',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            'col-span-2 grid grid-cols-subgrid items-center',
            compact ? 'rounded-xl px-2 py-1.5' : 'rounded-3xl px-4 py-3.5 sm:px-5 sm:py-4',
            panelClassName,
          )}
        >
          <img
            src={weddingTimelineIconSrc(weddingTimelineIconKind(timelineLabel(item)))}
            alt=""
            draggable={false}
            className={cn(
              'shrink-0 justify-self-start object-contain object-left drop-shadow-[0_2px_3px_rgba(62,47,32,0.16)]',
              compact ? 'h-8 w-8' : 'h-12 w-12 sm:h-14 sm:w-14',
            )}
          />
          <p className={cn('min-w-0 text-left', compact ? 'text-xs leading-5' : 'leading-relaxed', textClassName, textGlow)}>
            {item.time ? (
              <span className={cn('font-serif font-semibold tabular-nums', accentTextClassName, textGlow)}>{item.time}</span>
            ) : null}
            {item.time && item.content ? <span className={cn(compact ? 'mx-1' : 'mx-2', 'font-normal', mutedClassName, textGlow)}>·</span> : null}
            {item.content ? <span className={cn(item.time ? 'font-medium' : 'font-semibold')}>{item.content}</span> : null}
          </p>
        </div>
      ))}
    </div>
  )
}
