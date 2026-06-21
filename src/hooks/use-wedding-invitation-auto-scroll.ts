'use client'

import { useEffect, useRef } from 'react'

const PX_PER_FRAME = 0.95
const START_DELAY_MS = 520
const USER_CONTROL_GRACE_MS = 950
const RESUME_IDLE_MS = 3000

type AutoScrollSession = {
  id: number
  stop: () => void
}

let sessionCounter = 0
let activeSession: AutoScrollSession | null = null

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

function setScrollTop(y: number) {
  window.scrollTo(0, y)
  document.documentElement.scrollTop = y
  document.body.scrollTop = y
}

function getMaxScrollTop() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
}

/** Bắt đầu cuộn tự động từ đầu trang; gọi sau khi đóng overlay «Mở thiệp». */
export function startWeddingInvitationAutoScroll() {
  activeSession?.stop()

  const sessionId = ++sessionCounter
  let stopped = false
  let paused = false
  let rafId: number | null = null
  let startTimer: number | null = null
  let graceTimer: number | null = null
  let idleTimer: number | null = null
  let acceptUserControl = false
  const cleanups: Array<() => void> = []

  const stop = () => {
    if (stopped) return
    stopped = true
    if (rafId != null) cancelAnimationFrame(rafId)
    if (startTimer != null) window.clearTimeout(startTimer)
    if (graceTimer != null) window.clearTimeout(graceTimer)
    if (idleTimer != null) window.clearTimeout(idleTimer)
    for (const fn of cleanups) fn()
    if (activeSession?.id === sessionId) activeSession = null
  }

  activeSession = { id: sessionId, stop }

  setScrollTop(0)

  graceTimer = window.setTimeout(() => {
    acceptUserControl = true
  }, USER_CONTROL_GRACE_MS)

  const pause = () => {
    if (!acceptUserControl || stopped) return
    if (idleTimer != null) window.clearTimeout(idleTimer)
    if (!paused) {
      paused = true
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
    idleTimer = window.setTimeout(resume, RESUME_IDLE_MS)
  }

  const resume = () => {
    if (stopped) return
    if (!paused) return
    paused = false
    if (rafId == null) {
      rafId = requestAnimationFrame(tick)
    }
  }

  const onUserIntent = () => {
    if (!acceptUserControl) return
    pause()
  }

  const events: Array<[keyof WindowEventMap, AddEventListenerOptions | undefined]> = [
    ['wheel', { passive: true }],
    ['touchstart', { passive: true }],
    ['touchmove', { passive: true }],
    ['mousedown', undefined],
    ['keydown', undefined],
  ]

  for (const [name, opts] of events) {
    window.addEventListener(name, onUserIntent as EventListener, opts)
    cleanups.push(() => window.removeEventListener(name, onUserIntent as EventListener))
  }

  const tick = () => {
    if (stopped || paused) return
    const maxScroll = getMaxScrollTop()
    if (maxScroll <= 0) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const next = Math.min(maxScroll, getScrollTop() + PX_PER_FRAME)
    setScrollTop(next)
    if (next >= maxScroll - 0.5) {
      stop()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  const begin = () => {
    if (stopped) return
    setScrollTop(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!stopped) rafId = requestAnimationFrame(tick)
      })
    })
  }

  startTimer = window.setTimeout(begin, START_DELAY_MS)

  return stop
}

/** Dự phòng: nếu trang reload với opened (tương lai) vẫn có thể bật qua prop. */
export function useWeddingInvitationAutoScroll(active: boolean) {
  const startedRef = useRef(false)

  useEffect(() => {
    if (!active || startedRef.current) return
    startedRef.current = true
    startWeddingInvitationAutoScroll()
  }, [active])
}
