'use client'

import { Camera, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteImageSearchPopover } from '@/components/partner-website/shop/partner-site-image-search-popover'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteImageSearchPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteMobileSearchPath } from '@/lib/partner-website/shop/partner-site-mobile-search-path'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export function PartnerSiteShopSearchBar({
  siteSlug,
  locale,
  shopTitle = '',
}: {
  siteSlug: string
  locale: WebLocale
  previewDevice?: VisualDeviceVariant | null
  shopTitle?: string
}) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const [qHint, setQHint] = useState('')

  useEffect(() => {
    try {
      setQHint(new URLSearchParams(location.search).get('q') || '')
    } catch {
      setQHint('')
    }
  }, [])

  const composeHref = partnerSiteMobileSearchPath(siteSlug, {
    customDomain,
    q: qHint,
  })
  const imageHref = partnerSiteImageSearchPath(siteSlug, { customDomain })
  const shown = qHint.trim()

  return (
    <div className="pw-shop-search-wrap" data-pw-el={PW_EL.search}>
      <form
        className="pw-shop-search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          window.location.assign(composeHref)
        }}
      >
        <span className="pw-shop-search-default-icon" aria-hidden="true">
          <Search className="pw-search-default-glyph" strokeWidth={2} />
        </span>
        <a
          href={composeHref}
          target="_top"
          className="pw-shop-search-compose"
          aria-label={t.searchComposeOpen}
        >
          <span className={shown ? 'pw-shop-search-compose-q' : undefined}>
            {shown || t.searchComposePlaceholder.replace('{shop}', shopTitle || '') || t.searchPlaceholder}
          </span>
        </a>
        <PartnerSiteImageSearchPopover
          imageSearchPath={imageHref}
          locale={locale}
          triggerButtonClassName="pw-shop-search-image"
          triggerIconClassName="pw-shop-nav-icon"
        >
          <Camera className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
        </PartnerSiteImageSearchPopover>
        <a
          href={composeHref}
          target="_top"
          className="pw-shop-search-submit"
          aria-label={t.searchComposeOpen}
        >
          <Search className="pw-shop-search-submit-icon" aria-hidden="true" strokeWidth={2.4} />
          <span className="pw-shop-search-submit-label">{t.searchButton}</span>
        </a>
      </form>
    </div>
  )
}
