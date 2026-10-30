'use client'

import Link from 'next/link'
import { useState } from 'react'

const FIRST_COUNT = 6

export function WeddingLandingThemes(props: {
  themes: { id: string; title: string; image: string }[]
  moreLabel: string
  lessLabel: string
  openLabel: string
}) {
  const [open, setOpen] = useState(false)
  const shown = open ? props.themes : props.themes.slice(0, FIRST_COUNT)
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((theme) => (
          <li key={theme.id}>
            <Link
              href={`/thiep-mau/${theme.id}`}
              className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100"
            >
              <img src={theme.image} alt="" className="aspect-[3/4] w-full object-cover" />
              <span className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-950">{theme.title}</span>
                <span className="shrink-0 text-xs font-semibold text-rose-700">{props.openLabel}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {props.themes.length > FIRST_COUNT ? (
        <button
          type="button"
          className="mt-4 h-11 rounded-full bg-rose-700 px-5 text-sm font-semibold text-white"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? props.lessLabel : props.moreLabel}
        </button>
      ) : null}
    </div>
  )
}
