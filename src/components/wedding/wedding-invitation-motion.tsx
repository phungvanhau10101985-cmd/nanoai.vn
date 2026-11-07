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
  transform: translate3d(0, 12px, 0);
}
[data-wedding-motion-ready='1'] [data-wedding-reveal][data-wedding-shown='1'] {
  opacity: 1;
  transform: none;
  transition: opacity 1400ms cubic-bezier(0.16, 1, 0.3, 1), transform 1400ms cubic-bezier(0.16, 1, 0.3, 1);
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

/**
 * Chữ và khối dưới màn hình trượt lên một lần khi vào tầm mắt.
 * Đo lại khi mở thư hoặc đổi chế độ sửa/lướt — lần đo đầu thường rơi lúc thư còn cao 0,
 * observer không báo lại, khối gia đình nhà trai/nhà gái giữ opacity 0.
 */
export function WeddingInvitationMotion(props: { enabled: boolean; instant?: boolean; open?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    if (!props.enabled) {
      delete root.dataset.weddingMotionReady
      return
    }
    const revealAll = props.instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const markInView = () => {
      const nodes = root.querySelectorAll<HTMLElement>('[data-wedding-reveal]:not([data-wedding-shown])')
      const limit = window.innerHeight * 0.92
      for (const node of nodes) {
        if (revealAll) {
          node.dataset.weddingShown = '1'
          continue
        }
        const box = node.getBoundingClientRect()
        if (box.width < 1 || box.height < 1) continue
        if (box.top < limit && box.bottom > 0) node.dataset.weddingShown = '1'
      }
    }
    markInView()
    root.dataset.weddingMotionReady = '1'
    if (revealAll) {
      const added = new MutationObserver(() => markInView())
      added.observe(root, { childList: true, subtree: true })
      return () => added.disconnect()
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.weddingShown = '1'
          io.unobserve(entry.target)
        }
      },
      { threshold: 0, rootMargin: '0px 0px 12% 0px' },
    )
    const watch = () => {
      const nodes = root.querySelectorAll<HTMLElement>('[data-wedding-reveal]:not([data-wedding-shown])')
      for (const node of nodes) io.observe(node)
    }
    watch()
    const mo = new MutationObserver(() => {
      markInView()
      watch()
    })
    mo.observe(root, { childList: true, subtree: true })
    let scrollFrame = 0
    const onScroll = () => {
      if (scrollFrame) return
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0
        markInView()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll)
    return () => {
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
    }
  }, [props.enabled, props.instant, props.open])

  return (
    <div ref={ref} className="contents">
      <style dangerouslySetInnerHTML={{ __html: MOTION_CSS }} />
      {props.children}
    </div>
  )
}
