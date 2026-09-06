'use client'

import { usePathname } from 'next/navigation'
import { reactAccountShellNavFromPathname } from '@/lib/partner-website/shop/partner-site-account-nav'
import {
  PartnerSiteShopShell,
  type PartnerSiteShopShellProps,
} from '@/components/partner-website/shop/partner-site-shop-shell'

export type PartnerSiteReactAccountShellProps = Omit<
  PartnerSiteShopShellProps,
  'pageKind' | 'activeNav' | 'hideAccountNav'
>

/** Shared cart/account layout: keep header/footer mounted while menu routes swap children. */
export function PartnerSiteReactAccountShell(props: PartnerSiteReactAccountShellProps) {
  const pathname = usePathname()
  const nav = reactAccountShellNavFromPathname(pathname || '')
  return (
    <PartnerSiteShopShell
      {...props}
      pageKind={nav.pageKind}
      activeNav={nav.activeNav}
      hideAccountNav={nav.hideAccountNav}
    />
  )
}
