'use client'

import { Camera, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import Link from 'next/link'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteProductPath,
  partnerSiteSearchImageApiPath,
  partnerSiteSearchTextApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { emitPartnerSiteSearchHistory } from '@/lib/partner-website/shop/partner-site-search-history'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Hit = {
  id?: string
  inventory_id?: string
  name?: string
  imageUrl?: string
  image_url?: string
  priceHint?: string
  price_hint?: string
  detailPath?: string
}

export function PartnerSiteShopSearchBar({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const fileRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Hit[] | null>(null)

  async function runText(e?: React.FormEvent) {
    e?.preventDefault()
    const query = q.trim()
    if (query.length < 1 || busy) return
    emitPartnerSiteSearchHistory(query)
    setBusy(true)
    setError('')
    try {
      const res = await fetch(
        `${partnerSiteSearchTextApiPath(siteSlug)}?q=${encodeURIComponent(query)}&limit=24`,
        { credentials: 'same-origin' }
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        products?: Hit[]
        error?: string
      }
      if (!res.ok || !json.ok) {
        setResults([])
        setError(json.error || t.searchError)
        return
      }
      setResults(json.products || [])
      if (!(json.products || []).length) setError(t.searchEmpty)
    } catch {
      setResults([])
      setError(t.searchError)
    } finally {
      setBusy(false)
    }
  }

  async function runImage(file: File | undefined) {
    if (!file || busy) return
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('limit', '24')
      const res = await fetch(partnerSiteSearchImageApiPath(siteSlug), {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        products?: Hit[]
        error?: string
      }
      if (!res.ok || !json.ok) {
        setResults([])
        setError(json.error || t.searchError)
        return
      }
      setResults(json.products || [])
      if (!(json.products || []).length) setError(json.error || t.searchEmpty)
    } catch {
      setResults([])
      setError(t.searchError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pw-shop-search-wrap" data-pw-el={PW_EL.search}>
      <form className="pw-shop-search-form" role="search" onSubmit={(e) => void runText(e)}>
        <span className="pw-shop-search-default-icon" aria-hidden="true">
          <Search className="pw-search-default-glyph" strokeWidth={2} />
        </span>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
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
        <button type="submit" className="pw-shop-search-submit" disabled={busy} aria-label={busy ? t.searchSearching : t.searchButton}>
          <Search className="pw-shop-search-submit-icon" aria-hidden="true" strokeWidth={2.4} />
          <span className="pw-shop-search-submit-label">{busy ? t.searchSearching : t.searchButton}</span>
        </button>
      </form>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          void runImage(f)
          e.target.value = ''
        }}
      />
      {results ? (
        <div className="pw-shop-search-panel" role="region" aria-live="polite">
          <div className="pw-shop-search-panel-head">
            <strong>{t.searchResults}</strong>
            <button type="button" onClick={() => { setResults(null); setError('') }}>
              ×
            </button>
          </div>
          {error ? <p className="pw-shop-muted">{error}</p> : null}
          <div className="pw-shop-search-grid">
            {(results || []).map((p) => {
              const id = String(p.id || p.inventory_id || '')
              const href =
                p.detailPath ||
                (id
                  ? partnerSiteProductPath(siteSlug, id, {
                      customDomain,
                      name: p.name,
                    })
                  : '#')
              const img = p.imageUrl || p.image_url || ''
              const name = p.name || ''
              const price = p.priceHint || p.price_hint || ''
              return (
                <Link key={id || name} href={href} className="pw-shop-search-card">
                  {img ? <img src={img} alt="" loading="lazy" /> : <div className="pw-shop-search-ph" />}
                  <span className="pw-shop-search-name">{name}</span>
                  {price ? <span className="pw-shop-price">{price}</span> : null}
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
