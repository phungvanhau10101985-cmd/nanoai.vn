'use client'

import { cn } from '@/lib/utils'
import './wedding-cover-intro.css'

/** Tên chú rể từ trái, cô dâu từ phải, gặp nhau ở dấu &. */
export function WeddingCoupleNames(props: {
  groomName: string
  brideName: string
  flyIn?: boolean
  /** reveal = chạy vào lúc cửa thiệp chính mở. opened = tên bay vào rồi từng câu hiện tiếp. */
  pace?: 'cover' | 'reveal' | 'opened'
  className?: string
}) {
  return (
    <h1
      className={cn(
        'flex items-baseline justify-center gap-x-[0.35em]',
        props.flyIn ? 'flex-nowrap' : 'flex-wrap',
        props.flyIn && props.pace === 'reveal' && 'wedding-couple-pace-reveal',
        props.flyIn && props.pace === 'opened' && 'wedding-couple-pace-opened',
        props.className,
      )}
    >
      <span className={cn('inline-block max-w-full', props.flyIn ? 'whitespace-nowrap' : 'break-words', props.flyIn && 'wedding-couple-from-left')}>{props.groomName}</span>
      <span className={cn('inline-block', props.flyIn && 'wedding-couple-amp')}>&</span>
      <span className={cn('inline-block max-w-full', props.flyIn ? 'whitespace-nowrap' : 'break-words', props.flyIn && 'wedding-couple-from-right')}>{props.brideName}</span>
    </h1>
  )
}
