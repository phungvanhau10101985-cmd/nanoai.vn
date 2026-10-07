'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import { getWeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingCoupleNames } from '@/components/wedding/wedding-couple-names'
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
  /** Một nhịp phóng nhẹ rồi dừng. Chỉ thiệp công khai khi bật hiệu ứng. */
  breathe?: boolean
  /** Tên chú rể từ trái, tên cô dâu từ phải, ghép vào giữa. */
  namesFlyIn?: boolean
  onOpen?: () => void
  /** Có tên khách + RSVP bật: trả lời ngay trên vỏ, không cần mở thiệp. */
  quickRsvp?: {
    yesLabel: string
    noLabel: string
    savedYesLabel: string
    savedNoLabel: string
    busy?: boolean
    choice?: 'yes' | 'no' | null
    onYes: () => void
    onNo: () => void
  }
}

const COVER_INTRO_NODES =
  '.wedding-couple-from-left, .wedding-couple-from-right, .wedding-couple-amp, .wedding-couple-ornament, .wedding-invite-body-join, .wedding-cover-photo-open'

type CoverIntroWindow = Window & { __weddingCoverIntroAt?: number }

/** Hiệu ứng vỏ chỉ chạy sau khi hydrate, và lần gắn DOM sau vẫn nối tiếp đúng thời điểm — không mở lại từ đầu. */
function useCoverIntroOnce(enabled: boolean) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [play, setPlay] = useState(() => {
    if (!enabled) return true
    if (typeof window === 'undefined') return false
    return (window as CoverIntroWindow).__weddingCoverIntroAt != null
  })

  useLayoutEffect(() => {
    if (!enabled) return
    const w = window as CoverIntroWindow
    if (w.__weddingCoverIntroAt == null) w.__weddingCoverIntroAt = performance.now()
    setPlay(true)
  }, [enabled])

  useLayoutEffect(() => {
    if (!enabled || !play) return
    const started = (window as CoverIntroWindow).__weddingCoverIntroAt
    if (started == null) return
    const elapsed = performance.now() - started
    const root = rootRef.current
    if (!root) return
    root.querySelectorAll<HTMLElement>(COVER_INTRO_NODES).forEach((node) => {
      for (const anim of node.getAnimations()) anim.currentTime = elapsed
    })
  }, [enabled, play])

  return { rootRef, hold: enabled && !play }
}

function CoverActions(props: {
  themeId: string
  compact?: boolean
  className?: string
  openLabel: string
  onOpen?: () => void
  quickRsvp?: WeddingCoverShellCardProps['quickRsvp']
}) {
  const rsvp = props.quickRsvp
  const size = props.compact ? 'h-8 px-3 text-[10px]' : 'h-11 px-4 text-sm'
  const yesOn = rsvp?.choice === 'yes'
  const noOn = rsvp?.choice === 'no'
  return (
    <div className={cn('flex flex-col items-center gap-2', props.className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {props.onOpen ? (
          <WeddingSolidCtaButton weddingThemeId={props.themeId} compact={props.compact} onClick={props.onOpen}>
            {props.openLabel}
          </WeddingSolidCtaButton>
        ) : (
          <WeddingSolidCtaButton
            weddingThemeId={props.themeId}
            compact={props.compact}
            className="pointer-events-none"
            tabIndex={-1}
            aria-hidden
          >
            {props.openLabel}
          </WeddingSolidCtaButton>
        )}
        {rsvp ? (
          <>
            <button
              type="button"
              disabled={rsvp.busy}
              aria-pressed={yesOn}
              onClick={rsvp.onYes}
              className={cn(
                'inline-flex items-center justify-center rounded-full border-2 font-bold shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-transform active:scale-[0.98] disabled:opacity-60',
                yesOn
                  ? 'border-emerald-950 bg-emerald-800 text-white ring-2 ring-emerald-200 ring-offset-2 ring-offset-[#fff8f0]'
                  : 'border-emerald-800 bg-emerald-800 text-white',
                size,
              )}
            >
              {rsvp.yesLabel}
            </button>
            <button
              type="button"
              disabled={rsvp.busy}
              aria-pressed={noOn}
              onClick={rsvp.onNo}
              className={cn(
                'inline-flex items-center justify-center rounded-full border-2 font-bold shadow-[0_6px_18px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] disabled:opacity-60',
                noOn
                  ? 'border-stone-800 bg-stone-800 text-white ring-2 ring-stone-300 ring-offset-2 ring-offset-[#fff8f0]'
                  : 'border-stone-400/90 bg-white/90 text-stone-800',
                size,
              )}
            >
              {rsvp.noLabel}
            </button>
          </>
        ) : null}
      </div>
      {rsvp?.choice ? (
        <p
          className={cn(
            'font-medium',
            rsvp.choice === 'yes' ? 'text-emerald-950' : 'text-stone-700',
            props.compact ? 'text-[9px]' : 'text-xs',
          )}
          role="status"
        >
          {rsvp.choice === 'yes' ? rsvp.savedYesLabel : rsvp.savedNoLabel}
        </p>
      ) : null}
    </div>
  )
}

function CoverPhoto(props: {
  url: string
  alt: string
  compact?: boolean
  className?: string
  objectPosition?: string
  scale?: number
  breathe?: boolean
  /** Ảnh vỏ hiện từ từ lúc thiệp mở, cùng nhịp tên bay vào. */
  openSlowly?: boolean
}) {
  if (!props.url.trim()) return null
  const objectPosition = props.objectPosition ?? '50% 50%'
  const scale = Math.max(1, Math.min(3, props.scale ?? 1))
  return (
    <div
      className={cn(
        'mx-auto w-full overflow-hidden shadow-md ring-1 ring-black/5',
        props.compact ? 'h-24 rounded-lg' : 'h-[clamp(11rem,32dvh,15rem)] rounded-2xl lg:h-[clamp(13rem,38dvh,17rem)]',
        props.openSlowly && 'wedding-cover-photo-open',
        props.className,
      )}
    >
      <div className={cn('h-full w-full', props.breathe && !props.compact && 'wedding-cover-breathe')}>
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
    </div>
  )
}

function GlassCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  return (
    <WeddingReadableGlass
      theme={theme}
      strength="hero"
      className={cn(
        'w-full text-center',
        compact ? 'max-w-[200px] rounded-[1.2rem] p-3' : 'rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6 lg:p-5',
        props.namesFlyIn && !compact && 'overflow-visible',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div ref={intro.rootRef}>
      <p className={cn('uppercase tracking-[0.28em] sm:tracking-[0.35em]', compact ? 'text-[8px]' : 'text-[11px] sm:text-xs', theme.accentText, theme.textGlow)}>
        {props.invitationLabel}
      </p>
      <WeddingCoupleNames
        groomName={props.groomName}
        brideName={props.brideName}
        flyIn={props.namesFlyIn && !compact}
        className={cn('font-serif font-semibold italic', compact ? 'mt-2 text-base leading-tight' : 'mt-2 text-[clamp(1.05rem,8cqi,2.65rem)] leading-none sm:mt-3', theme.text, theme.textGlowHeading)}
      />
      <div className={cn(theme.accent, compact ? 'my-2 text-lg' : 'my-2 text-2xl sm:my-3 sm:text-3xl lg:my-2', props.namesFlyIn && !compact && 'wedding-couple-ornament', theme.textGlow)}>{theme.ornament}</div>
      {props.coverPhotoUrl ? (
        <div className={compact ? 'my-2' : 'my-2 sm:my-3 lg:my-2'}>
          <CoverPhoto
            url={props.coverPhotoUrl}
            alt={props.photoAlt}
            compact={compact}
            objectPosition={props.coverPhotoObjectPosition}
            scale={props.coverPhotoScale}
            breathe={props.breathe}
            openSlowly={props.namesFlyIn && !compact}
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
          className={cn(compact ? 'mt-2' : 'mt-2 sm:mt-3 lg:mt-2', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
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
      <CoverActions
        themeId={theme.id}
        compact={compact}
        className={compact ? 'mt-3' : 'mt-3 sm:mt-4 lg:mt-3'}
        openLabel={props.openButtonLabel}
        onOpen={props.onOpen}
        quickRsvp={props.quickRsvp}
      />
      </div>
    </WeddingReadableGlass>
  )
}

function RedArchCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const preset = getWeddingCoverPreset(props.presetId)
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  return (
    <div
      ref={intro.rootRef}
      className={cn(
        'w-full text-center shadow-2xl ring-1 ring-black/10 [container-type:inline-size]',
        props.namesFlyIn && !compact ? 'overflow-visible' : 'overflow-hidden',
        compact ? 'max-w-[200px] rounded-[1.2rem]' : 'max-w-md rounded-[1.5rem] sm:rounded-[2rem]',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div
        className={cn(compact ? 'px-3 pb-2 pt-3' : 'px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6')}
        style={{ background: preset.thumbnail.topBg }}
      >
        <p className={cn('uppercase tracking-[0.28em] text-white/90', compact ? 'text-[7px]' : 'text-[10px]')}>
          {props.invitationLabel}
        </p>
        <WeddingCoupleNames
          groomName={props.groomName}
          brideName={props.brideName}
          flyIn={props.namesFlyIn && !compact}
          className={cn('font-serif font-semibold text-white', compact ? 'mt-1 text-sm' : 'mt-2 text-[clamp(1.05rem,8cqi,2.35rem)] leading-none sm:mt-3')}
        />
        <div className={cn('text-amber-300', compact ? 'my-1 text-base' : 'my-2 text-xl sm:my-3 sm:text-2xl', props.namesFlyIn && !compact && 'wedding-couple-ornament')}>{preset.ornament}</div>
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
            className={compact ? 'h-28' : 'h-[clamp(12rem,34dvh,16rem)] lg:h-[clamp(14rem,40dvh,18rem)]'}
            objectPosition={props.coverPhotoObjectPosition}
            scale={props.coverPhotoScale}
            breathe={props.breathe}
            openSlowly={props.namesFlyIn && !compact}
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
            className={cn('mt-2 lg:mt-2', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
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
        <CoverActions
          themeId={theme.id}
          compact={compact}
          className={compact ? 'mt-2' : 'mt-2 sm:mt-3 lg:mt-2'}
          openLabel={props.openButtonLabel}
          onOpen={props.onOpen}
          quickRsvp={props.quickRsvp}
        />
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
