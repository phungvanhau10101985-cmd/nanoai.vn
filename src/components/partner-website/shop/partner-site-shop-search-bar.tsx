'use client'

import { Camera, Search } from 'lucide-react'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteImageSearchPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteMobileSearchPath } from '@/lib/partner-website/shop/partner-site-mobile-search-path'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { storePendingImageAndNavigate } from '@/lib/partner-website/shop/partner-site-pending-image'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

function goComposePage(href: string, router: ReturnType<typeof useRouter>) {
  if (typeof window !== 'undefined') {
    window.location.assign(href)
    return
  }
  router.push(href)
}

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
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
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

  function openCompose(e: SyntheticEvent) {
    const native = e.nativeEvent as MouseEvent | PointerEvent | KeyboardEvent
    if ('button' in native && native.button !== 0) return
    if ('ctrlKey' in native && (native.ctrlKey || native.metaKey || native.shiftKey || native.altKey)) return
    e.preventDefault()
    goComposePage(composeHref, router)
  }

  async function goImage(file: File | undefined) {
    if (!file || busy) return
    setBusy(true)
    try {
      await storePendingImageAndNavigate(file, router, partnerSiteImageSearchPath(siteSlug, { customDomain }))
    } finally {
      setBusy(false)
    }
  }

  const shown = qHint.trim()

  return (
    <div className="pw-shop-search-wrap" data-pw-el={PW_EL.search}>
      <form
        className="pw-shop-search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          goComposePage(composeHref, router)
        }}
      >
        <span className="pw-shop-search-default-icon" aria-hidden="true">
          <Search className="pw-search-default-glyph" strokeWidth={2} />
        </span>
        <Link
          href={composeHref}
          target="_top"
          className="pw-shop-search-compose"
          aria-label={t.searchComposeOpen}
          onPointerDown={openCompose}
          onClick={openCompose}
        >
          <span className={shown ? 'pw-shop-search-compose-q' : undefined}>
            {shown || t.searchComposePlaceholder.replace('{shop}', shopTitle || '') || t.searchPlaceholder}
          </span>
        </Link>
        <button
          type="button"
          className="pw-shop-search-image"
          title={t.searchByImage}
          aria-label={t.searchByImage}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
        </button>
        <Link
          href={composeHref}
          target="_top"
          className="pw-shop-search-submit"
          aria-label={t.searchComposeOpen}
          onPointerDown={openCompose}
          onClick={openCompose}
        >
          <Search className="pw-shop-search-submit-icon" aria-hidden="true" strokeWidth={2.4} />
          <span className="pw-shop-search-submit-label">{t.searchButton}</span>
        </Link>
      </form>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          void goImage(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
