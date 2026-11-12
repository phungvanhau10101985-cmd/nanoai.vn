'use client'

import { useEffect } from 'react'
import {
  KEYBOARD_FIELD_GAP_PX,
  applyPinAcrossScrollers,
  fieldPinDeltaPx,
  keyboardIsOpen,
  keyboardOverlapPx,
  shouldLockStickyBox,
  stickyContentHeightPx,
  type StickyChildBox,
} from '@/lib/mobile/pin-field-above-keyboard'

const SLOP_PX = 16
const DOCK_OR_SHEET = '[data-keyboard-dock],[data-keyboard-sheet]'
const BAR_SELECTOR = 'nav, footer, [class~="sticky"], [class~="fixed"]'
/** Nút chat tự kéo theo visual viewport. Giấu nó bằng display:none thì effect đo hộp rỗng và setState không dừng. */
const PARK_SKIP = '[data-keyboard-manual],[data-keyboard-dock],[data-keyboard-sheet],[data-nanoai-widget-root]'

function keyboardOwnedElsewhere(node: HTMLElement): boolean {
  if (node.closest(DOCK_OR_SHEET)) return true
  const manual = node.closest<HTMLElement>('[data-keyboard-manual]')
  if (!manual) return false
  const studyShell = manual.hasAttribute('data-study-chat') || manual.className.includes('max-md:fixed')
  if (studyShell) return getComputedStyle(manual).position === 'fixed'
  return true
}

function isTypingTarget(node: EventTarget | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false
  if (node instanceof HTMLTextAreaElement) return !node.readOnly && !node.disabled
  if (node.isContentEditable && node.getAttribute('contenteditable') !== 'false') return true
  if (!(node instanceof HTMLInputElement) || node.disabled || node.readOnly) return false
  const type = (node.type || 'text').toLowerCase()
  return !['button', 'checkbox', 'radio', 'file', 'submit', 'reset', 'range', 'color', 'image', 'hidden'].includes(type)
}

function isTextField(node: EventTarget | null): node is HTMLElement {
  return isTypingTarget(node) && !keyboardOwnedElsewhere(node)
}

function isScrollable(el: HTMLElement): boolean {
  const overflow = getComputedStyle(el).overflowY
  if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false
  return el.scrollHeight > el.clientHeight + 4
}

function scrollableAncestors(field: HTMLElement): HTMLElement[] {
  const list: HTMLElement[] = []
  let node = field.parentElement
  while (node && node !== document.documentElement) {
    if (isScrollable(node)) list.push(node)
    node = node.parentElement
  }
  return list
}

function markShopScrollHold() {
  const win = window as Window & { __pwScrollPinning?: number }
  win.__pwScrollPinning = 1
  window.requestAnimationFrame(() => {
    win.__pwScrollPinning = 0
  })
}

function scrollRooms(rooms: HTMLElement[], delta: number) {
  if (!rooms.length || Math.abs(delta) <= 1) return
  const plan = applyPinAcrossScrollers(
    rooms.map((el) => ({
      scrollTop: el.scrollTop,
      maxScroll: el.scrollHeight - el.clientHeight,
    })),
    delta,
  )
  markShopScrollHold()
  rooms.forEach((el, index) => {
    el.scrollTop = plan.scrollTops[index] ?? el.scrollTop
  })
}

/** Thanh dính / cố định ngắn chứa ô gõ. Hộp thoại đi đường riêng. */
function shortPinnedBox(field: HTMLElement): HTMLElement | null {
  const visualHeight = window.visualViewport?.height ?? window.innerHeight
  let node = field.parentElement
  while (node && node !== document.body) {
    if (node.getAttribute('role') === 'dialog') return null
    const position = getComputedStyle(node).position
    if (position === 'fixed' || position === 'sticky') {
      const height = node.getBoundingClientRect().height
      const short = height > 0 && height < visualHeight * 0.72
      const bottom = getComputedStyle(node).bottom
      if (short && (position === 'sticky' || bottom !== 'auto')) return node
      if (position === 'fixed') return null
    }
    node = node.parentElement
  }
  return null
}

function compactBox(field: HTMLElement, visualHeight: number): HTMLElement {
  let best: HTMLElement = field
  let node = field.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const height = node.getBoundingClientRect().height
    if (!(height > 0 && height < visualHeight * 0.42)) break
    best = node
    node = node.parentElement
  }
  return best
}

function nearestSticky(field: HTMLElement): HTMLElement | null {
  let node = field.parentElement
  while (node && node !== document.body) {
    if (node.getAttribute('role') === 'dialog') return null
    const position = getComputedStyle(node).position
    if (position === 'sticky') return node
    if (position === 'fixed') return null
    node = node.parentElement
  }
  return null
}

function readStickyContentPx(el: HTMLElement): number {
  const box = getComputedStyle(el)
  const children: StickyChildBox[] = []
  for (const child of el.children) {
    if (!(child instanceof HTMLElement)) continue
    const style = getComputedStyle(child)
    children.push({
      height: child.offsetHeight,
      marginTop: Number.parseFloat(style.marginTop) || 0,
      marginBottom: Number.parseFloat(style.marginBottom) || 0,
      skip: style.display === 'none' || style.position === 'absolute' || style.position === 'fixed',
    })
  }
  return stickyContentHeightPx(
    Number.parseFloat(box.paddingTop) || 0,
    Number.parseFloat(box.paddingBottom) || 0,
    Number.parseFloat(box.borderTopWidth) || 0,
    Number.parseFloat(box.borderBottomWidth) || 0,
    children,
  )
}

/**
 * Bàn phím mobile đôi khi kéo thanh `position: sticky` cao bằng cả vùng nhìn,
 * nền trắng che hội thoại, rồi ghim kéo riêng hàng ô gõ ra khỏi nền đó.
 * Khóa chiều cao đúng bằng nội dung đang hiện.
 */
function lockStickySheet(sticky: HTMLElement) {
  const content = readStickyContentPx(sticky)
  const box = sticky.getBoundingClientRect().height
  const locked = sticky.dataset.keyboardClamp === '1'
  if (!shouldLockStickyBox(box, content, locked)) return
  if (!locked) {
    sticky.dataset.keyboardClamp = '1'
    sticky.dataset.keyboardSavedClampHeight = sticky.style.height
    sticky.dataset.keyboardSavedClampMax = sticky.style.maxHeight
  }
  const px = `${content}px`
  if (sticky.style.height !== px) sticky.style.height = px
  if (sticky.style.maxHeight !== px) sticky.style.maxHeight = px
}

function releaseStickySheets(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-keyboard-clamp]').forEach((sticky) => {
    sticky.style.height = sticky.dataset.keyboardSavedClampHeight ?? ''
    sticky.style.maxHeight = sticky.dataset.keyboardSavedClampMax ?? ''
    delete sticky.dataset.keyboardClamp
    delete sticky.dataset.keyboardSavedClampHeight
    delete sticky.dataset.keyboardSavedClampMax
  })
}

function restoreShifted(root: ParentNode = document, includeParked = true) {
  root.querySelectorAll<HTMLElement>('[data-keyboard-shift]').forEach((box) => {
    box.style.transform = box.dataset.keyboardSavedTransform ?? ''
    box.style.zIndex = box.dataset.keyboardSavedZ ?? ''
    delete box.dataset.keyboardShift
    delete box.dataset.keyboardSavedTransform
    delete box.dataset.keyboardSavedZ
  })
  root.querySelectorAll<HTMLElement>('[data-keyboard-fit]').forEach((dialog) => {
    dialog.style.top = dialog.dataset.keyboardSavedTop ?? ''
    dialog.style.bottom = dialog.dataset.keyboardSavedBottom ?? ''
    dialog.style.height = dialog.dataset.keyboardSavedHeight ?? ''
    dialog.style.maxHeight = dialog.dataset.keyboardSavedMax ?? ''
    dialog.style.transform = dialog.dataset.keyboardSavedTransform ?? ''
    dialog.style.overflowY = dialog.dataset.keyboardSavedOverflow ?? ''
    delete dialog.dataset.keyboardFit
    delete dialog.dataset.keyboardSavedTop
    delete dialog.dataset.keyboardSavedBottom
    delete dialog.dataset.keyboardSavedHeight
    delete dialog.dataset.keyboardSavedMax
    delete dialog.dataset.keyboardSavedTransform
    delete dialog.dataset.keyboardSavedOverflow
  })
  root.querySelectorAll<HTMLElement>('[data-keyboard-shell]').forEach((shell) => {
    shell.style.bottom = shell.dataset.keyboardSavedBottom ?? ''
    delete shell.dataset.keyboardShell
    delete shell.dataset.keyboardSavedBottom
  })
  if (!includeParked) return
  root.querySelectorAll<HTMLElement>('[data-keyboard-parked]').forEach((bar) => {
    bar.style.display = bar.dataset.keyboardSavedDisplay ?? ''
    delete bar.dataset.keyboardParked
    delete bar.dataset.keyboardSavedDisplay
  })
}

function unparkAround(field: HTMLElement) {
  const parked = field.closest<HTMLElement>('[data-keyboard-parked]')
  if (!parked) return
  parked.style.display = parked.dataset.keyboardSavedDisplay ?? ''
  delete parked.dataset.keyboardParked
  delete parked.dataset.keyboardSavedDisplay
}

function shiftBoxToKeyboard(box: HTMLElement, field: HTMLElement, visualHeight: number) {
  if (!box.dataset.keyboardShift) {
    box.dataset.keyboardShift = '1'
    box.dataset.keyboardSavedTransform = box.style.transform
    box.dataset.keyboardSavedZ = box.style.zIndex
  }
  box.style.transform = box.dataset.keyboardSavedTransform ?? ''
  const naturalBottom = field.getBoundingClientRect().bottom
  const shift = Math.round(visualHeight - KEYBOARD_FIELD_GAP_PX - naturalBottom)
  if (Math.abs(shift) <= SLOP_PX) {
    box.style.zIndex = box.dataset.keyboardSavedZ ?? ''
    return
  }
  const base = (box.dataset.keyboardSavedTransform ?? '').trim()
  box.style.transform = base ? `${base} translateY(${shift}px)` : `translateY(${shift}px)`
  box.style.zIndex = '80'
}

/** Thanh đáy khác ô đang gõ không được nằm giữa ô và bàn phím. */
function parkForeignBars(field: HTMLElement, visualHeight: number) {
  document.querySelectorAll<HTMLElement>(BAR_SELECTOR).forEach((node) => {
    if (!node.isConnected || node.contains(field) || field.contains(node)) return
    if (node.closest(PARK_SKIP)) return
    const position = getComputedStyle(node).position
    if (position !== 'fixed' && position !== 'sticky') return
    const rect = node.getBoundingClientRect()
    if (rect.height < 8 || rect.height > visualHeight * 0.5) return
    const nearBottom = rect.bottom >= visualHeight - 180 || rect.bottom >= window.innerHeight - 180
    if (!nearBottom) return
    if (node.dataset.keyboardParked !== '1') {
      node.dataset.keyboardParked = '1'
      node.dataset.keyboardSavedDisplay = node.style.display
    }
    node.style.display = 'none'
  })
}

function horizontallyCentered(dialog: HTMLElement): boolean {
  return getComputedStyle(dialog).left === '50%'
}

function fitDialog(dialog: HTMLElement, offsetTop: number, visualHeight: number) {
  if (!dialog.dataset.keyboardFit) {
    dialog.dataset.keyboardFit = '1'
    dialog.dataset.keyboardSavedTop = dialog.style.top
    dialog.dataset.keyboardSavedBottom = dialog.style.bottom
    dialog.dataset.keyboardSavedHeight = dialog.style.height
    dialog.dataset.keyboardSavedMax = dialog.style.maxHeight
    dialog.dataset.keyboardSavedTransform = dialog.style.transform
    dialog.dataset.keyboardSavedOverflow = dialog.style.overflowY
  }
  const centered = horizontallyCentered(dialog)
  const gap = KEYBOARD_FIELD_GAP_PX
  dialog.style.bottom = 'auto'
  dialog.style.top = `${Math.max(0, Math.round(offsetTop + gap))}px`
  dialog.style.height = 'auto'
  dialog.style.maxHeight = `${Math.max(180, Math.round(visualHeight - gap * 2))}px`
  dialog.style.overflowY = 'auto'
  if (centered) dialog.style.transform = 'translateX(-50%)'
}

function isBottomAnchoredShell(node: HTMLElement, visualHeight: number): boolean {
  if (node.getAttribute('role') === 'dialog' || node.closest('[role="dialog"]')) return false
  const style = getComputedStyle(node)
  if (style.position !== 'fixed' || style.bottom === 'auto') return false
  const rect = node.getBoundingClientRect()
  if (rect.height < visualHeight * 0.72) return false
  if (style.top === '0px' && (style.bottom === '0px' || style.bottom === '0')) return false
  return true
}

function nudgeBottomShell(field: HTMLElement, offsetTop: number, visualHeight: number): boolean {
  let node = field.parentElement
  while (node && node !== document.body) {
    if (isBottomAnchoredShell(node, visualHeight)) {
      if (!node.dataset.keyboardShell) {
        node.dataset.keyboardShell = '1'
        node.dataset.keyboardSavedBottom = node.style.bottom
      }
      const overlap = keyboardOverlapPx(window.innerHeight, offsetTop, visualHeight)
      node.style.bottom = `${Math.max(KEYBOARD_FIELD_GAP_PX, overlap)}px`
      return true
    }
    node = node.parentElement
  }
  return false
}

function pinField(field: HTMLElement, heightBeforeFocus: number) {
  if (!field.isConnected || keyboardOwnedElsewhere(field)) return
  const sticky = nearestSticky(field)
  if (sticky) lockStickySheet(sticky)
  const vv = window.visualViewport
  const visualHeight = vv?.height ?? window.innerHeight
  const offsetTop = vv?.offsetTop ?? 0
  const open = keyboardIsOpen({
    layoutHeight: window.innerHeight,
    offsetTop,
    visualHeight,
    heightBeforeFocus,
  })
  if (!open) {
    restoreShifted()
    return
  }

  restoreShifted(document, false)
  unparkAround(field)
  parkForeignBars(field, visualHeight)

  const deltaNow = () => fieldPinDeltaPx(field.getBoundingClientRect().bottom, visualHeight)

  const bar = shortPinnedBox(field)
  if (bar) {
    shiftBoxToKeyboard(bar, field, visualHeight)
    return
  }

  if (sticky) {
    const rooms = scrollableAncestors(field)
    scrollRooms(rooms, deltaNow())
    const doc = document.scrollingElement
    if (doc instanceof HTMLElement && !rooms.includes(doc)) scrollRooms([doc], deltaNow())
    return
  }

  if (nudgeBottomShell(field, offsetTop, visualHeight)) {
    const shell = field.closest<HTMLElement>('[data-keyboard-shell]')
    const rooms = scrollableAncestors(field).filter((el) => (shell ? shell.contains(el) : true))
    scrollRooms(rooms, deltaNow())
    if (Math.abs(deltaNow()) > SLOP_PX) shiftBoxToKeyboard(compactBox(field, visualHeight), field, visualHeight)
    return
  }

  const dialog = field.closest('[role="dialog"]')
  if (dialog instanceof HTMLElement) {
    fitDialog(dialog, offsetTop, visualHeight)
    const rooms = scrollableAncestors(field).filter((el) => dialog.contains(el))
    if (isScrollable(dialog)) rooms.push(dialog)
    scrollRooms(rooms, deltaNow())
    const remain = deltaNow()
    if (remain < -SLOP_PX) {
      const top = Number.parseFloat(dialog.style.top) || 0
      dialog.style.top = `${Math.round(top - remain)}px`
    }
    return
  }

  const inners = scrollableAncestors(field)
  scrollRooms(inners, deltaNow())
  const doc = document.scrollingElement
  if (doc instanceof HTMLElement && !inners.includes(doc)) {
    scrollRooms([doc], deltaNow())
  }
  if (Math.abs(deltaNow()) > SLOP_PX) shiftBoxToKeyboard(compactBox(field, visualHeight), field, visualHeight)
}

/** Mọi ô gõ trên mobile: kéo sát mép bàn phím, phần phía trên vẫn cuộn được. */
export function MobileKeyboardPin() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    let field: HTMLElement | null = null
    let baseline = 0
    let timers: number[] = []
    let pinning = false
    let scrollSpins = 0
    let stickyNode: HTMLElement | null = null
    let stickyWatch: MutationObserver | null = null

    const clearTimers = () => {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
    }

    const run = () => {
      if (pinning || !mq.matches || !field || !field.isConnected || document.activeElement !== field) return
      pinning = true
      try {
        pinField(field, baseline)
      } finally {
        pinning = false
      }
    }

    const schedule = () => {
      scrollSpins = 0
      clearTimers()
      run()
      for (const delay of [80, 200, 400, 700, 1100, 1500]) {
        timers.push(
          window.setTimeout(() => {
            scrollSpins = 0
            run()
          }, delay),
        )
      }
    }

    const watchSticky = (next: HTMLElement | null) => {
      if (stickyNode === next) return
      stickyWatch?.disconnect()
      stickyWatch = null
      stickyNode = next
      if (!next) return
      stickyWatch = new MutationObserver(() => {
        if (field) run()
      })
      stickyWatch.observe(next, { childList: true })
    }

    const rememberBaseline = () => {
      baseline = window.visualViewport?.height ?? window.innerHeight
    }

    const markTyping = (open: boolean) => {
      if (open) document.documentElement.dataset.keyboardOpen = '1'
      else delete document.documentElement.dataset.keyboardOpen
    }

    const onPointerDown = (event: Event) => {
      if (!mq.matches) return
      if (isTextField(event.target)) rememberBaseline()
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!mq.matches || !isTypingTarget(event.target)) return
      markTyping(true)
      if (!isTextField(event.target)) return
      if (!baseline) rememberBaseline()
      field = event.target
      watchSticky(nearestSticky(event.target))
      schedule()
    }

    const onFocusOut = () => {
      window.setTimeout(() => {
        const next = document.activeElement
        if (isTypingTarget(next)) {
          markTyping(true)
          if (!isTextField(next)) {
            field = null
            clearTimers()
            watchSticky(null)
            releaseStickySheets()
            restoreShifted()
          }
          return
        }
        markTyping(false)
        field = null
        baseline = 0
        clearTimers()
        watchSticky(null)
        releaseStickySheets()
        restoreShifted()
      }, 80)
    }

    const onViewport = () => {
      if (field) schedule()
    }

    const onViewportScroll = () => {
      if (!field || scrollSpins > 6) return
      scrollSpins += 1
      run()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('touchstart', onPointerDown, { capture: true, passive: true })
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    window.visualViewport?.addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('scroll', onViewportScroll)
    mq.addEventListener('change', onViewport)

    return () => {
      clearTimers()
      stickyWatch?.disconnect()
      releaseStickySheets()
      restoreShifted()
      delete document.documentElement.dataset.keyboardOpen
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('touchstart', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      window.visualViewport?.removeEventListener('resize', onViewport)
      window.visualViewport?.removeEventListener('scroll', onViewportScroll)
      mq.removeEventListener('change', onViewport)
    }
  }, [])

  return null
}
