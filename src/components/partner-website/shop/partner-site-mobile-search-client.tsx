'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WebLocale } from '@/lib/i18n/config'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import {
  emitPartnerSiteSearchHistory,
  mergeSearchQueries,
  normalizeSearchQuery,
  partnerSiteSearchHistoryStorageKey,
} from '@/lib/partner-website/shop/partner-site-search-history'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteHomePath,
  partnerSiteImageSearchPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
  partnerSiteProductsApiPath,
  partnerSiteSearchHistoryApiPath,
  partnerSiteSearchPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { storePendingImageAndNavigate } from '@/lib/partner-website/shop/partner-site-pending-image'

const PW_MOBILE_SEARCH_COMPOSE_CSS = `
.pw-mobile-search{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:#fff;color:var(--pw-text,#111)}
.pw-mobile-search-head{flex:0 0 auto;background:#fff;border-bottom:1px solid var(--pw-border,#f3f4f6);padding-top:env(safe-area-inset-top,0px)}
.pw-mobile-search-form{display:flex;align-items:center;gap:6px;padding:8px}
.pw-mobile-search-back{flex:0 0 auto;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:12px;color:var(--pw-text,#111)}
.pw-mobile-search-back svg{width:24px;height:24px}
.pw-mobile-search-field{flex:1 1 auto;min-width:0;height:44px;display:flex;align-items:stretch;overflow:hidden;border-radius:12px;background:#f3f4f6;box-shadow:inset 0 0 0 1px var(--pw-border,#e5e7eb)}
.pw-mobile-search-lens{width:20px;height:20px;margin:auto 0 auto 10px;color:#9ca3af;flex:0 0 auto}
.pw-mobile-search-field input{flex:1 1 auto;min-width:0;height:100%;border:0;background:transparent;font-size:16px;color:var(--pw-text,#111);padding:0 6px;outline:none}
.pw-mobile-search-clear{flex:0 0 auto;width:32px;height:32px;margin:auto 2px;border:0;background:transparent;border-radius:999px;color:#6b7280}
.pw-mobile-search-clear svg{width:16px;height:16px}
.pw-mobile-search-camera{flex:0 0 auto;width:44px;border:0;border-left:1px solid var(--pw-border,#e5e7eb);background:transparent;color:#4b5563}
.pw-mobile-search-camera svg{width:22px;height:22px;margin:auto}
.pw-mobile-search-go{flex:0 0 auto;width:44px;border:0;background:var(--pw-primary);color:#fff}
.pw-mobile-search-go svg{width:22px;height:22px;margin:auto;stroke:#fff}
.pw-mobile-search-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 12px max(12px,env(safe-area-inset-bottom))}
.pw-mobile-search-body h2{margin:0;font-size:14px;font-weight:700;color:var(--pw-text,#111)}
.pw-mobile-search-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.pw-mobile-search-clear-all{border:0;background:transparent;font-size:12px;font-weight:600;color:var(--pw-muted,#6b7280)}
.pw-mobile-search-muted{margin:8px 0;font-size:12px;color:var(--pw-muted,#6b7280)}
.pw-mobile-search-hint{margin:2px 0 8px;font-size:12px;color:var(--pw-muted,#6b7280)}
.pw-mobile-search-err{margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:13px}
.pw-mobile-search-err button{border:0;background:transparent;font:inherit;font-weight:600;text-decoration:underline;color:inherit;cursor:pointer}
.pw-mobile-search-chips{display:flex;flex-wrap:wrap;gap:8px}
.pw-mobile-search-chip{display:inline-flex;max-width:100%;align-items:center;border-radius:999px;background:#f3f4f6;padding:4px 4px 4px 12px}
.pw-mobile-search-chip>button:first-child{border:0;background:transparent;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--pw-text,#111)}
.pw-mobile-search-chip>button:last-child{width:32px;height:32px;border:0;background:transparent;border-radius:999px;color:#9ca3af;font-size:18px;line-height:1}
.pw-mobile-search-body section{margin-top:16px}
.pw-mobile-search-body section:first-of-type{margin-top:4px}
.pw-mobile-search-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.pw-mobile-search-tile{display:block;overflow:hidden;border-radius:12px;border:1px solid var(--pw-border,#f3f4f6);background:#fff;text-align:left;color:inherit;text-decoration:none;box-shadow:0 1px 2px rgba(15,23,42,.06)}
.pw-mobile-search-tile img{width:100%;aspect-ratio:1;object-fit:cover;background:#f9fafb;display:block}
.pw-mobile-search-tile p{margin:0;padding:6px 8px;font-size:12px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}
.pw-mobile-search-skel{border-radius:12px;border:1px solid #f3f4f6;background:#f3f4f6;min-height:160px}
`

type SuggestProduct = {
  id?: string
  name?: string
  imageUrl?: string | null
  image_url?: string | null
  detailPath?: string
  detail_path?: string
  productUrl?: string
  product_url?: string
}

function productImage(p: SuggestProduct): string {
  const raw = String(p.imageUrl || p.image_url || '').trim()
  return shopCardDisplaySrc(raw) || raw
}

function productHref(
  p: SuggestProduct,
  siteSlug: string,
  customDomain?: boolean
): string {
  const raw = String(p.detailPath || p.detail_path || '').trim()
  if (raw.startsWith('/')) return raw
  const id = String(p.id || '').trim()
  if (id) return partnerSiteProductPath(siteSlug, id, { name: p.name, customDomain })
  return ''
}

function pushUnique(out: SuggestProduct[], seen: Set<string>, product: SuggestProduct | null | undefined) {
  if (!product) return
  const id = String(product.id || '').trim()
  const name = String(product.name || '').trim()
  const img = productImage(product)
  if (!id || seen.has(id) || !name || !img) return
  seen.add(id)
  out.push(product)
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { credentials: 'same-origin' })
    if (!r.ok) return null
    return (await r.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function asProducts(raw: unknown): SuggestProduct[] {
  if (!raw || typeof raw !== 'object') return []
  const list = (raw as { products?: unknown }).products
  return Array.isArray(list) ? (list as SuggestProduct[]) : []
}

async function loadSuggestProducts(siteSlug: string): Promise<{ products: SuggestProduct[]; fromViewed: boolean }> {
  const viewedUrl = `${partnerSitePersonalizationApiPath(siteSlug, 'recently-viewed')}?limit=8`
  const recUrl = `${partnerSitePersonalizationApiPath(siteSlug, 'recommendations')}?limit=8`
  const [viewedRes, recRes] = await Promise.allSettled([fetchJson(viewedUrl), fetchJson(recUrl)])
  const out: SuggestProduct[] = []
  const seen = new Set<string>()
  let fromViewed = false
  if (viewedRes.status === 'fulfilled' && viewedRes.value) {
    for (const p of asProducts(viewedRes.value)) {
      if (out.length >= 8) break
      const before = out.length
      pushUnique(out, seen, p)
      if (out.length > before) fromViewed = true
    }
  }
  if (recRes.status === 'fulfilled' && recRes.value) {
    for (const p of asProducts(recRes.value)) {
      if (out.length >= 8) break
      pushUnique(out, seen, p)
    }
  }
  if (out.length < 8) {
    const popular = await fetchJson(`${partnerSiteProductsApiPath(siteSlug)}?limit=12&sort=views_desc`)
    for (const p of asProducts(popular)) {
      if (out.length >= 8) break
      pushUnique(out, seen, p)
    }
  }
  return { products: out.slice(0, 8), fromViewed }
}

export function PartnerSiteMobileSearchClient({
  siteSlug,
  locale,
  shopTitle,
}: {
  siteSlug: string
  locale: WebLocale
  shopTitle: string
}) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoggedIn, setHistoryLoggedIn] = useState(false)
  const [removingQuery, setRemovingQuery] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [suggestProducts, setSuggestProducts] = useState<SuggestProduct[]>([])
  const [suggestLoading, setSuggestLoading] = useState(true)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestFromViewed, setSuggestFromViewed] = useState(false)
  const [typedProducts, setTypedProducts] = useState<SuggestProduct[]>([])
  const [typedLoading, setTypedLoading] = useState(false)
  const [typedError, setTypedError] = useState<string | null>(null)
  const [busyImage, setBusyImage] = useState(false)

  const typed = searchTerm.trim()
  const typedKey = typed.toLowerCase()
  const historyApi = partnerSiteSearchHistoryApiPath(siteSlug)
  const historyLs = partnerSiteSearchHistoryStorageKey(siteSlug)
  const placeholder = t.searchComposePlaceholder.replace('{shop}', shopTitle || '')

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q') || ''
      if (q) setSearchTerm(q)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const apply = () => {
      const vv = window.visualViewport
      setViewportHeight(vv ? Math.round(vv.height) : window.innerHeight)
    }
    apply()
    const vv = window.visualViewport
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const focus = () => {
      el.focus({ preventScroll: true })
      const len = el.value.length
      try {
        el.setSelectionRange(len, len)
      } catch {
        /* iOS older */
      }
    }
    focus()
    const timer = window.setTimeout(focus, 50)
    return () => window.clearTimeout(timer)
  }, [])

  const readLocalHistory = useCallback((): string[] => {
    try {
      return mergeSearchQueries(JSON.parse(localStorage.getItem(historyLs) || '[]'))
    } catch {
      return []
    }
  }, [historyLs])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const json = await fetchJson(historyApi)
      const loggedIn = Boolean(json && json.loggedIn)
      setHistoryLoggedIn(loggedIn)
      if (loggedIn) {
        const local = readLocalHistory()
        if (local.length) {
          const post = await fetch(historyApi, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ queries: local }),
          })
          const body = (await post.json().catch(() => null)) as { queries?: string[] } | null
          try {
            localStorage.removeItem(historyLs)
          } catch {
            /* ignore */
          }
          setHistory(mergeSearchQueries(body?.queries || json?.queries || []))
        } else {
          setHistory(mergeSearchQueries(json?.queries || []))
        }
      } else {
        setHistory(readLocalHistory())
      }
    } catch {
      setHistoryError(t.searchHistoryLoadError)
      setHistory(readLocalHistory())
    } finally {
      setHistoryLoading(false)
    }
  }, [historyApi, historyLs, readLocalHistory, t.searchHistoryLoadError])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    let cancelled = false
    setSuggestLoading(true)
    setSuggestError(null)
    void loadSuggestProducts(siteSlug)
      .then((result) => {
        if (cancelled) return
        setSuggestProducts(result.products)
        setSuggestFromViewed(result.fromViewed)
      })
      .catch(() => {
        if (cancelled) return
        setSuggestProducts([])
        setSuggestFromViewed(false)
        setSuggestError(t.searchSuggestLoadError)
      })
      .finally(() => {
        if (!cancelled) setSuggestLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug, t.searchSuggestLoadError])

  useEffect(() => {
    if (typed.length < 2) {
      setTypedProducts([])
      setTypedLoading(false)
      setTypedError(null)
      return
    }
    setTypedLoading(true)
    setTypedError(null)
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const json = await fetchJson(
        `${partnerSiteProductsApiPath(siteSlug)}?q=${encodeURIComponent(typed)}&limit=8&sort=newest`
      )
      if (cancelled) return
      if (!json) {
        setTypedProducts([])
        setTypedError(t.searchSuggestLoadError)
      } else {
        setTypedProducts(asProducts(json))
      }
      setTypedLoading(false)
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [siteSlug, typed, t.searchSuggestLoadError])

  const matchedHistory = useMemo(() => {
    if (!typedKey) return history
    return history.filter((row) => row.toLowerCase().includes(typedKey))
  }, [history, typedKey])

  const visibleProducts = typed.length >= 2 ? typedProducts : suggestProducts

  const runSearch = useCallback(
    (raw: string) => {
      const term = normalizeSearchQuery(raw)
      const homeHref = partnerSiteHomePath(siteSlug, { customDomain })
      if (!term) {
        if (typeof window !== 'undefined') {
          window.location.assign(homeHref)
          return
        }
        router.push(homeHref)
        return
      }
      emitPartnerSiteSearchHistory(term)
      const dest = partnerSiteSearchPath(siteSlug, { customDomain, q: term })
      if (typeof window !== 'undefined') {
        window.location.assign(dest)
        return
      }
      router.push(dest)
    },
    [customDomain, router, siteSlug]
  )

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      router.push(partnerSiteHomePath(siteSlug, { customDomain }))
      return
    }
    router.back()
  }

  const persistLocal = (next: string[]) => {
    try {
      localStorage.setItem(historyLs, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    setHistory(next)
  }

  const handleRemoveHistory = async (query: string) => {
    setRemovingQuery(query)
    setHistoryError(null)
    try {
      if (historyLoggedIn) {
        const res = await fetch(historyApi, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const body = (await res.json().catch(() => null)) as { queries?: string[] } | null
        if (res.ok && body) setHistory(mergeSearchQueries(body.queries || []))
      } else {
        persistLocal(history.filter((item) => item.toLowerCase() !== query.toLowerCase()))
      }
    } catch {
      setHistoryError(t.searchHistoryLoadError)
    } finally {
      setRemovingQuery(null)
    }
  }

  const handleClearAll = async () => {
    setClearingAll(true)
    setHistoryError(null)
    try {
      if (historyLoggedIn) {
        const res = await fetch(historyApi, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        const body = (await res.json().catch(() => null)) as { queries?: string[] } | null
        if (res.ok) setHistory(mergeSearchQueries(body?.queries || []))
      } else {
        persistLocal([])
      }
    } catch {
      setHistoryError(t.searchHistoryLoadError)
    } finally {
      setClearingAll(false)
    }
  }

  async function goImage(file: File | undefined) {
    if (!file || busyImage) return
    setBusyImage(true)
    try {
      await storePendingImageAndNavigate(file, router, partnerSiteImageSearchPath(siteSlug, { customDomain }))
    } finally {
      setBusyImage(false)
    }
  }

  const showSuggestSection =
    typed.length >= 2 || suggestLoading || Boolean(suggestError) || suggestProducts.length > 0

  return (
    <div
      className="pw-mobile-search"
      style={viewportHeight ? { height: viewportHeight } : { height: '100dvh' }}
    >
      <style>{PW_MOBILE_SEARCH_COMPOSE_CSS}</style>
      <header className="pw-mobile-search-head">
        <form
          className="pw-mobile-search-form"
          onSubmit={(e) => {
            e.preventDefault()
            runSearch(searchTerm)
          }}
        >
          <button type="button" className="pw-mobile-search-back" onClick={handleBack} aria-label={t.navBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="pw-mobile-search-field">
            <svg className="pw-mobile-search-lens" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              data-pw-search-compose="1"
              type="search"
              name="q"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              inputMode="search"
              aria-label={placeholder}
            />
            {searchTerm ? (
              <button
                type="button"
                className="pw-mobile-search-clear"
                onClick={() => {
                  setSearchTerm('')
                  inputRef.current?.focus()
                }}
                aria-label={t.searchClearQuery}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              className="pw-mobile-search-camera"
              title={t.searchByImage}
              aria-label={t.searchByImage}
              disabled={busyImage}
              onClick={() => fileRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8h3l2-3h8l2 3h3v12H3z"
                />
                <circle cx="12" cy="14" r="3.5" />
              </svg>
            </button>
            <button type="submit" className="pw-mobile-search-go" aria-label={t.searchButton} disabled={busyImage}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
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
      </header>

      <div className="pw-mobile-search-body">
        {historyError ? (
          <div className="pw-mobile-search-err">
            {historyError}{' '}
            <button type="button" onClick={() => void loadHistory()}>
              {t.searchRetry}
            </button>
          </div>
        ) : null}

        <section aria-label={t.searchHistoryAria}>
          <div className="pw-mobile-search-row">
            <h2>{t.searchHistoryAria}</h2>
            {history.length > 0 ? (
              <button
                type="button"
                className="pw-mobile-search-clear-all"
                onClick={() => void handleClearAll()}
                disabled={clearingAll || removingQuery != null}
              >
                {t.searchHistoryClearAll}
              </button>
            ) : null}
          </div>
          {historyLoading ? <p className="pw-mobile-search-muted">{t.searchSearching}</p> : null}
          {!historyLoading && matchedHistory.length === 0 && !historyError ? (
            <p className="pw-mobile-search-muted">{typedKey ? t.searchHistoryNoMatch : t.searchHistoryEmpty}</p>
          ) : null}
          {matchedHistory.length > 0 ? (
            <div className="pw-mobile-search-chips">
              {matchedHistory.map((q) => (
                <div key={q} className="pw-mobile-search-chip">
                  <button type="button" onClick={() => runSearch(q)}>
                    {q}
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.searchHistoryRemove} ${q}`}
                    disabled={removingQuery === q || clearingAll}
                    onClick={() => void handleRemoveHistory(q)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {showSuggestSection ? (
          <section aria-label={typed.length >= 2 ? t.searchSuggestProducts : t.searchSuggestTitle}>
            <h2>{typed.length >= 2 ? t.searchSuggestProducts : t.searchSuggestTitle}</h2>
            {typed.length < 2 && !suggestLoading && suggestProducts.length > 0 ? (
              <p className="pw-mobile-search-hint">
                {suggestFromViewed ? t.searchSuggestFromViewed : t.searchSuggestForYou}
              </p>
            ) : null}
            {suggestError && typed.length < 2 ? (
              <div className="pw-mobile-search-err">
                {suggestError}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSuggestLoading(true)
                    setSuggestError(null)
                    void loadSuggestProducts(siteSlug)
                      .then((result) => {
                        setSuggestProducts(result.products)
                        setSuggestFromViewed(result.fromViewed)
                      })
                      .catch(() => {
                        setSuggestProducts([])
                        setSuggestError(t.searchSuggestLoadError)
                      })
                      .finally(() => setSuggestLoading(false))
                  }}
                >
                  {t.searchRetry}
                </button>
              </div>
            ) : null}
            {typedError ? (
              <div className="pw-mobile-search-err">
                {typedError}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTypedError(null)
                    setTypedLoading(true)
                    void fetchJson(
                      `${partnerSiteProductsApiPath(siteSlug)}?q=${encodeURIComponent(typed)}&limit=8&sort=newest`
                    )
                      .then((json) => setTypedProducts(asProducts(json)))
                      .catch(() => {
                        setTypedProducts([])
                        setTypedError(t.searchSuggestLoadError)
                      })
                      .finally(() => setTypedLoading(false))
                  }}
                >
                  {t.searchRetry}
                </button>
              </div>
            ) : null}
            {((suggestLoading && typed.length < 2) ||
              (typedLoading && typed.length >= 2 && visibleProducts.length === 0)) && (
              <div className="pw-mobile-search-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="pw-mobile-search-skel" />
                ))}
              </div>
            )}
            {!typedLoading && typed.length >= 2 && visibleProducts.length === 0 && !typedError ? (
              <p className="pw-mobile-search-muted">{t.searchSuggestTypedEmpty}</p>
            ) : null}
            {visibleProducts.length > 0 && !(suggestLoading && typed.length < 2) ? (
              <div className="pw-mobile-search-grid">
                {visibleProducts.map((product) => {
                  const img = productImage(product)
                  if (!img) return null
                  const name = String(product.name || '').trim()
                  const body = (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" />
                      <p>{name}</p>
                    </>
                  )
                  if (typed.length >= 2) {
                    const href = productHref(product, siteSlug, customDomain)
                    if (!href) return null
                    return (
                      <Link key={String(product.id)} href={href} className="pw-mobile-search-tile">
                        {body}
                      </Link>
                    )
                  }
                  return (
                    <button
                      key={String(product.id)}
                      type="button"
                      className="pw-mobile-search-tile"
                      onClick={() => runSearch(name)}
                    >
                      {body}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
