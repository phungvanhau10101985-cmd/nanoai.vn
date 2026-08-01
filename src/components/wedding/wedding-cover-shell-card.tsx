'use client'

import { cn } from '@/lib/utils'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import { getWeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { WeddingSolidCtaButton } from '@/components/wedding/wedding-solid-cta-button'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

type WeddingCoverShellCardProps = {
  presetId: string
  coverPhotoUrl?: string
  coverPhotoObjectPosition?: string
  coverPhotoScale?: number
  groomName: string
  brideName: string
  weddingDate?: string | null
  weddingTimeText?: string
  guestName?: string
  guestInviteVenue?: WeddingGuestInviteVenue
  guestInviteVenueLabel?: string
  addressText?: string
  mapUrl?: string
  viewMapLabel?: string
  theme: WeddingTheme
  invitationLabel: string
  cordiallyInvitesLabel: string
  personalInviteText?: string
  openButtonLabel: string
  dateFallback: string
  photoAlt: string
  compact?: boolean
  onOpen?: () => void
}

function CoverPhoto(props: {
  url: string
  alt: string
  compact?: boolean
  className?: string
  objectPosition?: string
  scale?: number
}) {
  if (!props.url.trim()) return null
  const objectPosition = props.objectPosition ?? '50% 50%'
  const scale = Math.max(1, Math.min(3, props.scale ?? 1))
  return (
    <div
      className={cn(
        'mx-auto w-full overflow-hidden shadow-md ring-1 ring-black/5',
        props.compact ? 'h-24 rounded-lg' : 'h-[clamp(6.5rem,24svh,10rem)] rounded-2xl sm:h-56',
        props.className,
      )}
    >
      <img
        src={props.url}
        alt={props.alt}
        className="h-full w-full object-cover"
        style={{
          objectPosition,
          transform: `scale(${scale})`,
          transformOrigin: objectPosition,
        }}
      />
    </div>
  )
}

function GlassCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  return (
    <WeddingReadableGlass
      theme={theme}
      strength="hero"
      className={cn(
        'w-full text-center',
        compact ? 'max-w-[200px] rounded-[1.2rem] p-3' : 'max-w-md rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-8',
      )}
    >
      <p className={cn('uppercase tracking-[0.28em] sm:tracking-[0.35em]', compact ? 'text-[8px]' : 'text-[11px] sm:text-xs', theme.accentText, theme.textGlow)}>
        {props.invitationLabel}
      </p>
      <h1 className={cn('break-words font-serif font-semibold italic', compact ? 'mt-2 text-base leading-tight' : 'mt-3 text-3xl leading-tight sm:mt-6 sm:text-5xl', theme.text, theme.textGlowHeading)}>
        {props.groomName} & {props.brideName}
      </h1>
      <div className={cn(theme.accent, compact ? 'my-2 text-lg' : 'my-3 text-2xl sm:my-6 sm:text-3xl', theme.textGlow)}>{theme.ornament}</div>
      {props.coverPhotoUrl ? (
        <div className={compact ? 'my-2' : 'my-3 sm:my-5'}>
          <CoverPhoto
            url={props.coverPhotoUrl}
            alt={props.photoAlt}
            compact={compact}
            objectPosition={props.coverPhotoObjectPosition}
            scale={props.coverPhotoScale}
          />
        </div>
      ) : null}
      {!props.guestName ? (
        <p className={cn(compact ? 'text-[10px]' : 'text-xs sm:text-sm', theme.mutedText, theme.textGlow)}>
          {props.weddingDate || props.dateFallback}
        </p>
      ) : null}
      {props.guestName ? (
        <WeddingGuestInviteBlock
          className={compact ? 'mt-2' : 'mt-3 sm:mt-5'}
          guestName={props.guestName}
          inviteVenue={props.guestInviteVenue ?? ''}
          cordiallyInvitesLabel={props.cordiallyInvitesLabel}
          venueLabel={props.guestInviteVenueLabel ?? ''}
          weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
          weddingTimeText={props.weddingTimeText}
          addressText={props.addressText}
          mapUrl={props.mapUrl}
          viewMapLabel={props.viewMapLabel ?? ''}
          panelClassName={theme.panelStrong}
          cordiallyClassName={cn(theme.mutedText, theme.textGlow)}
          nameClassName={cn(theme.text, theme.textGlowHeading)}
          venueClassName={cn(theme.accentText, theme.textGlow)}
          addressClassName={cn(theme.mutedText, theme.textGlow)}
          weddingThemeId={theme.id}
          compact={compact}
          personalInviteText={props.personalInviteText}
          personalInviteClassName={cn(theme.mutedText, theme.textGlow)}
        />
      ) : null}
      {props.onOpen ? (
        <WeddingSolidCtaButton
          weddingThemeId={theme.id}
          compact={compact}
          className={compact ? 'mt-3' : 'mt-4 sm:mt-8'}
          onClick={props.onOpen}
        >
          {props.openButtonLabel}
        </WeddingSolidCtaButton>
      ) : (
        <WeddingSolidCtaButton
          weddingThemeId={theme.id}
          compact={compact}
          className={cn(compact ? 'mt-3' : 'mt-4 sm:mt-8', 'pointer-events-none')}
          tabIndex={-1}
          aria-hidden
        >
          {props.openButtonLabel}
        </WeddingSolidCtaButton>
      )}
    </WeddingReadableGlass>
  )
}

function RedArchCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const preset = getWeddingCoverPreset(props.presetId)
  return (
    <div
      className={cn(
        'w-full overflow-hidden text-center shadow-2xl ring-1 ring-black/10',
        compact ? 'max-w-[200px] rounded-[1.2rem]' : 'max-w-md rounded-[1.5rem] sm:rounded-[2rem]',
      )}
    >
      <div
        className={cn(compact ? 'px-3 pb-2 pt-3' : 'px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6')}
        style={{ background: preset.thumbnail.topBg }}
      >
        <p className={cn('uppercase tracking-[0.28em] text-white/90', compact ? 'text-[7px]' : 'text-[10px]')}>
          {props.invitationLabel}
        </p>
        <h1 className={cn('break-words font-serif font-semibold text-white', compact ? 'mt-1 text-sm' : 'mt-2 text-xl leading-tight sm:mt-3 sm:text-3xl')}>
          {props.groomName} & {props.brideName}
        </h1>
        <div className={cn('text-amber-300', compact ? 'my-1 text-base' : 'my-2 text-xl sm:my-3 sm:text-2xl')}>{preset.ornament}</div>
      </div>
      <div className="relative bg-[#fff8f0]/72 px-3 pb-3 pt-4 backdrop-blur-sm sm:px-5 sm:pb-5 sm:pt-5">
        <div
          className="pointer-events-none absolute -top-4 left-1/2 h-8 w-[108%] -translate-x-1/2 rounded-[100%] bg-[#fff8f0]/72 backdrop-blur-sm"
          aria-hidden
        />
        {props.coverPhotoUrl ? (
          <CoverPhoto
            url={props.coverPhotoUrl}
            alt={props.photoAlt}
            compact={compact}
            className={compact ? 'h-28' : 'h-[clamp(7rem,26svh,11rem)] sm:h-64'}
            objectPosition={props.coverPhotoObjectPosition}
            scale={props.coverPhotoScale}
          />
        ) : props.compact ? (
          <div
            className={cn(
              'mx-auto flex items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-white/80 text-rose-300',
              compact ? 'h-20 text-[9px]' : 'h-48 text-sm',
            )}
          >
            —
          </div>
        ) : null}
        {!props.guestName ? (
          <p className={cn('mt-2 sm:mt-3', compact ? 'text-[10px]' : 'text-xs sm:text-sm', theme.mutedText)}>
            {props.weddingDate || props.dateFallback}
          </p>
        ) : null}
        {props.guestName ? (
          <WeddingGuestInviteBlock
            className="mt-2 sm:mt-3"
            guestName={props.guestName}
            inviteVenue={props.guestInviteVenue ?? ''}
            cordiallyInvitesLabel={props.cordiallyInvitesLabel}
            venueLabel={props.guestInviteVenueLabel ?? ''}
            weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
            weddingTimeText={props.weddingTimeText}
            addressText={props.addressText}
            mapUrl={props.mapUrl}
            viewMapLabel={props.viewMapLabel ?? ''}
            panelClassName={cn('bg-white/75', theme.panelStrong)}
            cordiallyClassName={theme.mutedText}
            nameClassName={theme.text}
            venueClassName={theme.accentText}
            addressClassName={theme.mutedText}
            weddingThemeId={theme.id}
            compact={compact}
            personalInviteText={props.personalInviteText}
            personalInviteClassName={theme.mutedText}
          />
        ) : null}
        {props.onOpen ? (
          <WeddingSolidCtaButton
            weddingThemeId={theme.id}
            compact={compact}
            className={compact ? 'mt-2' : 'mt-3 sm:mt-5'}
            onClick={props.onOpen}
          >
            {props.openButtonLabel}
          </WeddingSolidCtaButton>
        ) : (
          <WeddingSolidCtaButton
            weddingThemeId={theme.id}
            compact={compact}
            className={cn(compact ? 'mt-2' : 'mt-3 sm:mt-5', 'pointer-events-none')}
            tabIndex={-1}
            aria-hidden
          >
            {props.openButtonLabel}
          </WeddingSolidCtaButton>
        )}
      </div>
    </div>
  )
}

export function WeddingCoverShellCard(props: WeddingCoverShellCardProps) {
  const preset = getWeddingCoverPreset(props.presetId)
  if (preset.layout === 'red_arch') {
    return <RedArchCoverCard {...props} />
  }
  return <GlassCoverCard {...props} />
}
