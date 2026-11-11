'use client'

import { useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Volume2 } from 'lucide-react'
import { ProcessingRow } from './processing-status'
import { LessonImeField } from '../ime/lesson-ime-field'
import { Button } from '@/components/ui/button'
import { keyboardOverlapPx } from '@/lib/mobile/pin-field-above-keyboard'

type LocalText = (vi: string, en: string) => string

function keyboardDockBottom() {
  const viewport = window.visualViewport
  const overlap = keyboardOverlapPx(
    window.innerHeight,
    viewport?.offsetTop ?? 0,
    viewport?.height ?? window.innerHeight,
  )
  return Math.max(0, overlap)
}

const BOTTOM_BAR = 'nav, footer, [class~="sticky"], [class~="fixed"]'

/** Thanh dính đáy không được nằm giữa ô sửa câu và bàn phím. */
function parkBottomBars(field: HTMLElement, parked: HTMLElement[]) {
  const visualHeight = window.visualViewport?.height ?? window.innerHeight
  document.querySelectorAll<HTMLElement>(BOTTOM_BAR).forEach((node) => {
    if (!node.isConnected || node.contains(field) || field.contains(node)) return
    if (node.closest('[data-keyboard-dock],[data-keyboard-sheet],[data-nanoai-widget-root]')) return
    const position = getComputedStyle(node).position
    if (position !== 'fixed' && position !== 'sticky') return
    const rect = node.getBoundingClientRect()
    if (rect.height < 8 || rect.height > visualHeight * 0.5) return
    const nearBottom = rect.bottom >= visualHeight - 180 || rect.bottom >= window.innerHeight - 180
    if (!nearBottom) return
    if (node.dataset.keyboardParked !== '1') {
      node.dataset.keyboardParked = '1'
      node.dataset.keyboardSavedDisplay = node.style.display
      parked.push(node)
    }
    node.style.display = 'none'
  })
}

function unparkBottomBars(parked: HTMLElement[]) {
  parked.forEach((node) => {
    node.style.display = node.dataset.keyboardSavedDisplay ?? ''
    delete node.dataset.keyboardParked
    delete node.dataset.keyboardSavedDisplay
  })
  parked.length = 0
}

export function SpeechIntentConfirm({
  text,
  meaning,
  meaningBusy,
  continueBusy,
  onTextChange,
  onContinue,
  onReplay,
  localText,
  languageCode,
}: {
  text: string
  meaning: string
  meaningBusy: boolean
  continueBusy: boolean
  onTextChange: (value: string) => void
  onContinue: () => void
  onReplay?: () => void
  localText: LocalText
  languageCode: string
}) {
  const flushRef = useRef<(() => string) | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const blurTimerRef = useRef(0)
  const phoneRef = useRef(false)
  const pinnedRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [phone, setPhone] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [dockBottom, setDockBottom] = useState(0)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const label = localText('Có phải em muốn nói', 'Is this what you meant')

  useLayoutEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useLayoutEffect(() => () => window.clearTimeout(blurTimerRef.current), [])

  useLayoutEffect(() => {
    if (!phone || pinned) return
    const place = () => {
      const rect = spacerRef.current?.getBoundingClientRect()
      if (!rect || rect.width < 8) return
      const viewport = window.visualViewport
      const next = {
        top: Math.round(rect.top + (viewport?.offsetTop ?? 0)),
        left: Math.round(rect.left + (viewport?.offsetLeft ?? 0)),
        width: Math.round(rect.width),
      }
      setAnchor((prev) => {
        if (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width) return prev
        return next
      })
    }
    place()
    const rooms: HTMLElement[] = []
    let node = spacerRef.current?.parentElement ?? null
    while (node) {
      rooms.push(node)
      node = node.parentElement
    }
    rooms.forEach((room) => room.addEventListener('scroll', place, { passive: true }))
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      rooms.forEach((room) => room.removeEventListener('scroll', place))
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [phone, pinned])

  useLayoutEffect(() => {
    if (!pinned) return
    const parked: HTMLElement[] = []
    let timers: number[] = []
    const sync = () => {
      setDockBottom((prev) => {
        const next = keyboardDockBottom()
        return prev === next ? prev : next
      })
      const field = inputRef.current
      if (field) parkBottomBars(field, parked)
    }
    const schedule = () => {
      sync()
      timers.forEach((id) => window.clearTimeout(id))
      timers = [80, 200, 400, 700, 1100].map((delay) => window.setTimeout(sync, delay))
    }
    schedule()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', schedule)
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      unparkBottomBars(parked)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [pinned])

  phoneRef.current = phone
  pinnedRef.current = pinned

  const pinToKeyboard = () => {
    if (!phoneRef.current || pinnedRef.current) return
    pinnedRef.current = true
    flushSync(() => setPinned(true))
  }

  useLayoutEffect(() => {
    const input = inputRef.current
    const dock = dockRef.current
    if (!input) return
    const onFocusOut = (event: globalThis.FocusEvent) => {
      const next = event.relatedTarget
      if (next instanceof Node && dock?.contains(next)) return
      window.clearTimeout(blurTimerRef.current)
      blurTimerRef.current = window.setTimeout(() => {
        const active = document.activeElement
        if (active && dockRef.current?.contains(active)) return
        pinnedRef.current = false
        setPinned(false)
      }, 200)
    }
    input.addEventListener('pointerdown', pinToKeyboard)
    input.addEventListener('focus', pinToKeyboard)
    dock?.addEventListener('focusout', onFocusOut)
    return () => {
      input.removeEventListener('pointerdown', pinToKeyboard)
      input.removeEventListener('focus', pinToKeyboard)
      dock?.removeEventListener('focusout', onFocusOut)
    }
  }, [phone])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!pinned) return
    if (event.target instanceof HTMLInputElement) return
    if (event.target instanceof Element && event.target.closest('button')) return
    event.preventDefault()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    window.clearTimeout(blurTimerRef.current)
    blurTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement
      if (active && dockRef.current?.contains(active)) return
      pinnedRef.current = false
      setPinned(false)
    }, 200)
  }

  const meaningLine = meaningBusy ? (
    <ProcessingRow className="text-sm leading-relaxed text-slate-700">
      {localText('Đang dịch...', 'Translating...')}
    </ProcessingRow>
  ) : meaning ? (
    <p className="max-h-24 overflow-y-auto text-sm leading-relaxed text-slate-700">{meaning}</p>
  ) : null

  const editor = (
    <div
      ref={dockRef}
      data-keyboard-dock={phone ? '' : undefined}
      onPointerDown={handlePointerDown}
      onBlur={handleBlur}
      className={
        !phone
          ? undefined
          : pinned
            ? 'fixed left-0 right-0 z-[90] border-t border-emerald-200 bg-white px-3 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.16)]'
            : 'fixed z-[90]'
      }
      style={
        phone
          ? pinned
            ? {
                bottom: dockBottom,
                paddingBottom: dockBottom > 0 ? 8 : 'max(8px, env(safe-area-inset-bottom, 0px))',
              }
            : {
                top: anchor?.top ?? -9999,
                left: anchor?.left ?? 0,
                width: anchor?.width ?? 0,
              }
          : undefined
      }
    >
      {pinned ? <p className="mb-1 text-xs font-semibold text-emerald-800">{label}</p> : null}
      {pinned ? <div className="mb-1">{meaningLine}</div> : null}
      <LessonImeField
        ref={inputRef}
        value={text}
        onChange={onTextChange}
        languageCode={languageCode}
        localText={localText}
        flushRef={flushRef}
        onPendingChange={setPending}
        disabled={continueBusy}
        className="bg-white text-slate-900"
      />
    </div>
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-emerald-800">{label}</p>
      {phone ? (
        <div ref={spacerRef} className="min-h-11">
          {pinned ? <p className="break-words text-base leading-relaxed">{text}</p> : null}
        </div>
      ) : (
        editor
      )}
      {pinned ? null : meaningLine}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const flushed = (flushRef.current?.() ?? text).trim()
            if (flushed !== text.trim()) return
            onContinue()
          }}
          disabled={continueBusy || meaningBusy || (!text.trim() && !pending)}
          className="min-h-[40px] px-4"
        >
          {localText('Tiếp', 'Continue')}
        </Button>
        {onReplay ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReplay}
            disabled={continueBusy}
            className="min-h-[40px] bg-white px-4"
          >
            <Volume2 className="mr-2 h-4 w-4" />
            {localText('Nghe lại', 'Play back')}
          </Button>
        ) : null}
      </div>
      {phone && typeof document !== 'undefined' ? createPortal(editor, document.body) : null}
    </div>
  )
}
