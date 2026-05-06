'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, MessageCircle, Package, ShoppingCart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openGuestProductDetailUrl } from '@/lib/messaging/open-guest-product-url'
import { WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'
import {
  NANOAI_WIDGET_MSG_SOURCE,
  isAllowedHttpNavigationUrl,
  isNavigateTopFromIframe,
} from '@/lib/messaging/widget-parent-bridge'
import { readReturnChatIframeHref, writeReturnChatIframeHref } from '@/lib/messaging/widget-embed-session'

const LOCALE_SHORT: Record<WebLocale, string> = {
  vi: 'VI',
  en: 'EN',
  zh: 'ZH',
  ja: 'JA',
  ko: 'KO',
}
const GUEST_SESSION_STORAGE_KEY = 'nanoai_guest_session_id_v1'
const GUEST_ACCOUNT_STORAGE_KEY = 'nanoai_guest_account_id_v1'
const UUID_STRING_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function appendStoredGuestIdentity(urlStr: string): string {
  if (typeof window === 'undefined') return urlStr
  try {
    const u = new URL(urlStr, window.location.href)
    const sid = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY)?.trim() || ''
    const aid = window.localStorage.getItem(GUEST_ACCOUNT_STORAGE_KEY)?.trim() || ''
    if (UUID_STRING_RE.test(sid)) u.searchParams.set('guest_session_id', sid)
    if (UUID_STRING_RE.test(aid)) u.searchParams.set('guest_account_id', aid)
    return u.toString()
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
    if (UUID_STRING_RE.test(sid)) window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, sid)
    if (UUID_STRING_RE.test(aid)) window.localStorage.setItem(GUEST_ACCOUNT_STORAGE_KEY, aid)
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
  /** Nút «Đơn hàng» trên thanh widget (cùng hàng với chọn ngôn ngữ). */
  ordersButtonLabel: string
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
  ordersButtonLabel,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [duplicateMount, setDuplicateMount] = useState(false)
  // Mặc định đóng; chỉ mở khi người dùng chủ động bấm nút chat.
  const [closed, setClosed] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [uiLocale, setUiLocale] = useState<WebLocale>(() => parseUiLocaleFromChatUrl(chatUrl))
  const [iframeSrc, setIframeSrc] = useState(() => appendStoredGuestIdentity(readReturnChatIframeHref() ?? chatUrl))
  const [cartCount, setCartCount] = useState(0)
  // Keep NanoAI widget above common social/contact bubbles (e.g. Zalo).
  const anchorClass = 'bottom-[10.5rem] right-3 md:bottom-6 md:right-4'
  const topLayerClass = 'z-[2147483000]'

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
    setUiLocale(parseUiLocaleFromChatUrl(chatUrl))
  }, [chatUrl])

  useEffect(() => {
    const stored = readReturnChatIframeHref()
    if (stored) setIframeSrc(appendStoredGuestIdentity(stored))
    else setIframeSrc(appendStoredGuestIdentity(chatUrl))
  }, [chatUrl])

  useLayoutEffect(() => {
    if (!rootRef.current) return
    const all = document.querySelectorAll('[data-nanoai-widget-root]')
    if (all.length > 1 && all[0] !== rootRef.current) setDuplicateMount(true)
  }, [])

  const applyLocaleToIframe = useCallback(
    (next: WebLocale) => {
      setUiLocale(next)
      const el = iframeRef.current
      if (!el) return
      try {
        const baseSrc = iframeSrc || chatUrl
        const u = new URL(el.src || baseSrc, window.location.href)
        u.searchParams.set('ui_locale', next)
        const nextSrc = u.toString()
        if (el.src !== nextSrc) el.src = nextSrc
        setIframeSrc(nextSrc)
      } catch {
        /* ignore */
      }
    },
    [chatUrl, iframeSrc]
  )

  const openMyOrdersInIframe = useCallback(() => {
    const el = iframeRef.current
    if (!el?.contentWindow) return
    try {
      const targetOrigin = new URL(el.src || iframeSrc || chatUrl, window.location.href).origin
      el.contentWindow.postMessage(
        { source: NANOAI_WIDGET_MSG_SOURCE, type: 'OPEN_MY_ORDERS' },
        targetOrigin
      )
    } catch {
      /* ignore */
    }
  }, [chatUrl, iframeSrc])

  const postToIframe = useCallback(
    (type: string) => {
      const el = iframeRef.current
      if (!el?.contentWindow) return
      try {
        const targetOrigin = new URL(el.src || iframeSrc || chatUrl, window.location.href).origin
        el.contentWindow.postMessage({ source: NANOAI_WIDGET_MSG_SOURCE, type }, targetOrigin)
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
      if (!isAllowedHttpNavigationUrl(raw)) return
      const ret = typeof e.data.returnChatUrl === 'string' ? e.data.returnChatUrl.trim() : ''
      if (ret && isAllowedHttpNavigationUrl(ret)) {
        writeReturnChatIframeHref(ret)
      }
      window.location.assign(raw)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if ((data as { source?: unknown }).source !== NANOAI_WIDGET_MSG_SOURCE) return
      if (e.source !== iframeRef.current?.contentWindow) return
      const type = (data as { type?: unknown }).type
      if (type === 'GUEST_IDENTITY') {
        storeGuestIdentity(data)
        if (iframeRef.current?.src) writeReturnChatIframeHref(iframeRef.current.src)
      }
      if (type === 'CART_COUNT') {
        const n = Math.max(0, Math.floor(Number((data as { count?: unknown }).count) || 0))
        setCartCount(n)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const openPanelWithSavedChat = useCallback(() => {
    const next = appendStoredGuestIdentity(readReturnChatIframeHref() ?? chatUrl)
    setIframeSrc(next)
    setClosed(false)
  }, [chatUrl])

  const launcherSrc = typeof launcherLogoUrl === 'string' ? launcherLogoUrl.trim() : ''
  const showLauncherLogo = Boolean(launcherSrc && /^https?:\/\//i.test(launcherSrc))

  if (duplicateMount) {
    return null
  }

  if (closed) {
    if (showLauncherLogo) {
      return (
        <div ref={rootRef} data-nanoai-widget-root className="contents">
          <button
          type="button"
          className={`fixed ${anchorClass} ${topLayerClass} h-14 w-14 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
          onClick={openPanelWithSavedChat}
          title={openLabel}
          aria-label={openLabel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={launcherSrc}
            alt=""
            className="pointer-events-none h-full w-full object-cover object-center select-none"
          />
        </button>
        </div>
      )
    }
    return (
      <div ref={rootRef} data-nanoai-widget-root className="contents">
        <button
        type="button"
        className={`fixed ${anchorClass} ${topLayerClass} flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/95 p-0 shadow-lg transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
        onClick={openPanelWithSavedChat}
        title={openLabel}
        aria-label={openLabel}
      >
        <MessageCircle className="h-7 w-7 text-muted-foreground" aria-hidden />
      </button>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      data-nanoai-widget-root
      className={`fixed ${anchorClass} ${topLayerClass} flex h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-sm`}
    >
      <div
        className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-muted/40 px-2 py-1.5 sm:gap-1.5 sm:px-3 sm:py-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 max-w-[32%] shrink truncate text-sm font-semibold sm:text-base">{shopName}</div>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5">
          <select
            value={uiLocale}
            onChange={(e) => applyLocaleToIframe(e.target.value as WebLocale)}
            aria-label="Language"
            className="h-7 max-w-[4.75rem] shrink-0 rounded-md border border-border bg-background px-1.5 text-xs font-medium text-foreground"
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
            size="sm"
            className="h-7 max-w-[min(140px,42vw)] shrink gap-1 border-violet-300/80 bg-violet-50/90 px-1.5 text-[11px] font-medium text-violet-950 hover:bg-violet-100/90 dark:border-violet-700 dark:bg-violet-950/45 dark:text-violet-50 dark:hover:bg-violet-900/55"
            onClick={openMyOrdersInIframe}
            title={ordersButtonLabel}
          >
            <Package className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">Đơn hàng</span>
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 rounded-full"
            onClick={() => postToIframe('OPEN_CART')}
            title="Giỏ hàng"
            aria-label={`Giỏ hàng: ${cartCount} sản phẩm`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => {
              openGuestProductDetailUrl(fullPageUrl)
            }}
            title={openFullPageLabel}
            aria-label={openFullPageLabel}
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              setClosed(true)
            }}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-b-xl">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={title}
          loading={loading}
          referrerPolicy={referrerPolicy}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  )
}

