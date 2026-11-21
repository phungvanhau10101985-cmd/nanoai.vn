'use client'

import { useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'

const SCROLLBAR =
  '[scrollbar-color:#94a3b8_#e2e8f0] [scrollbar-width:auto] [&::-webkit-scrollbar]:h-3.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-slate-200'

const SCROLL_STYLE: CSSProperties = {
  scrollBehavior: 'auto',
  overflowAnchor: 'none',
}

/** Giữ vai dẫn sau mỗi nhịp cuộn để nuốt sự kiện dội từ phía kia. */
const LEAD_MS = 120

/**
 * Thanh trượt ngang trên đầu bảng giáo trình.
 * Bảng rộng hơn khung nhìn; thanh dưới đáy ở xa khi danh sách dài.
 * Chỉ một phía dẫn. Ghi scrollLeft ngược lại thanh đang kéo làm thumb giật.
 */
export function CurriculumManageTableScroll({
  scrollLabel,
  children,
}: {
  scrollLabel: string
  children: ReactNode
}) {
  const topRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef<HTMLDivElement>(null)
  const leaderRef = useRef<'top' | 'body' | null>(null)
  const pendingLeaderRef = useRef<'top' | 'body' | null>(null)
  const leadUntilRef = useRef(0)
  const quietRef = useRef(0)
  const frameRef = useRef(0)

  const measure = useCallback(() => {
    const body = bodyRef.current
    const top = topRef.current
    const width = widthRef.current
    if (!body || !top || !width) return
    if (performance.now() < leadUntilRef.current) return
    const span = body.scrollWidth - body.clientWidth
    top.hidden = span < 1
    if (span < 1) return
    const next = Math.round(top.clientWidth + span)
    const current = Number.parseFloat(width.style.width) || 0
    if (Math.abs(current - next) <= 1) return
    width.style.width = `${next}px`
  }, [])

  useLayoutEffect(() => {
    measure()
    const body = bodyRef.current
    if (!body) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(body)
    const table = body.querySelector('table')
    if (table) ro.observe(table)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.clearTimeout(quietRef.current)
      window.cancelAnimationFrame(frameRef.current)
    }
  }, [measure, children])

  const follow = (leader: 'top' | 'body') => {
    const now = performance.now()
    if (leaderRef.current && leaderRef.current !== leader && now < leadUntilRef.current) return
    const top = topRef.current
    const body = bodyRef.current
    if (!top || !body) return
    leaderRef.current = leader
    pendingLeaderRef.current = leader
    leadUntilRef.current = now + LEAD_MS
    window.clearTimeout(quietRef.current)
    quietRef.current = window.setTimeout(() => {
      leaderRef.current = null
      leadUntilRef.current = 0
      measure()
    }, LEAD_MS + 20)
    if (frameRef.current) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0
      const leaderNow = pendingLeaderRef.current
      const topEl = topRef.current
      const bodyEl = bodyRef.current
      if (!leaderNow || !topEl || !bodyEl || leaderRef.current !== leaderNow) return
      const from = leaderNow === 'top' ? topEl : bodyEl
      const to = leaderNow === 'top' ? bodyEl : topEl
      const left = from.scrollLeft
      if (Math.abs(to.scrollLeft - left) < 0.5) return
      to.scrollLeft = left
    })
  }

  return (
    <div className="min-w-0 [&_*]:[overflow-anchor:none]" style={{ overflowAnchor: 'none' }}>
      <div
        ref={topRef}
        aria-label={scrollLabel}
        onScroll={() => follow('top')}
        className={`sticky top-12 z-30 mb-1 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border bg-card md:top-[3.75rem] lg:top-16 ${SCROLLBAR}`}
        style={{ height: 18, ...SCROLL_STYLE }}
      >
        <div ref={widthRef} className="h-px" />
      </div>
      <div
        ref={bodyRef}
        onScroll={() => follow('body')}
        className={`overflow-x-auto overflow-y-hidden overscroll-x-contain ${SCROLLBAR}`}
        style={SCROLL_STYLE}
      >
        {children}
      </div>
    </div>
  )
}
