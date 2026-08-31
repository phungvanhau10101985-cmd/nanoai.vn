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
  parseWidgetPageContextFromChatUrl,
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
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [duplicateMount, setDuplicateMount] = useState(false)
  // Mặc định đóng; chỉ mở khi người dùng chủ động bấm nút chat.
  const [closed, setClosed] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [uiLocale, setUiLocale] = useState<WebLocale>(() => parseUiLocaleFromChatUrl(chatUrl))
  const [iframeSrc, setIframeSrc] = useState(() => appendStoredGuestIdentity(readReturnChatIframeHref() ?? chatUrl))
  const [loyaltyTierLabel, setLoyaltyTierLabel] = useState('')
  const [cartCount, setCartCount] = useState(0)
  // Keep NanoAI widget above common social/contact bubbles (e.g. Zalo).
  const launcherAnchorClass = 'bottom-[10.5rem] right-3 md:bottom-6 md:right-4'
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
    const next = appendStoredGuestIdentity(externalOpenRequest.iframeSrc ?? readReturnChatIframeHref() ?? chatUrl)
    setIframeSrc(next)
    writeReturnChatIframeHref(next)
    setClosed(false)
  }, [chatUrl, externalOpenRequest?.iframeSrc, externalOpenRequest?.seq])

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
      win.postMessage({ source: NANOAI_WIDGET_MSG_SOURCE, type: 'SET_PAGE_CONTEXT', ...ctx }, '*')
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
        const nextSrc = u.toString()
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
  }, [])

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
    const next = appendStoredGuestIdentity(resolved || readReturnChatIframeHref() || chatUrl)
    setIframeSrc(next)
    writeReturnChatIframeHref(next)
    setClosed(false)
  }, [chatUrl, resolveOpenUrl])

  const launcherSrc = typeof launcherLogoUrl === 'string' ? launcherLogoUrl.trim() : ''
  const showLauncherLogo = Boolean(launcherSrc && /^https?:\/\//i.test(launcherSrc))

  if (duplicateMount) {
    return null
  }

  if (closed) {
    if (hideLauncher) {
      return <div ref={rootRef} data-nanoai-widget-root className="hidden" aria-hidden />
    }
    if (showLauncherLogo) {
      return (
        <div ref={rootRef} data-nanoai-widget-root className="contents">
          <button
          type="button"
          className={`fixed ${launcherAnchorClass} ${topLayerClass} h-14 w-14 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
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
        className={`fixed ${launcherAnchorClass} ${topLayerClass} flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/95 p-0 shadow-lg transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
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
          onLoad={postPageContextToIframe}
        />
      </div>
    </div>
  )
}

