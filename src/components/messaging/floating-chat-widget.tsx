'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { Maximize2, MessageCircle, Package, ShoppingCart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openGuestProductDetailUrl } from '@/lib/messaging/open-guest-product-url'
import { WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'
import {
  NANOAI_WIDGET_MSG_SOURCE,
  PARTNER_SITE_ORDERS_UPDATED_EVENT,
  isAllowedHttpNavigationUrl,
  isDashboardNavigationUrl,
  isNavigateTopFromIframe,
  isOrderUpdatedFromIframe,
  parseWidgetPageContextFromChatUrl,
} from '@/lib/messaging/widget-parent-bridge'
import { isHostedChatIframeSrc } from '@/lib/messaging/parse-site-chat-embed'
import { stampGuestChatEmbedPageParam } from '@/lib/messaging/guest-purchase-flow'
import {
  clearReturnChatIframeHref,
  readReturnChatIframeHref,
  writeReturnChatIframeHref,
} from '@/lib/messaging/widget-embed-session'

const LOCALE_SHORT: Record<WebLocale, string> = {
  vi: 'VI',
  en: 'EN',
  zh: 'ZH',
  ja: 'JA',
  ko: 'KO',
}
const GUEST_SESSION_STORAGE_KEY = 'nanoai_guest_session_id_v1'
const GUEST_ACCOUNT_STORAGE_KEY = 'nanoai_guest_account_id_v1'
const PARTNER_SITE_SESSION_KEYS = ['app_guest_session_id', 'nanoai_guest_session_id'] as const
const PARTNER_SITE_ACCOUNT_KEYS = ['app_guest_account_id', 'nanoai_guest_account_id'] as const
const UUID_STRING_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readStoredGuestSessionId(): string {
  if (typeof window === 'undefined') return ''
  const keys = [GUEST_SESSION_STORAGE_KEY, ...PARTNER_SITE_SESSION_KEYS]
  for (const key of keys) {
    const sid = window.localStorage.getItem(key)?.trim() || ''
    if (UUID_STRING_RE.test(sid)) return sid
  }
  return ''
}

function readStoredGuestAccountId(): string {
  if (typeof window === 'undefined') return ''
  const keys = [GUEST_ACCOUNT_STORAGE_KEY, ...PARTNER_SITE_ACCOUNT_KEYS]
  for (const key of keys) {
    const aid = window.localStorage.getItem(key)?.trim() || ''
    if (UUID_STRING_RE.test(aid)) return aid
  }
  return ''
}

type WidgetLoyaltyStatus = {
  enabled?: unknown
  tierCode?: unknown
  tierName?: unknown
}

function appendStoredGuestIdentity(urlStr: string): string {
  if (typeof window === 'undefined') return urlStr
  try {
    const u = new URL(urlStr, window.location.href)
    const sid = readStoredGuestSessionId()
    const aid = readStoredGuestAccountId()
    if (UUID_STRING_RE.test(sid)) u.searchParams.set('guest_session_id', sid)
    if (UUID_STRING_RE.test(aid)) u.searchParams.set('guest_account_id', aid)
    return stampGuestChatEmbedPageParam(u.toString(), `${window.location.origin}${window.location.pathname}`)
  } catch {
    return urlStr
  }
}

function storeGuestIdentity(payload: unknown): void {
  if (typeof window === 'undefined' || !payload || typeof payload !== 'object') return
  const data = payload as { guestSessionId?: unknown; guestAccountId?: unknown }
  try {
    const sid = String(data.guestSessionId || '').trim()
    const aid = String(data.guestAccountId || '').trim()
    if (UUID_STRING_RE.test(sid)) {
      window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, sid)
      for (const key of PARTNER_SITE_SESSION_KEYS) window.localStorage.setItem(key, sid)
    }
    if (UUID_STRING_RE.test(aid)) {
      window.localStorage.setItem(GUEST_ACCOUNT_STORAGE_KEY, aid)
      for (const key of PARTNER_SITE_ACCOUNT_KEYS) window.localStorage.setItem(key, aid)
    }
    if (UUID_STRING_RE.test(sid) || UUID_STRING_RE.test(aid)) {
      window.dispatchEvent(new CustomEvent('pw-partner-site-guest-session-change'))
    }
  } catch {
    /* quota / private mode */
  }
}

function parseUiLocaleFromChatUrl(urlStr: string): WebLocale {
  try {
    const u = new URL(urlStr, typeof window !== 'undefined' ? window.location.href : 'https://localhost')
    const raw = (u.searchParams.get('ui_locale') || 'vi').trim().toLowerCase()
    if ((WEB_LOCALES as readonly string[]).includes(raw)) return raw as WebLocale
  } catch {
    /* ignore */
  }
  return 'vi'
}

/** Vị trí nút nổi — chung với `public/embed/nanoai-chat-widget.js`. */
const LAUNCHER_POS_KEY = 'nanoai_chat_launcher_pos_v1'
const LAUNCHER_DRAG_THRESHOLD_PX = 8

type LauncherPoint = { x: number; y: number }
type SafeInsets = { top: number; right: number; bottom: number; left: number }

let cachedSafeInsets: SafeInsets | null = null

function measureSafeInsets(force = false): SafeInsets {
  const empty: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  if (typeof document === 'undefined') return empty
  if (cachedSafeInsets && !force) return cachedSafeInsets
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const insets: SafeInsets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  }
  probe.remove()
  cachedSafeInsets = insets
  return insets
}

function readLauncherPos(): LauncherPoint | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAUNCHER_POS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
    return { x: parsed.x, y: parsed.y }
  } catch {
    return null
  }
}

function writeLauncherPos(pos: LauncherPoint): void {
  try {
    window.localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ x: pos.x, y: pos.y }))
  } catch {
    /* quota / private mode */
  }
}

/** Giữ nút trong vùng nhìn thấy (visual viewport), kể cả notch iOS và bàn phím. */
function clampLauncherVisual(x: number, y: number, size: number): LauncherPoint {
  const vv = window.visualViewport
  const insets = measureSafeInsets()
  const viewW = vv?.width ?? window.innerWidth
  const viewH = vv?.height ?? window.innerHeight
  const margin = 8
  const minX = margin + insets.left
  const minY = margin + insets.top
  let maxX = viewW - size - margin - insets.right
  let maxY = viewH - size - margin - insets.bottom
  if (maxX < minX) maxX = minX
  if (maxY < minY) maxY = minY
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  }
}

function visualEditorOwnsLauncher(): boolean {
  if (typeof document === 'undefined') return false
  return (
    document.documentElement.classList.contains('nanoai-ve-active') ||
    document.body.classList.contains('nanoai-ve-active')
  )
}

type Props = {
  chatUrl: string
  title: string
  shopName: string
  /** Logo shop trên nút nổi khi đóng — chỉ hiển thị **tròn** (`rounded-full` + `object-cover`). Không dùng trong header khi mở. */
  launcherLogoUrl?: string | null
  loading?: 'lazy' | 'eager'
  referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy']
  openLabel: string
  closeLabel: string
  openFullPageLabel: string
  /** `aria-label` cho ô chọn ngôn ngữ. */
  languageSelectAriaLabel: string
  /** Header giống `nanoai-chat-widget.js` trên web khách 188. */
  ordersLabel?: string
  cartLabel?: string
  /** Parent-controlled open (partner site embed parity). */
  externalOpenRequest?: { seq: number; iframeSrc?: string }
  /** Override URL when opening from launcher bubble (e.g. product detail page context). */
  resolveOpenUrl?: () => string | undefined
  /** Ẩn icon nổi; vẫn mở được khi `externalOpenRequest` (nút Tư vấn trên trang). */
  hideLauncher?: boolean
  /** Chừa chỗ phía dưới icon cho nút Top trên site NanoAI. Shop không bật. */
  leaveRoomBelowLauncher?: boolean
}

export function FloatingChatWidget({
  chatUrl,
  title,
  shopName,
  launcherLogoUrl,
  loading,
  referrerPolicy,
  openLabel,
  closeLabel,
  openFullPageLabel,
  languageSelectAriaLabel,
  ordersLabel = 'Đơn hàng',
  cartLabel = 'Giỏ hàng',
  externalOpenRequest,
  resolveOpenUrl,
  hideLauncher = false,
  leaveRoomBelowLauncher = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const launcherBtnRef = useRef<HTMLButtonElement>(null)
  const launcherPosRef = useRef<LauncherPoint | null>(null)
  const launcherDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originVisualX: number
    originVisualY: number
    adjustX: number
    adjustY: number
    moved: boolean
  } | null>(null)
  const suppressLauncherClickRef = useRef(false)
  const suppressLauncherTimerRef = useRef(0)
  const [launcherPos, setLauncherPos] = useState<LauncherPoint | null>(null)
  const [launcherGrabbing, setLauncherGrabbing] = useState(false)
  const [duplicateMount, setDuplicateMount] = useState(false)
  // Mặc định đóng; chỉ mở khi người dùng chủ động bấm nút chat.
  const [closed, setClosed] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const snappedOffAdminRef = useRef(false)
  const [uiLocale, setUiLocale] = useState<WebLocale>(() => parseUiLocaleFromChatUrl(chatUrl))
  const [iframeSrc, setIframeSrc] = useState(() => appendStoredGuestIdentity(readReturnChatIframeHref(chatUrl) ?? chatUrl))
  const [loyaltyTierLabel, setLoyaltyTierLabel] = useState('')
  const [cartCount, setCartCount] = useState(0)
  // Keep NanoAI widget above common social/contact bubbles (e.g. Zalo).
  const launcherAnchorClass = leaveRoomBelowLauncher
    ? 'bottom-[10.5rem] right-3 md:bottom-[4.75rem] md:right-4'
    : 'bottom-[10.5rem] right-3 md:bottom-6 md:right-4'
  const topLayerClass = 'z-[2147483000]'
  /** Khớp `nanoai-chat-widget.js`: mobile full-screen 100dvh; desktop góc 340×560. */
  const openPanelClass = [
    topLayerClass,
    'fixed flex flex-col overflow-hidden bg-background shadow-2xl',
    'inset-0 h-[100dvh] w-screen rounded-none border-0',
    'md:inset-auto md:bottom-3 md:right-4 md:h-[min(560px,calc(100dvh-24px))] md:w-[min(34vw,340px)] md:rounded-xl md:border md:border-border/60',
  ].join(' ')

  const fullPageUrl = useMemo(() => {
    try {
      const url = new URL(chatUrl)
      url.searchParams.delete('embed')
      return url.toString()
    } catch {
      return chatUrl
    }
  }, [chatUrl])

  useEffect(() => {
    if (!externalOpenRequest?.seq) return
    const next = appendStoredGuestIdentity(externalOpenRequest.iframeSrc ?? readReturnChatIframeHref(chatUrl) ?? chatUrl)
    setIframeSrc(next)
    writeReturnChatIframeHref(next, chatUrl)
    setClosed(false)
  }, [chatUrl, externalOpenRequest?.iframeSrc, externalOpenRequest?.seq])

  useEffect(() => {
    setUiLocale(parseUiLocaleFromChatUrl(chatUrl))
  }, [chatUrl])

  useEffect(() => {
    const stored = readReturnChatIframeHref(chatUrl)
    if (stored) setIframeSrc(appendStoredGuestIdentity(stored))
    else setIframeSrc(appendStoredGuestIdentity(chatUrl))
  }, [chatUrl])

  useLayoutEffect(() => {
    if (!rootRef.current) return
    const all = document.querySelectorAll('[data-nanoai-widget-root]')
    if (all.length > 1 && all[0] !== rootRef.current) setDuplicateMount(true)
  }, [])

  const commitLauncherPos = useCallback((next: LauncherPoint | null) => {
    launcherPosRef.current = next
    setLauncherPos(next)
  }, [])

  useLayoutEffect(() => {
    const saved = readLauncherPos()
    if (!saved) return
    commitLauncherPos(saved)
  }, [commitLauncherPos])

  useLayoutEffect(() => {
    if (!launcherPos || launcherDragRef.current?.moved) return
    const el = launcherBtnRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const size = el.offsetWidth || 56
    const visual = clampLauncherVisual(rect.left, rect.top, size)
    if (Math.abs(visual.x - rect.left) < 1 && Math.abs(visual.y - rect.top) < 1) return
    const next = {
      x: launcherPos.x + (visual.x - rect.left),
      y: launcherPos.y + (visual.y - rect.top),
    }
    writeLauncherPos(next)
    commitLauncherPos(next)
  }, [closed, commitLauncherPos, launcherPos])

  useEffect(() => {
    const el = launcherBtnRef.current
    if (!el) return
    const onTouchMove = (event: TouchEvent) => {
      if (launcherDragRef.current?.moved && event.cancelable) event.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [closed, hideLauncher])

  useEffect(() => {
    const reclamp = () => {
      measureSafeInsets(true)
      const prev = launcherPosRef.current
      const el = launcherBtnRef.current
      if (!prev || !el || launcherDragRef.current) return
      const rect = el.getBoundingClientRect()
      const size = el.offsetWidth || 56
      const visual = clampLauncherVisual(rect.left, rect.top, size)
      if (Math.abs(visual.x - rect.left) < 1 && Math.abs(visual.y - rect.top) < 1) return
      const next = {
        x: prev.x + (visual.x - rect.left),
        y: prev.y + (visual.y - rect.top),
      }
      writeLauncherPos(next)
      commitLauncherPos(next)
    }
    window.addEventListener('resize', reclamp)
    window.addEventListener('orientationchange', reclamp)
    window.visualViewport?.addEventListener('resize', reclamp)
    window.visualViewport?.addEventListener('scroll', reclamp)
    return () => {
      window.removeEventListener('resize', reclamp)
      window.removeEventListener('orientationchange', reclamp)
      window.visualViewport?.removeEventListener('resize', reclamp)
      window.visualViewport?.removeEventListener('scroll', reclamp)
    }
  }, [commitLauncherPos])

  useEffect(() => {
    if (closed) return
    const prev = document.body.style.overflow
    const lock = () => {
      if (window.innerWidth <= 768) document.body.style.overflow = 'hidden'
      else document.body.style.overflow = prev
    }
    lock()
    window.addEventListener('resize', lock)
    return () => {
      window.removeEventListener('resize', lock)
      document.body.style.overflow = prev
    }
  }, [closed])

  const postPageContextToIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const ctx = parseWidgetPageContextFromChatUrl(iframeSrc, window.location.href)
    try {
      win.postMessage(
        {
          source: NANOAI_WIDGET_MSG_SOURCE,
          type: 'SET_PAGE_CONTEXT',
          ...ctx,
          embedPage: `${window.location.origin}${window.location.pathname}`,
        },
        '*'
      )
    } catch {
      /* ignore */
    }
  }, [iframeSrc])

  const applyLocaleToIframe = useCallback(
    (next: WebLocale) => {
      setUiLocale(next)
      const el = iframeRef.current
      if (!el) return
      try {
        const baseSrc = iframeSrc || chatUrl
        const u = new URL(el.src || baseSrc, window.location.href)
        u.searchParams.set('ui_locale', next)
        const nextSrc = stampGuestChatEmbedPageParam(u.toString())
        if (el.src !== nextSrc) el.src = nextSrc
        setIframeSrc(nextSrc)
      } catch {
        /* ignore */
      }
    },
    [chatUrl, iframeSrc]
  )

  /** iframe chat → thay cả tab trang shop bằng URL SP (đồng bộ với `openGuestProductDetailUrl` khi cross-origin). */
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!isNavigateTopFromIframe(e.data)) return
      if (e.source !== iframeRef.current?.contentWindow) return
      const raw = e.data.url.trim()
      if (!isAllowedHttpNavigationUrl(raw) || isDashboardNavigationUrl(raw)) return
      const ret = typeof e.data.returnChatUrl === 'string' ? e.data.returnChatUrl.trim() : ''
      if (ret && isAllowedHttpNavigationUrl(ret)) {
        writeReturnChatIframeHref(ret, chatUrl)
      }
      window.location.assign(raw)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [chatUrl])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if ((data as { source?: unknown }).source !== NANOAI_WIDGET_MSG_SOURCE) return
      if (e.source !== iframeRef.current?.contentWindow) return
      const type = (data as { type?: unknown }).type
      if (type === 'GUEST_IDENTITY') {
        storeGuestIdentity(data)
        if (iframeRef.current?.src) writeReturnChatIframeHref(iframeRef.current.src, chatUrl)
      } else if (isOrderUpdatedFromIframe(data)) {
        window.dispatchEvent(
          new CustomEvent(PARTNER_SITE_ORDERS_UPDATED_EVENT, {
            detail: { siteSlug: data.siteSlug?.trim().toLowerCase() || null },
          })
        )
      } else if (type === 'CART_COUNT') {
        const n = Number((data as { count?: unknown }).count)
        setCartCount(Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)
      } else if (type === 'LOYALTY_STATUS') {
        const status = (data as { status?: WidgetLoyaltyStatus }).status
        if (!status || status.enabled === false) {
          setLoyaltyTierLabel('')
          return
        }
        const label = String(status.tierName || status.tierCode || 'L1').trim()
        setLoyaltyTierLabel(label || 'L1')
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [chatUrl])

  const postToIframe = useCallback((type: 'OPEN_MY_ORDERS' | 'OPEN_CART') => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    try {
      win.postMessage({ source: NANOAI_WIDGET_MSG_SOURCE, type }, '*')
    } catch {
      /* ignore */
    }
  }, [])

  const openPanelWithSavedChat = useCallback(() => {
    const resolved = resolveOpenUrl?.()?.trim()
    const next = appendStoredGuestIdentity(resolved || readReturnChatIframeHref(chatUrl) || chatUrl)
    setIframeSrc(next)
    writeReturnChatIframeHref(next, chatUrl)
    setClosed(false)
  }, [chatUrl, resolveOpenUrl])

  const armSuppressLauncherClick = useCallback(() => {
    suppressLauncherClickRef.current = true
    window.clearTimeout(suppressLauncherTimerRef.current)
    suppressLauncherTimerRef.current = window.setTimeout(() => {
      suppressLauncherClickRef.current = false
      suppressLauncherTimerRef.current = 0
    }, 400)
  }, [])

  const onLauncherPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || visualEditorOwnsLauncher()) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    let adjustX = 0
    let adjustY = 0
    if (launcherPosRef.current) {
      adjustX = launcherPosRef.current.x - rect.left
      adjustY = launcherPosRef.current.y - rect.top
    } else {
      el.style.left = `${rect.left}px`
      el.style.top = `${rect.top}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      const shifted = el.getBoundingClientRect()
      adjustX = rect.left - shifted.left
      adjustY = rect.top - shifted.top
      const pinned = { x: rect.left + adjustX, y: rect.top + adjustY }
      el.style.left = `${pinned.x}px`
      el.style.top = `${pinned.y}px`
      launcherPosRef.current = pinned
      setLauncherPos(pinned)
    }
    launcherDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originVisualX: rect.left,
      originVisualY: rect.top,
      adjustX,
      adjustY,
      moved: false,
    }
    el.setPointerCapture(e.pointerId)
  }, [])

  const onLauncherPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < LAUNCHER_DRAG_THRESHOLD_PX) return
    drag.moved = true
    if (!suppressLauncherClickRef.current) armSuppressLauncherClick()
    setLauncherGrabbing(true)
    const size = e.currentTarget.offsetWidth || 56
    const visual = clampLauncherVisual(drag.originVisualX + dx, drag.originVisualY + dy, size)
    const next = { x: visual.x + drag.adjustX, y: visual.y + drag.adjustY }
    launcherPosRef.current = next
    setLauncherPos(next)
  }, [armSuppressLauncherClick])

  const endLauncherDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const moved = drag.moved
    launcherDragRef.current = null
    setLauncherGrabbing(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!moved) return
    const size = e.currentTarget.offsetWidth || 56
    const visual = clampLauncherVisual(
      drag.originVisualX + (e.clientX - drag.startX),
      drag.originVisualY + (e.clientY - drag.startY),
      size
    )
    const next = { x: visual.x + drag.adjustX, y: visual.y + drag.adjustY }
    launcherPosRef.current = next
    setLauncherPos(next)
    writeLauncherPos(next)
    armSuppressLauncherClick()
  }, [armSuppressLauncherClick])

  const onLauncherClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressLauncherClickRef.current) {
        e.preventDefault()
        e.stopPropagation()
        suppressLauncherClickRef.current = false
        window.clearTimeout(suppressLauncherTimerRef.current)
        suppressLauncherTimerRef.current = 0
        return
      }
      openPanelWithSavedChat()
    },
    [openPanelWithSavedChat]
  )

  const launcherPlaceClass = launcherPos ? '' : launcherAnchorClass
  const launcherStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    touchAction: 'none',
    WebkitTouchCallout: 'none',
    ...(launcherPos
      ? { left: launcherPos.x, top: launcherPos.y, right: 'auto' as const, bottom: 'auto' as const }
      : null),
    ...(launcherGrabbing ? { cursor: 'grabbing' } : null),
  }

  const launcherSrc = typeof launcherLogoUrl === 'string' ? launcherLogoUrl.trim() : ''
  const showLauncherLogo = Boolean(launcherSrc && /^https?:\/\//i.test(launcherSrc))

  if (duplicateMount) {
    return null
  }

  if (closed) {
    if (hideLauncher) {
      return <div ref={rootRef} data-nanoai-widget-root className="hidden" aria-hidden />
    }
    const renderLauncherButton = (className: string, children: React.ReactNode) => (
      <DismissableLayerBranch asChild>
        <button
          ref={launcherBtnRef}
          type="button"
          className={className}
          style={launcherStyle}
          onPointerDown={onLauncherPointerDown}
          onPointerMove={onLauncherPointerMove}
          onPointerUp={endLauncherDrag}
          onPointerCancel={endLauncherDrag}
          onClick={onLauncherClick}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          title={openLabel}
          aria-label={openLabel}
        >
          {children}
        </button>
      </DismissableLayerBranch>
    )

    if (showLauncherLogo) {
      return (
        <div ref={rootRef} data-nanoai-widget-root className="contents">
          {renderLauncherButton(
            `pointer-events-auto fixed ${launcherPlaceClass} ${topLayerClass} h-14 w-14 cursor-grab touch-none select-none overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={launcherSrc}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full select-none object-cover object-center"
            />
          )}
        </div>
      )
    }
    return (
      <div ref={rootRef} data-nanoai-widget-root className="contents">
        {renderLauncherButton(
          `pointer-events-auto fixed ${launcherPlaceClass} ${topLayerClass} flex h-14 w-14 cursor-grab touch-none select-none items-center justify-center rounded-full border border-border/40 bg-background/95 p-0 shadow-lg transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
          <MessageCircle className="pointer-events-none h-7 w-7 text-muted-foreground" aria-hidden />
        )}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      data-nanoai-widget-root
      data-pw-chat-panel="1"
      className={openPanelClass}
    >
      <div
        className="flex shrink-0 flex-nowrap items-center gap-1 overflow-hidden border-b border-border/60 bg-muted/40 px-2 py-1 touch-manipulation"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 max-w-[38%] flex-1 truncate text-xs font-semibold leading-tight sm:max-w-none sm:text-sm">{shopName}</div>
        {loyaltyTierLabel ? (
          <span className="shrink-0 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-900 shadow-sm">
            {loyaltyTierLabel}
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-0.5">
          <select
            value={uiLocale}
            onChange={(e) => applyLocaleToIframe(e.target.value as WebLocale)}
            aria-label={languageSelectAriaLabel}
            className="h-8 w-auto max-w-[3.75rem] shrink-0 rounded-md border border-border bg-background px-1.5 text-xs font-semibold text-foreground sm:max-w-[4.75rem]"
          >
            {WEB_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_SHORT[loc]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 border-violet-300/80 bg-violet-50/90 text-violet-950 hover:bg-violet-100/90 dark:border-violet-700 dark:bg-violet-950/45 dark:text-violet-50 dark:hover:bg-violet-900/55"
            onClick={() => postToIframe('OPEN_MY_ORDERS')}
            title={ordersLabel}
            aria-label={ordersLabel}
          >
            <Package className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative h-8 w-8 shrink-0"
            onClick={() => postToIframe('OPEN_CART')}
            title={cartLabel}
            aria-label={`${cartLabel} (${cartCount})`}
          >
            <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold leading-none text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 shrink-0 rounded-full md:inline-flex"
            onClick={() => {
              openGuestProductDetailUrl(fullPageUrl)
            }}
            title={openFullPageLabel}
            aria-label={openFullPageLabel}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              setClosed(true)
            }}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden md:rounded-b-xl">
        <iframe
          key={externalOpenRequest?.seq ? `pw-chat-${externalOpenRequest.seq}` : 'pw-chat-default'}
          ref={iframeRef}
          src={iframeSrc}
          title={title}
          loading={loading}
          referrerPolicy={referrerPolicy}
          className="h-full w-full border-0"
          onLoad={() => {
            const src = iframeRef.current?.src || ''
            const leftChat = Boolean(src) && (isDashboardNavigationUrl(src) || !isHostedChatIframeSrc(src))
            if (leftChat) {
              if (!snappedOffAdminRef.current) {
                snappedOffAdminRef.current = true
                clearReturnChatIframeHref()
                setIframeSrc(appendStoredGuestIdentity(chatUrl))
              }
            } else {
              snappedOffAdminRef.current = false
            }
            postPageContextToIframe()
          }}
        />
      </div>
    </div>
  )
}

