'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FloatingChatWidget } from '@/components/messaging/floating-chat-widget'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  PARTNER_SITE_CHAT_MSG_SOURCE,
  buildPartnerSiteChatEmbedPath,
  buildPartnerSiteConsultEmbedPath,
  mergeConsultContext,
  resolvePartnerSiteChatOpenFromEventTarget,
  withAbsolutePartnerTryOnContext,
  type PartnerSiteChatOpenMessage,
  type PartnerSiteConsultContext,
} from '@/lib/partner-website/shop/partner-site-chat-embed'

type OpenRequest = {
  seq: number
  iframeSrc?: string
}

type PartnerSiteChatWidgetContextValue = {
  openChat: () => void
  openConsult: (ctx: PartnerSiteConsultContext) => void
  openTryOn: (ctx: PartnerSiteConsultContext) => void
}

type ActiveProductRegistrar = {
  setActiveProduct: (ctx: PartnerSiteConsultContext | null) => void
}

const PartnerSiteChatWidgetContext = createContext<PartnerSiteChatWidgetContextValue | null>(null)
const PartnerSiteActiveProductContext = createContext<ActiveProductRegistrar | null>(null)

export function usePartnerSiteChatWidget(): PartnerSiteChatWidgetContextValue {
  const ctx = useContext(PartnerSiteChatWidgetContext)
  if (!ctx) {
    return {
      openChat: () => {},
      openConsult: () => {},
      openTryOn: () => {},
    }
  }
  return ctx
}

/** Trang chi tiết SP: đăng ký ngữ cảnh để mọi lần mở chat đều có chip «Gửi mã SP đang xem». */
export function usePartnerSiteActiveProductRegistrar(): ActiveProductRegistrar {
  const ctx = useContext(PartnerSiteActiveProductContext)
  return ctx ?? { setActiveProduct: () => {} }
}

function hasConsultContext(ctx: PartnerSiteConsultContext | null | undefined): boolean {
  if (!ctx) return false
  return Boolean((ctx.sku ?? '').trim() || (ctx.imageUrl ?? '').trim() || (ctx.inventoryId ?? '').trim())
}

type Props = {
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  listenLandingPostMessage?: boolean
  hideLauncher?: boolean
  children?: ReactNode
}

export function PartnerSiteChatWidgetProvider({
  chatPath,
  shopName,
  logoUrl,
  locale,
  listenLandingPostMessage = false,
  hideLauncher = false,
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const seqRef = useRef(0)
  const activeProductRef = useRef<PartnerSiteConsultContext | null>(null)
  const [openRequest, setOpenRequest] = useState<OpenRequest | undefined>(undefined)

  const chatEmbedPath = useMemo(
    () => buildPartnerSiteChatEmbedPath(chatPath, locale),
    [chatPath, locale]
  )

  const buildConsultOpenUrl = useCallback(
    (ctx: PartnerSiteConsultContext) => buildPartnerSiteConsultEmbedPath(chatPath, ctx, 'consult', locale),
    [chatPath, locale]
  )

  const resolveOpenUrl = useCallback((): string => {
    const active = activeProductRef.current
    if (hasConsultContext(active)) return buildConsultOpenUrl(active!)
    return chatEmbedPath
  }, [buildConsultOpenUrl, chatEmbedPath])

  const triggerOpen = useCallback((iframeSrc?: string) => {
    seqRef.current += 1
    setOpenRequest({ seq: seqRef.current, iframeSrc })
  }, [])

  const openChat = useCallback(() => {
    triggerOpen(resolveOpenUrl())
  }, [resolveOpenUrl, triggerOpen])

  const openConsult = useCallback(
    (ctx: PartnerSiteConsultContext) => {
      triggerOpen(buildPartnerSiteConsultEmbedPath(chatPath, ctx, 'consult', locale))
    },
    [chatPath, locale, triggerOpen]
  )

  const openTryOn = useCallback(
    (ctx: PartnerSiteConsultContext) => {
      triggerOpen(buildPartnerSiteConsultEmbedPath(chatPath, ctx, 'try_on', locale))
    },
    [chatPath, locale, triggerOpen]
  )

  const setActiveProduct = useCallback((ctx: PartnerSiteConsultContext | null) => {
    activeProductRef.current = ctx
  }, [])

  const applyOpenRequest = useCallback(
    (mode: 'default' | 'consult' | 'try_on', ctx: PartnerSiteConsultContext) => {
      if (mode === 'try_on') {
        openTryOn(withAbsolutePartnerTryOnContext(mergeConsultContext(ctx, activeProductRef.current || {})))
        return
      }
      if (mode === 'consult' && hasConsultContext(ctx)) {
        openConsult(ctx)
        return
      }
      openChat()
    },
    [openChat, openConsult, openTryOn]
  )

  const handleLandingMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data as PartnerSiteChatOpenMessage | null
      if (!data || typeof data !== 'object') return
      if (data.source !== PARTNER_SITE_CHAT_MSG_SOURCE || data.type !== 'OPEN_CHAT') return

      applyOpenRequest(data.mode || 'default', {
        inventoryId: data.inventoryId,
        sku: data.sku,
        imageUrl: data.imageUrl,
        imageUrl2: data.imageUrl2,
        productUrl: data.productUrl,
      })
    },
    [applyOpenRequest]
  )

  useEffect(() => {
    if (!listenLandingPostMessage) return
    window.addEventListener('message', handleLandingMessage)
    return () => window.removeEventListener('message', handleLandingMessage)
  }, [handleLandingMessage, listenLandingPostMessage])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const opened = resolvePartnerSiteChatOpenFromEventTarget(event.target)
      if (!opened) return
      event.preventDefault()
      event.stopPropagation()
      applyOpenRequest(opened.mode, opened.ctx)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [applyOpenRequest])

  const chatValue = useMemo(() => ({ openChat, openConsult, openTryOn }), [openChat, openConsult, openTryOn])
  const activeProductValue = useMemo(() => ({ setActiveProduct }), [setActiveProduct])

  return (
    <PartnerSiteActiveProductContext.Provider value={activeProductValue}>
      <PartnerSiteChatWidgetContext.Provider value={chatValue}>
        {children}
        {chatEmbedPath ? (
          <FloatingChatWidget
            chatUrl={chatEmbedPath}
            title={shopName}
            shopName={shopName}
            launcherLogoUrl={logoUrl}
            openLabel={t.chatOpenLabel}
            closeLabel={t.chatCloseLabel}
            openFullPageLabel={t.chatFullPageLabel}
            languageSelectAriaLabel={t.chatLanguageLabel}
            ordersLabel={t.chatOrdersLabel}
            cartLabel={t.chatCartLabel}
            externalOpenRequest={openRequest}
            resolveOpenUrl={resolveOpenUrl}
            hideLauncher={hideLauncher}
          />
        ) : null}
      </PartnerSiteChatWidgetContext.Provider>
    </PartnerSiteActiveProductContext.Provider>
  )
}
