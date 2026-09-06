'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  nextShopImageRetrySrc,
  shopPdpDisplaySrc,
  shopPdpPageSrc,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import {
  formatPartnerShopMoneyVnd,
  isPartnerFlashSaleActive,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import {
  formatPartnerSaleCountdownCompact,
  formatPartnerSaleMoney,
  partnerSiteSaleCopy,
  partnerSiteSalePillText,
  resolvePartnerProductSaleFace,
  type PartnerSiteSalePricing,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import {
  PRODUCT_VARIANT_MODAL_COPY,
  resolveVariantModalFace,
  variantModalMaxQty,
  variantModalShowsLowStock,
  type ProductVariantModalCopy,
} from '@/lib/partner-website/shop/partner-site-product-variant-modal'
import type { WebLocale } from '@/lib/i18n/config'

export type PartnerSiteVariantModalColor = { name: string; img?: string | null }

export type PartnerSiteVariantModalProduct = {
  name: string
  sku?: string | null
  imageUrl?: string | null
  priceHint?: string | null
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  isClearance?: boolean
  siteSalePhase?: 'off' | 'teaser' | 'active' | null
  siteSalePercent?: number | null
  siteSaleExpectedPrice?: number | null
  siteSale?: PartnerSiteSalePricing | null
  stockQty?: number | null
  colors?: PartnerSiteVariantModalColor[] | null
  sizes?: string[] | null
}

function hideBrokenVariantImage(ev: { currentTarget: HTMLImageElement }) {
  const img = ev.currentTarget
  const retry = nextShopImageRetrySrc(img.currentSrc || img.getAttribute('src') || '')
  if (retry && img.getAttribute('data-pw-img-retry') !== '1') {
    img.setAttribute('data-pw-img-retry', '1')
    img.src = retry
    return
  }
  img.setAttribute('data-pw-pdp-img-broken', '1')
  img.hidden = true
}

type Props = {
  open: boolean
  locale: WebLocale
  product: PartnerSiteVariantModalProduct
  initialColor?: string
  initialSize?: string
  initialQty?: number
  sizeGuideHref?: string | null
  onOpenSizeGuide?: () => void
  busy?: boolean
  onClose: () => void
  onAddToCart: (pick: { color: string; size: string; quantity: number; imageUrl: string }) => void
  onBuyNow: (pick: { color: string; size: string; quantity: number; imageUrl: string }) => void
  copy?: ProductVariantModalCopy
}

function ColorChips({
  colors,
  selected,
  onPick,
}: {
  colors: PartnerSiteVariantModalColor[]
  selected: number
  onPick: (i: number) => void
}) {
  return (
    <div data-pw-variant-chips>
      {colors.map((color, i) => {
        const src = shopPdpPageSrc(color.img)
        const fullSrc = shopPdpDisplaySrc(color.img)
        return (
          <button
            key={`${color.name}-${i}`}
            type="button"
            data-pw-variant-color
            aria-pressed={selected === i}
            onClick={() => onPick(i)}
          >
            <span data-pw-variant-swatch>
              {src ? (
                <img
                  src={src}
                  data-pw-full-src={fullSrc || undefined}
                  alt=""
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onError={hideBrokenVariantImage}
                />
              ) : null}
            </span>
            <span data-pw-variant-color-name>{color.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export function PartnerSiteProductVariantModal({
  open,
  locale,
  product,
  initialColor,
  initialSize,
  initialQty,
  sizeGuideHref,
  onOpenSizeGuide,
  busy,
  onClose,
  onAddToCart,
  onBuyNow,
  copy: copyProp,
}: Props) {
  const copy = copyProp ?? PRODUCT_VARIANT_MODAL_COPY[locale] ?? PRODUCT_VARIANT_MODAL_COPY.en
  const colors = useMemo(
    () => (product.colors ?? []).filter((c) => String(c.name || '').trim()),
    [product.colors]
  )
  const sizes = useMemo(
    () => (product.sizes ?? []).map((s) => String(s || '').trim()).filter(Boolean),
    [product.sizes]
  )
  const [ready, setReady] = useState(false)
  const [face, setFace] = useState<'wide' | 'compact'>('compact')
  const [colorIndex, setColorIndex] = useState(0)
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [saleCount, setSaleCount] = useState('')

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const idx = colors.findIndex((c) => c.name === initialColor)
    setColorIndex(idx >= 0 ? idx : colors.length ? 0 : -1)
    setSize(initialSize && sizes.includes(initialSize) ? initialSize : sizes[0] || '')
    setQty(Math.max(1, Math.round(Number(initialQty) || 1)))
  }, [open, colors, sizes, initialColor, initialSize, initialQty])

  useEffect(() => {
    if (!open) return
    const readFace = () => {
      const html = document.documentElement
      let queryDevice = ''
      try {
        queryDevice = new URLSearchParams(location.search).get('pw-device') || ''
      } catch {
        queryDevice = ''
      }
      setFace(
        resolveVariantModalFace({
          editDevice: html.getAttribute('data-pw-edit-device'),
          sceneLock: html.getAttribute('data-pw-scene-lock'),
          queryDevice,
          viewportMinMd: window.matchMedia('(min-width:768px)').matches,
        })
      )
    }
    readFace()
    const mq = window.matchMedia('(min-width:768px)')
    mq.addEventListener('change', readFace)
    return () => mq.removeEventListener('change', readFace)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const maxQty = variantModalMaxQty(product.stockQty)
  const effectiveQty = Math.min(maxQty, Math.max(1, qty))
  const showStock = variantModalShowsLowStock(product.stockQty)
  const stockQty = Math.max(0, Math.round(Number(product.stockQty) || 0))
  const saleFace = resolvePartnerProductSaleFace(product)
  const saleCopy = partnerSiteSaleCopy(locale)
  const siteSaleKind = product.siteSale?.phase ?? (product.siteSalePhase === 'teaser' || product.siteSalePhase === 'active' ? product.siteSalePhase : null)
  const showSiteSale = (siteSaleKind === 'teaser' || siteSaleKind === 'active') && saleFace.kind === siteSaleKind

  useEffect(() => {
    if (!open || !showSiteSale || !saleFace.countdownTo) {
      setSaleCount('')
      return
    }
    const tick = () => setSaleCount(formatPartnerSaleCountdownCompact(saleFace.countdownTo))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [open, showSiteSale, saleFace.countdownTo])
  const pillText = showSiteSale ? partnerSiteSalePillText(saleFace, locale) : null
  const flashActive =
    saleFace.kind === 'active' ||
    isPartnerFlashSaleActive({
      priceAmount: product.priceAmount ?? null,
      salePriceAmount: product.salePriceAmount ?? null,
      saleStartsAt: product.saleStartsAt ?? null,
      saleEndsAt: product.saleEndsAt ?? null,
    })
  const unitPrice =
    saleFace.kind
      ? saleFace.displayPrice
      : flashActive && product.salePriceAmount != null
        ? product.salePriceAmount
        : product.priceAmount != null && Number.isFinite(product.priceAmount)
          ? product.priceAmount
          : null
  const priceLabel =
    unitPrice != null ? formatPartnerShopMoneyVnd(unitPrice) : String(product.priceHint || '').trim()
  const lineLabel =
    unitPrice != null ? formatPartnerShopMoneyVnd(unitPrice * effectiveQty) : priceLabel
  const lineSavings = showSiteSale && saleFace.savings > 0 ? saleFace.savings * effectiveQty : 0
  const lineSaveText =
    lineSavings > 0
      ? (saleFace.kind === 'teaser' ? saleCopy.teaserSave : saleCopy.save).replace(
          '{amount}',
          formatPartnerSaleMoney(lineSavings, locale)
        )
      : ''
  const selectedColor = colorIndex >= 0 ? colors[colorIndex] : null
  const displayImage = shopPdpPageSrc(selectedColor?.img || product.imageUrl)
  const sku = String(product.sku || '').trim()
  const name = product.name.trim() || '—'

  function confirm(buyNow: boolean) {
    const pick = {
      color: selectedColor?.name || '',
      size,
      quantity: effectiveQty,
      imageUrl: selectedColor?.img || product.imageUrl || '',
    }
    if (buyNow) onBuyNow(pick)
    else onAddToCart(pick)
  }

  if (!open || !ready || typeof document === 'undefined') return null

  const sizeGuide =
    sizes.length && (onOpenSizeGuide || sizeGuideHref) ? (
      onOpenSizeGuide ? (
        <button type="button" data-pw-variant-size-guide onClick={onOpenSizeGuide}>
          {copy.sizeGuide}
        </button>
      ) : (
        <a data-pw-variant-size-guide href={sizeGuideHref || '#'}>
          {copy.sizeGuide}
        </a>
      )
    ) : null

  const priceBlock = showSiteSale ? (
    <div data-pw-variant-sale data-pw-sale-phase={saleFace.kind || undefined}>
      {pillText ? (
        <span data-pw-variant-sale-pill>
          {saleFace.kind === 'teaser' ? '⏳ ' : '🔥 '}
          {pillText}
        </span>
      ) : null}
      {saleCount ? (
        <div data-pw-variant-sale-count>
          ⏱{' '}
          {(saleFace.kind === 'teaser' ? saleCopy.countdownStarts : saleCopy.countdownLeft).replace(
            '{label}',
            saleFace.eventLabel || (saleFace.kind === 'teaser' ? saleCopy.teaserFallback : saleCopy.activeFallback)
          )}{' '}
          <strong data-pw-sale-hms>{saleCount}</strong>
        </div>
      ) : null}
      <p data-pw-variant-price-label>
        {saleFace.kind === 'teaser' ? saleCopy.listPriceLabel : saleCopy.offerPriceLabel}
      </p>
      <div data-pw-variant-price-row>
        {priceLabel ? <p data-pw-variant-price>{priceLabel}</p> : null}
        {saleFace.kind === 'teaser' && saleFace.expectedPrice != null ? (
          <span data-pw-variant-expected>
            <span>{saleCopy.expectedPrice}</span> {formatPartnerSaleMoney(saleFace.expectedPrice, locale)}
          </span>
        ) : null}
        {saleFace.kind === 'active' && saleFace.comparePrice != null ? (
          <span data-pw-variant-compare>{formatPartnerSaleMoney(saleFace.comparePrice, locale)}</span>
        ) : null}
        {saleFace.savings > 0 ? (
          <span data-pw-variant-save-chip>
            {(saleFace.kind === 'teaser' ? saleCopy.teaserSave : saleCopy.save).replace(
              '{amount}',
              formatPartnerSaleMoney(saleFace.savings, locale)
            )}
          </span>
        ) : null}
        {saleFace.percent > 0 ? <span data-pw-variant-pct>-{saleFace.percent}%</span> : null}
      </div>
    </div>
  ) : priceLabel ? (
    <p data-pw-variant-price>{priceLabel}</p>
  ) : null

  const lineTotal = (
    <div data-pw-variant-total>
      <span data-pw-variant-total-label>{copy.lineTotal.replace('{n}', String(effectiveQty))}</span>
      <span data-pw-variant-total-price>
        {lineLabel}
        {lineSaveText ? <span data-pw-variant-total-save>{lineSaveText}</span> : null}
      </span>
    </div>
  )

  const colorSection = colors.length ? (
    <div data-pw-variant-section>
      <p data-pw-variant-label>{copy.color}</p>
      <ColorChips colors={colors} selected={colorIndex} onPick={setColorIndex} />
    </div>
  ) : null

  const sizeSection = sizes.length ? (
    <div data-pw-variant-section>
      <div data-pw-variant-size-row>
        <p data-pw-variant-label>{copy.size}</p>
        {sizeGuide}
      </div>
      <div data-pw-variant-chips>
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            data-pw-variant-size
            aria-pressed={size === s}
            onClick={() => setSize(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  ) : null

  const qtyWide = (
    <div data-pw-variant-section>
      <p data-pw-variant-label>{copy.qty}</p>
      <div data-pw-variant-stepper>
        <button
          type="button"
          data-pw-variant-step
          disabled={effectiveQty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          -
        </button>
        <span data-pw-variant-qty>{effectiveQty}</span>
        <button
          type="button"
          data-pw-variant-step
          disabled={effectiveQty >= maxQty}
          onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
        >
          +
        </button>
      </div>
      {lineTotal}
    </div>
  )

  const qtyCompact = (
    <div data-pw-variant-section>
      <p data-pw-variant-label>{copy.qty}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div data-pw-variant-compact-step>
          <button
            type="button"
            data-pw-variant-step
            disabled={effectiveQty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            -
          </button>
          <span data-pw-variant-qty>{effectiveQty}</span>
          <button
            type="button"
            data-pw-variant-step
            disabled={effectiveQty >= maxQty}
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
          >
            +
          </button>
        </div>
        {showStock ? (
          <span data-pw-variant-remain>
            ({copy.stockLeftShort.replace('{n}', String(stockQty))})
          </span>
        ) : null}
      </div>
      {lineTotal}
    </div>
  )

  return createPortal(
    <div
      data-pw-variant-modal="1"
      data-pw-variant-face={face}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-variant-title"
    >
      <div data-pw-variant-backdrop onClick={onClose} aria-hidden />
      <div data-pw-variant-card onClick={(e) => e.stopPropagation()}>
        <div data-pw-variant-head>
          <button type="button" data-pw-variant-close aria-label={copy.close} onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div data-pw-variant-body>
          <h2 id="pw-variant-title" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {copy.title}
          </h2>
          <div data-pw-variant-wide>
            <div data-pw-variant-hero>
              {displayImage ? <img src={displayImage} alt={name} onError={hideBrokenVariantImage} /> : null}
            </div>
            <div data-pw-variant-info>
              {sku ? <p data-pw-variant-sku>{copy.sku.replace('{sku}', sku)}</p> : null}
              <p data-pw-variant-name>{name}</p>
              {priceBlock}
              {showStock ? (
                <p data-pw-variant-stock>
                  <span data-pw-variant-stock-icon aria-hidden>
                    ★
                  </span>
                  {copy.stockLeft.replace('{n}', String(stockQty))}
                </p>
              ) : null}
              {colorSection}
              {sizeSection}
              {qtyWide}
            </div>
          </div>
          <div data-pw-variant-compact>
            <div data-pw-variant-compact-top>
              <div data-pw-variant-thumb>
                {displayImage ? <img src={displayImage} alt={name} onError={hideBrokenVariantImage} /> : null}
              </div>
              <div data-pw-variant-info>
                {sku ? <p data-pw-variant-sku>{copy.skuShort.replace('{sku}', sku)}</p> : null}
                <p data-pw-variant-name>{name}</p>
                {priceBlock}
                {showStock ? (
                  <p data-pw-variant-stock>
                    <span data-pw-variant-stock-icon aria-hidden>
                      ★
                    </span>
                    {copy.stockLeftShort.replace('{n}', String(stockQty))}
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              {colorSection}
              {sizeSection}
              {qtyCompact}
            </div>
          </div>
        </div>
        <div data-pw-variant-foot>
          <button type="button" data-pw-variant-add disabled={busy} onClick={() => confirm(false)}>
            {copy.add}
          </button>
          <button type="button" data-pw-variant-buy disabled={busy} onClick={() => confirm(true)}>
            {copy.buy}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
