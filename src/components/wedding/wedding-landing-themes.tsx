'use client'

import Link from 'next/link'
import { useState } from 'react'
import { WeddingSampleScrollPreview } from '@/components/wedding/wedding-sample-scroll-preview'

/** Mobile: 2 cột × 3 hàng. Desktop: 2 hàng × 4 cột, rồi mới bấm xem hết. */
const MOBILE_FIRST = 6
const DESKTOP_FIRST = 8

export function WeddingLandingThemes(props: {
  themes: { id: string; title: string; image: string }[]
  moreLabel: string
  lessLabel: string
  openLabel: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {props.themes.map((theme, index) => (
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
              href={`/thiep-mau/${theme.id}`}
              className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100"
            >
              <WeddingSampleScrollPreview src={theme.image} eager={index < DESKTOP_FIRST} />
              <span className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-950">{theme.title}</span>
                <span className="shrink-0 text-xs font-semibold text-rose-700">{props.openLabel}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {props.themes.length > MOBILE_FIRST ? (
        <button
          type="button"
          className={`mt-4 h-11 rounded-full bg-rose-700 px-5 text-sm font-semibold text-white${!open && props.themes.length <= DESKTOP_FIRST ? ' lg:hidden' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? props.lessLabel : props.moreLabel}
        </button>
      ) : null}
    </div>
  )
}
