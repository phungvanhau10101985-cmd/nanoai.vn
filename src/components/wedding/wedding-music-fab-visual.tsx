'use client'

import { Music } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Waveform nhỏ trong nút FAB khi đang phát; khi dừng dùng nốt nhạc. */
export function WeddingMusicFabVisual({ playing, className }: { playing: boolean; className?: string }) {
  if (!playing) {
    return <Music className={cn('h-6 w-6 shrink-0', className)} strokeWidth={2} aria-hidden />
  }

  return (
    <span
      className={cn(
        'inline-flex h-[22px] w-[26px] shrink-0 items-end justify-between gap-[3px]',
        className,
      )}
      aria-hidden
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'h-[18px] w-[5px] origin-bottom rounded-full bg-white shadow-sm',
            'motion-safe:animate-wedding-music-fab-bar',
          )}
          style={{
            animationDelay: `${i * 95}ms`,
          }}
        />
      ))}
    </span>
  )
}
