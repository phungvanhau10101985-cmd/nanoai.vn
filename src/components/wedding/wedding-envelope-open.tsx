'use client'

import { cn } from '@/lib/utils'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'

const FLAP_MS = 1000

/** Phong bì đóng, chạm dấu sáp thì nắp hé lên một nhịp. */
export function WeddingEnvelopeOpen(props: {
  groomName: string
  brideName: string
  invitationLabel: string
  openLabel: string
  ornament: string
  theme: WeddingTheme
  opening: boolean
  onOpen: () => void
}) {
  return (
    <div className="mx-auto w-[min(24rem,88vw)]" style={{ perspective: '1200px' }}>
      <div className="relative min-h-[22rem] overflow-hidden rounded-[1.35rem] bg-[#fffaf3] shadow-[0_18px_50px_rgba(70,42,20,0.18)] ring-1 ring-black/10">
        <div className={cn('flex min-h-[22rem] flex-col items-center justify-end px-6 pb-7 pt-[13.25rem] text-center', props.theme.text)}>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#7a624c]">{props.invitationLabel}</p>
          <p className="mt-2 font-serif text-[1.65rem] font-semibold italic leading-tight text-[#2f241f] sm:text-3xl">
            {props.groomName} & {props.brideName}
          </p>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[52%] origin-top"
          style={{
            background: 'linear-gradient(180deg, #f6ead8 0%, #fff8ee 72%)',
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            boxShadow: '0 10px 18px rgba(80, 48, 20, 0.08)',
            transform: props.opening ? 'rotateX(-180deg)' : 'rotateX(0deg)',
            transition: `transform ${FLAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            zIndex: props.opening ? 1 : 2,
          }}
        />
        <button
          type="button"
          aria-label={props.openLabel}
          disabled={props.opening}
          onClick={props.onOpen}
          className={cn(
            props.theme.button,
            'absolute left-1/2 top-[46%] z-10 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full text-xl',
          )}
          style={{
            opacity: props.opening ? 0 : 1,
            transform: `translate(-50%, -50%) scale(${props.opening ? 0.86 : 1})`,
            transition: 'opacity 480ms ease, transform 480ms ease',
          }}
        >
          {props.ornament}
        </button>
      </div>
    </div>
  )
}

export const WEDDING_ENVELOPE_OPEN_MS = FLAP_MS
