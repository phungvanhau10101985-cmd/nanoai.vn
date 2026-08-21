'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  buildPartnerShopLoginHref,
  buildPartnerShopLoginHrefFromParts,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'

/**
 * href Đăng nhập: pathname + query hiện tại + hash — giống 188 `useLoginRedirectHref`.
 */
export function usePartnerShopLoginRedirectHref(siteSlug: string, hashOverride?: string | null): string {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const customDomain = usePartnerSiteCustomDomain()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => {
      if (typeof window === 'undefined') return
      setHash(window.location.hash || '')
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [pathname])

  return useMemo(() => {
    const effectiveHash = hashOverride !== undefined && hashOverride !== null ? hashOverride : hash
    return buildPartnerShopLoginHrefFromParts(siteSlug, pathname, searchParams, effectiveHash, {
      customDomain,
    })
  }, [customDomain, hash, hashOverride, pathname, searchParams, siteSlug])
}

export function usePartnerShopLoginRedirect(siteSlug: string) {
  const customDomain = usePartnerSiteCustomDomain()
  const loginHref = usePartnerShopLoginRedirectHref(siteSlug)

  const goToLogin = useCallback(
    (returnLocation?: string) => {
      if (typeof window === 'undefined') return
      const dest = returnLocation
        ? buildPartnerShopLoginHref(siteSlug, returnLocation, { customDomain })
        : loginHref
      window.location.assign(dest)
    },
    [customDomain, loginHref, siteSlug]
  )

  return { loginHref, goToLogin, customDomain }
}

export function assignPartnerShopLogin(siteSlug: string, returnLocation?: string, customDomain = false): void {
  if (typeof window === 'undefined') return
  const loc = returnLocation ?? getPartnerShopBrowserReturnLocation(siteSlug, { customDomain })
  window.location.assign(buildPartnerShopLoginHref(siteSlug, loc, { customDomain }))
}
