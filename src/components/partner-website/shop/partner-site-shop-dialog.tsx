'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  closeLabel: string
  children: ReactNode
}

export function PartnerSiteShopDialog({ open, title, onClose, closeLabel, children }: Props) {
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

  if (!open || !ready) return null

  return createPortal(
    <div className="pw-shop-address-modal" role="dialog" aria-modal="true" aria-labelledby="pw-shop-address-modal-title">
      <button type="button" className="pw-shop-address-modal-backdrop" aria-label={closeLabel} onClick={onClose} />
      <div className="pw-shop-address-modal-card">
        <div className="pw-shop-address-modal-head">
          <h3 id="pw-shop-address-modal-title">{title}</h3>
          <button type="button" className="pw-shop-address-modal-close" aria-label={closeLabel} onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
