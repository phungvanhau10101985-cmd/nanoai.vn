'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { InvitationOccasionKey } from '@/lib/wedding/invitation-occasion'
import { normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { WeddingOccasionDemoBar } from '@/components/wedding/wedding-sample-card-picker'
import { WeddingSampleScrollPreview } from '@/components/wedding/wedding-sample-scroll-preview'

/** Mobile: 2 cột × 3 hàng. Desktop: 2 hàng × 4 cột, rồi mới bấm xem hết. */
const MOBILE_FIRST = 6
const DESKTOP_FIRST = 8

export function WeddingLandingThemes(props: {
  locale: WebLocale
  themes: { id: string; title: string; image: string; cover: string; occasionKey: string }[]
  moreLabel: string
  lessLabel: string
  openLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [occasion, setOccasion] = useState<InvitationOccasionKey>('wedding')
  const themes = props.themes.filter((theme) => normalizeInvitationOccasion(theme.occasionKey) === occasion)
  return (
    <div>
      <WeddingOccasionDemoBar locale={props.locale} value={occasion} onChange={(key) => { setOccasion(key); setOpen(false) }} />
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {themes.map((theme, index) => (
          <li
            key={theme.id}
            className={
              open || index < MOBILE_FIRST
                ? undefined
                : index < DESKTOP_FIRST
                  ? 'hidden lg:block'
                  : 'hidden'
            }
          >
            <Link
              href={`/thiep-mau/${theme.id}?occasion=${encodeURIComponent(theme.occasionKey)}`}
              className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100"
            >
              <LandingFace image={theme.image} cover={theme.cover} eager={index < DESKTOP_FIRST} />
              <span className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-950">{theme.title}</span>
                <span className="shrink-0 text-xs font-semibold text-rose-700">{props.openLabel}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {themes.length > MOBILE_FIRST ? (
        <button
          type="button"
          className={`mt-4 h-11 rounded-full bg-rose-700 px-5 text-sm font-semibold text-white${!open && themes.length <= DESKTOP_FIRST ? ' lg:hidden' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? props.lessLabel : props.moreLabel}
        </button>
      ) : null}
    </div>
  )
}

function LandingFace(props: { image: string; cover: string; eager?: boolean }) {
  const [src, setSrc] = useState(props.image)
  return (
    <WeddingSampleScrollPreview
      src={src}
      eager={props.eager}
      onError={() => {
        if (src !== props.cover) setSrc(props.cover)
      }}
    />
  )
}
