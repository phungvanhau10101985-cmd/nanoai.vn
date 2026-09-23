'use client'

import { useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteCartAddedModal } from '@/components/partner-website/shop/partner-site-cart-added-modal'
import { PartnerSiteProductVariantModal } from '@/components/partner-website/shop/partner-site-product-variant-modal'
import { CART_ADDED_MODAL_COPY } from '@/lib/partner-website/shop/partner-site-cart-added-modal'
import { mergeSiteCartLine, type SiteCartLine } from '@/lib/partner-website/shop/cart-line-utils'
import { shopProductToCartCard, type PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { queuePartnerSitePendingCart } from '@/lib/partner-website/shop/partner-site-pending-cart'
import { buildPartnerShopLoginHref } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { partnerSiteCartApiPath, partnerSiteCartPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

function shopOriginIsCustom(siteSlug: string): boolean {
  return !window.location.pathname.startsWith(`/site/${siteSlug}`)
}

function withCurrentSearch(path: string): string {
  const search = window.location.search
  if (!search || search === '?') return path
  return path.includes('?') ? `${path}&${search.slice(1)}` : `${path}${search}`
}

export function LandingSingleProductCta({
  siteSlug,
  locale,
  inventoryId,
  productName,
  imageUrl,
  priceHint,
  detailPath,
  label,
  className,
}: {
  siteSlug: string
  locale: WebLocale
  inventoryId: string
  productName: string
  imageUrl: string
  priceHint: string
  detailPath: string
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [product, setProduct] = useState<PartnerSiteShopProduct | null>(null)
  const [added, setAdded] = useState<{
    name: string
    imageUrl?: string | null
    productHref?: string | null
    cartHref: string
  } | null>(null)

  function fallbackProduct(): PartnerSiteShopProduct {
    return {
      id: inventoryId,
      name: productName,
      description: '',
      detailDescription: '',
      galleryImages: [],
      detailImages: [],
      productVideoUrl: null,
      priceHint,
      imageUrl,
      productUrl: detailPath,
      sku: '',
      detailPath,
      stockQty: 0,
      sizes: [],
      colors: [],
    }
  }

  async function openModal() {
    setOpen(true)
    if (product) return
    try {
      const res = await fetch(
        `/api/site/${encodeURIComponent(siteSlug)}/products/${encodeURIComponent(inventoryId)}?view=buy`,
        { credentials: 'same-origin' }
      )
      const json = (await res.json()) as { product?: PartnerSiteShopProduct }
      setProduct(json.product?.id ? json.product : fallbackProduct())
    } catch {
      setProduct(fallbackProduct())
    }
  }

  async function commit(buyNow: boolean, pick: { color: string; size: string; quantity: number; imageUrl: string }) {
    const current = product ?? fallbackProduct()
    if (busy) return
    const customDomain = shopOriginIsCustom(siteSlug)
    const returnPath = `${window.location.pathname}${window.location.search}`
    const pending = {
      inventory_id: current.id,
      name: current.name,
      image_url: pick.imageUrl || current.imageUrl,
      product_url: current.productUrl,
      price_hint: current.priceHint,
      sku: current.sku,
      color: pick.color,
      size: pick.size,
      quantity: pick.quantity,
    }
    setBusy(true)
    try {
      const cartRes = await fetch(partnerSiteCartApiPath(siteSlug), { credentials: 'same-origin' })
      if (cartRes.status === 401) {
        queuePartnerSitePendingCart(siteSlug, pending, { buyNow })
        window.location.assign(buildPartnerShopLoginHref(siteSlug, returnPath, { customDomain }))
        return
      }
      const cartJson = (await cartRes.json()) as { items?: SiteCartLine[] }
      const line: SiteCartLine = {
        id: crypto.randomUUID(),
        card: shopProductToCartCard({ ...current, imageUrl: pick.imageUrl || current.imageUrl }),
        quantity: Math.max(1, Math.min(99, pick.quantity)),
        color: pick.color,
        size: pick.size,
        note: '',
      }
      const merged = mergeSiteCartLine(Array.isArray(cartJson.items) ? cartJson.items : [], line)
      const saved = await fetch(partnerSiteCartApiPath(siteSlug), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: merged }),
      })
      if (saved.status === 401) {
        queuePartnerSitePendingCart(siteSlug, pending, { buyNow })
        window.location.assign(buildPartnerShopLoginHref(siteSlug, returnPath, { customDomain }))
        return
      }
      if (!saved.ok) return
      setOpen(false)
      const nextCartHref = withCurrentSearch(partnerSiteCartPath(siteSlug, { customDomain }))
      if (buyNow) {
        window.location.assign(nextCartHref)
        return
      }
      setAdded({
        name: current.name,
        imageUrl: pick.imageUrl || current.imageUrl,
        productHref: current.detailPath || detailPath,
        cartHref: nextCartHref,
      })
    } finally {
      setBusy(false)
    }
  }

  const modalProduct = product ?? (open ? fallbackProduct() : null)

  return (
    <>
      <button type="button" className={className} data-pw-el="cta" data-pw-ladipage-buy="1" onClick={() => void openModal()}>
        {label}
      </button>
      {modalProduct ? (
        <PartnerSiteProductVariantModal
          open={open}
          locale={locale}
          product={modalProduct}
          busy={busy}
          disablePortal
          onClose={() => setOpen(false)}
          onAddToCart={(pick) => void commit(false, pick)}
          onBuyNow={(pick) => void commit(true, pick)}
        />
      ) : null}
      <PartnerSiteCartAddedModal
        open={Boolean(added)}
        item={added}
        cartHref={added?.cartHref || partnerSiteCartPath(siteSlug)}
        copy={CART_ADDED_MODAL_COPY[locale]}
        onClose={() => setAdded(null)}
      />
    </>
  )
}
