'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PW_SHOP_SOFT_NAV_EVENT } from '@/components/partner-website/shop/partner-site-soft-nav-relay'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import { PartnerSiteProductHitLink } from '@/components/partner-website/shop/partner-site-product-hit-link'
import type { CartAddedModalCopy } from '@/lib/partner-website/shop/partner-site-cart-added-modal'

export type PartnerSiteCartAddedItem = {
  name: string
  imageUrl?: string | null
  productHref?: string | null
}

type Props = {
  open: boolean
  item: PartnerSiteCartAddedItem | null
  cartHref: string
  copy: CartAddedModalCopy
  onClose: () => void
}

export function PartnerSiteCartAddedModal({ open, item, cartHref, copy, onClose }: Props) {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    const onSoftNav = () => onClose()
    document.addEventListener('keydown', onKey)
    window.addEventListener(PW_SHOP_SOFT_NAV_EVENT, onSoftNav)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      window.removeEventListener(PW_SHOP_SOFT_NAV_EVENT, onSoftNav)
    }
  }, [open, onClose])

  if (!open || !item || !ready || typeof document === 'undefined') return null

  const name = item.name.trim() || '—'
  const image = shopCardDisplaySrc(item.imageUrl)
  const productHref = String(item.productHref || '').trim()

  return createPortal(
    <div
      data-pw-cart-added-popup="1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-cart-added-title"
    >
      <div data-pw-cart-added-backdrop onClick={onClose} aria-hidden />
      <div data-pw-cart-added-card onClick={(e) => e.stopPropagation()}>
        <div data-pw-cart-added-head>
          {image ? (
            <div data-pw-cart-added-thumb>
              {productHref ? (
                <PartnerSiteProductHitLink
                  href={productHref}
                  aria-label={name}
                  data-pw-cart-added-pdp="1"
                  onPointerDown={onClose}
                  onClick={onClose}
                >
                  <img src={image} alt={name} width={48} height={48} draggable={false} />
                </PartnerSiteProductHitLink>
              ) : (
                <img src={image} alt={name} width={48} height={48} draggable={false} />
              )}
            </div>
          ) : (
            <div data-pw-cart-added-thumb />
          )}
          <div data-pw-cart-added-copy>
            <p data-pw-cart-added-title id="pw-cart-added-title">
              {copy.cartAddedTitle}
            </p>
            <p data-pw-cart-added-name>
              <PartnerSiteProductHitLink
                href={productHref}
                data-pw-cart-added-pdp="1"
                onPointerDown={onClose}
                onClick={onClose}
              >
                {name}
              </PartnerSiteProductHitLink>
            </p>
          </div>
          <button type="button" data-pw-cart-added-close aria-label={copy.cartAddedClose} onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div data-pw-cart-added-actions>
          <a href={cartHref} data-pw-cart-added-go onPointerDown={onClose} onClick={onClose}>
            <span aria-hidden>🛒</span>
            <span>{copy.cartGoToCart}</span>
          </a>
          <button type="button" data-pw-cart-added-stay onClick={onClose}>
            <span aria-hidden>🛍️</span>
            <span>{copy.cartContinueShopping}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
