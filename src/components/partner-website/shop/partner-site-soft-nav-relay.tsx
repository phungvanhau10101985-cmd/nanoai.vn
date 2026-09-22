'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  clearViewedProductSnapshot,
  showViewedProductSnapshot,
} from '@/lib/partner-website/shop/partner-site-viewed-product-cache'

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
 * After hydration, chrome taps use App Router `router.push` so the shared
 * account shell (header / sidebar) stays mounted. Parser-blocking native nav
 * still `location.assign` if this relay is not ready yet.
 *
 * Do not wrap `router.push` in an extra `startTransition`. Next.js already
 * transitions internally; a nested transition leaves the destination page
 * committed but its passive effects frozen until the next tap.
 */
export function PartnerSiteSoftNavRelay() {
  const router = useRouter()
  const pathname = usePathname()
  const pathRef = useRef(pathname)
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
      if (showViewedProductSnapshot(path)) {
        try {
          win.__pwShopTapAckNavEnd?.()
        } catch {
          /* visual ack is best-effort */
        }
      } else {
        clearViewedProductSnapshot()
      }
      window.dispatchEvent(new CustomEvent(PW_SHOP_SOFT_NAV_EVENT, { detail: { href: path } }))
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
    if (pathRef.current === pathname) return
    pathRef.current = pathname
    clearViewedProductSnapshot()
    try {
      ;(window as ShopSoftNavWindow).__pwShopTapAckNavEnd?.()
    } catch {
      /* visual ack is best-effort */
    }
  }, [pathname])
  return null
}
