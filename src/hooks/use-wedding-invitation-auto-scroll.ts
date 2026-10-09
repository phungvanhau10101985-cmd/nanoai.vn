'use client'

import { useEffect, useRef } from 'react'

const PX_PER_FRAME = 1
/** 60px/s — one pixel per frame so the page does not sit still then jump. */
export const WEDDING_AUTO_SCROLL_PX_PER_MS = (PX_PER_FRAME * 60) / 1000
const MAX_FRAME_MS = 40
const START_DELAY_MS = 520
const USER_CONTROL_GRACE_MS = 950
const RESUME_IDLE_MS = 3000
const STUCK_WATCH_MS = 480

type AutoScrollSession = {
  id: number
  stop: () => void
}

let sessionCounter = 0
let activeSession: AutoScrollSession | null = null

export function advanceWeddingAutoScrollY(y: number, dtMs: number, maxScroll: number) {
  const dt = Math.min(MAX_FRAME_MS, Math.max(0, dtMs))
  return Math.min(maxScroll, y + dt * WEDDING_AUTO_SCROLL_PX_PER_MS)
}

/** Integer paint target. iOS drops fractional scrollTop, so the accumulator must live outside the DOM. */
export function paintWeddingAutoScrollTop(y: number) {
  return Math.round(y)
}

function scrollingRoot(): HTMLElement {
  const el = document.scrollingElement
  return el instanceof HTMLElement ? el : document.documentElement
}

function readScrollTop() {
  const root = scrollingRoot()
  return root.scrollTop || window.scrollY || document.body.scrollTop || 0
}

function writeScrollTop(y: number) {
  const top = paintWeddingAutoScrollTop(y)
  const root = scrollingRoot()
  const html = document.documentElement
  const body = document.body
  const before = Math.round(root.scrollTop || window.scrollY || 0)
  if (before === top) return
  root.scrollTop = top
  if (Math.abs(Math.round(root.scrollTop) - top) <= 1) return
  if (html !== root) html.scrollTop = top
  if (body !== root) body.scrollTop = top
  if (Math.abs(Math.round(readScrollTop()) - top) <= 1) return
  const delta = top - Math.round(window.scrollY || 0)
  if (delta !== 0) window.scrollBy(0, delta)
}

/** Dừng cuộn tự động đang chạy (kể cả khi trang được khôi phục từ bộ nhớ). */
export function stopWeddingInvitationAutoScroll() {
  activeSession?.stop()
}

/** Về đầu trang, không gỡ khóa cuộn của bìa. */
export function scrollWeddingPageToTop() {
  const html = document.documentElement
  const prev = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  const root = scrollingRoot()
  root.scrollTop = 0
  window.scrollTo(0, 0)
  if (document.body && document.body !== root) document.body.scrollTop = 0
  html.style.scrollBehavior = prev
}

/** Gỡ overflow:hidden trên html/body. iOS không nhận scrollTo nếu khóa còn dính. */
export function releaseWeddingPageScrollLock() {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

/**
 * Gọi trong cùng lượt chạm «Mở thiệp» (useLayoutEffect), sau khi lớp bìa đã gỡ.
 * WebKit chỉ gắn scroller của trang nếu có scrollTo trong user gesture.
 */
export function primeWeddingPageScroll() {
  releaseWeddingPageScrollLock()
  const html = document.documentElement
  const prevBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  void document.body.offsetHeight
  const root = scrollingRoot()
  root.scrollTop = 1
  window.scrollTo(0, 1)
  root.scrollTop = 0
  window.scrollTo(0, 0)
  html.style.scrollBehavior = prevBehavior
}

/** Bắt đầu cuộn tự động từ đầu trang; gọi sau khi đóng overlay «Mở thiệp». */
export function startWeddingInvitationAutoScroll() {
  activeSession?.stop()

  const sessionId = ++sessionCounter
  let stopped = false
  let paused = false
  let rafId: number | null = null
  let intervalId: number | null = null
  let startTimer: number | null = null
  let graceTimer: number | null = null
  let idleTimer: number | null = null
  let watchTimer: number | null = null
  let acceptUserControl = false
  let y = 0
  let lastTs = 0
  let usingInterval = false
  const cleanups: Array<() => void> = []

  const html = document.documentElement
  const root = scrollingRoot()
  const prevHtmlBehavior = html.style.scrollBehavior
  const prevRootBehavior = root.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  if (root !== html) root.style.scrollBehavior = 'auto'

  const stop = () => {
    if (stopped) return
    stopped = true
    if (rafId != null) cancelAnimationFrame(rafId)
    if (intervalId != null) window.clearInterval(intervalId)
    if (startTimer != null) window.clearTimeout(startTimer)
    if (graceTimer != null) window.clearTimeout(graceTimer)
    if (idleTimer != null) window.clearTimeout(idleTimer)
    if (watchTimer != null) window.clearTimeout(watchTimer)
    html.style.scrollBehavior = prevHtmlBehavior
    if (root !== html) root.style.scrollBehavior = prevRootBehavior
    for (const fn of cleanups) fn()
    if (activeSession?.id === sessionId) activeSession = null
  }

  activeSession = { id: sessionId, stop }

  releaseWeddingPageScrollLock()
  writeScrollTop(0)

  graceTimer = window.setTimeout(() => {
    acceptUserControl = true
  }, USER_CONTROL_GRACE_MS)

  const clearDriver = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (intervalId != null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }

  const step = (dt: number) => {
    if (stopped || paused) return
    const maxScroll = Math.max(0, html.scrollHeight - window.innerHeight, root.scrollHeight - root.clientHeight)
    if (maxScroll <= 0) return
    y = advanceWeddingAutoScrollY(y, dt, maxScroll)
    writeScrollTop(y)
    if (y >= maxScroll - 0.5) stop()
  }

  const rafLoop = (now: number) => {
    if (stopped || paused) return
    const dt = lastTs ? now - lastTs : 0
    lastTs = now
    step(dt)
    if (!stopped && !paused) rafId = requestAnimationFrame(rafLoop)
  }

  const intervalLoop = () => {
    const now = performance.now()
    const dt = lastTs ? now - lastTs : 0
    lastTs = now
    step(dt)
  }

  const arm = () => {
    if (stopped || paused) return
    lastTs = performance.now()
    if (usingInterval) {
      if (intervalId == null) intervalId = window.setInterval(intervalLoop, 16)
      return
    }
    if (rafId == null) rafId = requestAnimationFrame(rafLoop)
  }

  const pause = () => {
    if (!acceptUserControl || stopped) return
    if (idleTimer != null) window.clearTimeout(idleTimer)
    if (!paused) {
      paused = true
      clearDriver()
    }
    idleTimer = window.setTimeout(resume, RESUME_IDLE_MS)
  }

  const resume = () => {
    if (stopped || !paused) return
    paused = false
    y = readScrollTop()
    arm()
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

  const begin = () => {
    if (stopped) return
    releaseWeddingPageScrollLock()
    void document.body.offsetHeight
    y = 0
    writeScrollTop(0)
    arm()
    watchTimer = window.setTimeout(() => {
      if (stopped || paused || usingInterval) return
      if (y > 12 && readScrollTop() < 2) {
        usingInterval = true
        clearDriver()
        arm()
      }
    }, STUCK_WATCH_MS)
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
