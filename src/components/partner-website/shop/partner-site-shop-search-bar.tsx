'use client'

import { Camera, Search } from 'lucide-react'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PartnerSiteMobileSearchClient } from '@/components/partner-website/shop/partner-site-mobile-search-client'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteImageSearchPath,
  partnerSiteSearchPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  isPartnerShopMobileSearchComposeFace,
  PARTNER_MOBILE_SEARCH_COMPOSE_MQ,
  partnerSiteMobileSearchPath,
} from '@/lib/partner-website/shop/partner-site-mobile-search-path'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { emitPartnerSiteSearchHistory } from '@/lib/partner-website/shop/partner-site-search-history'
import { storePendingImageAndNavigate } from '@/lib/partner-website/shop/partner-site-pending-image'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

function usePartnerShopMobileSearchComposeFace(previewDevice?: VisualDeviceVariant | null): boolean {
  const [mobile, setMobile] = useState(previewDevice === 'mobile')
  useEffect(() => {
    const read = () => {
      let queryDevice = ''
      try {
        queryDevice = new URLSearchParams(location.search).get('pw-device') || ''
      } catch {
        queryDevice = ''
      }
      const html = document.documentElement
      setMobile(
        isPartnerShopMobileSearchComposeFace({
          editDevice: html.getAttribute('data-pw-edit-device'),
          sceneLock: html.getAttribute('data-pw-scene-lock'),
          queryDevice,
          viewportMobile: window.matchMedia(PARTNER_MOBILE_SEARCH_COMPOSE_MQ).matches,
        })
      )
    }
    read()
    const mq = window.matchMedia(PARTNER_MOBILE_SEARCH_COMPOSE_MQ)
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [previewDevice])
  return mobile
}

export function PartnerSiteShopSearchBar({
  siteSlug,
  locale,
  previewDevice = null,
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
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const composeMobile = usePartnerShopMobileSearchComposeFace(previewDevice)
  const [qHint, setQHint] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    try {
      setQHint(new URLSearchParams(location.search).get('q') || '')
    } catch {
      setQHint('')
    }
  }, [])

  const composeHref = partnerSiteMobileSearchPath(siteSlug, {
    customDomain,
    q: qHint || q,
  })

  function openCompose(e: SyntheticEvent) {
    const native = e.nativeEvent as MouseEvent | PointerEvent | KeyboardEvent
    if ('button' in native && native.button !== 0) return
    if ('ctrlKey' in native && (native.ctrlKey || native.metaKey || native.shiftKey || native.altKey)) return
    e.preventDefault()
    if (composeOpen) return
    flushSync(() => setComposeOpen(true))
  }

  function goText(e?: React.FormEvent) {
    e?.preventDefault()
    if (composeMobile) {
      if (composeOpen) return
      flushSync(() => setComposeOpen(true))
      return
    }
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

  const shown = (qHint || q).trim()

  return (
    <div className="pw-shop-search-wrap" data-pw-el={PW_EL.search}>
      <form className="pw-shop-search-form" role="search" onSubmit={goText}>
        <span className="pw-shop-search-default-icon" aria-hidden="true">
          <Search className="pw-search-default-glyph" strokeWidth={2} />
        </span>
        {composeMobile ? (
          <Link
            href={composeHref}
            target="_top"
            className="pw-shop-search-compose"
            aria-label={t.searchComposeOpen}
            onPointerDown={openCompose}
            onClick={openCompose}
          >
            <span className={shown ? 'pw-shop-search-compose-q' : undefined}>{shown || t.searchPlaceholder}</span>
          </Link>
        ) : (
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
        )}
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
        {composeMobile ? (
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
        ) : (
          <button type="submit" className="pw-shop-search-submit" disabled={busy} aria-label={t.searchButton}>
            <Search className="pw-shop-search-submit-icon" aria-hidden="true" strokeWidth={2.4} />
            <span className="pw-shop-search-submit-label">{t.searchButton}</span>
          </button>
        )}
      </form>
      {composeMobile ? null : <div data-pw-search-history="" data-pw-search-history-panel="1" hidden />}
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
      {composeOpen ? (
        <PartnerSiteMobileSearchClient
          siteSlug={siteSlug}
          locale={locale}
          shopTitle={shopTitle}
          onClose={() => setComposeOpen(false)}
        />
      ) : null}
    </div>
  )
}
