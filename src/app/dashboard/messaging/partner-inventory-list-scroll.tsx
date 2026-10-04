'use client'

import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react'

/** Horizontal scrollbar pinned above the inventory table, kept in sync with the table body. */
export function InventoryAdminTableScroll({
  scrollLabel,
  children,
}: {
  scrollLabel: string
  children: ReactNode
}) {
  const topRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(false)

  const measure = useCallback(() => {
    const body = bodyRef.current
    const top = topRef.current
    const width = widthRef.current
    if (!body || !top || !width) return
    const span = Math.max(0, body.scrollWidth - body.clientWidth)
    width.style.width = `${top.clientWidth + span}px`
  }, [])

  useLayoutEffect(() => {
    measure()
    const body = bodyRef.current
    if (!body) return
    const ro = new ResizeObserver(measure)
    ro.observe(body)
    const table = body.querySelector('table')
    if (table) ro.observe(table)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, children])

  const sync = (from: HTMLDivElement, to: HTMLDivElement) => {
    if (lockRef.current || to.scrollLeft === from.scrollLeft) return
    lockRef.current = true
    to.scrollLeft = from.scrollLeft
    lockRef.current = false
  }

  return (
    <>
      <div
        ref={topRef}
        aria-label={scrollLabel}
        onScroll={() => {
          if (topRef.current && bodyRef.current) sync(topRef.current, bodyRef.current)
        }}
        className="overflow-x-scroll overflow-y-hidden border-b border-border bg-muted/40 [scrollbar-color:#94a3b8_#e2e8f0] [scrollbar-width:auto] [&::-webkit-scrollbar]:h-3.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-slate-200"
        style={{ height: 18 }}
      >
        <div ref={widthRef} className="h-px" />
      </div>
      <div
        ref={bodyRef}
        onScroll={() => {
          if (topRef.current && bodyRef.current) sync(bodyRef.current, topRef.current)
        }}
        className="max-h-[min(70vh,40rem)] max-w-full overflow-auto overscroll-x-contain"
      >
        {children}
      </div>
    </>
  )
}
