'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
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
import {
  partnerSiteCartPath,
  partnerSiteInfoPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteAddToCart,
  trackPartnerSiteViewItem,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PartnerSiteProductReviewsQa } from '@/components/partner-website/shop/partner-site-product-reviews-qa'
import {
  formatPartnerShopMoneyVnd,
  isPartnerFlashSaleActive,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  product: PartnerSiteShopProduct
  relatedProducts?: PartnerSiteShopProduct[]
}

/** W1.6 — chỉ hiện cảnh báo "sắp hết hàng" khi tồn kho THẤP nhưng > 0, không hiện khi = 0.
 * Lý do: `stock_qty` mặc định 0 cho shop chưa từng cấu hình (không phải tín hiệu hết hàng thật) —
 * hiện "Hết hàng" cho mọi sản phẩm chưa nhập tồn kho sẽ làm sai lệch hàng loạt shop hiện có. */
const LOW_STOCK_URGENCY_THRESHOLD = 5
const SWIPE_THRESHOLD_PX = 40

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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxZoomed, setLightboxZoomed] = useState(false)
  const [stickyBuyVisible, setStickyBuyVisible] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const touchStartXRef = useRef<number | null>(null)
  const buyActionsRef = useRef<HTMLDivElement | null>(null)
  const flashActive = isPartnerFlashSaleActive({
    priceAmount: product.priceAmount ?? null,
    salePriceAmount: product.salePriceAmount ?? null,
    saleStartsAt: product.saleStartsAt ?? null,
    saleEndsAt: product.saleEndsAt ?? null,
  })

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

  // W1.6 — thanh mua nổi (mobile): hiện khi khối nút mua chính đã cuộn khỏi màn hình.
  useEffect(() => {
    const el = buyActionsRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setStickyBuyVisible(!entry.isIntersecting),
      { rootMargin: '0px 0px -20% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const galleryImages = product.galleryImages.length ? product.galleryImages : [product.imageUrl]

  // W1.6 — vuốt ngang đổi ảnh (dùng chung cho ảnh chính lẫn lightbox).
  function goToGalleryImage(delta: number) {
    if (galleryImages.length < 2) return
    const idx = galleryImages.indexOf(activeImage)
    const next = ((idx === -1 ? 0 : idx) + delta + galleryImages.length) % galleryImages.length
    setActiveImage(galleryImages[next])
  }
  function handleGalleryTouchStart(e: ReactTouchEvent) {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }
  function handleGalleryTouchEnd(e: ReactTouchEvent) {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX == null) return
    const dx = (e.changedTouches[0]?.clientX ?? startX) - startX
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    goToGalleryImage(dx > 0 ? -1 : 1)
  }
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
        <div className="pw-shop-product-gallery" data-pw-region={PW_REGION.gallery}>
          <img
            className="pw-shop-product-img"
            src={activeImage}
            alt={product.name}
            data-pw-el={PW_EL.mainImage}
            onClick={() => {
              setLightboxZoomed(false)
              setLightboxOpen(true)
            }}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          />
          {galleryImages.length > 1 ? (
            <p className="pw-shop-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              {t.galleryZoomHint}
            </p>
          ) : null}
          {galleryImages.length > 1 ? (
            <div className="pw-shop-product-thumbs">
              {galleryImages.map((url) => (
                <button
                  key={url}
                  type="button"
                  className={`pw-shop-product-thumb${activeImage === url ? ' is-active' : ''}`}
                  data-pw-el={PW_EL.thumb}
                  onClick={() => setActiveImage(url)}
                  aria-label={product.name}
                >
                  <img src={url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="pw-shop-pdp-info" data-pw-region={PW_REGION.pdpInfo}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, flex: 1 }} data-pw-el={PW_EL.title}>{options?.name || product.name}</h1>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              disabled={!ready || favoriteBusy}
              onClick={() => void toggleFavorite()}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? t.favoriteRemove : t.favoriteAdd}
              title={isFavorite ? t.favoriteRemove : t.favoriteAdd}
              style={{ flexShrink: 0, fontSize: '1.25rem', lineHeight: 1, padding: '8px 12px' }}
              data-pw-el={PW_EL.wishlist}
            >
              {isFavorite ? '♥' : '♡'}
            </button>
          </div>
          {flashActive && product.salePriceAmount != null ? (
            <div style={{ marginTop: 8 }}>
              <span className="pw-shop-urgency-badge" data-pw-el={PW_EL.badge}>{t.flashSaleBadge}</span>
              <p className="pw-shop-price" style={{ fontSize: '1.25rem' }} data-pw-el={PW_EL.price}>
                {formatPartnerShopMoneyVnd(product.salePriceAmount)}
                {product.priceAmount != null ? (
                  <span className="pw-shop-muted" style={{ marginLeft: 8, textDecoration: 'line-through', fontSize: '1rem' }} data-pw-el={PW_EL.comparePrice}>
                    {formatPartnerShopMoneyVnd(product.priceAmount)}
                  </span>
                ) : null}
              </p>
            </div>
          ) : (options?.price_hint || product.priceHint) ? (
            <p className="pw-shop-price" style={{ fontSize: '1.25rem' }} data-pw-el={PW_EL.price}>
              {options?.price_hint || product.priceHint}
            </p>
          ) : null}
          {product.description ? <p className="pw-shop-muted" data-pw-el={PW_EL.desc}>{product.description}</p> : null}
          {product.stockQty > 0 && product.stockQty <= LOW_STOCK_URGENCY_THRESHOLD ? (
            <span className="pw-shop-urgency-badge" data-pw-el={PW_EL.badge}>{t.lowStockUrgency.replace('{n}', String(product.stockQty))}</span>
          ) : null}
          {options?.sizes.length ? (
            <div style={{ marginTop: 12 }} data-pw-el={PW_EL.variant}>
              <label style={{ display: 'grid', gap: 4 }}>
                {t.sizeLabel}
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  {options.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              {product.sizeGuideImageUrl ? (
                <button
                  type="button"
                  className="pw-shop-btn pw-shop-btn-outline"
                  style={{ marginTop: 8, fontSize: 13 }}
                  onClick={() => setSizeGuideOpen(true)}
                >
                  {t.sizeGuideButton}
                </button>
              ) : (
                <Link
                  href={partnerSiteInfoPath(siteSlug, 'size-guide', { customDomain: Boolean(customDomain) })}
                  style={{ display: 'inline-block', marginTop: 8, fontSize: 13 }}
                >
                  {t.sizeGuideFallbackLink}
                </Link>
              )}
            </div>
          ) : null}
          {sizeGuideOpen && product.sizeGuideImageUrl ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t.sizeGuideModalTitle}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 80,
                background: 'rgba(0,0,0,0.65)',
                display: 'grid',
                placeItems: 'center',
                padding: 16,
              }}
              onClick={() => setSizeGuideOpen(false)}
            >
              <div
                style={{ background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%', padding: 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{t.sizeGuideModalTitle}</strong>
                  <button type="button" onClick={() => setSizeGuideOpen(false)}>
                    {t.sizeGuideClose}
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.sizeGuideImageUrl} alt={t.sizeGuideModalTitle} style={{ width: '100%', height: 'auto' }} />
              </div>
            </div>
          ) : null}
          {options?.colors.length ? (
            <div style={{ marginTop: 12 }} data-pw-el={PW_EL.variant}>
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
          <label style={{ display: 'grid', gap: 4, marginTop: 16, maxWidth: 120 }} data-pw-el={PW_EL.qty}>
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
          <div ref={buyActionsRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
            <button type="button" className="pw-shop-btn pw-shop-btn-cart" disabled={!ready || busy} onClick={() => void addLine(false)} data-pw-el={PW_EL.cardCart}>
              {t.addToCart}
            </button>
            <button type="button" className="pw-shop-btn pw-shop-btn-buy" disabled={!ready || busy} onClick={() => void addLine(true)} data-pw-el={PW_EL.buy}>
              {t.buyNow}
            </button>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => openConsult(consultCtx)}
              data-pw-el={PW_EL.cta}
            >
              {t.consultChat}
            </button>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => openTryOn(consultCtx)}
              data-pw-el={PW_EL.cta}
            >
              {t.tryOnLink}
            </button>
          </div>
          {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
        </div>
      </div>
      {showDetailDescription || detailImageUrls.length > 0 || videoEmbedUrl ? (
        <section className="pw-shop-product-detail" data-pw-region={PW_REGION.pdpInfo}>
          {showDetailDescription ? (
            <div>
              <h2>{t.productDescriptionTitle}</h2>
              <div className="pw-shop-product-detail-body" data-pw-el={PW_EL.desc}>
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
      <PartnerSiteProductReviewsQa siteSlug={siteSlug} inventoryId={product.id} locale={locale} />
      {relatedProducts.length > 0 ? (
        <section style={{ marginTop: 40 }} data-pw-region={PW_REGION.catalog} data-pw-catalog>
          <h2 data-pw-el={PW_EL.sectionTitle}>{t.relatedProducts}</h2>
          <div className="pw-shop-grid" style={{ marginTop: 16 }} data-pw-el={PW_EL.grid} data-pw-grid>
            {relatedProducts.map((p) => (
              <article key={p.id} className="pw-shop-card" data-pw-el={PW_EL.card}>
                <Link href={partnerSiteProductPath(siteSlug, p.id, { customDomain, name: p.name })} data-pw-el={PW_EL.cardMedia}>
                  <img src={p.imageUrl} alt={p.name} loading="lazy" />
                </Link>
                <div className="pw-shop-card-body">
                  <Link href={partnerSiteProductPath(siteSlug, p.id, { customDomain, name: p.name })}>
                    <h3 data-pw-el={PW_EL.cardName}>{p.name}</h3>
                  </Link>
                  {p.priceHint ? <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>{p.priceHint}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lightboxOpen ? (
        <div className="pw-shop-lightbox" onClick={() => setLightboxOpen(false)} role="dialog" aria-modal="true">
          <button
            type="button"
            className="pw-shop-lightbox-close"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxOpen(false)
            }}
            aria-label={t.lightboxClose}
          >
            ×
          </button>
          {galleryImages.length > 1 ? (
            <>
              <button
                type="button"
                className="pw-shop-lightbox-nav pw-shop-lightbox-prev"
                onClick={(e) => {
                  e.stopPropagation()
                  goToGalleryImage(-1)
                }}
                aria-label={t.lightboxPrev}
              >
                ‹
              </button>
              <button
                type="button"
                className="pw-shop-lightbox-nav pw-shop-lightbox-next"
                onClick={(e) => {
                  e.stopPropagation()
                  goToGalleryImage(1)
                }}
                aria-label={t.lightboxNext}
              >
                ›
              </button>
            </>
          ) : null}
          <img
            src={activeImage}
            alt={product.name}
            className={lightboxZoomed ? 'is-zoomed' : ''}
            onClick={(e) => {
              e.stopPropagation()
              setLightboxZoomed((z) => !z)
            }}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          />
          {galleryImages.length > 1 ? (
            <div className="pw-shop-lightbox-dots" onClick={(e) => e.stopPropagation()}>
              {galleryImages.map((url) => (
                <span key={url} className={url === activeImage ? 'is-active' : ''} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`pw-shop-sticky-buy${stickyBuyVisible ? ' is-visible' : ''}`}>
        <img src={displayImage} alt="" />
        <div className="pw-shop-sticky-buy-info">
          <p style={{ fontWeight: 600 }}>{options?.name || product.name}</p>
          {(options?.price_hint || product.priceHint) ? (
            <p className="pw-shop-price">{options?.price_hint || product.priceHint}</p>
          ) : null}
        </div>
        <div className="pw-shop-sticky-buy-actions">
          <button type="button" className="pw-shop-btn pw-shop-btn-cart" disabled={!ready || busy} onClick={() => void addLine(false)} data-pw-el={PW_EL.cardCart}>
            {t.addToCart}
          </button>
          <button type="button" className="pw-shop-btn pw-shop-btn-buy" disabled={!ready || busy} onClick={() => void addLine(true)} data-pw-el={PW_EL.buy}>
            {t.buyNow}
          </button>
        </div>
      </div>
    </div>
  )
}
