'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { InvitationOccasionKey } from '@/lib/wedding/invitation-occasion'
import { normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { WeddingOccasionDemoBar } from '@/components/wedding/wedding-sample-card-picker'
import { WeddingSampleScrollPreview } from '@/components/wedding/wedding-sample-scroll-preview'
import { cn } from '@/lib/utils'

/** Editor trống: điện thoại 2×3, desktop 2×4. Landing: 2×2, tablet 3×2, desktop 2×4. */
const EDITOR_PHONE = 6
const EDITOR_TABLET = 6
const LANDING_PHONE = 4
const LANDING_TABLET = 6
const DESKTOP_FIRST = 8

function cardVisibility(open: boolean, index: number, phone: number, tablet: number, desktop: number) {
  if (open || index < phone) return undefined
  if (index < tablet) return 'hidden md:block'
  if (index < desktop) return 'hidden lg:block'
  return 'hidden'
}

function moreVisibility(open: boolean, count: number, phone: number, tablet: number, desktop: number) {
  if (count <= phone) return 'hidden'
  if (open) return ''
  return cn(count <= tablet && 'md:hidden', count <= desktop && 'lg:hidden')
}

export function WeddingLandingThemes(props: {
  locale: WebLocale
  themes: { id: string; title: string; image: string; cover: string; occasionKey: string }[]
  moreLabel: string
  lessLabel: string
  openLabel: string
  /** Trang khách: lưới ngắn hơn, nút chạm 44px. Công cụ giữ lưới cũ. */
  variant?: 'editor' | 'landing'
}) {
  const [open, setOpen] = useState(false)
  const [occasion, setOccasion] = useState<InvitationOccasionKey>('wedding')
  const landing = props.variant === 'landing'
  const phone = landing ? LANDING_PHONE : EDITOR_PHONE
  const tablet = landing ? LANDING_TABLET : EDITOR_TABLET
  const themes = props.themes.filter((theme) => normalizeInvitationOccasion(theme.occasionKey) === occasion)
  return (
    <div className="min-w-0">
      <WeddingOccasionDemoBar
        locale={props.locale}
        value={occasion}
        variant={landing ? 'landing' : 'editor'}
        onChange={(key) => {
          setOccasion(key)
          setOpen(false)
        }}
      />
      <ul className={landing ? 'mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4' : 'mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4'}>
        {themes.map((theme, index) => (
          <li key={theme.id} className={cardVisibility(open, index, phone, tablet, DESKTOP_FIRST)}>
            <Link
              href={`/thiep-mau/${theme.id}?occasion=${encodeURIComponent(theme.occasionKey)}`}
              className={
                landing
                  ? 'block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 active:scale-[0.99]'
                  : 'block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100'
              }
            >
              <span className="relative block">
                <LandingFace
                  image={theme.image}
                  cover={theme.cover}
                  eager={index < (landing ? LANDING_PHONE : DESKTOP_FIRST)}
                  fetchPriority={landing && index < 2 ? 'high' : undefined}
                  aspectClassName={landing ? 'aspect-[3/4] lg:aspect-[3/5]' : undefined}
                />
                {landing ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-11 items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2.5 pb-2.5 pt-10">
                    <span className="min-w-0 truncate text-sm font-semibold text-white">{theme.title}</span>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-rose-700">{props.openLabel}</span>
                  </span>
                ) : null}
              </span>
              {landing ? null : (
                <span className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-950">{theme.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-rose-700">{props.openLabel}</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {themes.length > phone ? (
        <button
          type="button"
          className={cn(
            landing
              ? 'mt-4 inline-flex h-12 w-full touch-manipulation items-center justify-center rounded-full bg-rose-700 px-5 text-sm font-semibold text-white active:scale-[0.99] sm:w-auto'
              : 'mt-4 h-11 rounded-full bg-rose-700 px-5 text-sm font-semibold text-white',
            moreVisibility(open, themes.length, phone, tablet, DESKTOP_FIRST),
          )}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? props.lessLabel : props.moreLabel}
        </button>
      ) : null}
    </div>
  )
}

function LandingFace(props: {
  image: string
  cover: string
  eager?: boolean
  fetchPriority?: 'high' | 'low' | 'auto'
  aspectClassName?: string
}) {
  const [src, setSrc] = useState(props.image)
  return (
    <WeddingSampleScrollPreview
      src={src}
      eager={props.eager}
      fetchPriority={props.fetchPriority}
      aspectClassName={props.aspectClassName}
      onError={() => {
        if (src !== props.cover) setSrc(props.cover)
      }}
    />
  )
}
