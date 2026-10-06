'use client'

import { cn } from '@/lib/utils'

const COUPLE_NAME_FLY_CSS = `
@keyframes wedding-couple-from-left {
  0% { opacity: 0; transform: translateX(calc(-1 * clamp(8rem, 30vw, 16rem))); }
  16% { opacity: 1; }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes wedding-couple-from-right {
  0% { opacity: 0; transform: translateX(clamp(8rem, 30vw, 16rem)); }
  16% { opacity: 1; }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes wedding-couple-amp {
  from { opacity: 0; transform: scale(0.72); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes wedding-couple-ornament {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
.wedding-couple-from-left {
  animation: wedding-couple-from-left 2.8s cubic-bezier(0.22, 0.45, 0.2, 1) 0.35s both;
}
.wedding-couple-from-right {
  animation: wedding-couple-from-right 2.8s cubic-bezier(0.22, 0.45, 0.2, 1) 0.35s both;
}
.wedding-couple-amp {
  animation: wedding-couple-amp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1.35s both;
}
.wedding-couple-ornament {
  animation: wedding-couple-ornament 0.85s cubic-bezier(0.22, 1, 0.36, 1) 1.7s both;
}
.wedding-couple-pace-reveal .wedding-couple-from-left,
.wedding-couple-pace-reveal .wedding-couple-from-right {
  animation-delay: 1.55s;
}
.wedding-couple-pace-reveal .wedding-couple-amp {
  animation-delay: 2.55s;
}
@media (prefers-reduced-motion: reduce) {
  .wedding-couple-from-left,
  .wedding-couple-from-right,
  .wedding-couple-amp,
  .wedding-couple-ornament { animation: none; }
}
`

/** Tên chú rể từ trái, cô dâu từ phải, gặp nhau ở dấu &. */
export function WeddingCoupleNames(props: {
  groomName: string
  brideName: string
  flyIn?: boolean
  /** reveal = chạy vào lúc cửa thiệp chính mở, để khách nhìn thấy. */
  pace?: 'cover' | 'reveal'
  className?: string
}) {
  const reveal = props.pace === 'reveal'
  return (
    <>
      {props.flyIn ? <style>{COUPLE_NAME_FLY_CSS}</style> : null}
      <h1
        className={cn(
          'flex flex-wrap items-baseline justify-center gap-x-[0.35em]',
          reveal && props.flyIn && 'wedding-couple-pace-reveal',
          props.className,
        )}
      >
        <span className={cn('inline-block max-w-full break-words', props.flyIn && 'wedding-couple-from-left')}>{props.groomName}</span>
        <span className={cn('inline-block', props.flyIn && 'wedding-couple-amp')}>&</span>
        <span className={cn('inline-block max-w-full break-words', props.flyIn && 'wedding-couple-from-right')}>{props.brideName}</span>
      </h1>
    </>
  )
}
