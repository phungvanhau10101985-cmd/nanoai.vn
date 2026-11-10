'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { LanguageLandingMode } from '@/lib/hoc-ngoai-ngu/landing-copy'

export function LanguageModeSwitch({
  modes,
}: {
  modes: LanguageLandingMode[]
}) {
  const [active, setActive] = useState<LanguageLandingMode['id']>(modes[0]?.id ?? 'live')
  const current = modes.find((mode) => mode.id === active) ?? modes[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={modes.map((mode) => mode.name).join(', ')}>
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-pressed={active === mode.id}
            onClick={() => setActive(mode.id)}
            className={active === mode.id
              ? 'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white'
              : 'rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold'}
          >
            {mode.name}
          </button>
        ))}
      </div>
      {current ? (
        <div className={current.id === 'live' ? 'mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4' : 'mt-4 rounded-lg border border-slate-200 p-4'}>
          <p className="text-sm font-semibold">{current.name}</p>
          <p className="mt-1 text-lg font-bold">{current.price}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{current.detail}</p>
          <Link href={current.href} className="mt-4 inline-flex h-11 items-center rounded-md bg-slate-800 px-5 text-sm font-semibold text-white">
            {current.action}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
