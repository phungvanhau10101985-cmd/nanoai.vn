'use client'

import { useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'

export const PW_SHOP_SOFT_NAV_EVENT = 'pw-shop-soft-nav'

type ShopSoftNavWindow = Window & {
  __pwShopSoftNav?: (href: string) => void
  __pwShopPrefetch?: (href: string) => void
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
  useLayoutEffect(() => {
    const win = window as ShopSoftNavWindow
    win.__pwShopSoftNav = (href: string) => {
      const path = pathFromHref(href)
      if (!path) {
        window.location.assign(href)
        return
      }
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (path === here) return
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
  return null
}
