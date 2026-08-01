'use client'

import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveGuestInviteMapUrl } from '@/lib/wedding/google-maps-embed-url'
import { formatGuestInviteVenueDateTime } from '@/lib/wedding/wedding-calendar-utils'
import { getWeddingMapButtonColors } from '@/lib/wedding/wedding-theme'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

type Props = {
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  cordiallyInvitesLabel: string
  venueLabel: string
  weddingDateLabel?: string
  weddingTimeText?: string
  addressText?: string
  mapUrl?: string
  viewMapLabel: string
  weddingThemeId?: string
  className?: string
  panelClassName?: string
  cordiallyClassName?: string
  nameClassName?: string
  venueClassName?: string
  venueDateTimeClassName?: string
  addressClassName?: string
  personalInviteText?: string
  personalInviteClassName?: string
  compact?: boolean
}

export function WeddingGuestInviteBlock(props: Props) {
  const name = props.guestName.trim()
  if (!name) return null
  const venue = props.venueLabel.trim()
  const venueDateTime = formatGuestInviteVenueDateTime(props.weddingDateLabel, props.weddingTimeText)
  const address = props.addressText?.trim() ?? ''
  const mapsHref = resolveGuestInviteMapUrl(props.mapUrl ?? '', address)
  const mapColors = getWeddingMapButtonColors(props.weddingThemeId)

  return (
    <div className={cn(props.className)}>
      <div className={cn('rounded-2xl p-3 ring-1 ring-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:rounded-3xl sm:p-4', props.panelClassName)}>
        <p className={cn('text-xs sm:text-sm', props.cordiallyClassName)}>{props.cordiallyInvitesLabel}</p>
        <p
          className={cn(
            'mt-1 font-semibold',
            props.compact ? 'text-base' : 'text-lg sm:text-xl',
            props.nameClassName,
          )}
        >
          {name}
        </p>
        {venue ? (
          <>
            <p className={cn('mt-1 font-medium sm:mt-2', props.compact ? 'text-xs' : 'text-xs sm:text-sm', props.venueClassName)}>
              {venue}
            </p>
            {venueDateTime ? (
              <p
                className={cn(
                  'mt-0.5 font-medium',
                  props.compact ? 'text-[11px]' : 'text-xs sm:text-sm',
                  props.venueDateTimeClassName ?? props.venueClassName,
                )}
              >
                {venueDateTime}
              </p>
            ) : null}
          </>
        ) : null}
        {address ? (
          <p
            className={cn(
              'mt-1 flex items-start justify-center gap-1.5 text-left leading-relaxed sm:mt-2',
              props.compact ? 'text-xs' : 'text-xs sm:text-sm',
              props.addressClassName,
            )}
          >
            <MapPin className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', props.compact && 'h-3.5 w-3.5')} aria-hidden />
            <span>{address}</span>
          </p>
        ) : null}
        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            style={{
              backgroundColor: mapColors.bg,
              color: mapColors.text,
              borderColor: mapColors.border,
              textShadow: mapColors.text === '#ffffff' ? '0 1px 3px rgba(0,0,0,0.45)' : undefined,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = mapColors.hoverBg
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = mapColors.bg
            }}
            className={cn(
              'relative z-20 mx-auto mt-2 inline-flex w-fit max-w-full items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 font-bold tracking-wide',
              'no-underline antialiased shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-all hover:shadow-md active:scale-[0.98]',
              props.compact ? 'min-h-8 text-[11px] leading-snug' : 'min-h-9 text-xs leading-snug sm:text-sm',
            )}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: mapColors.text }} aria-hidden />
            <span className="text-center">{props.viewMapLabel}</span>
          </a>
        ) : null}
        {props.personalInviteText?.trim() ? (
          <p
            className={cn(
              'mt-3 whitespace-pre-line border-t border-white/20 pt-3 text-left text-xs leading-relaxed sm:text-sm',
              props.personalInviteClassName ?? props.cordiallyClassName,
            )}
          >
            {props.personalInviteText.trim()}
          </p>
        ) : null}
      </div>
    </div>
  )
}
