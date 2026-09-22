'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PW_LISTING_FACET_MODAL_ATTR,
  PW_LISTING_FACET_TRIGGER_ATTR,
} from '@/lib/partner-website/shop/partner-site-listing-facet-picker'

export type ListingFacetPickerOption = { value: string; label: string }

type Props = {
  label: string
  value: string
  options: ListingFacetPickerOption[]
  emptyLabel?: string
  closeLabel: string
  onChange: (value: string) => void
  facet?: string
  el?: string
  includeEmpty?: boolean
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function PartnerSiteListingFacetPicker({
  label,
  value,
  options,
  emptyLabel,
  closeLabel,
  onChange,
  facet,
  el = 'facet',
  includeEmpty = true,
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const current = options.find((o) => o.value === value)
  const display = current?.label || emptyLabel || label

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (!open) return
    document.documentElement.setAttribute('data-pw-listing-facet-open', '1')
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.removeAttribute('data-pw-listing-facet-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const rows: ListingFacetPickerOption[] =
    includeEmpty && emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options

  return (
    <>
      <button
        type="button"
        className="pw-listing-facet-trigger"
        {...{ [PW_LISTING_FACET_TRIGGER_ATTR]: '1' }}
        data-pw-el={el}
        data-pw-facet={facet}
        aria-haspopup="dialog"
        aria-expanded={open || undefined}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        {display}
      </button>
      {open && ready
        ? createPortal(
            <div
              {...{ [PW_LISTING_FACET_MODAL_ATTR]: '1' }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <button
                type="button"
                {...{ [`${PW_LISTING_FACET_MODAL_ATTR}-backdrop`]: '1' }}
                aria-label={closeLabel}
                onClick={() => setOpen(false)}
              />
              <div {...{ [`${PW_LISTING_FACET_MODAL_ATTR}-card`]: '1' }}>
                <div {...{ [`${PW_LISTING_FACET_MODAL_ATTR}-head`]: '1' }}>
                  <h3 id={titleId} {...{ [`${PW_LISTING_FACET_MODAL_ATTR}-title`]: '1' }}>
                    {label}
                  </h3>
                  <button
                    type="button"
                    {...{ [`${PW_LISTING_FACET_MODAL_ATTR}-close`]: '1' }}
                    aria-label={closeLabel}
                    onClick={() => setOpen(false)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div {...{ [`${PW_LISTING_FACET_MODAL_ATTR}-list`]: '1' }} role="listbox" aria-label={label}>
                  {rows.map((row) => {
                    const selected = (row.value || '') === (value || '')
                    return (
                      <button
                        key={row.value || '__all__'}
                        type="button"
                        className={`pw-listing-facet-option${selected ? ' is-selected' : ''}`}
                        role="option"
                        aria-selected={selected}
                        data-pw-listing-facet-option={row.value}
                        onClick={() => {
                          setOpen(false)
                          if (row.value !== value) onChange(row.value)
                        }}
                      >
                        {row.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
