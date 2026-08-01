'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

type PartnerSiteShopContextValue = {
  cartCount: number
  setCartCount: (n: number) => void
  refreshCartCount: () => Promise<void>
  registerCartLoader: (fn: () => Promise<number>) => void
  tracking: PartnerSiteShopTrackingConfig
}

const PartnerSiteShopContext = createContext<PartnerSiteShopContextValue | null>(null)

const EMPTY_TRACKING: PartnerSiteShopTrackingConfig = {
  ga4MeasurementId: null,
  facebookPixelId: null,
  googleAdsId: null,
  tiktokPixelId: null,
}

export function PartnerSiteShopProvider({
  children,
  initialCartCount = 0,
  tracking = EMPTY_TRACKING,
}: {
  children: ReactNode
  initialCartCount?: number
  tracking?: PartnerSiteShopTrackingConfig
}) {
  const [cartCount, setCartCount] = useState(initialCartCount)
  const loaderRef = useRef<(() => Promise<number>) | null>(null)

  const registerCartLoader = useCallback((fn: () => Promise<number>) => {
    loaderRef.current = fn
  }, [])

  const refreshCartCount = useCallback(async () => {
    if (!loaderRef.current) return
    const n = await loaderRef.current()
    setCartCount(n)
  }, [])

  const value = useMemo(
    () => ({ cartCount, setCartCount, refreshCartCount, registerCartLoader, tracking }),
    [cartCount, refreshCartCount, registerCartLoader, tracking]
  )

  return <PartnerSiteShopContext.Provider value={value}>{children}</PartnerSiteShopContext.Provider>
}

export function usePartnerSiteShop() {
  const ctx = useContext(PartnerSiteShopContext)
  if (!ctx) {
    return {
      cartCount: 0,
      setCartCount: () => {},
      refreshCartCount: async () => {},
      registerCartLoader: () => {},
      tracking: EMPTY_TRACKING,
    }
  }
  return ctx
}
