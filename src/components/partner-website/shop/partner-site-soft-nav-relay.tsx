'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { scrollPartnerShopViewportToTop } from '@/lib/partner-website/shop/partner-site-cart-added-modal'
import { discardViewedProductSnapshots } from '@/lib/partner-website/shop/partner-site-viewed-product-cache'
import { isPartnerShopVisualHtmlPath } from '@/lib/partner-website/shop/partner-shop-react-island-path'

export const PW_SHOP_SOFT_NAV_EVENT = 'pw-shop-soft-nav'

type ShopSoftNavWindow = Window & {
  __pwShopSoftNav?: (href: string) => void
  __pwShopPrefetch?: (href: string) => void
  __pwShopTapAckNav?: (href?: string) => void
  __pwShopTapAckNavEnd?: () => void
}

function pathFromHref(href: string): string | null {
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/**
 * After hydration, chrome taps use App Router `router.push` for React islands
 * (giỏ / tài khoản / cọc). Visual HTML pages `location.assign` once the
 * destination HTML already has product cards. Parser-blocking native nav
 * still `location.assign` if this relay is not ready yet.
 *
 * A tap that opens another page (Tài khoản, Giỏ, Yêu thích, Đơn, nút chức năng)
 * must show that page from the top. The shared shop shell otherwise keeps the
 * scroll offset of the page you left — a long category listing lands Account
 * at the bottom. Browser Back keeps the previous scroll position.
 *
 * Do not wrap `router.push` in an extra `startTransition`. Next.js already
 * transitions internally; a nested transition leaves the destination page
 * committed but its passive effects frozen until the next tap.
 */
export function PartnerSiteSoftNavRelay() {
  const router = useRouter()
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  const historyPopRef = useRef<string | false>(false)
  useLayoutEffect(() => {
    const onPop = () => {
      historyPopRef.current = window.location.pathname
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useLayoutEffect(() => {
    const win = window as ShopSoftNavWindow
    win.__pwShopSoftNav = (href: string) => {
      const path = pathFromHref(href)
      if (!path) {
        try {
          win.__pwShopTapAckNav?.(href)
        } catch {
          /* visual ack is best-effort */
        }
        window.location.assign(href)
        return
      }
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (path === here) {
        try {
          win.__pwShopTapAckNavEnd?.()
        } catch {
          /* visual ack is best-effort */
        }
        return
      }
      try {
        win.__pwShopTapAckNav?.(path)
      } catch {
        /* visual ack is best-effort */
      }
      window.dispatchEvent(new CustomEvent(PW_SHOP_SOFT_NAV_EVENT, { detail: { href: path } }))
      if (isPartnerShopVisualHtmlPath(path)) {
        window.location.assign(path)
        return
      }
      router.push(path)
    }
    win.__pwShopPrefetch = (href: string) => {
      const path = pathFromHref(href)
      if (!path) return
      try {
        router.prefetch(path)
      } catch {
        /* prefetch is best-effort */
      }
    }
    return () => {
      delete win.__pwShopSoftNav
      delete win.__pwShopPrefetch
    }
  }, [router])
  useLayoutEffect(() => {
    discardViewedProductSnapshots()
  }, [])
  useLayoutEffect(() => {
    const poppedPath = historyPopRef.current
    historyPopRef.current = false
    if (pathRef.current === pathname) return
    pathRef.current = pathname
    const fromHistory = poppedPath === pathname
    let raf = 0
    let soon = 0
    let later = 0
    if (!fromHistory) {
      const scroll = () => scrollPartnerShopViewportToTop()
      scroll()
      raf = window.requestAnimationFrame(scroll)
      soon = window.setTimeout(scroll, 0)
      later = window.setTimeout(scroll, 120)
    }
    try {
      ;(window as ShopSoftNavWindow).__pwShopTapAckNavEnd?.()
    } catch {
      /* visual ack is best-effort */
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      if (soon) window.clearTimeout(soon)
      if (later) window.clearTimeout(later)
    }
  }, [pathname])
  return null
}
