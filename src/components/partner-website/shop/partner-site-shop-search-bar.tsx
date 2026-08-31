'use client'

import { Camera, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteImageSearchPath,
  partnerSiteSearchPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { emitPartnerSiteSearchHistory } from '@/lib/partner-website/shop/partner-site-search-history'
import { storePendingImageAndNavigate } from '@/lib/partner-website/shop/partner-site-pending-image'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export function PartnerSiteShopSearchBar({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  function goText(e?: React.FormEvent) {
    e?.preventDefault()
    const query = q.trim()
    if (query.length < 1 || busy) return
    emitPartnerSiteSearchHistory(query)
    router.push(partnerSiteSearchPath(siteSlug, { customDomain, q: query }))
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

  return (
    <div className="pw-shop-search-wrap" data-pw-el={PW_EL.search}>
      <form className="pw-shop-search-form" role="search" onSubmit={goText}>
        <span className="pw-shop-search-default-icon" aria-hidden="true">
          <Search className="pw-search-default-glyph" strokeWidth={2} />
        </span>
        <input
          data-pw-search=""
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          autoComplete="off"
          disabled={busy}
        />
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
        <button type="submit" className="pw-shop-search-submit" disabled={busy} aria-label={t.searchButton}>
          <Search className="pw-shop-search-submit-icon" aria-hidden="true" strokeWidth={2.4} />
          <span className="pw-shop-search-submit-label">{t.searchButton}</span>
        </button>
      </form>
      <div data-pw-search-history="" data-pw-search-history-panel="1" hidden />
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
