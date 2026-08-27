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
  partnerSiteCategoryPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteAddToCart,
  trackPartnerSiteViewItem,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PartnerSiteProductReviewsQa } from '@/components/partner-website/shop/partner-site-product-reviews-qa'
import { PartnerSiteRelatedProducts } from '@/components/partner-website/shop/partner-site-related-products'
import {
  formatPartnerShopMoneyVnd,
  isPartnerFlashSaleActive,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { PartnerSiteCartAddedModal } from '@/components/partner-website/shop/partner-site-cart-added-modal'
import { PartnerSiteProductVariantModal } from '@/components/partner-website/shop/partner-site-product-variant-modal'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import {
  displayablePdpText,
  pdpAttrGridHtml,
  pdpDescriptionBodyHtml,
  pdpProductInfoHtml,
} from '@/lib/partner-website/shop/pdp-product-info-html'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'

type RatingSummary = { average: number; total: number }

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  product: PartnerSiteShopProduct
  relatedProducts?: PartnerSiteShopProduct[]
  ratingSummary?: RatingSummary | null
  shippingFreeThreshold?: number | null
}

/** W1.6 — chỉ hiện cảnh báo "sắp hết hàng" khi tồn kho THẤP nhưng > 0, không hiện khi = 0. */
const LOW_STOCK_URGENCY_THRESHOLD = 5
const SWIPE_THRESHOLD_PX = 40

type MediaItem = { kind: 'photo'; url: string } | { kind: 'video'; embedUrl: string; rawUrl: string }

function isYoutubeEmbed(url: string) {
  return /youtube\.com\/watch|youtu\.be\//i.test(url)
}

function toYoutubeEmbed(raw: string): string | null {
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
}

function IconHome() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconTryOn() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}

export function PartnerSiteShopProductClient({
  siteSlug,
  partnerSlug,
  locale,
  product,
  relatedProducts = [],
  ratingSummary = null,
  shippingFreeThreshold = null,
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
  const [size, setSize] = useState(product.sizes[0] || '')
  const [color, setColor] = useState(product.colors[0]?.name || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [cartAdded, setCartAdded] = useState<{ name: string; imageUrl?: string | null } | null>(null)
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [likesCount, setLikesCount] = useState(() => Math.max(0, Math.round(Number(product.likesCount ?? 0) || 0)))
  const [activeImage, setActiveImage] = useState(product.imageUrl)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxZoomed, setLightboxZoomed] = useState(false)
  const [stickyBuyVisible, setStickyBuyVisible] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [pdpTab, setPdpTab] = useState<'description' | 'specs'>('description')
  const touchStartXRef = useRef<number | null>(null)
  const buyActionsRef = useRef<HTMLDivElement | null>(null)
  const flashActive = isPartnerFlashSaleActive({
    priceAmount: product.priceAmount ?? null,
    salePriceAmount: product.salePriceAmount ?? null,
    saleStartsAt: product.saleStartsAt ?? null,
    saleEndsAt: product.saleEndsAt ?? null,
  })

  const rawDisplay =
    (options?.colors.length ? options.colors : product.colors).find((c) => c.name === color)?.img?.trim() ||
    product.imageUrl
  const displayImage = shopCardDisplaySrc(rawDisplay) || rawDisplay

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

  const galleryImages = (product.galleryImages.length ? product.galleryImages : [product.imageUrl])
    .map((url) => shopCardDisplaySrc(url))
    .filter(Boolean)
  const videoEmbedUrl = (() => {
    const raw = product.productVideoUrl?.trim()
    if (!raw) return null
    if (!isYoutubeEmbed(raw)) return raw
    return toYoutubeEmbed(raw)
  })()

  const mediaItems = useMemo<MediaItem[]>(() => {
    const photos = galleryImages.filter(Boolean)
    const items: MediaItem[] = []
    if (photos[0]) items.push({ kind: 'photo', url: photos[0] })
    if (videoEmbedUrl && product.productVideoUrl) {
      items.push({ kind: 'video', embedUrl: videoEmbedUrl, rawUrl: product.productVideoUrl })
    }
    photos.slice(1).forEach((url) => items.push({ kind: 'photo', url }))
    return items
  }, [galleryImages, product.productVideoUrl, videoEmbedUrl])

  const currentMedia = mediaItems[mediaIndex] ?? mediaItems[0] ?? null
  const photoUrls = mediaItems.filter((m): m is Extract<MediaItem, { kind: 'photo' }> => m.kind === 'photo').map((m) => m.url)

  useEffect(() => {
    if (currentMedia?.kind === 'photo') setActiveImage(currentMedia.url)
  }, [currentMedia])

  function goToMedia(delta: number) {
    if (mediaItems.length < 2) return
    setMediaIndex((idx) => (idx + delta + mediaItems.length) % mediaItems.length)
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
    goToMedia(dx > 0 ? -1 : 1)
  }

  const detailBody = product.detailDescription.trim() || product.description.trim()
  const showDetailDescription = Boolean(detailBody)
  const detailImageUrls = product.detailImages.map((url) => shopCardDisplaySrc(url)).filter(Boolean)
  const materialImageUrl = shopCardDisplaySrc(product.materialImageUrl)
  const realUseImageUrls = (product.realUseImageUrls ?? []).map((url) => shopCardDisplaySrc(url)).filter(Boolean)
  const attrFields = {
    brandName: product.brandName,
    origin: product.origin,
    material: product.material,
    style: product.style,
    occasion: product.occasion,
    weight: product.weight,
    features: product.features ?? null,
    colorSummary: product.colorSummary,
    categoryL1: product.categoryL1,
    categoryL2: product.categoryL2,
    categoryL3: product.categoryL3,
    stockQty: product.stockQty,
  }
  const attrGridHtml = pdpAttrGridHtml(attrFields, t)
  const specsHtml = pdpProductInfoHtml(product.productInfo, locale, t, attrFields)
  const descHtml = pdpDescriptionBodyHtml(detailBody)
  const catalogRating = Number(product.ratingScore ?? 0)
  const catalogReviews = Math.max(0, Math.round(Number(product.reviewsCount ?? ratingSummary?.total ?? 0) || 0))
  const catalogSold = Math.max(0, Math.round(Number(product.purchasesCount ?? 0) || 0))
  const catalogLikes = Math.max(0, Math.round(Number(product.likesCount ?? 0) || 0))
  const brandText = displayablePdpText(product.brandName)
  const crumbNames = [product.categoryL1, product.categoryL2, product.categoryL3]
    .map((x) => displayablePdpText(x))
    .filter(Boolean)
  const sizeOptions = options?.sizes?.length ? options.sizes : product.sizes
  const colorOptions = options?.colors?.length ? options.colors : product.colors

  const unitPrice =
    flashActive && product.salePriceAmount != null
      ? product.salePriceAmount
      : product.priceAmount != null && Number.isFinite(product.priceAmount)
        ? product.priceAmount
        : null
  const comparePrice =
    flashActive && product.priceAmount != null && product.salePriceAmount != null && product.priceAmount > product.salePriceAmount
      ? product.priceAmount
      : null
  const lineTotal = unitPrice != null ? unitPrice * quantity : null
  const savings = comparePrice != null && unitPrice != null ? (comparePrice - unitPrice) * quantity : 0
  const priceLabel = options?.price_hint || product.priceHint
  const productName = options?.name || product.name
  const sku = options?.sku || product.sku
  const custom = Boolean(customDomain)
  const homeHref = partnerSiteHomePath(siteSlug, { customDomain: custom })
  const categoryHref = product.categoryPath
    ? partnerSiteCategoryPath(siteSlug, product.categoryPath, { customDomain: custom })
    : partnerSiteProductsPath(siteSlug, { customDomain: custom })
  const shippingHref = partnerSiteInfoPath(siteSlug, 'shipping', { customDomain: custom })
  const returnsHref = partnerSiteInfoPath(siteSlug, 'returns', { customDomain: custom })
  const freeShipText =
    shippingFreeThreshold != null && shippingFreeThreshold > 0
      ? t.pdpShippingFreeFrom.replace('{amount}', formatPartnerShopMoneyVnd(shippingFreeThreshold))
      : ''

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
    setLikesCount(catalogLikes)
  }, [catalogLikes, product.id])

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
    const wasFavorite = isFavorite
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'events'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ event: 'toggle_favorite', inventory_id: product.id }),
      })
      captureFromResponse(res)
      const json = (await res.json()) as { is_favorite?: boolean; likes_count?: number; ok?: boolean }
      if (res.ok && typeof json.is_favorite === 'boolean') {
        setIsFavorite(json.is_favorite)
        if (typeof json.likes_count === 'number' && Number.isFinite(json.likes_count)) {
          setLikesCount(Math.max(0, Math.round(json.likes_count)))
        } else {
          setLikesCount((n) => Math.max(0, n + (json.is_favorite && !wasFavorite ? 1 : !json.is_favorite && wasFavorite ? -1 : 0)))
        }
      }
    } finally {
      setFavoriteBusy(false)
    }
  }

  async function copyProductLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    } catch {
      setShareCopied(false)
    }
  }

  async function addLine(
    redirectToCart: boolean,
    pick?: { color?: string; size?: string; quantity?: number; imageUrl?: string }
  ) {
    if (!ready || busy) return
    setBusy(true)
    setMessage('')
    const nextColor = pick?.color ?? color
    const nextSize = pick?.size ?? size
    const nextQty = pick?.quantity ?? quantity
    const nextImage = pick?.imageUrl?.trim() || displayImage
    try {
      const card = shopProductToCartCard({
        ...product,
        priceHint: options?.price_hint || product.priceHint,
        imageUrl: nextImage,
      })
      const colorImg = options?.colors.find((c) => c.name === nextColor)?.img || pick?.imageUrl
      const line: SiteCartLine = {
        id: crypto.randomUUID(),
        card,
        quantity: Math.max(1, Math.min(99, nextQty)),
        color: nextColor,
        size: nextSize,
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
      else setCartAdded({ name: productName, imageUrl: nextImage })
    } finally {
      setBusy(false)
    }
  }

  function renderMedia(media: MediaItem | null, opts?: { hero?: boolean }) {
    if (!media) return null
    if (media.kind === 'video') {
      return isYoutubeEmbed(media.rawUrl) ? (
        <iframe
          className={opts?.hero ? 'pw-pdp-hero-img' : 'pw-shop-product-video'}
          src={media.embedUrl}
          title={productName}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video className={opts?.hero ? 'pw-pdp-hero-img' : 'pw-shop-product-video'} src={media.embedUrl} controls preload="metadata" />
      )
    }
    return (
      <img
        className={opts?.hero ? 'pw-pdp-hero-img' : 'pw-shop-product-img'}
        src={media.url}
        alt={productName}
        data-pw-el={PW_EL.mainImage}
        onClick={() => {
          setActiveImage(media.url)
          setLightboxZoomed(false)
          setLightboxOpen(true)
        }}
        onTouchStart={handleGalleryTouchStart}
        onTouchEnd={handleGalleryTouchEnd}
      />
    )
  }

  const qtyStepper = (
    <div className="pw-pdp-qty" data-pw-el={PW_EL.qty}>
      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="-">
        −
      </button>
      <span>{quantity}</span>
      <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="+">
        +
      </button>
    </div>
  )

  const stickyBar = (
    <div className={`pw-pdp-sticky${stickyBuyVisible ? ' is-visible' : ''}`}>
      <nav className="pw-pdp-sticky-nav" aria-label={t.navHome}>
        <Link href={homeHref}>
          <IconHome />
          <span className="pw-pdp-sticky-copy">
            <span>{t.pdpStickyHomeL1}</span>
            {t.pdpStickyHomeL2 ? <span>{t.pdpStickyHomeL2}</span> : null}
          </span>
        </Link>
        <button type="button" className="is-try" onClick={() => openTryOn(consultCtx)}>
          <IconTryOn />
          <span className="pw-pdp-sticky-copy">
            <span>{t.pdpStickyTryOnL1}</span>
            {t.pdpStickyTryOnL2 ? <span>{t.pdpStickyTryOnL2}</span> : null}
          </span>
        </button>
        <button
          type="button"
          className="is-fav"
          disabled={!ready || favoriteBusy}
          onClick={() => void toggleFavorite()}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t.favoriteRemove : t.favoriteAdd}
          data-pw-el={PW_EL.wishlist}
        >
          <IconHeart filled={isFavorite} />
          <span className="pw-pdp-like-copy">
            <span>{t.pdpStickyLikeLabel}</span>
            <span className="pw-pdp-like-count" data-pw-like-count>
              {likesCount}
            </span>
          </span>
        </button>
      </nav>
      <div className="pw-pdp-sticky-ctas">
        <button type="button" className="pw-shop-btn pw-shop-btn-cart" disabled={!ready || busy} onClick={() => setVariantModalOpen(true)} data-pw-el={PW_EL.cardCart}>
          {t.pdpAddToCartShort}
        </button>
        <button type="button" className="pw-shop-btn pw-shop-btn-buy" disabled={!ready || busy} onClick={() => setVariantModalOpen(true)} data-pw-el={PW_EL.buy}>
          {t.pdpBuyNowShort}
        </button>
      </div>
    </div>
  )

  return (
    <div className="pw-pdp">
      {crumbNames.length ? (
        <nav className="pw-shop-breadcrumb" data-pw-region={PW_REGION.breadcrumb} data-pw-pdp-slot="breadcrumb">
          <Link href={homeHref} data-pw-el={PW_EL.link}>
            {t.navHome}
          </Link>
          {crumbNames.map((name) => (
            <span key={name}>
              {' / '}
              <Link href={categoryHref} data-pw-el={PW_EL.crumb}>
                {name}
              </Link>
            </span>
          ))}
          {' / '}
          <span data-pw-el={PW_EL.crumb}>{productName}</span>
        </nav>
      ) : null}
      <div className="pw-pdp-hero" data-pw-region={PW_REGION.gallery}>
        {renderMedia(currentMedia, { hero: true })}
        {mediaItems.length > 1 ? (
          <>
            <span className="pw-pdp-hero-count">
              {mediaIndex + 1}/{mediaItems.length}
            </span>
            <div className="pw-pdp-hero-dots">
              {mediaItems.map((item, i) => (
                <span key={item.kind === 'photo' ? item.url : 'video'} className={i === mediaIndex ? 'is-active' : ''} />
              ))}
            </div>
          </>
        ) : null}
        {mediaItems.length > 1 ? (
          <nav className="pw-pdp-hero-thumbs" aria-label={productName}>
            {mediaItems.map((item, i) => (
              <button
                key={item.kind === 'photo' ? item.url : 'video'}
                type="button"
                className={`pw-shop-product-thumb${i === mediaIndex ? ' is-active' : ''}`}
                data-pw-el={PW_EL.thumb}
                onClick={() => setMediaIndex(i)}
              >
                {item.kind === 'photo' ? (
                  <img src={item.url} alt="" loading="lazy" />
                ) : (
                  <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', background: '#111', color: '#fff', fontSize: 11 }}>▶</span>
                )}
              </button>
            ))}
            <button type="button" className="pw-pdp-pill" onClick={() => void copyProductLink()}>
              {shareCopied ? t.pdpShareCopied : t.pdpShareCopy}
            </button>
          </nav>
        ) : null}
      </div>

      <div className="pw-shop-product-layout">
        <div className="pw-shop-product-gallery pw-pdp-gallery-desktop" data-pw-region={PW_REGION.gallery}>
          {renderMedia(currentMedia?.kind === 'photo' ? currentMedia : { kind: 'photo', url: activeImage })}
          {mediaItems.length > 1 ? (
            <p className="pw-shop-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              {t.galleryZoomHint}
            </p>
          ) : null}
          {mediaItems.length > 1 ? (
            <div className="pw-shop-product-thumbs">
              {mediaItems.map((item, i) => (
                <button
                  key={item.kind === 'photo' ? item.url : 'video'}
                  type="button"
                  className={`pw-shop-product-thumb${i === mediaIndex ? ' is-active' : ''}`}
                  data-pw-el={PW_EL.thumb}
                  onClick={() => {
                    setMediaIndex(i)
                    if (item.kind === 'photo') setActiveImage(item.url)
                  }}
                  aria-label={productName}
                >
                  {item.kind === 'photo' ? (
                    <img src={item.url} alt="" loading="lazy" />
                  ) : (
                    <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', background: '#111', color: '#fff', fontSize: 11 }}>▶</span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pw-shop-pdp-info pw-pdp-info-pad" data-pw-region={PW_REGION.pdpInfo}>
          <h1 className="pw-pdp-title" data-pw-el={PW_EL.title}>{productName}</h1>
          {brandText ? (
            <p className="pw-pdp-brand" data-pw-pdp-slot="brand">
              {t.pdpBrandLabel}: {brandText}
            </p>
          ) : null}
          {sku ? (
            <p className="pw-pdp-sku">
              {t.skuLabel}: <strong>{sku}</strong>
            </p>
          ) : null}
          <div className="pw-pdp-stats" data-pw-pdp-slot="stats">
            <span>
              <span className="pw-pdp-star">★</span>{' '}
              <strong>{Number.isFinite(catalogRating) ? catalogRating.toFixed(1) : '0.0'}</strong>
            </span>
            <span className="pw-pdp-stats-dot">•</span>
            <span>
              <strong>{catalogReviews}</strong> {t.pdpRatingLabel}
            </span>
            <span className="pw-pdp-stats-dot">•</span>
            <span>
              <strong>{catalogSold}</strong> {t.pdpPurchasesLabel}
            </span>
          </div>

          {flashActive && product.salePriceAmount != null ? (
            <div className="pw-pdp-price-card">
              <span className="pw-shop-urgency-badge" data-pw-el={PW_EL.badge}>{t.flashSaleBadge}</span>
              <p className="pw-shop-price" data-pw-el={PW_EL.price}>
                {formatPartnerShopMoneyVnd(product.salePriceAmount)}
                {comparePrice != null ? (
                  <span className="pw-pdp-compare" data-pw-el={PW_EL.comparePrice}>
                    {formatPartnerShopMoneyVnd(comparePrice)}
                  </span>
                ) : null}
              </p>
              {savings > 0 ? (
                <p className="pw-pdp-save">{t.pdpSavings.replace('{amount}', formatPartnerShopMoneyVnd(savings / quantity))}</p>
              ) : null}
            </div>
          ) : priceLabel ? (
            <div className="pw-pdp-price-card">
              <p className="pw-shop-price" data-pw-el={PW_EL.price}>{priceLabel}</p>
            </div>
          ) : null}

          {product.stockQty > 0 && product.stockQty <= LOW_STOCK_URGENCY_THRESHOLD ? (
            <span className="pw-shop-urgency-badge" data-pw-el={PW_EL.badge}>
              {t.lowStockUrgency.replace('{n}', String(product.stockQty))}
            </span>
          ) : null}

          <div className="pw-pdp-policy">
            {t.pdpShippingNote.replace('{free}', freeShipText)}{' '}
            <Link href={shippingHref}>{t.pdpShippingPolicyLink}</Link>
            {' · '}
            <Link href={returnsHref}>{t.pdpReturnsPolicyLink}</Link>
          </div>
          <p className="pw-pdp-policy" style={{ borderTop: 'none', paddingTop: 0, marginTop: 8 }}>
            <strong>{t.pdpServiceLabel}:</strong> {t.pdpServiceNote}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 700 }}>{t.pdpNotesTitle}</p>
          <ul className="pw-pdp-notes">
            <li>{t.pdpNoteFit}</li>
            <li>{t.pdpNoteColor}</li>
          </ul>

          {sizeOptions.length ? (
            <div style={{ marginTop: 16 }} data-pw-el={PW_EL.variant}>
              <p style={{ fontWeight: 700, margin: '0 0 8px', fontSize: 14 }}>{t.sizeLabel}</p>
              <div className="pw-pdp-pills">
                {sizeOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pw-pdp-pill${size === s ? ' is-active' : ''}`}
                    onClick={() => setSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
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
                  href={partnerSiteInfoPath(siteSlug, 'size-guide', { customDomain: custom })}
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
                zIndex: 100060,
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

          {colorOptions.length ? (
            <div style={{ marginTop: 16 }} data-pw-el={PW_EL.variant}>
              <p style={{ fontWeight: 700, margin: '0 0 8px', fontSize: 14 }}>{t.colorLabel}</p>
              <div className="pw-pdp-pills">
                {colorOptions.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={`pw-pdp-pill pw-pdp-color${color === c.name ? ' is-active' : ''}`}
                    onClick={() => setColor(c.name)}
                  >
                    {c.img ? <img src={shopCardDisplaySrc(c.img) || c.img} alt={c.name} /> : c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <p style={{ fontWeight: 700, margin: '0 0 8px', fontSize: 14 }}>{t.pdpQtyBuy}</p>
            {qtyStepper}
          </div>
          {lineTotal != null ? (
            <div className="pw-pdp-total">
              <span>{t.pdpLineTotal}</span>
              <span className="pw-shop-price" style={{ fontSize: '1.15rem' }}>
                {formatPartnerShopMoneyVnd(lineTotal)}
              </span>
            </div>
          ) : null}
          {savings > 0 ? (
            <p className="pw-pdp-save">{t.pdpSavings.replace('{amount}', formatPartnerShopMoneyVnd(savings))}</p>
          ) : null}

          {options?.deposit_policy ? (
            <p className="pw-shop-muted" style={{ marginTop: 12, fontSize: 13 }}>
              {t.depositPolicyNote}
            </p>
          ) : null}

          <div ref={buyActionsRef} className="pw-pdp-actions pw-pdp-actions-inline">
            <button type="button" className="pw-shop-btn pw-shop-btn-cart" disabled={!ready || busy} onClick={() => setVariantModalOpen(true)} data-pw-el={PW_EL.cardCart}>
              {t.addToCart}
            </button>
            <button type="button" className="pw-shop-btn pw-shop-btn-buy" disabled={!ready || busy} onClick={() => setVariantModalOpen(true)} data-pw-el={PW_EL.buy}>
              {t.buyNow}
            </button>
            <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => openConsult(consultCtx)} data-pw-el={PW_EL.cta}>
              {t.consultChat}
            </button>
            <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => openTryOn(consultCtx)} data-pw-el={PW_EL.cta}>
              {t.tryOnLink}
            </button>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              disabled={!ready || favoriteBusy}
              onClick={() => void toggleFavorite()}
              aria-pressed={isFavorite}
              data-pw-el={PW_EL.wishlist}
            >
              {isFavorite ? '♥' : '♡'} {likesCount}
            </button>
          </div>
          {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
        </div>
      </div>

      <section className="pw-shop-product-detail" data-pw-region={PW_REGION.pdpInfo}>
        <div className="pw-pdp-tabs" data-pw-pdp-slot="tabs">
          <div className="pw-pdp-tablist" role="tablist">
            <button
              type="button"
              className={`pw-pdp-tab${pdpTab === 'description' ? ' is-active' : ''}`}
              onClick={() => setPdpTab('description')}
            >
              {t.pdpDescTab}
            </button>
            <button
              type="button"
              className={`pw-pdp-tab${pdpTab === 'specs' ? ' is-active' : ''}`}
              onClick={() => setPdpTab('specs')}
            >
              {t.pdpSpecsTab}
            </button>
          </div>
          {pdpTab === 'description' ? (
            <div className="pw-pdp-tabpanel pw-pdp-tabpanel-desc" style={{ display: 'block' }}>
              {showDetailDescription && descHtml ? (
                <div>
                  <h2>{t.productDescriptionTitle}</h2>
                  <div
                    className="pw-shop-product-detail-body"
                    data-pw-el={PW_EL.desc}
                    dangerouslySetInnerHTML={{ __html: descHtml }}
                  />
                </div>
              ) : null}
              {detailImageUrls.length > 0 ? (
                <div data-pw-pdp-slot="detail-images">
                  <h2>{t.pdpDetailImagesHeading}</h2>
                  <div className="pw-pdp-detail-photos">
                    {detailImageUrls.map((url) => (
                      <img key={url} src={url} alt={product.name} loading="lazy" />
                    ))}
                  </div>
                </div>
              ) : null}
              {attrGridHtml ? <div dangerouslySetInnerHTML={{ __html: attrGridHtml }} /> : null}
              {materialImageUrl ? (
                <div data-pw-pdp-slot="material">
                  <h2>{t.pdpMaterialImagesTitle}</h2>
                  <div className="pw-shop-detail-grid">
                    <img src={materialImageUrl} alt={product.name} loading="lazy" />
                  </div>
                </div>
              ) : null}
              {realUseImageUrls.length > 0 ? (
                <div data-pw-pdp-slot="real-use">
                  <h2>{t.pdpRealUseImagesTitle}</h2>
                  <div className="pw-shop-detail-grid">
                    {realUseImageUrls.map((url) => (
                      <img key={url} src={url} alt={product.name} loading="lazy" />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className="pw-pdp-tabpanel pw-pdp-tabpanel-specs"
              style={{ display: 'block' }}
              dangerouslySetInnerHTML={{ __html: specsHtml }}
            />
          )}
        </div>
      </section>

      <PartnerSiteProductReviewsQa siteSlug={siteSlug} inventoryId={product.id} locale={locale} />

      <PartnerSiteRelatedProducts
        siteSlug={siteSlug}
        locale={locale}
        products={relatedProducts}
        categoryPath={product.categoryPath}
      />

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
          {photoUrls.length > 1 ? (
            <>
              <button
                type="button"
                className="pw-shop-lightbox-nav pw-shop-lightbox-prev"
                onClick={(e) => {
                  e.stopPropagation()
                  goToMedia(-1)
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
                  goToMedia(1)
                }}
                aria-label={t.lightboxNext}
              >
                ›
              </button>
            </>
          ) : null}
          <img
            src={activeImage}
            alt={productName}
            className={lightboxZoomed ? 'is-zoomed' : ''}
            onClick={(e) => {
              e.stopPropagation()
              setLightboxZoomed((z) => !z)
            }}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          />
          {photoUrls.length > 1 ? (
            <div className="pw-shop-lightbox-dots" onClick={(e) => e.stopPropagation()}>
              {photoUrls.map((url) => (
                <span key={url} className={url === activeImage ? 'is-active' : ''} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {stickyBar}

      <PartnerSiteProductVariantModal
        open={variantModalOpen}
        locale={locale}
        product={{
          name: productName,
          sku,
          imageUrl: displayImage,
          priceHint: priceLabel,
          priceAmount: product.priceAmount,
          salePriceAmount: product.salePriceAmount,
          saleStartsAt: product.saleStartsAt,
          saleEndsAt: product.saleEndsAt,
          stockQty: product.stockQty,
          colors: colorOptions,
          sizes: sizeOptions,
        }}
        initialColor={color}
        initialSize={size}
        initialQty={quantity}
        sizeGuideHref={partnerSiteInfoPath(siteSlug, 'size-guide', { customDomain: custom })}
        onOpenSizeGuide={product.sizeGuideImageUrl ? () => setSizeGuideOpen(true) : undefined}
        busy={busy}
        onClose={() => setVariantModalOpen(false)}
        onAddToCart={(pick) => {
          setColor(pick.color)
          setSize(pick.size)
          setQuantity(pick.quantity)
          setVariantModalOpen(false)
          void addLine(false, pick)
        }}
        onBuyNow={(pick) => {
          setColor(pick.color)
          setSize(pick.size)
          setQuantity(pick.quantity)
          setVariantModalOpen(false)
          void addLine(true, pick)
        }}
      />
      <PartnerSiteCartAddedModal
        open={Boolean(cartAdded)}
        item={cartAdded}
        cartHref={partnerSiteCartPath(siteSlug, { customDomain })}
        copy={{
          cartAddedTitle: t.cartAddedTitle,
          cartGoToCart: t.cartGoToCart,
          cartContinueShopping: t.cartContinueShopping,
          cartAddedClose: t.cartAddedClose,
        }}
        onClose={() => setCartAdded(null)}
      />
    </div>
  )
}
