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
        'mx-auto flex w-full flex-col items-stretch',
        compact ? 'mt-2 max-w-full gap-1' : 'mt-6 max-w-md gap-3 sm:max-w-lg',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            'flex justify-center text-center',
            compact ? 'rounded-xl px-2 py-1.5' : 'rounded-3xl px-4 py-3.5 sm:px-5 sm:py-4',
            panelClassName,
          )}
        >
          <div className={cn('flex w-fit max-w-full items-center justify-center', compact ? 'gap-1.5' : 'gap-2.5 sm:gap-3')}>
            <img
              src={weddingTimelineIconSrc(weddingTimelineIconKind(timelineLabel(item)))}
              alt=""
              draggable={false}
              className={cn(
                'shrink-0 object-contain drop-shadow-[0_2px_3px_rgba(62,47,32,0.16)]',
                compact ? 'h-8 w-8' : 'h-12 w-12 sm:h-14 sm:w-14',
              )}
            />
            <p className={cn(compact ? 'text-center text-xs leading-5' : 'text-center leading-relaxed', textClassName, textGlow)}>
              {item.time ? (
                <span className={cn('font-serif font-semibold tabular-nums', accentTextClassName, textGlow)}>{item.time}</span>
              ) : null}
              {item.time && item.content ? <span className={cn(compact ? 'mx-1' : 'mx-2', 'font-normal', mutedClassName, textGlow)}>·</span> : null}
              {item.content ? <span className={cn(item.time ? 'font-medium' : 'font-semibold')}>{item.content}</span> : null}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
