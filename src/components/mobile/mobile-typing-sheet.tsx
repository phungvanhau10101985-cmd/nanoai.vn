'use client'

import { useLayoutEffect, useState, type ReactNode, type Ref } from 'react'
import { KEYBOARD_OPEN_PX, keyboardOverlapPx, typingSheetFrame } from '@/lib/mobile/pin-field-above-keyboard'

type Frame = { top: number; height: number }

/**
 * Modal gõ trên mobile: phần trên cuộn được, ô gõ dính sát mép dưới vùng còn nhìn thấy.
 * Bàn phím mở thì hộp co theo visual viewport nên ô không bị đẩy lên cao.
 */
export function MobileTypingSheet(props: {
  panelRef?: Ref<HTMLDivElement>
  panelClassName?: string
  header?: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  const [frame, setFrame] = useState<Frame | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const previousHtml = document.documentElement.style.overflow
    const previousBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const openedAt = window.visualViewport?.height ?? window.innerHeight
    const sync = () => {
      const vv = window.visualViewport
      const visualHeight = vv?.height ?? window.innerHeight
      const next = typingSheetFrame({
        mobile: mq.matches,
        offsetTop: vv?.offsetTop ?? 0,
        visualHeight,
      })
      setFrame(next)
      const overlap = keyboardOverlapPx(window.innerHeight, vv?.offsetTop ?? 0, visualHeight)
      const dropped = openedAt - visualHeight
      setKeyboardOpen(mq.matches && (overlap >= KEYBOARD_OPEN_PX || dropped >= KEYBOARD_OPEN_PX))
    }

    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    mq.addEventListener('change', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      document.documentElement.style.overflow = previousHtml
      document.body.style.overflow = previousBody
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      mq.removeEventListener('change', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:px-3">
      <div
        ref={props.panelRef}
        role="dialog"
        aria-modal="true"
        data-keyboard-sheet=""
        className={`flex w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[min(40rem,calc(100dvh-2rem))] ${props.panelClassName ?? ''}`}
        style={
          frame
            ? {
                position: 'fixed',
                left: 8,
                right: 8,
                width: 'auto',
                top: frame.top,
                height: frame.height,
                maxHeight: frame.height,
              }
            : undefined
        }
      >
        {props.header ? <div className="shrink-0 border-b bg-white">{props.header}</div> : null}
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-3 [-webkit-overflow-scrolling:touch] sm:max-h-[min(32rem,calc(100dvh-8rem))]">
          {props.children}
        </div>
        <div
          data-keyboard-dock=""
          className="shrink-0 border-t bg-white px-3 pt-2"
          style={{
            paddingBottom: keyboardOpen ? 8 : 'max(8px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          {props.footer}
        </div>
      </div>
    </div>
  )
}
