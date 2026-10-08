'use client'

import { MapPin } from 'lucide-react'
import { WeddingGuestNameFontLink, renderWeddingGuestName, WEDDING_GUEST_NAME_CLASS } from '@/components/wedding/wedding-guest-name-font'
import { cn } from '@/lib/utils'
import { resolveGuestInviteMapUrl } from '@/lib/wedding/google-maps-embed-url'
import { formatGuestInviteVenueDateTime } from '@/lib/wedding/wedding-calendar-utils'
import { getWeddingMapButtonColors, isWeddingDarkTheme } from '@/lib/wedding/wedding-theme'
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
  /** Vỏ thiệp trên điện thoại: chữ và lề sát hơn để nút còn trong màn. */
  dense?: boolean
  /** Trong thiệp đã mở: từng dòng hiện lần lượt sau tên cô dâu chú rể. */
  scriptLines?: boolean
}

export function WeddingGuestInviteBlock(props: Props) {
  const name = props.guestName.trim()
  if (!name) return null
  const venue = props.venueLabel.trim()
  const venueDateTime = formatGuestInviteVenueDateTime(props.weddingDateLabel, props.weddingTimeText)
  const address = props.addressText?.trim() ?? ''
  const mapsHref = resolveGuestInviteMapUrl(props.mapUrl ?? '', address)
  const mapColors = getWeddingMapButtonColors(props.weddingThemeId)

  const guestNameClass = cn(WEDDING_GUEST_NAME_CLASS, 'text-[1.45em] leading-none', props.nameClassName)

  return (
    <div className={cn(props.className)}>
      <WeddingGuestNameFontLink />
      <div
        className={cn(
          'rounded-2xl shadow-none ring-0 sm:rounded-3xl',
          props.dense ? 'p-1.5 sm:p-2' : 'p-3 sm:p-4',
          props.scriptLines && 'wedding-open-line wedding-open-guest',
          props.panelClassName,
          'bg-transparent shadow-none ring-0',
        )}
        style={{
          background: isWeddingDarkTheme(props.weddingThemeId)
            ? 'radial-gradient(ellipse 40% 46% at 50% 48%, rgba(15,23,42,0.64) 0%, rgba(15,23,42,0.24) 64%, transparent 100%)'
            : 'radial-gradient(ellipse 40% 46% at 50% 48%, rgba(255,252,247,0.8) 0%, rgba(255,248,236,0.36) 64%, transparent 100%)',
          boxShadow: 'none',
        }}
      >
        <p className={cn('text-xs sm:text-sm', props.scriptLines && 'wedding-open-line wedding-open-cordial', props.cordiallyClassName)}>{props.cordiallyInvitesLabel}</p>
        <p
          className={cn(
            WEDDING_GUEST_NAME_CLASS,
            'mt-1 break-words',
            props.compact ? 'text-[1.65rem]' : props.dense ? 'text-[1.7rem] leading-none sm:text-[2rem]' : 'text-[2.15rem] sm:text-[2.55rem]',
            props.scriptLines && 'wedding-open-guest-name',
            props.nameClassName,
          )}
        >
          {name}
        </p>
        {props.personalInviteText?.trim() ? (
          <p
            className={cn(
              'mx-auto max-w-prose whitespace-pre-line text-center',
              props.dense ? 'mt-1.5' : 'mt-3',
              props.compact ? 'text-[11px] leading-relaxed' : props.dense ? 'text-[13px] leading-5' : 'text-xs leading-6 sm:text-sm',
              props.scriptLines && 'wedding-open-line wedding-open-invite',
              props.personalInviteClassName ?? props.cordiallyClassName,
            )}
          >
            {renderWeddingGuestName(props.personalInviteText.trim(), name, guestNameClass)}
          </p>
        ) : null}
        {venue ? (
          <>
            <p className={cn('mt-1 font-medium sm:mt-2', props.compact ? 'text-xs' : 'text-xs sm:text-sm', props.scriptLines && 'wedding-open-line wedding-open-venue', props.venueClassName)}>
              {venue}
            </p>
            {venueDateTime ? (
              <p
                className={cn(
                  'mt-0.5 font-medium',
                  props.compact ? 'text-[11px]' : 'text-xs sm:text-sm',
                  props.scriptLines && 'wedding-open-line wedding-open-when',
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
              props.scriptLines && 'wedding-open-line wedding-open-address',
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
              'relative z-20 mx-auto inline-flex w-fit max-w-full items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 font-bold tracking-wide',
              props.dense ? 'mt-1.5' : 'mt-2',
              'no-underline antialiased shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-all hover:shadow-md active:scale-[0.98]',
              props.compact ? 'min-h-8 text-[11px] leading-snug' : 'min-h-9 text-xs leading-snug sm:text-sm',
              props.scriptLines && 'wedding-open-line wedding-open-map',
            )}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: mapColors.text }} aria-hidden />
            <span className="text-center">{props.viewMapLabel}</span>
          </a>
        ) : null}
      </div>
    </div>
  )
}
