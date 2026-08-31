'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PARTNER_PUBLIC_INVENTORY_SEARCH_MAX } from '@/lib/messaging/partner-public-search-limits'
import {
  classifyPartnerImageSearchError,
  looksLikeHttpUrl,
  shouldRetryPartnerImageSearchTransient,
} from '@/lib/partner-website/shop/partner-site-image-search-errors'
import {
  consumePendingImageFile,
  PW_PENDING_IMAGE_EVENT,
} from '@/lib/partner-website/shop/partner-site-pending-image'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteSearchImageApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Hit = {
  id?: string
  inventory_id?: string
  name?: string
  imageUrl?: string
  image_url?: string
  priceHint?: string | null
  price_hint?: string | null
  detailPath?: string
}

const RETRY_AFTER_MS = 2500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function imageUrlToFile(raw: string): Promise<File> {
  const u = new URL(raw.trim())
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('protocol')
  }
  const hrefs = [raw.trim(), `/api/fetch-image?url=${encodeURIComponent(raw.trim())}`]
  let last: Error | null = null
  for (const href of hrefs) {
    try {
      const res = await fetch(href, href.startsWith('/') ? { credentials: 'same-origin' } : { mode: 'cors' })
      if (!res.ok) throw new Error(`http ${res.status}`)
      const blob = await res.blob()
      if (!String(blob.type || '').startsWith('image/')) throw new Error('type')
      const sub = blob.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg'
      const ext = sub === 'jpeg' ? 'jpg' : sub
      return new File([blob], `anh-tu-link.${ext}`, { type: blob.type })
    } catch (e) {
      last = e instanceof Error ? e : new Error('fetch')
    }
  }
  throw last || new Error('fetch')
}

function useLazyReveal<T>(items: T[], initial = 12, step = 12) {
  const [count, setCount] = useState(initial)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setCount(initial)
  }, [items, initial])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) {
        setCount((c) => Math.min(items.length, c + step))
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [items.length, step])
  return {
    revealed: items.slice(0, count),
    hasMore: count < items.length,
    sentinelRef,
    total: items.length,
  }
}

export function PartnerSiteImageSearchClient({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  const t = getPartnerSiteShopCopy(locale)
  const fileInputId = useId()
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [softMessage, setSoftMessage] = useState<string | null>(null)
  const [products, setProducts] = useState<Hit[]>([])
  const [imageUrlInput, setImageUrlInput] = useState('')
  const lastAutoFetchedUrlRef = useRef<string | null>(null)
  const linkSearchBusyRef = useRef(false)

  const humanize = useCallback(
    (raw: string | null | undefined) => {
      const kind = classifyPartnerImageSearchError(raw)
      if (kind === 'html') return t.imageSearchServiceUnavailable
      if (kind === 'gemini') return t.imageSearchGeminiError
      const s = String(raw || '').trim()
      return s.length > 320 ? `${s.slice(0, 320)}…` : s
    },
    [t.imageSearchGeminiError, t.imageSearchServiceUnavailable]
  )

  const runSearch = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      setSoftMessage(null)
      setProducts([])
      try {
        const url = URL.createObjectURL(file)
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
          return url
        })

        let lastErr: string | null = null
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const fd = new FormData()
          fd.append('image', file)
          fd.append('limit', String(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX))
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
          const list = Array.isArray(json.products) ? json.products : []
          const errRaw = json.error ? String(json.error) : !res.ok ? t.searchError : ''

          if (list.length > 0) {
            setProducts(list)
            if (attempt > 0) setSoftMessage(null)
            break
          }

          lastErr = errRaw || null
          if (shouldRetryPartnerImageSearchTransient(lastErr) && attempt === 0) {
            setSoftMessage(t.imageSearchRetry)
            await sleep(RETRY_AFTER_MS)
            continue
          }

          setProducts([])
          if (lastErr) setSoftMessage(humanize(lastErr))
          break
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : t.searchError
        setError(humanize(raw) || raw)
        setProducts([])
      } finally {
        setLoading(false)
      }
    },
    [humanize, siteSlug, t.imageSearchRetry, t.searchError]
  )

  useEffect(() => {
    const consume = () => {
      const file = consumePendingImageFile()
      if (file) void runSearch(file)
    }
    consume()
    window.addEventListener(PW_PENDING_IMAGE_EVENT, consume)
    return () => window.removeEventListener(PW_PENDING_IMAGE_EVENT, consume)
  }, [runSearch])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const fetchFromUrlString = useCallback(
    async (rawInput: string) => {
      if (linkSearchBusyRef.current) return
      const raw = rawInput.trim()
      if (!raw) {
        setError(t.imageSearchUrlInvalid)
        return
      }
      if (!looksLikeHttpUrl(raw)) {
        setError(t.imageSearchUrlInvalid)
        return
      }
      setError(null)
      linkSearchBusyRef.current = true
      try {
        const file = await imageUrlToFile(raw)
        await runSearch(file)
        lastAutoFetchedUrlRef.current = raw
      } catch {
        lastAutoFetchedUrlRef.current = null
        setError(t.imageSearchUrlFetchFailed)
      } finally {
        linkSearchBusyRef.current = false
      }
    },
    [runSearch, t.imageSearchUrlFetchFailed, t.imageSearchUrlInvalid]
  )

  useEffect(() => {
    const raw = imageUrlInput.trim()
    if (!raw) {
      lastAutoFetchedUrlRef.current = null
      return
    }
    if (!looksLikeHttpUrl(raw)) return
    if (raw === lastAutoFetchedUrlRef.current) return
    const id = window.setTimeout(() => {
      const latest = imageUrlInput.trim()
      if (latest !== raw) return
      if (!looksLikeHttpUrl(latest)) return
      if (latest === lastAutoFetchedUrlRef.current) return
      void fetchFromUrlString(latest)
    }, 520)
    return () => window.clearTimeout(id)
  }, [imageUrlInput, fetchFromUrlString])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData
      if (!cd) return
      const ae = document.activeElement as HTMLElement | null
      const isOtherFormField =
        ae &&
        (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable) &&
        ae !== urlInputRef.current
      if (isOtherFormField) return
      for (const it of Array.from(cd.items)) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) {
            e.preventDefault()
            void runSearch(f)
            return
          }
        }
      }
      for (const f of Array.from(cd.files)) {
        if (f.type.startsWith('image/')) {
          e.preventDefault()
          void runSearch(f)
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [runSearch])

  const onThumbDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f?.type.startsWith('image/')) await runSearch(f)
  }

  const { revealed, hasMore, sentinelRef, total } = useLazyReveal(products, 12, 12)

  return (
    <div>
      <header style={{ marginBottom: 12 }}>
        <h1 data-pw-el={PW_EL.sectionTitle} style={{ margin: 0, fontSize: '1.05rem' }}>
          {t.imageSearchTitle}
        </h1>
        <p className="pw-shop-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
          {t.imageSearchHint}
        </p>
      </header>

      <input
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void runSearch(f)
        }}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            border: '1px solid var(--pw-border)',
            background: 'var(--pw-surface)',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void onThumbDrop(e)}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="pw-shop-muted" style={{ fontSize: 10 }}>
              —
            </span>
          )}
        </div>
        <label
          htmlFor={fileInputId}
          className="pw-shop-btn"
          style={{
            background: 'var(--pw-buy)',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
            pointerEvents: loading ? 'none' : undefined,
          }}
        >
          {t.imageSearchUpload}
        </label>
        <input
          ref={urlInputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t.imageSearchUrlPlaceholder}
          value={imageUrlInput}
          onChange={(e) => {
            setImageUrlInput(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              lastAutoFetchedUrlRef.current = null
              void fetchFromUrlString(imageUrlInput)
            }
          }}
          style={{
            flex: '1 1 12rem',
            minWidth: 0,
            minHeight: 44,
            border: '1px solid var(--pw-border)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 14,
            color: 'var(--pw-text)',
            background: 'var(--pw-bg)',
          }}
        />
      </div>

      {error ? (
        <p className="pw-shop-muted" role="alert" style={{ color: '#b91c1c', marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      {softMessage && !error && products.length === 0 && !loading ? (
        <p className="pw-shop-muted" role="status" style={{ marginBottom: 8 }}>
          {softMessage}
        </p>
      ) : null}

      <section data-pw-region={PW_REGION.catalog} data-pw-catalog aria-live="polite">
        <h2 data-pw-el={PW_EL.sectionTitle} style={{ fontSize: 14, margin: '0 0 12px' }}>
          {loading
            ? t.imageSearchLoading
            : t.imageSearchResultCount.replace('{n}', String(products.length))}
        </h2>
        {loading ? (
          <div className="pw-shop-grid" data-pw-el={PW_EL.grid} data-pw-grid aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <article key={i} className="pw-shop-card" style={{ minHeight: 220, background: 'var(--pw-surface)' }} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="pw-shop-grid" data-pw-el={PW_EL.grid} data-pw-grid>
              {revealed.map((p, i) => {
                const id = String(p.id || p.inventory_id || '')
                const href = p.detailPath || '#'
                const img = p.imageUrl || p.image_url || ''
                const name = p.name || ''
                const price = p.priceHint || p.price_hint || ''
                return (
                  <article key={id || `${name}-${i}`} className="pw-shop-card" data-pw-el={PW_EL.card}>
                    <Link href={href} data-pw-el={PW_EL.cardMedia}>
                      {img ? <img src={img} alt={name} loading="lazy" /> : null}
                    </Link>
                    <div className="pw-shop-card-body">
                      <Link href={href}>
                        <h3 data-pw-el={PW_EL.cardName}>{name}</h3>
                      </Link>
                      {price ? (
                        <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>
                          {price}
                        </p>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
            {hasMore ? (
              <p className="pw-shop-muted" style={{ textAlign: 'center', fontSize: 12, padding: 12 }}>
                {t.imageSearchRevealHint
                  .replace('{shown}', String(revealed.length))
                  .replace('{total}', String(total))}
              </p>
            ) : null}
            <div ref={sentinelRef} style={{ height: 16 }} aria-hidden />
          </>
        ) : !loading && !error && !softMessage ? (
          <p className="pw-shop-muted">{t.imageSearchEmpty}</p>
        ) : null}
      </section>
    </div>
  )
}
