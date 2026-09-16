'use client'

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import {
  shopProductToCartCard,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import { mergeSiteCartLine, parseSiteCartLines, type SiteCartLine } from '@/lib/partner-website/shop/cart-line-utils'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  buildPartnerShopLoginHref,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { queuePartnerSitePendingCart } from '@/lib/partner-website/shop/partner-site-pending-cart'
import { returnFromPartnerShopCartAdd } from '@/lib/partner-website/shop/partner-site-cart-add-return'
import {
  partnerSiteCartApiPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteProductPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteAddToCart,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PartnerSiteProductVariantModal } from '@/components/partner-website/shop/partner-site-product-variant-modal'
import { shopPdpPageSrc } from '@/lib/partner-website/shop/inventory-shop-detail'

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  product: PartnerSiteShopProduct | null
  fromNanoAi: boolean
}

export function PartnerSiteCartAddClient({ siteSlug, locale, product, fromNanoAi }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const router = useRouter()
  const customDomain = usePartnerSiteCustomDomain()
  const { refreshCartCount, tracking } = usePartnerSiteShop()
  const { isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [open, setOpen] = useState(() => Boolean(product))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const homeHref = partnerSiteHomePath(siteSlug, { customDomain })
  const productHref = product
    ? partnerSiteProductPath(siteSlug, product.id, { name: product.name, customDomain })
    : homeHref
  const cartHref = partnerSiteCartPath(siteSlug, { customDomain })

  useLayoutEffect(() => {
    if (!product) return
    setOpen(true)
  }, [product])

  const goPurchaseLogin = useCallback(() => {
    window.location.assign(
      buildPartnerShopLoginHref(
        siteSlug,
        getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }),
        { customDomain }
      )
    )
  }, [customDomain, siteSlug])

  const closeModal = useCallback(() => {
    setOpen(false)
    returnFromPartnerShopCartAdd({
      fromNanoAi,
      fallbackHref: fromNanoAi ? homeHref : productHref,
    })
  }, [fromNanoAi, homeHref, productHref])

  const addLine = useCallback(
    async (pick: { color: string; size: string; quantity: number; imageUrl: string }) => {
      if (!product || busy) return
      const nextImage = pick.imageUrl.trim() || product.imageUrl
      if (!isAuthenticated) {
        queuePartnerSitePendingCart(
          siteSlug,
          {
            inventory_id: product.id,
            name: product.name,
            image_url: nextImage,
            product_url: product.productUrl,
            price_hint: product.priceHint,
            sku: product.sku,
            color: pick.color,
            size: pick.size,
            quantity: pick.quantity,
          },
          { buyNow: true }
        )
        goPurchaseLogin()
        return
      }
      setBusy(true)
      setMessage('')
      try {
        const card = shopProductToCartCard({ ...product, imageUrl: nextImage })
        const line: SiteCartLine = {
          id: crypto.randomUUID(),
          card,
          quantity: Math.max(1, Math.min(99, pick.quantity)),
          color: pick.color,
          size: pick.size,
          note: '',
          ...(nextImage ? { variantLineImages: [nextImage] } : {}),
        }
        const cartRes = await fetch(partnerSiteCartApiPath(siteSlug), {
          credentials: 'same-origin',
          headers: authHeaders(),
        })
        captureFromResponse(cartRes)
        if (cartRes.status === 401) {
          queuePartnerSitePendingCart(
            siteSlug,
            {
              inventory_id: product.id,
              name: product.name,
              image_url: nextImage,
              product_url: product.productUrl,
              price_hint: product.priceHint,
              sku: product.sku,
              color: pick.color,
              size: pick.size,
              quantity: pick.quantity,
            },
            { buyNow: true }
          )
          goPurchaseLogin()
          return
        }
        const cartJson = (await cartRes.json()) as { items?: unknown }
        const existing = parseSiteCartLines(cartJson.items)
        const merged = mergeSiteCartLine(existing, line)
        const saveRes = await fetch(partnerSiteCartApiPath(siteSlug), {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ items: merged }),
        })
        captureFromResponse(saveRes)
        if (saveRes.status === 401) {
          queuePartnerSitePendingCart(
            siteSlug,
            {
              inventory_id: product.id,
              name: product.name,
              image_url: nextImage,
              product_url: product.productUrl,
              price_hint: product.priceHint,
              sku: product.sku,
              color: pick.color,
              size: pick.size,
              quantity: pick.quantity,
            },
            { buyNow: true }
          )
          goPurchaseLogin()
          return
        }
        if (!saveRes.ok) {
          setMessage(t.authFailed)
          return
        }
        await refreshCartCount()
        trackPartnerSiteAddToCart(tracking, shopProductToTrackingProduct(product, product.priceHint), line.quantity)
        setOpen(false)
        router.push(cartHref)
      } finally {
        setBusy(false)
      }
    },
    [
      authHeaders,
      busy,
      captureFromResponse,
      cartHref,
      goPurchaseLogin,
      isAuthenticated,
      product,
      refreshCartCount,
      router,
      siteSlug,
      t.authFailed,
      tracking,
    ]
  )

  const variantProduct = useMemo(() => {
    if (!product) return null
    return {
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      priceHint: product.priceHint,
      priceAmount: product.priceAmount,
      salePriceAmount: product.salePriceAmount,
      saleStartsAt: product.saleStartsAt,
      saleEndsAt: product.saleEndsAt,
      isClearance: product.isClearance,
      siteSale: product.siteSale,
      siteSalePhase: product.siteSalePhase,
      siteSalePercent: product.siteSalePercent,
      siteSaleExpectedPrice: product.siteSaleExpectedPrice,
      birthdayOfferPercent: product.birthdayOfferPercent,
      birthdayOfferEndsAt: product.birthdayOfferEndsAt,
      birthdayOffer: product.birthdayOffer,
      stockQty: product.stockQty,
      colors: product.colors,
      sizes: product.sizes,
    }
  }, [product])

  if (!product || !variantProduct) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t.catalogEmpty}</p>
        <a href={homeHref} className="mt-4 inline-block text-sm font-semibold text-[var(--pw-primary)]">
          {t.navHome}
        </a>
      </div>
    )
  }

  const thumb = shopPdpPageSrc(product.imageUrl) || product.imageUrl

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="flex gap-3 rounded-lg border border-[var(--pw-border,#e5e7eb)] bg-[var(--pw-surface,#fff)] p-3">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-20 w-20 rounded object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{product.name}</p>
          {product.priceHint ? <p className="mt-1 text-sm text-[var(--pw-primary)]">{product.priceHint}</p> : null}
        </div>
      </div>
      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
      <PartnerSiteProductVariantModal
        open={open}
        locale={locale}
        product={variantProduct}
        busy={busy}
        disablePortal
        onClose={closeModal}
        onAddToCart={(pick) => {
          void addLine(pick)
        }}
        onBuyNow={(pick) => {
          void addLine(pick)
        }}
      />
    </div>
  )
}
