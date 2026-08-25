'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import type { CartAddedModalCopy } from '@/lib/partner-website/shop/partner-site-cart-added-modal'

export type PartnerSiteCartAddedItem = {
  name: string
  imageUrl?: string | null
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

  useEffect(() => {
    setReady(true)
  }, [])

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

  if (!open || !item || !ready || typeof document === 'undefined') return null

  const name = item.name.trim() || '—'
  const image = shopCardDisplaySrc(item.imageUrl)

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
          <div data-pw-cart-added-thumb>
            {image ? <img src={image} alt={name} width={48} height={48} draggable={false} /> : null}
          </div>
          <div data-pw-cart-added-copy>
            <p data-pw-cart-added-title id="pw-cart-added-title">
              {copy.cartAddedTitle}
            </p>
            <p data-pw-cart-added-name>{name}</p>
          </div>
          <button type="button" data-pw-cart-added-close aria-label={copy.cartAddedClose} onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div data-pw-cart-added-actions>
          <Link href={cartHref} data-pw-cart-added-go onClick={onClose}>
            <span aria-hidden>🛒</span>
            <span>{copy.cartGoToCart}</span>
          </Link>
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
