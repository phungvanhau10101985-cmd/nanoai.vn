'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type WeddingTimelineListItem = {
  key: string
  time: string
  content: ReactNode
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

function FloraRose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M6.4 19.2c-2.2 2.4-1.6 5.6 1 6.4 1.8-2.8 2-5.6.4-7.4" fill="#8fb58a" />
      <path d="M25.2 17.6c2.8 1.4 3.6 4.8 1.6 6.4-2.8-1.4-4.2-3.8-3.4-6.2" fill="#6f9a72" />
      <circle cx="16" cy="13.6" r="5" fill="#f6c3cf" />
      <circle cx="12.2" cy="15.6" r="3.5" fill="#e890a8" />
      <circle cx="19.7" cy="15.4" r="3.4" fill="#f8d0da" />
      <circle cx="16" cy="17" r="3.2" fill="#e07a96" />
      <circle cx="16" cy="14.6" r="1.55" fill="#f8e4b4" />
    </svg>
  )
}

function FloraSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16.2 26.2c.4-5.2 1.4-9.2 4.2-13.2" stroke="#6f9a72" strokeWidth="1.35" strokeLinecap="round" />
      <ellipse cx="10.6" cy="17.2" rx="5.1" ry="3" transform="rotate(-32 10.6 17.2)" fill="#8fb58a" />
      <ellipse cx="22.2" cy="12.4" rx="4.8" ry="2.8" transform="rotate(26 22.2 12.4)" fill="#b7d4ae" />
      <circle cx="16.4" cy="8.2" r="2.35" fill="#f4b7c6" />
      <circle cx="16.4" cy="8.2" r="0.85" fill="#f8e4b4" />
    </svg>
  )
}

function FloraBlossom({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M8.2 22.4c-2.4 1.2-3.6 3.8-2.4 5.4 2.6-.6 4.4-2.4 4.6-4.6" fill="#7ea37a" />
      <circle cx="16" cy="10.2" r="3.15" fill="#f7c9d4" />
      <circle cx="11.6" cy="13.4" r="3.15" fill="#f0b0c2" />
      <circle cx="20.4" cy="13.4" r="3.15" fill="#f8d5de" />
      <circle cx="13.2" cy="18.2" r="3.15" fill="#e890a8" />
      <circle cx="18.8" cy="18.2" r="3.15" fill="#f4b8c8" />
      <circle cx="16" cy="14.8" r="2.15" fill="#f8e4b4" />
    </svg>
  )
}

function TimelineFlora({ index, className }: { index: number; className?: string }) {
  const kind = index % 3
  if (kind === 0) return <FloraRose className={className} />
  if (kind === 1) return <FloraSprig className={className} />
  return <FloraBlossom className={className} />
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
      {items.map((item, index) => (
        <div
          key={item.key}
          className={cn(
            'flex justify-center text-center',
            compact ? 'rounded-xl px-2 py-1.5' : 'rounded-3xl px-4 py-3.5 sm:px-5 sm:py-4',
            panelClassName,
          )}
        >
          <div className={cn('flex w-fit max-w-full items-center justify-center', compact ? 'gap-1.5' : 'gap-2.5 sm:gap-3')}>
            <TimelineFlora
              index={index}
              className={cn('shrink-0 drop-shadow-[0_1px_1px_rgba(255,255,255,0.65)]', compact ? 'h-5 w-5' : 'h-9 w-9 sm:h-10 sm:w-10')}
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
