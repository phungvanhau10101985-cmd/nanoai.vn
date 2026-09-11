'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  partnerSiteCategoryHubPath,
  partnerSiteHomePath,
  partnerSiteImageSearchPath,
  partnerSiteKhoSalePath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductsApiPath,
  partnerSiteProductsPath,
  partnerSiteSearchHistoryApiPath,
  partnerSiteSearchPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { storePendingImageAndNavigate } from '@/lib/partner-website/shop/partner-site-pending-image'
import { isSaleListingSearchTerm } from '@/lib/partner-website/shop/partner-site-text-search'

const PW_MOBILE_SEARCH_COMPOSE_CSS = `
.pw-mobile-search{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:#f9fafb;color:var(--pw-text,#111);font-family:var(--pw-font-ui),system-ui,sans-serif}
.pw-mobile-search-head{flex:0 0 auto;background:#fff;padding-top:env(safe-area-inset-top,0px);border-bottom:1px solid #f3f4f6}
.pw-mobile-search-form{display:flex;align-items:center;gap:6px;padding:10px 12px;touch-action:manipulation;max-width:48rem;margin:0 auto;width:100%;box-sizing:border-box}
@media (min-width:768px){.pw-mobile-search-form{padding:12px 16px}}
.pw-mobile-search-back,.pw-mobile-search-camera,.pw-mobile-search-go{flex:0 0 auto;min-width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;cursor:pointer}
.pw-mobile-search-back{background:transparent;border-radius:12px;color:#1f2937}
.pw-mobile-search-back:hover{background:#f3f4f6}
.pw-mobile-search-back svg,.pw-mobile-search-camera svg,.pw-mobile-search-go svg{width:22px;height:22px}
.pw-mobile-search-field{flex:1 1 auto;min-width:0;height:44px;display:flex;align-items:stretch;overflow:hidden;border-radius:12px;background:#f3f4f6;box-shadow:inset 0 0 0 1px #e5e7eb}
.pw-mobile-search-field:focus-within{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--pw-primary,#ea580c) 55%,#fff)}
.pw-mobile-search-field-main{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;padding:0 4px 0 10px}
.pw-mobile-search-lens{width:18px;height:18px;color:#9ca3af;flex:0 0 auto}
.pw-mobile-search-field input{flex:1 1 auto;min-width:0;height:100%;border:0;background:transparent;font-size:16px;color:var(--pw-text,#111);padding:0 4px;outline:none;caret-color:var(--pw-primary,#ea580c);-webkit-user-select:text}
.pw-mobile-search-field input::placeholder{color:#6b7280}
.pw-mobile-search-field input[type=search]::-webkit-search-decoration,
.pw-mobile-search-field input[type=search]::-webkit-search-cancel-button{display:none}
.pw-mobile-search-clear{flex:0 0 auto;width:32px;height:32px;margin:auto 4px auto 0;border:0;background:#e5e7eb;border-radius:999px;color:#6b7280;cursor:pointer}
.pw-mobile-search-clear svg{width:14px;height:14px}
.pw-mobile-search-camera{width:44px;border-left:1px solid #e5e7eb;border-radius:0;background:transparent;color:#4b5563}
.pw-mobile-search-camera:hover{background:color-mix(in srgb,var(--pw-primary,#ea580c) 8%,#fff);color:var(--pw-primary,#ea580c)}
.pw-mobile-search-go{min-width:44px;width:44px;padding:0;border-radius:0;background:var(--pw-primary,#ea580c);color:#fff}
@media (min-width:768px){.pw-mobile-search-go{min-width:56px;width:56px}}
.pw-mobile-search-go:hover{filter:brightness(.95)}
.pw-mobile-search-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:12px 12px max(20px,env(safe-area-inset-bottom))}
.pw-mobile-search-body-inner{max-width:48rem;margin:0 auto;width:100%}
@media (min-width:768px){.pw-mobile-search-body{padding-top:20px}}
.pw-mobile-search-quick{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.pw-mobile-search-quick a{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:999px;background:#fff;color:var(--pw-text,#111);font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 0 0 1px #e5e7eb}
.pw-mobile-search-card{background:transparent;border-radius:0;padding:0;box-shadow:none}
.pw-mobile-search-card + .pw-mobile-search-card,.pw-mobile-search-body section + section{margin-top:20px}
.pw-mobile-search-body h2{margin:0;font-size:14px;font-weight:700;color:var(--pw-text,#111)}
.pw-mobile-search-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.pw-mobile-search-clear-all{border:0;background:transparent;font-size:12px;font-weight:600;color:var(--pw-muted,#6b7280);min-height:36px;cursor:pointer}
.pw-mobile-search-clear-all:hover{color:#b91c1c}
.pw-mobile-search-muted{margin:0;font-size:13px;line-height:1.45;color:var(--pw-muted,#6b7280)}
.pw-mobile-search-hint{margin:2px 0 12px;font-size:12px;color:var(--pw-muted,#6b7280)}
.pw-mobile-search-empty{display:flex;align-items:flex-start;gap:10px;padding:2px 0 4px;color:var(--pw-muted,#6b7280)}
.pw-mobile-search-empty svg{width:22px;height:22px;margin-top:1px;color:var(--pw-primary,#ea580c);flex:0 0 auto}
.pw-mobile-search-empty strong{display:block;font-size:13px;font-weight:700;color:var(--pw-text,#111)}
.pw-mobile-search-err{margin:0 0 10px;padding:10px 12px;border-radius:12px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:13px}
.pw-mobile-search-err button{border:0;background:transparent;font:inherit;font-weight:600;text-decoration:underline;color:inherit;cursor:pointer}
.pw-mobile-search-chips{display:flex;flex-wrap:wrap;gap:8px}
.pw-mobile-search-chip{display:inline-flex;max-width:100%;align-items:center;gap:2px;border-radius:999px;background:#fff;padding:2px 4px 2px 12px;box-shadow:0 0 0 1px #e5e7eb}
.pw-mobile-search-chip svg{width:14px;height:14px;color:#9ca3af;flex:0 0 auto;margin-left:4px}
.pw-mobile-search-chip>button:first-of-type{border:0;background:transparent;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--pw-text,#111);padding:8px 4px;min-height:36px;cursor:pointer}
.pw-mobile-search-chip>button:last-child{width:36px;height:36px;border:0;background:transparent;border-radius:999px;color:#9ca3af;font-size:18px;line-height:1;cursor:pointer}
.pw-mobile-search-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (min-width:640px){.pw-mobile-search-grid{grid-template-columns:repeat(3,1fr)}}
@media (min-width:768px){.pw-mobile-search-grid{grid-template-columns:repeat(4,1fr)}}
.pw-mobile-search-tile{position:relative;display:block;overflow:hidden;border-radius:16px;background:#fff;text-align:left;color:inherit;border:0;padding:0;box-shadow:0 0 0 1px #f3f4f6,0 1px 2px rgba(15,23,42,.04);cursor:pointer;width:100%}
.pw-mobile-search-tile:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(15,23,42,.08),0 0 0 1px color-mix(in srgb,var(--pw-primary,#ea580c) 22%,#fff)}
.pw-mobile-search-tile-media{position:relative;aspect-ratio:3/4;background:#f9fafb}
.pw-mobile-search-tile img{width:100%;height:100%;object-fit:cover;background:#f3f4f6;display:block}
.pw-mobile-search-tile-badge{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:rgba(255,255,255,.95);padding:2px 8px;font-size:11px;font-weight:700;color:var(--pw-primary,#ea580c);box-shadow:0 1px 2px rgba(15,23,42,.08)}
.pw-mobile-search-tile-badge svg{width:12px;height:12px}
.pw-mobile-search-tile p{margin:0;padding:8px 10px 10px;font-size:13px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em;color:var(--pw-text,#111)}
.pw-mobile-search-skel{border-radius:16px;background:linear-gradient(90deg,#f3f4f6 25%,#eceff3 37%,#f3f4f6 63%);background-size:400% 100%;animation:pw-ms-skel 1.2s ease infinite;min-height:220px}
@keyframes pw-ms-skel{0%{background-position:100% 0}100%{background-position:0 0}}
`

type SuggestProduct = {
  id?: string
  inventoryId?: string
  inventory_id?: string
  name?: string
  imageUrl?: string | null
  image_url?: string | null
  categoryL1?: string | null
  category_l1?: string | null
  categoryL2?: string | null
  category_l2?: string | null
  categoryL3?: string | null
  category_l3?: string | null
}

function productId(p: SuggestProduct): string {
  return String(p.id || p.inventoryId || p.inventory_id || '').trim()
}

function productImage(p: SuggestProduct): string {
  const raw = String(p.imageUrl || p.image_url || '').trim()
  return shopCardDisplaySrc(raw) || raw
}

function searchQueryFromProduct(p: SuggestProduct, typed: boolean): string {
  const name = String(p.name || '').trim()
  const l3 = String(p.categoryL3 || p.category_l3 || '').trim()
  const l2 = String(p.categoryL2 || p.category_l2 || '').trim()
  const l1 = String(p.categoryL1 || p.category_l1 || '').trim()
  if (typed) return name || l3 || l2 || l1
  return l3 || l2 || l1 || name
}

function pushUnique(out: SuggestProduct[], seen: Set<string>, product: SuggestProduct | null | undefined) {
  if (!product) return
  const id = productId(product)
  const name = String(product.name || '').trim()
  const img = productImage(product)
  if (!id || seen.has(id) || !name || !img) return
  seen.add(id)
  out.push({ ...product, id })
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
  if (!Array.isArray(list)) return []
  return (list as SuggestProduct[]).map((product) => {
    const id = productId(product)
    return id ? { ...product, id } : product
  })
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
      if (out.length >= 12) break
      const before = out.length
      pushUnique(out, seen, p)
      if (out.length > before) fromViewed = true
    }
  }
  if (recRes.status === 'fulfilled' && recRes.value) {
    for (const p of asProducts(recRes.value)) {
      if (out.length >= 12) break
      pushUnique(out, seen, p)
    }
  }
  if (out.length < 12) {
    const popular = await fetchJson(`${partnerSiteProductsApiPath(siteSlug)}?limit=16&sort=views_desc`)
    for (const p of asProducts(popular)) {
      if (out.length >= 12) break
      pushUnique(out, seen, p)
    }
  }
  return { products: out.slice(0, 12), fromViewed }
}

function focusComposeInput(el: HTMLInputElement | null) {
  if (!el) return
  try {
    el.focus({ preventScroll: true })
  } catch {
    try {
      el.focus()
    } catch {
      /* ignore */
    }
  }
  try {
    const len = el.value.length
    el.setSelectionRange(len, len)
  } catch {
    /* iOS older */
  }
}

export function PartnerSiteMobileSearchClient({
  siteSlug,
  locale,
  shopTitle,
  onClose,
}: {
  siteSlug: string
  locale: WebLocale
  shopTitle: string
  onClose?: () => void
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

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    const focus = () => focusComposeInput(el)
    focus()
    const raf = window.requestAnimationFrame(focus)
    const timers = [0, 50, 120, 320, 700].map((ms) => window.setTimeout(focus, ms))
    const onShow = () => focus()
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', onShow)
    return () => {
      window.cancelAnimationFrame(raf)
      for (const id of timers) window.clearTimeout(id)
      window.removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', onShow)
    }
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
      const dest = isSaleListingSearchTerm(term)
        ? partnerSiteKhoSalePath(siteSlug, { customDomain })
        : partnerSiteSearchPath(siteSlug, { customDomain, q: term })
      if (typeof window !== 'undefined') {
        window.location.assign(dest)
        return
      }
      router.push(dest)
    },
    [customDomain, router, siteSlug]
  )

  const handleBack = () => {
    if (onClose) {
      onClose()
      return
    }
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

  const renderProduct = (product: SuggestProduct) => {
    const img = productImage(product)
    if (!img) return null
    const query = searchQueryFromProduct(product, typed.length >= 2)
    if (!query) return null
    const key = productId(product) || query
    return (
      <button
        key={key}
        type="button"
        className="pw-mobile-search-tile"
        onClick={() => runSearch(query)}
        aria-label={`${t.searchTileBadge} ${query}`}
      >
        <span className="pw-mobile-search-tile-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" loading="lazy" decoding="async" />
          <span className="pw-mobile-search-tile-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {t.searchTileBadge}
          </span>
        </span>
        <p>{query}</p>
      </button>
    )
  }

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
            <div className="pw-mobile-search-field-main">
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
                autoFocus
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
                    focusComposeInput(inputRef.current)
                  }}
                  aria-label={t.searchClearQuery}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>
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
        <div className="pw-mobile-search-body-inner">
        {typed.length < 2 ? (
          <nav className="pw-mobile-search-quick" aria-label={t.searchQuickAria}>
            <Link href={partnerSiteProductsPath(siteSlug, { customDomain })}>{t.searchQuickNew}</Link>
            <Link href={partnerSiteKhoSalePath(siteSlug, { customDomain })}>{t.khoSaleNavLabel}</Link>
            <Link href={partnerSiteCategoryHubPath(siteSlug, { customDomain })}>{t.categoryHubTitle}</Link>
          </nav>
        ) : null}

        {historyError ? (
          <div className="pw-mobile-search-err">
            {historyError}{' '}
            <button type="button" onClick={() => void loadHistory()}>
              {t.searchRetry}
            </button>
          </div>
        ) : null}

        <section className="pw-mobile-search-card" aria-label={t.searchHistoryAria}>
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
            typedKey ? (
              <p className="pw-mobile-search-muted">{t.searchHistoryNoMatch}</p>
            ) : (
              <div className="pw-mobile-search-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 8v4l2.5 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <strong>{t.searchHistoryEmpty}</strong>
                  <p className="pw-mobile-search-muted">{t.searchHistoryEmptyHint}</p>
                </div>
              </div>
            )
          ) : null}
          {matchedHistory.length > 0 ? (
            <div className="pw-mobile-search-chips">
              {matchedHistory.map((q) => (
                <div key={q} className="pw-mobile-search-chip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l2.5 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
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
          <section
            className="pw-mobile-search-card"
            aria-label={typed.length >= 2 ? t.searchSuggestProducts : t.searchSuggestTitle}
          >
            <h2>{typed.length >= 2 ? t.searchSuggestProducts : t.searchSuggestTitle}</h2>
            <p className="pw-mobile-search-hint">
              {typed.length >= 2
                ? t.searchSuggestTapTyped
                : suggestFromViewed
                  ? t.searchSuggestFromViewed
                  : t.searchSuggestForYou}
            </p>
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
            {suggestLoading && typed.length < 2 ? (
              <div className="pw-mobile-search-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="pw-mobile-search-skel" />
                ))}
              </div>
            ) : null}
            {typedLoading && typed.length >= 2 && visibleProducts.length === 0 ? (
              <div className="pw-mobile-search-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="pw-mobile-search-skel" />
                ))}
              </div>
            ) : null}
            {!typedLoading && typed.length >= 2 && visibleProducts.length === 0 && !typedError ? (
              <p className="pw-mobile-search-muted">{t.searchSuggestTypedEmpty}</p>
            ) : null}
            {visibleProducts.length > 0 && !(suggestLoading && typed.length < 2) ? (
              <div className="pw-mobile-search-grid">
                {visibleProducts.map((product) => renderProduct(product))}
              </div>
            ) : null}
          </section>
        ) : null}
        </div>
      </div>
    </div>
  )
}
