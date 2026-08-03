'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { ProductPurchaseOptions } from '@/lib/messaging/guest-chat-ordering'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import {
  shopProductToCartCard,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import { mergeSiteCartLine, type SiteCartLine } from '@/lib/partner-website/shop/cart-line-utils'
import {
  usePartnerSiteChatWidget,
  usePartnerSiteActiveProductRegistrar,
} from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { productToConsultContext } from '@/lib/partner-website/shop/partner-site-chat-embed'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteCartPath, partnerSitePersonalizationApiPath, partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteAddToCart,
  trackPartnerSiteViewItem,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  product: PartnerSiteShopProduct
  relatedProducts?: PartnerSiteShopProduct[]
}

export function PartnerSiteShopProductClient({
  siteSlug,
  partnerSlug,
  locale,
  product,
  relatedProducts = [],
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const router = useRouter()
  const { openConsult, openTryOn } = usePartnerSiteChatWidget()
  const { setActiveProduct } = usePartnerSiteActiveProductRegistrar()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { refreshCartCount, tracking } = usePartnerSiteShop()
  const customDomain = usePartnerSiteCustomDomain()
  const [options, setOptions] = useState<ProductPurchaseOptions | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [activeImage, setActiveImage] = useState(product.imageUrl)

  const displayImage =
    options?.colors.find((c) => c.name === color)?.img?.trim() || product.imageUrl

  const consultCtx = useMemo(
    () =>
      productToConsultContext({
        id: product.id,
        sku: options?.sku || product.sku,
        imageUrl: displayImage,
        productUrl: product.productUrl,
        galleryImages: product.galleryImages,
      }),
    [displayImage, options?.sku, product.galleryImages, product.id, product.productUrl, product.sku]
  )

  useEffect(() => {
    setActiveProduct(consultCtx)
    return () => setActiveProduct(null)
  }, [consultCtx, setActiveProduct])

  useEffect(() => {
    setActiveImage(displayImage)
  }, [displayImage])

  const galleryImages = product.galleryImages.length ? product.galleryImages : [product.imageUrl]
  const detailBody = product.detailDescription.trim()
  const detailParagraphs = detailBody
    ? detailBody.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : []
  const showDetailDescription =
    detailParagraphs.length > 0 &&
    detailBody !== product.description.trim()
  const detailImageUrls = product.detailImages.filter((url) => url !== activeImage)
  const isYoutubeEmbed = (url: string) => /youtube\.com\/watch|youtu\.be\//i.test(url)
  const videoEmbedUrl = (() => {
    const raw = product.productVideoUrl?.trim()
    if (!raw) return null
    if (!isYoutubeEmbed(raw)) return raw
    try {
      if (raw.includes('youtu.be/')) {
        const id = raw.split('youtu.be/')[1]?.split(/[?#]/)[0]?.trim()
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      const id = new URL(raw).searchParams.get('v')?.trim()
      return id ? `https://www.youtube.com/embed/${id}` : null
    } catch {
      return null
    }
  })()

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/site/${encodeURIComponent(siteSlug)}/products/${encodeURIComponent(product.id)}/options`,
        { cache: 'no-store' }
      )
      const json = (await res.json()) as { options?: ProductPurchaseOptions | null }
      if (json.options) {
        setOptions(json.options)
        if (json.options.sizes[0]) setSize(json.options.sizes[0])
        if (json.options.colors[0]?.name) setColor(json.options.colors[0].name)
      }
    })()
  }, [product.id, siteSlug])

  useEffect(() => {
    const priceHint = options?.price_hint || product.priceHint
    trackPartnerSiteViewItem(tracking, shopProductToTrackingProduct(product, priceHint))
  }, [options?.price_hint, product, tracking])

  useEffect(() => {
    if (!ready) return
    void fetch(partnerSitePersonalizationApiPath(siteSlug, 'events'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ event: 'view_product', inventory_id: product.id }),
    }).then((res) => captureFromResponse(res))
  }, [authHeaders, captureFromResponse, product.id, ready, siteSlug])

  useEffect(() => {
    if (!ready) return
    void fetch(partnerSitePersonalizationApiPath(siteSlug, `favorites?limit=48`), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((json: { products?: { inventory_id?: string }[] }) => {
        const ids = (json.products ?? []).map((p) => p.inventory_id?.toLowerCase()).filter(Boolean)
        setIsFavorite(ids.includes(product.id.toLowerCase()))
      })
      .catch(() => {})
  }, [authHeaders, product.id, ready, siteSlug])

  async function toggleFavorite() {
    if (!ready || favoriteBusy) return
    setFavoriteBusy(true)
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'events'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ event: 'toggle_favorite', inventory_id: product.id }),
      })
      captureFromResponse(res)
      const json = (await res.json()) as { is_favorite?: boolean; ok?: boolean }
      if (res.ok && typeof json.is_favorite === 'boolean') setIsFavorite(json.is_favorite)
    } finally {
      setFavoriteBusy(false)
    }
  }

  async function addLine(redirectToCart: boolean) {
    if (!ready || busy) return
    setBusy(true)
    setMessage('')
    try {
      const card = shopProductToCartCard({
        ...product,
        priceHint: options?.price_hint || product.priceHint,
        imageUrl: displayImage,
      })
      const colorImg = options?.colors.find((c) => c.name === color)?.img
      const line: SiteCartLine = {
        id: crypto.randomUUID(),
        card,
        quantity: Math.max(1, Math.min(99, quantity)),
        color,
        size,
        note: '',
        ...(colorImg ? { variantLineImages: [colorImg] } : {}),
      }
      const cartRes = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/cart`, {
        credentials: 'same-origin',
        headers: authHeaders(),
      })
      captureFromResponse(cartRes)
      const cartJson = (await cartRes.json()) as { items?: SiteCartLine[] }
      const existing = Array.isArray(cartJson.items) ? cartJson.items : []
      const merged = mergeSiteCartLine(existing, line)
      const saveRes = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/cart`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ items: merged }),
      })
      captureFromResponse(saveRes)
      if (!saveRes.ok) {
        setMessage(t.authFailed)
        return
      }
      await refreshCartCount()
      const priceHint = options?.price_hint || product.priceHint
      trackPartnerSiteAddToCart(
        tracking,
        shopProductToTrackingProduct(product, priceHint),
        line.quantity
      )
      if (redirectToCart) router.push(partnerSiteCartPath(siteSlug, { customDomain }))
      else setMessage(t.addedToCart)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="pw-shop-product-layout">
        <div className="pw-shop-product-gallery">
          <img className="pw-shop-product-img" src={activeImage} alt={product.name} />
          {galleryImages.length > 1 ? (
            <div className="pw-shop-product-thumbs">
              {galleryImages.map((url) => (
                <button
                  key={url}
                  type="button"
                  className={`pw-shop-product-thumb${activeImage === url ? ' is-active' : ''}`}
                  onClick={() => setActiveImage(url)}
                  aria-label={product.name}
                >
                  <img src={url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, flex: 1 }}>{options?.name || product.name}</h1>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              disabled={!ready || favoriteBusy}
              onClick={() => void toggleFavorite()}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? t.favoriteRemove : t.favoriteAdd}
              title={isFavorite ? t.favoriteRemove : t.favoriteAdd}
              style={{ flexShrink: 0, fontSize: '1.25rem', lineHeight: 1, padding: '8px 12px' }}
            >
              {isFavorite ? '♥' : '♡'}
            </button>
          </div>
          {(options?.price_hint || product.priceHint) ? (
            <p className="pw-shop-price" style={{ fontSize: '1.25rem' }}>
              {options?.price_hint || product.priceHint}
            </p>
          ) : null}
          {product.description ? <p className="pw-shop-muted">{product.description}</p> : null}
          {options?.sizes.length ? (
            <label style={{ display: 'grid', gap: 4, marginTop: 12 }}>
              {t.sizeLabel}
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                {options.sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {options?.colors.length ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{t.colorLabel}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {options.colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="pw-shop-btn pw-shop-btn-outline"
                    style={{ borderColor: color === c.name ? 'var(--pw-accent)' : undefined, padding: 4 }}
                    onClick={() => setColor(c.name)}
                  >
                    {c.img ? (
                      <img src={c.img} alt={c.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      c.name
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <label style={{ display: 'grid', gap: 4, marginTop: 16, maxWidth: 120 }}>
            {t.quantity}
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            />
          </label>
          {options?.deposit_policy ? (
            <p className="pw-shop-muted" style={{ marginTop: 12, fontSize: 13 }}>
              {t.depositPolicyNote}
            </p>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
            <button type="button" className="pw-shop-btn" disabled={!ready || busy} onClick={() => void addLine(false)}>
              {t.addToCart}
            </button>
            <button type="button" className="pw-shop-btn" disabled={!ready || busy} onClick={() => void addLine(true)}>
              {t.buyNow}
            </button>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => openConsult(consultCtx)}
            >
              {t.consultChat}
            </button>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => openTryOn(consultCtx)}
            >
              {t.tryOnLink}
            </button>
          </div>
          {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
        </div>
      </div>
      {showDetailDescription || detailImageUrls.length > 0 || videoEmbedUrl ? (
        <section className="pw-shop-product-detail">
          {showDetailDescription ? (
            <div>
              <h2>{t.productDescriptionTitle}</h2>
              <div className="pw-shop-product-detail-body">
                {detailParagraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)} style={{ margin: '0 0 12px' }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          {detailImageUrls.length > 0 ? (
            <div>
              <h2>{t.productDetailImagesTitle}</h2>
              <div className="pw-shop-detail-grid">
                {detailImageUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className="pw-shop-product-thumb"
                    style={{ width: '100%', height: 'auto', aspectRatio: '1' }}
                    onClick={() => setActiveImage(url)}
                  >
                    <img src={url} alt={product.name} loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {videoEmbedUrl ? (
            <div>
              <h2>{t.productVideoTitle}</h2>
              {isYoutubeEmbed(product.productVideoUrl ?? '') ? (
                <iframe
                  className="pw-shop-product-video"
                  src={videoEmbedUrl}
                  title={product.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video className="pw-shop-product-video" src={videoEmbedUrl} controls preload="metadata" />
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      {relatedProducts.length > 0 ? (
        <section style={{ marginTop: 40 }}>
          <h2>{t.relatedProducts}</h2>
          <div className="pw-shop-grid" style={{ marginTop: 16 }}>
            {relatedProducts.map((p) => (
              <article key={p.id} className="pw-shop-card">
                <Link href={partnerSiteProductPath(siteSlug, p.id, { customDomain, name: p.name })}>
                  <img src={p.imageUrl} alt={p.name} loading="lazy" />
                </Link>
                <div className="pw-shop-card-body">
                  <Link href={partnerSiteProductPath(siteSlug, p.id, { customDomain, name: p.name })}>
                    <h3>{p.name}</h3>
                  </Link>
                  {p.priceHint ? <p className="pw-shop-price">{p.priceHint}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
