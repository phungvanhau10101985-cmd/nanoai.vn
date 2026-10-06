'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

const MOTION_CSS = `
@keyframes wedding-cover-breathe {
  from { transform: scale(1); }
  to { transform: scale(1.06); }
}
.wedding-cover-breathe {
  animation: wedding-cover-breathe 7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  transform-origin: center center;
}
@keyframes wedding-cover-arrive {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
.wedding-cover-arrive {
  animation: wedding-cover-arrive 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
[data-wedding-motion-ready='1'] [data-wedding-reveal]:not([data-wedding-shown]) {
  opacity: 0;
  transform: translateY(18px);
}
[data-wedding-motion-ready='1'] [data-wedding-reveal][data-wedding-shown='1'] {
  opacity: 1;
  transform: none;
  transition: opacity 760ms cubic-bezier(0.22, 1, 0.36, 1), transform 760ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .wedding-cover-breathe,
  .wedding-cover-arrive { animation: none; }
  [data-wedding-motion-ready='1'] [data-wedding-reveal]:not([data-wedding-shown]) {
    opacity: 1;
    transform: none;
  }
}
`

/** Chữ và khối dưới màn hình trượt lên một lần khi vào tầm mắt. */
export function WeddingInvitationMotion(props: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !props.enabled) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-wedding-reveal]')]
    const limit = window.innerHeight * 0.9
    for (const node of nodes) {
      if (reduce || node.getBoundingClientRect().top < limit) node.dataset.weddingShown = '1'
    }
    root.dataset.weddingMotionReady = '1'
    if (reduce) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.weddingShown = '1'
          io.unobserve(entry.target)
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    )
    for (const node of nodes) {
      if (node.dataset.weddingShown !== '1') io.observe(node)
    }
    return () => io.disconnect()
  }, [props.enabled])

  return (
    <div ref={ref} className="contents">
      <style>{MOTION_CSS}</style>
      {props.children}
    </div>
  )
}
