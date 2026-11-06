'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { CalendarDays, ImagePlus, Loader2, MapPin, Music, Send, Sparkles, Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { PublishedGuestRsvpSnapshot, WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { WeddingSideWish, WeddingSideWishGroups } from '@/lib/wedding/wedding-side-wishes'
import { submitWeddingGuestResponse, subscribeWeddingReminder } from './actions'
import { WeddingAlbumLightbox } from './wedding-album-lightbox'
import { WeddingAlbumGalleryGrid } from '@/components/wedding/wedding-album-grid'
import { WeddingAlbumStage } from '@/components/wedding/wedding-album-stage'
import { resolveWeddingAlbumLayoutId, WEDDING_ALBUM_LAYOUTS } from '@/lib/wedding/wedding-album-layouts'
import { WeddingInvitationAudio, type WeddingInvitationAudioHandle } from '@/components/wedding/wedding-invitation-audio'
import { WeddingMusicFabVisual } from '@/components/wedding/wedding-music-fab-visual'
import { WeddingMapEmbed } from '@/components/wedding/wedding-map-embed'
import { WeddingEventCalendarBlock } from '@/components/wedding/wedding-event-calendar-block'
import { WeddingCountdownBlock } from '@/components/wedding/wedding-countdown-block'
import { WeddingGiftEnvelopeBlock } from '@/components/wedding/wedding-gift-envelope-block'
import { WeddingGiftAccountsForm } from '@/components/wedding/wedding-gift-accounts-form'
import { useVietQrBanks } from '@/hooks/use-vietqr-banks'
import {
  applyInvitationCalendarCopy,
  applyInvitationGiftCopy,
  applyInvitationMusicCopy,
  applyInvitationOccasionPublicCopy,
  invitationCardStructure,
  invitationOccasionShape,
  invitationSeal,
  invitationShowsSecondVenue,
} from '@/lib/wedding/invitation-occasion'
import { WeddingInvitationShareActions } from '@/components/wedding/wedding-invitation-share-actions'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { shouldShowPublicGiftBoxForSide } from '@/lib/wedding/wedding-gift-vietqr'
import { weddingGiftBoxLook } from '@/lib/wedding/wedding-gift-box-look'
import { resolveWeddingDisplayTime } from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso, formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { bindWeddingButtonFill, resolveWeddingButtonColor } from '@/lib/wedding/wedding-button-colors'
import { getWeddingTheme, isWeddingDarkTheme, weddingBackgroundStyle, weddingNavLinkClass, weddingThemeIsDark, WEDDING_BG_OVERLAY } from '@/lib/wedding/wedding-theme'
import { WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { WeddingOrnamentAdminBar, WeddingOrnamentAdminLayer, weddingOrnamentSpotOnPage, weddingOrnamentVisibleSurface } from '@/components/wedding/wedding-ornament-admin'
import { applyWeddingSampleLook, loadWeddingPreviewTools, resetWeddingCardOrnaments, resetWeddingPresetOrnaments, saveWeddingCardOrnaments, saveWeddingPresetFrame, saveWeddingPresetOrnaments, saveWeddingPresetShell, saveWeddingPreviewEdit, saveWeddingPreviewMedia, saveWeddingTemplateFrame, saveWeddingTemplateShell } from '@/app/tao-thiep-moi-cuoi-ai/actions'
import { WeddingSampleGallery } from '@/components/wedding/wedding-sample-card-picker'
import { isWeddingSamplePhotoUrl } from '@/lib/wedding/wedding-sample-cards'
import { WeddingScrollingBackground } from '@/components/wedding/wedding-scrolling-background'
import { applyWeddingKitTheme, resolveWeddingChromeKit, weddingFramePatchForStyle, weddingHeroPhotoLayout, weddingKitSurface, weddingReadingPlate, weddingTextUsesVeil, weddingUsesPairedAiFrame, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { WeddingMusicLibraryPicker } from '@/components/wedding/wedding-music-library-picker'
import { WeddingFrameChoiceGrid, weddingSharedFrameFromChoice, type WeddingFrameChoice } from '@/components/wedding/wedding-frame-choice-grid'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import type { WeddingCoverFrameLibraryItem, WeddingMusicLibraryRow } from '@/lib/db/wedding-cards-pg'
import type { WeddingStackedPhotoEdit } from '@/components/wedding/wedding-stacked-couple-photos'
import { resolveWeddingShownOrnaments, weddingOrnamentLayoutKey, weddingOrnamentListsEqual } from '@/lib/wedding/wedding-background-ornament-store'
import { publishWeddingOrnamentTruth, subscribeWeddingOrnamentTruth } from '@/lib/wedding/wedding-ornament-sync'
import { readWeddingPreviewLook, WEDDING_PREVIEW_READY_MESSAGE, weddingPreviewLookToken } from '@/lib/wedding/wedding-preview-look'
import { WeddingSectionCard } from '@/components/wedding/wedding-section-card'
import { DEFAULT_WEDDING_COVER_PRESET_ID, getWeddingCoverPreset, weddingCoverCentersOnStage, weddingCoverPhotoHead } from '@/lib/wedding/wedding-cover-presets'
import type { WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'
import {
  parseWeddingSectionConfig,
  resolveCoverAiFrame,
  resolveCoverFrameOpen,
  resolveCoverFrameScale,
  resolveOpenBurstEffect,
  resolveOpenFallEffect,
  resolveOpenFallSeconds,
  resolveCoverPhotoObjectPosition,
  resolveCoverPhotoOpen,
  resolveCoverPhotoScale,
  coverPhotoUrlUnlessBackground,
  resolveCoverPhotoUrl,
  resolvePortraitPhotoFrame,
  resolvePortraitFrameScale,
  resolveShownCoverFrame,
  resolveShownPortraitShell,
  resolveDeviceFrameScale,
  resolveDeviceStackPlace,
  resolveDeviceStackRotate,
  withDeviceShell,
  withoutPrivateShell,
  mergeWeddingSectionConfig,
  applyPreviewFrameChoice,
  resolveShownHeroLayout,
  weddingPreviewFrameSelectionKey,
  weddingPortraitCropPatch,
  upsertAlbumPhotoCrop,
  shiftAlbumPhotoCropsAfterRemove,
  clampWeddingFrameScale,
  type WeddingDeviceShell,
  type WeddingTextRole,
} from '@/lib/wedding/wedding-section-config'
import { weddingTextCss } from '@/lib/wedding/wedding-text-style'
import { WeddingTextStyleBar } from '@/components/wedding/wedding-text-style-bar'
import { WeddingCoverShellCard } from '@/components/wedding/wedding-cover-shell-card'
import { WeddingInvitationMotion } from '@/components/wedding/wedding-invitation-motion'
import { WeddingOpenEffects } from '@/components/wedding/wedding-open-effects'
import { WeddingPartyCountFields } from '@/components/wedding/wedding-party-count-fields'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingCoupleNames } from '@/components/wedding/wedding-couple-names'
import { WeddingCouplePortraits } from '@/components/wedding/wedding-couple-portraits'
import { WeddingWishPresetPicker } from '@/components/wedding/wedding-wish-preset-picker'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { WeddingAiPolishButton } from '@/components/wedding/wedding-ai-polish-button'
import type { WeddingPolishField } from '@/lib/wedding/wedding-text-polish-deepseek'
import { WeddingGuestNameFontLink, renderWeddingGuestName, WEDDING_GUEST_NAME_CLASS } from '@/components/wedding/wedding-guest-name-font'
import { WeddingDraggableChrome, WeddingDraggableFab } from '@/components/wedding/wedding-draggable-fab'
import {
  guestInviteVenueLabel,
  normalizeGuestInviteVenue,
  type WeddingGuestInviteVenue,
} from '@/lib/wedding/wedding-guest-invite-venue'
import { resolveGuestInviteLocation } from '@/lib/wedding/wedding-guest-invite-location'
import { buildWeddingDemoPersonalInvite } from '@/lib/wedding/build-personal-wedding-invite'
import { omitWeddingAddressesFromSharedCopy, weddingSharedCopyAddresses } from '@/lib/wedding/wedding-shared-copy'
import { resolveWeddingCardDisplayText } from '@/lib/wedding/wedding-card-text-interpolate'
import { renderWeddingHighlightedText } from '@/lib/wedding/wedding-card-text-highlight'
import { WeddingTimeField } from '@/components/wedding/wedding-time-field'
import { WeddingTimelineList } from '@/components/wedding/wedding-timeline-list'
import { parseWeddingEventTimeline, serializeWeddingEventTimeline, weddingTimelineItemContent, type WeddingTimelineItem } from '@/lib/wedding/wedding-event-timeline'
import {
  allowWeddingPageScroll,
  primeWeddingPageScroll,
  releaseWeddingPageScrollLock,
  scrollWeddingPageToTop,
  startWeddingInvitationAutoScroll,
  stopWeddingInvitationAutoScroll,
} from '@/hooks/use-wedding-invitation-auto-scroll'
import { applyWeddingDesignViewport, isIosWeddingWebKit, WEDDING_DESKTOP_HEIGHT, WEDDING_DESKTOP_MIN_PX, WEDDING_DESKTOP_WIDTH, WEDDING_MOBILE_HEIGHT, WEDDING_MOBILE_WIDTH, weddingIosCoverFitScale } from '@/lib/wedding/wedding-design-viewport'
import { WEDDING_EDIT_SIDE, weddingEditSideLabelStyle } from '@/lib/wedding/wedding-side-edit-color'

const PUBLIC_COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-5 sm:gap-7'

function seedParty(rsvp: PublishedGuestRsvpSnapshot | null | undefined) {
  if (!rsvp) return { choice: null as 'yes' | 'no' | null, adult: 1, child: 0, attending: true }
  if (!rsvp.attending) return { choice: 'no' as const, adult: 1, child: 0, attending: false }
  const adult = rsvp.adultCount + rsvp.childCount > 0 ? rsvp.adultCount : Math.max(1, rsvp.guestCount || 1)
  return { choice: 'yes' as const, adult, child: rsvp.childCount, attending: true }
}

function WeddingSideWishGroup({
  title,
  wishes,
  theme,
}: {
  title: string
  wishes: WeddingSideWish[]
  theme: ReturnType<typeof getWeddingTheme>
}) {
  if (wishes.length === 0) return null
  return (
    <div className="space-y-3 text-left">
      <h3 className={cn('text-center font-serif text-xl font-semibold sm:text-2xl', theme.accent, theme.textGlowHeading)}>
        {title}
      </h3>
      {wishes.map((wish) => (
        <div key={wish.id} className={cn('rounded-2xl p-4', theme.panelStrong)}>
          <p className={cn(WEDDING_GUEST_NAME_CLASS, 'text-[1.85rem] leading-snug', theme.text, theme.textGlow)}>{wish.guestName}</p>
          <p className={cn('mt-1 whitespace-pre-line text-sm leading-6', theme.mutedText, theme.textGlow)}>{wish.message}</p>
        </div>
      ))}
    </div>
  )
}

/** Ô sửa giữ đúng chiều chữ khách. Nút chuẩn hóa nằm trong khối, không trồi lên khối phía trên. */
function WeddingGuestTextSlot(props: {
  editing: boolean
  draft: string
  ariaLabel: string
  textKey: string
  onFocus: () => void
  onChange: (value: string) => void
  className: string
  style?: CSSProperties
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative">
      {props.editing && props.toolbar ? (
        <div className="mb-2 flex justify-center">{props.toolbar}</div>
      ) : null}
      <div className="relative">
        <p className={cn(props.className, props.editing && 'invisible')} style={props.style} aria-hidden={props.editing || undefined}>
          {props.children}
        </p>
        {props.editing ? (
          <textarea
            aria-label={props.ariaLabel}
            data-wedding-text={props.textKey}
            value={props.draft}
            onFocus={props.onFocus}
            onChange={(event) => props.onChange(event.target.value)}
            style={{ ...props.style, outline: '1px dashed rgb(251 113 133)' }}
            className={cn(props.className, 'absolute inset-0 z-[1] !m-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0')}
          />
        ) : null}
      </div>
    </div>
  )
}

type WeddingPlaceDraft = {
  address: string
  time: string
  date: string
  partyTime: string
  map: string
  contact: string
  timeline: string
}

function weddingPlaceDraftFromCard(card: WeddingCard, side: 'groom' | 'bride'): WeddingPlaceDraft {
  const loc = resolveGuestInviteLocation(card, side === 'bride' ? 'bride_home' : 'groom_home')
  return {
    address: loc.address,
    time: loc.receptionTime,
    date: loc.weddingDate ?? '',
    partyTime: loc.partyStartTime,
    map: loc.mapUrl || card.mapUrl,
    contact: loc.contact,
    timeline: loc.eventTimeline || card.eventTimeline,
  }
}

function WeddingEventPlaceEditor(props: {
  side: 'groom' | 'bride'
  title?: string
  date: string
  time: string
  partyTime: string
  address: string
  map: string
  contact: string
  dateLabel: string
  timeLabel: string
  partyLabel: string
  addressLabel: string
  mapLabel: string
  contactLabel: string
  onFocus: () => void
  onChange: (key: 'date' | 'time' | 'partyTime' | 'address' | 'map' | 'contact', value: string) => void
  style?: CSSProperties
}) {
  const tone = WEDDING_EDIT_SIDE[props.side]
  const nameStyle = weddingEditSideLabelStyle(props.side)
  const fieldClass = `h-10 rounded-xl border border-dashed ${tone.fieldBorder} bg-white/80 px-3 text-sm text-stone-900`
  return (
    <div className="relative z-[80] mx-auto grid max-w-md gap-2 rounded-xl bg-white/95 p-3 text-left shadow-lg">
      {props.title ? <p data-wedding-field-name="" style={weddingEditSideLabelStyle(props.side, true)}>{props.title}</p> : null}
      <label className="grid gap-0.5">
        <span data-wedding-field-name="" style={nameStyle}>{props.dateLabel}</span>
        <input
          aria-label={props.dateLabel}
          data-wedding-text="event"
          type="date"
          value={props.date}
          onFocus={props.onFocus}
          onChange={(event) => props.onChange('date', event.target.value)}
          style={props.style}
          className={fieldClass}
        />
      </label>
      <div className="grid gap-0.5">
        <span data-wedding-field-name="" style={nameStyle}>{props.timeLabel}</span>
        <WeddingTimeField
          ariaLabel={props.timeLabel}
          textMarker="event"
          value={props.time}
          onOpen={props.onFocus}
          onChange={(value) => props.onChange('time', value)}
          className={`h-12 rounded-xl border border-dashed ${tone.fieldBorder} bg-white px-3 text-lg font-semibold text-stone-950 shadow-none`}
        />
      </div>
      <div className="grid gap-0.5">
        <span data-wedding-field-name="" style={nameStyle}>{props.partyLabel}</span>
        <WeddingTimeField
          ariaLabel={props.partyLabel}
          textMarker="event"
          value={props.partyTime}
          onOpen={props.onFocus}
          onChange={(value) => props.onChange('partyTime', value)}
          className={`h-12 rounded-xl border border-dashed ${tone.fieldBorder} bg-white px-3 text-lg font-semibold text-stone-950 shadow-none`}
        />
      </div>
      <label className="grid gap-0.5">
        <span data-wedding-field-name="" style={nameStyle}>{props.addressLabel}</span>
        <textarea
          aria-label={props.addressLabel}
          data-wedding-text="event"
          value={props.address}
          onFocus={props.onFocus}
          onChange={(event) => props.onChange('address', event.target.value)}
          rows={2}
          style={props.style}
          className={`rounded-xl border border-dashed ${tone.fieldBorder} bg-white/80 px-3 py-2 text-sm text-stone-900`}
        />
      </label>
      <label className="grid gap-0.5">
        <span data-wedding-field-name="" style={nameStyle}>{props.mapLabel}</span>
        <input
          aria-label={props.mapLabel}
          data-wedding-text="event"
          value={props.map}
          onFocus={props.onFocus}
          onChange={(event) => props.onChange('map', event.target.value)}
          style={props.style}
          placeholder="https://maps.google.com/…"
          className={fieldClass}
        />
      </label>
      <label className="grid gap-0.5">
        <span data-wedding-field-name="" style={nameStyle}>{props.contactLabel}</span>
        <input
          aria-label={props.contactLabel}
          data-wedding-text="event"
          value={props.contact}
          onFocus={props.onFocus}
          onChange={(event) => props.onChange('contact', event.target.value)}
          style={props.style}
          placeholder="090…"
          className={fieldClass}
        />
      </label>
    </div>
  )
}

function WeddingTimelineDraftEditor(props: {
  value: string
  addLabel: string
  removeLabel: string
  timeLabel: string
  titleLabel: string
  borderClass?: string
  removeClass?: string
  polish?: ReactNode
  onChange: (value: string) => void
}) {
  const parsed = parseWeddingEventTimeline(props.value)
  const [pad, setPad] = useState(0)
  const rows: WeddingTimelineItem[] = [...parsed]
  for (let i = 0; i < pad; i += 1) rows.push({ time: '', title: '', note: '' })
  const write = (next: WeddingTimelineItem[]) => {
    props.onChange(serializeWeddingEventTimeline(next))
    setPad(0)
  }
  return (
    <div className="mt-5 space-y-2 text-left">
      {props.polish ? <div className="flex justify-start">{props.polish}</div> : null}
      {rows.map((row, index) => (
        <div key={`tl-${index}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-2">
          <WeddingTimeField
            ariaLabel={props.timeLabel}
            value={row.time}
            onChange={(time) => {
              write(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, time } : item)))
            }}
            className={`h-12 rounded-xl border border-dashed ${props.borderClass ?? 'border-rose-300'} bg-white px-2 text-sm font-semibold text-stone-950 shadow-none`}
          />
          <input
            aria-label={props.titleLabel}
            value={weddingTimelineItemContent(row)}
            onChange={(event) => {
              write(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value, note: '' } : item)))
            }}
            className={`h-10 rounded-xl border border-dashed ${props.borderClass ?? 'border-rose-300'} bg-white/80 px-2 text-sm text-stone-900`}
          />
          <button
            type="button"
            className={`h-10 rounded-xl px-2 text-xs font-semibold ${props.removeClass ?? 'text-rose-700'}`}
            onClick={() => write(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            {props.removeLabel}
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`h-9 rounded-xl border border-dashed ${props.borderClass ?? 'border-rose-300'} px-3 text-xs font-semibold ${props.removeClass ?? 'text-rose-800'}`}
        onClick={() => setPad((count) => count + 1)}
      >
        {props.addLabel}
      </button>
    </div>
  )
}

function FittedCoverFrame(props: { active: boolean; designWidth: number; backgroundColor: string; flow?: boolean; contain?: boolean; fitHeight?: boolean; fitFrame?: boolean; maxScale?: number; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState(0)
  const [iosFrame, setIosFrame] = useState<{ top: number; height: number } | null>(null)

  useLayoutEffect(() => {
    if (!props.active) return
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const ios = isIosWeddingWebKit()
    const pinIosFrame = ios && !props.flow && !props.contain && !props.fitHeight && !props.fitFrame
    const fitBoth = Boolean(props.fitHeight || props.fitFrame)
    const fit = () => {
      const height = inner.offsetHeight
      if (height < 1 || outer.clientWidth < 1) return
      const view = window.visualViewport
      if (pinIosFrame) {
        const nextFrame = {
          top: Math.round(view?.offsetTop ?? 0),
          height: Math.round(view?.height ?? window.innerHeight),
        }
        setIosFrame((current) => (current && current.top === nextFrame.top && current.height === nextFrame.height ? current : nextFrame))
      }
      const computed = ios && !props.flow ? getComputedStyle(outer) : null
      const padTop = computed ? Number.parseFloat(computed.paddingTop) || 0 : 0
      const padBottom = computed ? Number.parseFloat(computed.paddingBottom) || 0 : 0
      const safeHeight = Math.max(0, outer.clientHeight - padTop - padBottom)
      const next = weddingIosCoverFitScale({
        fitSafeHeight: pinIosFrame,
        fitHeight: fitBoth,
        viewWidth: outer.clientWidth,
        safeHeight: fitBoth ? outer.clientHeight : safeHeight,
        contentHeight: height,
        designWidth: props.designWidth,
        maxScale: props.maxScale,
      })
      setScale((current) => (Math.abs(current - next) < 0.004 ? current : next))
      setContentHeight((current) => (Math.abs(current - height) < 1 ? current : height))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(outer)
    observer.observe(inner)
    const view = window.visualViewport
    view?.addEventListener('resize', fit)
    view?.addEventListener('scroll', fit)
    return () => {
      observer.disconnect()
      view?.removeEventListener('resize', fit)
      view?.removeEventListener('scroll', fit)
    }
  }, [props.active, props.contain, props.designWidth, props.fitFrame, props.fitHeight, props.flow, props.maxScale, iosFrame])

  if (!props.active) return <div className="relative" data-wedding-stage="">{props.children}</div>

  const scaledHeight = contentHeight * scale
  const boxed = Math.abs(scale - 1) >= 0.004
  if (props.flow) {
    const sheetWidth = props.designWidth * scale
    return (
      <div ref={outerRef} className="relative flex w-full justify-center overflow-visible" style={boxed ? { height: scaledHeight || undefined } : undefined}>
        <div
          ref={innerRef}
          className={boxed ? 'absolute top-0' : 'relative'}
          data-wedding-stage=""
          style={{
            width: props.designWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            left: boxed ? `max(0px, calc((100% - ${sheetWidth}px) / 2))` : undefined,
            ['--wedding-stage-scale' as string]: String(scale),
          }}
        >
          {props.children}
        </div>
      </div>
    )
  }
  const sheet = (
    <div style={{ width: props.designWidth * scale, height: scaledHeight || undefined, margin: '0 auto' }}>
      <div ref={innerRef} data-wedding-stage="" style={{ width: props.designWidth, transform: `scale(${scale})`, transformOrigin: 'top left', ['--wedding-stage-scale' as string]: String(scale) }}>
        {props.children}
      </div>
    </div>
  )
  if (props.fitHeight) {
    return (
      <div className="fixed inset-x-0 z-50 overflow-x-clip overflow-y-hidden" style={{ backgroundColor: props.backgroundColor, top: 'env(safe-area-inset-top, 0px)', bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div ref={outerRef} className="relative mx-auto h-full overflow-visible" style={{ width: props.designWidth, maxWidth: '100%' }}>
          {sheet}
        </div>
      </div>
    )
  }
  if (props.fitFrame) {
    return (
      <div ref={outerRef} className="fixed inset-0 z-50 overflow-hidden" style={{ backgroundColor: props.backgroundColor }}>
        {sheet}
      </div>
    )
  }
  return (
    <div
      ref={outerRef}
      className={props.contain ? 'relative mx-auto min-h-screen w-full overflow-visible' : iosFrame ? 'fixed inset-x-0 z-50 overflow-x-clip overflow-y-auto' : 'fixed inset-0 z-50 overflow-x-clip overflow-y-auto'}
      style={{
        backgroundColor: props.backgroundColor,
        ...(iosFrame
          ? {
              top: iosFrame.top,
              height: iosFrame.height,
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }
          : null),
      }}
    >
      {sheet}
    </div>
  )
}

type OrnamentFace = 'cover' | 'letter'

function useOrnamentFaceAutosave(input: {
  enabled: boolean
  surface: OrnamentFace
  draft: WeddingBackgroundOrnament[] | null
  cardId: string
  samplePresetId: string
  templateEditor: boolean
  onFailed: () => void
  onStored: (
    surface: OrnamentFace,
    ornaments: WeddingBackgroundOrnament[] | null,
    template: boolean,
    snapshot: WeddingBackgroundOrnament[] | null,
  ) => void
}) {
  const [saving, setSaving] = useState(false)
  const draftRef = useRef(input.draft)
  const queueRef = useRef<{ ornaments: WeddingBackgroundOrnament[] } | null>(null)
  const flightRef = useRef(false)
  const epochRef = useRef(0)
  const inputRef = useRef(input)
  draftRef.current = input.draft
  inputRef.current = input

  const reset = useCallback(async () => {
    const current = inputRef.current
    if (!current.enabled || (!current.samplePresetId && !current.cardId)) return
    epochRef.current += 1
    queueRef.current = null
    setSaving(true)
    const result = current.samplePresetId
      ? await resetWeddingPresetOrnaments(current.samplePresetId, 'mobile', current.surface)
      : await resetWeddingCardOrnaments(current.cardId, 'mobile', current.surface)
    setSaving(false)
    if (!result || !('ok' in result)) {
      current.onFailed()
      return
    }
    current.onStored(current.surface, null, current.templateEditor || Boolean(current.samplePresetId), null)
    window.parent.postMessage(
      { type: 'wedding-ornament-saved', surface: current.surface, device: 'mobile', cleared: true },
      window.location.origin,
    )
  }, [])

  useEffect(() => {
    if (!input.enabled || !input.draft) return
    const snapshot = input.draft
    const timer = window.setTimeout(() => {
      queueRef.current = { ornaments: snapshot }
      const flush = async () => {
        if (flightRef.current) return
        const job = queueRef.current
        if (!job) return
        queueRef.current = null
        const current = inputRef.current
        const epoch = epochRef.current
        flightRef.current = true
        setSaving(true)
        const result = current.samplePresetId
          ? await saveWeddingPresetOrnaments(current.samplePresetId, 'mobile', job.ornaments, current.surface)
          : await saveWeddingCardOrnaments(current.cardId, 'mobile', job.ornaments, current.surface)
        flightRef.current = false
        if (epochRef.current !== epoch) {
          if (current.samplePresetId) await resetWeddingPresetOrnaments(current.samplePresetId, 'mobile', current.surface)
          else await resetWeddingCardOrnaments(current.cardId, 'mobile', current.surface)
          setSaving(false)
          if (queueRef.current) void flush()
          return
        }
        setSaving(false)
        if (!result || !('ok' in result)) {
          current.onFailed()
          return
        }
        const templateSave = Boolean(current.templateEditor || result.template || current.samplePresetId)
        current.onStored(current.surface, result.ornaments ?? [], templateSave, job.ornaments)
        window.parent.postMessage(
          { type: 'wedding-ornament-saved', surface: current.surface, device: 'mobile', ornaments: result.ornaments },
          window.location.origin,
        )
        if (queueRef.current) void flush()
      }
      void flush()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [input.cardId, input.draft, input.enabled, input.samplePresetId, input.surface, input.templateEditor])

  return { saving, reset, draftRef }
}

export default function WeddingPublicClient({
  card,
  sideWishes,
  initialGuestDisplayName = '',
  initialGuestInviteVenue = '',
  initialLetterView = 'groom',
  askLetterView = false,
  initialPersonalInvite = '',
  initialGuestRsvp = null,
  backgroundPlateUrls = [],
  ornamentOverride = null,
  ornamentMobile = null,
  ornamentSharedMobile = null,
  ornamentLetterMobile = null,
  ornamentLetterSharedMobile = null,
  ornamentEditor = false,
  hostEditor = false,
  templateEditor = false,
  sharedShell = null,
  initialSharedFrame = null,
  layoutPreview = false,
  editorStack,
  hostPreview = false,
  samplePresetId = '',
  sampleDemo = false,
  demoMusicUrls = [],
  captureStill = false,
  quietFrame = false,
  editorContent = false,
}: {
  card: WeddingCard
  sideWishes: WeddingSideWishGroups
  initialGuestDisplayName?: string
  initialGuestInviteVenue?: WeddingGuestInviteVenue
  initialLetterView?: 'groom' | 'bride' | 'both'
  askLetterView?: boolean
  initialPersonalInvite?: string
  initialGuestRsvp?: PublishedGuestRsvpSnapshot | null
  backgroundPlateUrls?: string[]
  ornamentOverride?: WeddingBackgroundOrnament[] | null
  ornamentDesktop?: WeddingBackgroundOrnament[] | null
  ornamentMobile?: WeddingBackgroundOrnament[] | null
  ornamentSharedDesktop?: WeddingBackgroundOrnament[] | null
  ornamentSharedMobile?: WeddingBackgroundOrnament[] | null
  ornamentLetterMobile?: WeddingBackgroundOrnament[] | null
  ornamentLetterSharedMobile?: WeddingBackgroundOrnament[] | null
  ornamentLayoutKey?: string
  ornamentEditor?: boolean
  hostEditor?: boolean
  templateEditor?: boolean
  sharedShell?: { desktop?: WeddingDeviceShell | null; mobile?: WeddingDeviceShell | null } | null
  initialSharedFrame?: WeddingSharedFrame | null
  layoutPreview?: boolean
  editorStack?: 'cover' | 'letter'
  hostPreview?: boolean
  /** Mẫu dùng chung đang xem demo. Sửa của quản trị ghi vào mẫu này, không ghi vào thiệp khách. */
  samplePresetId?: string
  sampleDemo?: boolean
  /** Kho nhạc, chỉ bản demo. Hết một bài thì bài khác, thứ tự ngẫu nhiên. */
  demoMusicUrls?: string[]
  /** Ảnh lưới chủ đề: thiệp đã mở, đứng yên, không nhạc và không hiệu ứng. */
  captureStill?: boolean
  /** Khung demo điện thoại: chỉ mặt thiệp, không nút máy và không thanh dùng mẫu. */
  quietFrame?: boolean
  /** Demo mẫu: chữ, ảnh, ngày giờ lấy đúng bản Sửa thiệp, không bật nút sửa. */
  editorContent?: boolean
}) {
  const asEditor = hostEditor || editorContent
  const router = useRouter()
  const { toast } = useToast()
  const compiledWishes = sideWishes.groom.length + sideWishes.bride.length + sideWishes.other.length
  const uiLocale = readWebLocaleFromDocumentCookie()
  const txMusic = useMemo(
    () => applyInvitationMusicCopy(getDictionary(uiLocale).weddingCardAiMusic, card.occasionKey, uiLocale),
    [card.occasionKey, uiLocale],
  )
  const txCal = useMemo(
    () => applyInvitationCalendarCopy(getDictionary(uiLocale).weddingCardCalendar, card.occasionKey, uiLocale),
    [card.occasionKey, uiLocale],
  )
  const txGift = useMemo(
    () => applyInvitationGiftCopy(getDictionary(uiLocale).weddingGiftBox, card.occasionKey, uiLocale),
    [card.occasionKey, uiLocale],
  )
  const tx = useMemo(
    () => applyInvitationOccasionPublicCopy(getDictionary(uiLocale).weddingCardPublic, card.occasionKey, uiLocale),
    [card.occasionKey, uiLocale],
  )
  const editSide = initialLetterView === 'bride' ? 'bride' : 'groom'
  const [sectionRaw, setSectionRaw] = useState(card.sectionConfig)
  const [previewPlates, setPreviewPlates] = useState<string[] | null>(null)
  const [previewStyleId, setPreviewStyleId] = useState<string | null>(null)
  const [previewLookOn, setPreviewLookOn] = useState(false)
  const [sharedFrame, setSharedFrame] = useState<WeddingSharedFrame | null>(initialSharedFrame)
  const pendingSharedFrameRef = useRef<{ frame: WeddingSharedFrame | null; side: 'cover' | 'groom' | 'bride' | 'pair' } | null>(null)
  const [groomDraft, setGroomDraft] = useState(card.groomName)
  const [brideDraft, setBrideDraft] = useState(card.brideName)
  const [introDraft, setIntroDraft] = useState(card.coupleIntro)
  const [storyDraft, setStoryDraft] = useState(card.storyText)
  const [thanksDraft, setThanksDraft] = useState(card.thankYouText)
  const [quoteDraft, setQuoteDraft] = useState(card.loveQuote)
  const [inviteDraft, setInviteDraft] = useState(card.invitationText)
  const [inviteEnDraft, setInviteEnDraft] = useState(card.invitationTextEn)
  const [dressDraft, setDressDraft] = useState(card.dressCode)
  const [groomParentsDraft, setGroomParentsDraft] = useState(card.groomParents)
  const [brideParentsDraft, setBrideParentsDraft] = useState(card.brideParents)
  const [groomHometownDraft, setGroomHometownDraft] = useState(card.groomHometown)
  const [brideHometownDraft, setBrideHometownDraft] = useState(card.brideHometown)
  const [groomPlaceDraft, setGroomPlaceDraft] = useState(() => weddingPlaceDraftFromCard(card, 'groom'))
  const [bridePlaceDraft, setBridePlaceDraft] = useState(() => weddingPlaceDraftFromCard(card, 'bride'))
  const [effectsEnabled, setEffectsEnabled] = useState(card.effectsEnabled)
  const rsvpEnabled = true
  const [giftQrEnabled, setGiftQrEnabled] = useState(card.giftQrEnabled)
  const [groomGiftBankId, setGroomGiftBankId] = useState(card.groomGiftBankId)
  const [groomGiftAccountNo, setGroomGiftAccountNo] = useState(card.groomGiftAccountNo)
  const [groomGiftAccountName, setGroomGiftAccountName] = useState(card.groomGiftAccountName)
  const [brideGiftBankId, setBrideGiftBankId] = useState(card.brideGiftBankId)
  const [brideGiftAccountNo, setBrideGiftAccountNo] = useState(card.brideGiftAccountNo)
  const [brideGiftAccountName, setBrideGiftAccountName] = useState(card.brideGiftAccountName)
  const vietQrBanks = useVietQrBanks()
  const placeDraft = editSide === 'bride' ? bridePlaceDraft : groomPlaceDraft
  const addressDraft = placeDraft.address
  const timeDraft = placeDraft.time
  const dateDraft = placeDraft.date
  const partyTimeDraft = placeDraft.partyTime
  const mapDraft = placeDraft.map
  const contactDraft = placeDraft.contact
  const timelineDraft = placeDraft.timeline
  const [previewTick, setPreviewTick] = useState(0)
  const previewKindRef = useRef<'text' | 'shell' | 'frame' | 'both' | null>(null)
  const [textPick, setTextPick] = useState<WeddingTextRole | null>(null)
  const [viewDevice, setViewDevice] = useState<'desktop' | 'mobile'>('mobile')
  const [forcedMasterUrl, setForcedMasterUrl] = useState<string | null | undefined>(undefined)
  const [photoOverride, setPhotoOverride] = useState<{ groom: string; bride: string; album: string[] } | null>(null)
  const [sampleFlowers, setSampleFlowers] = useState(false)
  const [lookOpen, setLookOpen] = useState(false)
  const [lookPick, setLookPick] = useState('')
  const [lookBusy, setLookBusy] = useState(false)
  const [musicLibrary, setMusicLibrary] = useState<WeddingMusicLibraryRow[]>([])
  const [frameLibrary, setFrameLibrary] = useState<WeddingCoverFrameLibraryItem[]>([])
  const [musicDraftUrl, setMusicDraftUrl] = useState(card.musicUrl)
  const [mediaLocal, setMediaLocal] = useState<{ cover?: string; groom?: string; bride?: string; album?: string[] }>({})
  const [framePick, setFramePick] = useState<'cover' | 'groom' | 'bride' | 'pair' | null>(null)
  const mediaLocalRef = useRef(mediaLocal)
  mediaLocalRef.current = mediaLocal
  const displayedSectionRaw = previewLookOn || hostEditor || ornamentEditor ? sectionRaw : card.sectionConfig
  const sectionConfig = useMemo(() => {
    const parsed = parseWeddingSectionConfig(displayedSectionRaw)
    if (sampleDemo || !isWeddingSamplePhotoUrl(parsed.coverPhotoUrl)) return parsed
    return { ...parsed, coverPhotoUrl: '' }
  }, [displayedSectionRaw, sampleDemo])
  const groomSource = mediaLocal.groom || (photoOverride ? photoOverride.groom : card.groomImageUrl)
  const brideSource = mediaLocal.bride || (photoOverride ? photoOverride.bride : card.brideImageUrl)
  const albumSource = mediaLocal.album || (photoOverride ? photoOverride.album : card.albumImageUrls)
  const groomPhotoUrl = sampleDemo || !isWeddingSamplePhotoUrl(groomSource) ? groomSource : ''
  const bridePhotoUrl = sampleDemo || !isWeddingSamplePhotoUrl(brideSource) ? brideSource : ''
  const albumPhotoUrls = sampleDemo ? albumSource : albumSource.filter((url) => !isWeddingSamplePhotoUrl(url))
  const plateUrls = previewPlates ?? backgroundPlateUrls
  const masterUrl = forcedMasterUrl !== undefined ? forcedMasterUrl : card.masterImageUrl
  const pageBackground = (plateUrls[0] || (previewLookOn ? '' : masterUrl) || '').trim()
  const readyBackground = resolveWeddingChromeKit(sectionConfig)
  const kitSurface = weddingKitSurface(readyBackground)
  const themeStyleId = readyBackground?.look.styleId || previewStyleId || card.selectedStyleId
  const theme = useMemo(
    () => applyWeddingKitTheme(getWeddingTheme(themeStyleId), readyBackground),
    [readyBackground, themeStyleId],
  )
  const readingPlate = weddingReadingPlate(readyBackground, pageBackground, weddingThemeIsDark(theme))
  const contentSurface = pageBackground
    ? { background: 'transparent' }
    : weddingBackgroundStyle(pageBackground, theme, 0)
  const pairedAiFrame = weddingUsesPairedAiFrame(sectionConfig) ? resolveCoverAiFrame(sectionConfig) : null
  const kitFrameId = pairedAiFrame ? undefined : readyBackground?.coverPresetId
  const groomShell = resolveShownPortraitShell(sectionConfig, 'groom', kitFrameId, pairedAiFrame ? null : sharedFrame)
  const brideShell = resolveShownPortraitShell(sectionConfig, 'bride', kitFrameId, pairedAiFrame ? null : sharedFrame)
  const styleColors = weddingFramePatchForStyle(themeStyleId)
  const buttonColor = useMemo(
    () => resolveWeddingButtonColor(readyBackground?.look.buttonColorId ?? styleColors.buttonColorId),
    [readyBackground, styleColors.buttonColorId],
  )
  const coverRsvpColor = useMemo(
    () => resolveWeddingButtonColor(readyBackground?.look.coverRsvpColorId ?? styleColors.coverRsvpColorId),
    [readyBackground, styleColors.coverRsvpColorId],
  )
  const buttonFill = useMemo(() => bindWeddingButtonFill(buttonColor), [buttonColor])
  const rsvpFill = useMemo(() => bindWeddingButtonFill(coverRsvpColor), [coverRsvpColor])
  const stageColor = theme.darkPaper || (isWeddingDarkTheme(theme.id) ? '#0f172a' : '#fffdf8')
  const paperField = theme.darkPaper
    ? 'border-[#e8c87a]/45 bg-[#fff8ee] text-[#3a2214] placeholder:text-[#8a7048]'
    : ''
  const ringOffsetClass = theme.darkPaper ? 'ring-offset-[#5c1018]' : 'ring-offset-[#fff8f0]'
  const cardStructure = invitationCardStructure(card.occasionKey)
  const secondVenueOpen = invitationShowsSecondVenue(card.occasionKey, {
    address: card.brideInviteAddress,
    date: card.brideInviteWeddingDate,
    time: card.brideInviteReceptionTime,
    partyTime: card.brideInvitePartyStartTime,
  })
  const heroStack =
    cardStructure.portraitLayout === 'pair' &&
    resolveShownHeroLayout(sectionConfig, weddingHeroPhotoLayout(readyBackground)) === 'stack'
  const shownCover = resolveShownCoverFrame(sectionConfig, kitFrameId, pairedAiFrame ? null : sharedFrame)
  const coverPresetId = pairedAiFrame ? sectionConfig.coverPresetId || DEFAULT_WEDDING_COVER_PRESET_ID : shownCover.presetId || styleColors.coverPresetId
  const envelopeCover = getWeddingCoverPreset(coverPresetId).layout === 'envelope'
  const coverAiFrame = pairedAiFrame ?? shownCover.library ?? null
  const coverFrameMode = pairedAiFrame
    ? sectionConfig.coverFrameMode === 'ai'
      ? 'ai'
      : 'library'
    : shownCover.mode
  const coverPhotoOpen = useMemo(() => resolveCoverPhotoOpen(sectionConfig), [sectionConfig])
  const coverFrameOpen = useMemo(() => resolveCoverFrameOpen(sectionConfig), [sectionConfig])
  const openBurstEffect = useMemo(() => resolveOpenBurstEffect(sectionConfig), [sectionConfig])
  const openFallEffect = useMemo(() => resolveOpenFallEffect(sectionConfig), [sectionConfig])
  const openFallSeconds = useMemo(() => resolveOpenFallSeconds(sectionConfig), [sectionConfig])
  const albumLayoutId = resolveWeddingAlbumLayoutId(sectionConfig.albumLayoutId)
  const coverPhotoUrl = coverPhotoUrlUnlessBackground(mediaLocal.cover || resolveCoverPhotoUrl(sectionConfig), pageBackground)
  const coverPhotoObjectPosition = resolveCoverPhotoObjectPosition(sectionConfig)
  const coverPhotoScale = resolveCoverPhotoScale(sectionConfig)
  const weddingDateIso = useMemo(
    () =>
      resolveWeddingDateIso(card.weddingDate) ||
      resolveWeddingDateIso(card.groomInviteWeddingDate) ||
      resolveWeddingDateIso(card.brideInviteWeddingDate),
    [card.brideInviteWeddingDate, card.groomInviteWeddingDate, card.weddingDate],
  )
  const weddingDisplayTime = useMemo(
    () => resolveWeddingDisplayTime(card.weddingTime, card.partyStartTime) || card.weddingTime,
    [card.partyStartTime, card.weddingTime],
  )
  const demoMix = sampleDemo ? demoMusicUrls.filter((url) => url.trim()) : []
  const showMusic = Boolean(musicDraftUrl) || demoMix.length > 0
  const [musicLoadFailed, setMusicLoadFailed] = useState(false)
  const [musicFabPlaying, setMusicFabPlaying] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [, setAttending] = useState(() => seedParty(initialGuestRsvp).attending)
  const [partyAdult, setPartyAdult] = useState(() => seedParty(initialGuestRsvp).adult)
  const [partyChild, setPartyChild] = useState(() => seedParty(initialGuestRsvp).child)
  const [partyModalOpen, setPartyModalOpen] = useState(false)
  const [draftAdult, setDraftAdult] = useState(() => seedParty(initialGuestRsvp).adult)
  const [draftChild, setDraftChild] = useState(() => seedParty(initialGuestRsvp).child)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [coverRsvpChoice, setCoverRsvpChoice] = useState<'yes' | 'no' | null>(
    () => seedParty(initialGuestRsvp).choice,
  )
  const [contentChoice, setContentChoice] = useState<'yes' | 'no' | null>(
    () => seedParty(initialGuestRsvp).choice,
  )
  const rsvpSeq = useRef(0)
  const [reminderEmail, setReminderEmail] = useState('')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [letterView, setLetterView] = useState<'groom' | 'bride' | 'both' | null>(
    () => (askLetterView ? null : initialLetterView),
  )
  const [houseAskOpen, setHouseAskOpen] = useState(false)
  const coverPreview = editorStack === 'cover'
  const [opened, setOpened] = useState(captureStill || (layoutPreview && !coverPreview))
  const [coverGate, setCoverGate] = useState(!(captureStill || (layoutPreview && !coverPreview)))
  const [coverDesignWidth, setCoverDesignWidth] = useState(WEDDING_MOBILE_WIDTH)
  const [coverCard, setCoverCard] = useState(ornamentMobile)
  const [coverShared, setCoverShared] = useState(ornamentSharedMobile)
  const [letterCard, setLetterCard] = useState(ornamentLetterMobile)
  const [letterShared, setLetterShared] = useState(ornamentLetterSharedMobile)
  const [sharedShellDraft, setSharedShellDraft] = useState(sharedShell)
  const [shellDevice, setShellDevice] = useState<'desktop' | 'mobile'>('mobile')
  const [frameLines, setFrameLines] = useState(!sampleDemo)
  const [editFace, setEditFace] = useState<'cover' | 'letter'>('cover')
  const [chromeHold, setChromeHold] = useState(false)
  const [flowerHold, setFlowerHold] = useState(false)
  const flowerHoldsRef = useRef({ cover: false, letter: false })
  const noteFlowerHold = useCallback((surface: 'cover' | 'letter', index: number | null) => {
    flowerHoldsRef.current[surface] = index != null
    const hold = flowerHoldsRef.current.cover || flowerHoldsRef.current.letter
    setFlowerHold((prev) => (prev === hold ? prev : hold))
  }, [])
  const onCoverFlowerSelection = useCallback((index: number | null) => noteFlowerHold('cover', index), [noteFlowerHold])
  const onLetterFlowerSelection = useCallback((index: number | null) => noteFlowerHold('letter', index), [noteFlowerHold])
  const hideFlowerChrome = useCallback(() => {
    window.dispatchEvent(new Event('wedding-browse-flower-idle'))
  }, [])
  const [lookOrnaments, setLookOrnaments] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [coverDraft, setCoverDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [letterDraft, setLetterDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const visualEdit = Boolean(hostEditor && frameLines)
  /** Lướt vừa xem vừa thêm hoa. Sửa nội dung không gắn và không kéo hoa. */
  const browseFlowers = Boolean(hostEditor && !frameLines)
  const activeSurface: OrnamentFace = editorStack ?? (visualEdit ? editFace : opened ? 'letter' : 'cover')
  const layoutDevice: 'desktop' | 'mobile' = (sampleDemo || hostPreview || layoutPreview) && viewDevice === 'desktop' ? 'desktop' : 'mobile'
  /* Demo thiệp này xem hoa của chính thiệp, cùng bản khách thấy. Sửa mẫu chung chỉ khi mở layout mẫu. */
  const showCardFlowers = hostEditor || !templateEditor
  const coverSaved = resolveWeddingShownOrnaments({
    defaults: readyBackground?.ornaments,
    cardSheet: coverCard,
    sharedSheet: coverShared,
    sharedBase: sampleFlowers ? null : ornamentOverride,
    templateEditor: !showCardFlowers,
  })
  const letterSaved = resolveWeddingShownOrnaments({
    defaults: readyBackground?.ornaments,
    cardSheet: letterCard,
    sharedSheet: letterShared,
    templateEditor: !showCardFlowers,
  })
  const coverShown = coverDraft ?? (previewLookOn && activeSurface === 'cover' ? lookOrnaments : null) ?? coverSaved
  const letterShown = letterDraft ?? (previewLookOn && activeSurface === 'letter' ? lookOrnaments : null) ?? letterSaved
  const activeDraft = activeSurface === 'letter' ? letterDraft : coverDraft
  const activeShown = activeSurface === 'letter' ? letterShown : coverShown
  const setActiveDraft = activeSurface === 'letter' ? setLetterDraft : setCoverDraft
  const tImage = getDictionary(uiLocale).weddingCardAiImage
  const tCover = getDictionary(uiLocale).weddingCardAiCover
  const tMu = getDictionary(uiLocale).weddingCardAiMusic
  const previewLookOnRef = useRef(false)
  previewLookOnRef.current = previewLookOn
  const ornamentSyncSource = useRef(Math.random().toString(36).slice(2))
  const failOrnamentSave = useCallback(() => {
    toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
  }, [tImage.ornamentAdminFailed, toast])
  useEffect(() => {
    if (!hostEditor) return
    void loadWeddingPreviewTools().then((result) => {
      if ('error' in result) return
      setMusicLibrary(result.musicLibrary)
      setFrameLibrary(result.frameLibrary)
    })
  }, [hostEditor])
  useEffect(() => {
    return () => {
      const local = mediaLocalRef.current
      for (const url of [local.cover, local.groom, local.bride, ...(local.album ?? [])]) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
      }
    }
  }, [])
  const rememberLocalPhoto = useCallback((slot: 'cover' | 'groom' | 'bride', file: File) => {
    const next = URL.createObjectURL(file)
    setMediaLocal((current) => {
      const prev = current[slot]
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return { ...current, [slot]: next }
    })
  }, [])
  const uploadPreviewPhoto = useCallback(async (slot: 'cover' | 'groom' | 'bride', file: File) => {
    rememberLocalPhoto(slot, file)
    const body = new FormData()
    body.set('cardId', card.id)
    body.set(slot === 'cover' ? 'coverImage' : slot === 'groom' ? 'groomImage' : 'brideImage', file)
    const result = await saveWeddingPreviewMedia(body)
    if (!result || 'error' in result) {
      toast({ title: tImage.ornamentAdminFailed, description: result && 'error' in result ? String(result.error) : undefined, variant: 'destructive' })
      return
    }
    if (slot === 'cover' && result.coverPhotoUrl) {
      setSectionRaw((current) => mergeWeddingSectionConfig(current, { coverPhotoUrl: result.coverPhotoUrl }))
    }
  }, [card.id, rememberLocalPhoto, tImage.ornamentAdminFailed, toast])
  const choosePreviewMusic = useCallback(async (audioUrl: string) => {
    setMusicDraftUrl(audioUrl)
    const body = new FormData()
    body.set('cardId', card.id)
    if (audioUrl) body.set('musicLibraryUrl', audioUrl)
    else body.set('musicClear', 'true')
    const result = await saveWeddingPreviewMedia(body)
    if (!result || 'error' in result) {
      toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
      return
    }
    setMusicDraftUrl(result.musicUrl)
  }, [card.id, tImage.ornamentAdminFailed, toast])
  const storeFace = useCallback((
    surface: OrnamentFace,
    ornaments: WeddingBackgroundOrnament[] | null,
    template: boolean,
    snapshot: WeddingBackgroundOrnament[] | null,
  ) => {
    const clearDraft = (current: WeddingBackgroundOrnament[] | null) => (!snapshot || current === snapshot ? null : current)
    if (surface === 'cover') {
      if (template) {
        setCoverShared(ornaments)
        setCoverCard(null)
      } else setCoverCard(ornaments)
      setCoverDraft(clearDraft)
    } else {
      if (template) {
        setLetterShared(ornaments)
        setLetterCard(null)
      } else setLetterCard(ornaments)
      setLetterDraft(clearDraft)
    }
    if (previewLookOnRef.current && (editorStack ?? (opened ? 'letter' : 'cover')) === surface) setLookOrnaments(ornaments)
    publishWeddingOrnamentTruth({
      source: ornamentSyncSource.current,
      cardId: card.id,
      surface,
      template,
      ornaments,
    })
  }, [card.id, editorStack, opened])
  const coverSave = useOrnamentFaceAutosave({
    enabled: ornamentEditor,
    surface: 'cover',
    draft: coverDraft,
    cardId: card.id,
    samplePresetId,
    templateEditor,
    onFailed: failOrnamentSave,
    onStored: storeFace,
  })
  const letterSave = useOrnamentFaceAutosave({
    enabled: ornamentEditor,
    surface: 'letter',
    draft: letterDraft,
    cardId: card.id,
    samplePresetId,
    templateEditor,
    onFailed: failOrnamentSave,
    onStored: storeFace,
  })
  const ornamentSaving = coverSave.saving || letterSave.saving
  const resetOrnaments = () => (activeSurface === 'letter' ? letterSave.reset() : coverSave.reset())
  const applyPickedLook = async (sampleId: string) => {
    if (lookBusy || sampleDemo || !card.id || card.id.startsWith('sample:')) return
    setLookBusy(true)
    const result = await applyWeddingSampleLook(card.id, sampleId)
    setLookBusy(false)
    if (!('ok' in result)) {
      toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
      return
    }
    setSectionRaw(result.sectionConfig)
    setPreviewStyleId(result.selectedStyleId)
    setPreviewPlates(result.plateUrls)
    setForcedMasterUrl(result.masterImageUrl ?? '')
    setPhotoOverride({ groom: result.groomImageUrl, bride: result.brideImageUrl, album: result.albumImageUrls })
    setCoverShared(result.sharedOrnaments)
    setLetterShared(result.sharedLetterOrnaments)
    setCoverCard(null)
    setLetterCard(null)
    setCoverDraft(null)
    setLetterDraft(null)
    setSampleFlowers(true)
    setSharedFrame(result.sharedFrame)
    setSharedShellDraft(result.sharedShell)
    setLookOpen(false)
    setLookPick('')
    toast({ title: tImage.sampleCardAppliedTitle, description: tImage.sampleCardAppliedHint })
  }
  const resetOrnamentsRef = useRef(resetOrnaments)
  resetOrnamentsRef.current = resetOrnaments
  useEffect(() => {
    if (!ornamentEditor || !coverDraft) return
    publishWeddingOrnamentTruth({
      source: ornamentSyncSource.current,
      cardId: card.id,
      surface: 'cover',
      template: templateEditor || Boolean(samplePresetId),
      ornaments: coverDraft,
    })
  }, [card.id, coverDraft, ornamentEditor, samplePresetId, templateEditor])
  useEffect(() => {
    if (!ornamentEditor || !letterDraft) return
    publishWeddingOrnamentTruth({
      source: ornamentSyncSource.current,
      cardId: card.id,
      surface: 'letter',
      template: templateEditor || Boolean(samplePresetId),
      ornaments: letterDraft,
    })
  }, [card.id, letterDraft, ornamentEditor, samplePresetId, templateEditor])
  useEffect(() => {
    return subscribeWeddingOrnamentTruth(card.id, ornamentSyncSource.current, (message) => {
      if (message.surface === 'cover' && coverSave.draftRef.current) return
      if (message.surface === 'letter' && letterSave.draftRef.current) return
      storeFace(message.surface, message.ornaments, message.template, null)
    })
  }, [card.id, coverSave.draftRef, letterSave.draftRef, storeFace])
  useEffect(() => {
    if (!ornamentEditor || !editorStack) return
    window.parent.postMessage(
      {
        type: 'wedding-ornament-state',
        surface: editorStack,
        dirty: activeDraft != null,
        saving: ornamentSaving,
      },
      window.location.origin,
    )
  }, [activeDraft, editorStack, ornamentEditor, ornamentSaving])
  useEffect(() => {
    if (!ornamentEditor) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; surface?: string; action?: string }
      if (!data) return
      if (data.type === 'wedding-ornament-command' && data.action === 'reset' && (!editorStack || data.surface === editorStack)) {
        void resetOrnamentsRef.current()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [editorStack, ornamentEditor])
  const shownSectionRef = useRef(sectionConfig)
  const sectionRawRef = useRef(displayedSectionRaw)
  const pageBackgroundRef = useRef(pageBackground)
  const previewLookTokenRef = useRef('')
  shownSectionRef.current = sectionConfig
  sectionRawRef.current = displayedSectionRaw
  pageBackgroundRef.current = pageBackground
  previewLookOnRef.current = previewLookOn
  previewLookTokenRef.current = weddingPreviewLookToken({
    sectionConfig: displayedSectionRaw,
    selectedStyleId: previewStyleId ?? card.selectedStyleId,
    plateUrls,
    ornamentKey: weddingOrnamentLayoutKey({
      backgroundPresetId: sectionConfig.backgroundPresetId,
      backgroundKitStyleId: sectionConfig.backgroundKitStyleId,
      masterImageUrl: pageBackground,
    }),
    sharedFrame,
  })
  useEffect(() => {
    if (!layoutPreview || window.parent === window) return
    const applyLook = (data: unknown) => {
      const look = readWeddingPreviewLook(data)
      if (!look) return
      const currentKey = weddingOrnamentLayoutKey({
        backgroundPresetId: shownSectionRef.current.backgroundPresetId,
        backgroundKitStyleId: shownSectionRef.current.backgroundKitStyleId,
        masterImageUrl: pageBackgroundRef.current,
      })
      const sameLook = previewLookOnRef.current && weddingPreviewLookToken(look) === previewLookTokenRef.current
      if (look.sectionConfig !== sectionRawRef.current) {
        sectionRawRef.current = look.sectionConfig
        setSectionRaw(look.sectionConfig)
      }
      if (!sameLook) {
        setPreviewLookOn(true)
        setSectionRaw(look.sectionConfig)
        setPreviewPlates(look.plateUrls.length > 0 ? look.plateUrls : [])
        setPreviewStyleId(look.selectedStyleId)
        if (look.ornamentKey !== currentKey) {
          setCoverDraft(null)
          setLetterDraft(null)
          setCoverCard(null)
          setLetterCard(null)
          setCoverShared(null)
          setLetterShared(null)
          setSharedShellDraft(null)
        }
        setSharedFrame(look.sharedFrame)
      }
      const incoming = editorStack === 'letter' ? look.letterOrnaments : look.coverOrnaments
      setLookOrnaments((current) => (weddingOrnamentListsEqual(current, incoming) ? current : incoming))
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      applyLook(event.data)
    }
    window.addEventListener('message', onMessage)
    const ping = () => {
      window.parent.postMessage({ type: WEDDING_PREVIEW_READY_MESSAGE, surface: editorStack ?? '' }, window.location.origin)
    }
    ping()
    const timers = [200, 800, 2000, 4500, 8000].map((ms) => window.setTimeout(ping, ms))
    return () => {
      window.removeEventListener('message', onMessage)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [editorStack, layoutPreview])
  const scrollTimer = useRef<number | null>(null)
  const openedAtRef = useRef(0)
  const frameLinesRef = useRef(frameLines)
  frameLinesRef.current = frameLines
  const flowerHoldRef = useRef(false)
  flowerHoldRef.current = flowerHold
  const resumeAfterFlowerRef = useRef(false)
  const coverScrollRef = useRef<HTMLDivElement>(null)
  const doorStarted = useRef(false)
  const [contentVisible, setContentVisible] = useState(captureStill || (layoutPreview && !coverPreview))
  const [albumOpen, setAlbumOpen] = useState(false)
  const [activeAlbumIndex, setActiveAlbumIndex] = useState<number | null>(null)
  useEffect(() => {
    if (!albumOpen || activeAlbumIndex !== null) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAlbumOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [activeAlbumIndex, albumOpen])
  const [sharePageUrl, setSharePageUrl] = useState('')
  const weddingMusicAudioRef = useRef<WeddingInvitationAudioHandle>(null)
  const reportMusicPlaying = useCallback((playing: boolean) => {
    setMusicFabPlaying(playing)
  }, [])
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('device') === 'desktop' ? 'desktop' : 'mobile'
    if (isIosWeddingWebKit()) document.documentElement.setAttribute('data-wedding-ios', '')
    if (layoutPreview) {
      setViewDevice(view)
      setCoverDesignWidth(view === 'desktop' ? WEDDING_DESKTOP_WIDTH : WEDDING_MOBILE_WIDTH)
      return
    }
    applyWeddingDesignViewport(view, { natural: sampleDemo || params.get('demo') === '1' })
    setViewDevice(view)
    setCoverDesignWidth((sampleDemo || hostPreview) && view === 'desktop' ? WEDDING_DESKTOP_WIDTH : WEDDING_MOBILE_WIDTH)
  }, [hostPreview, layoutPreview, sampleDemo])
  const markPreview = (kind: 'text' | 'shell' | 'frame') => {
    const current = previewKindRef.current
    previewKindRef.current = !current || current === kind ? kind : 'both'
    setPreviewTick((tick) => tick + 1)
  }
  const applyPreviewFrame = (choice: WeddingFrameChoice, side: 'cover' | 'groom' | 'bride' | 'pair') => {
    setSectionRaw((current) => applyPreviewFrameChoice(current, choice, side))
    if (templateEditor) {
      pendingSharedFrameRef.current = {
        frame: weddingSharedFrameFromChoice(choice),
        side: side === 'bride' || side === 'groom' || side === 'pair' ? side : 'cover',
      }
    }
    markPreview('frame')
    setFramePick(null)
  }
  const updateCoverPhotoCrop = (patch: { positionX?: number; positionY?: number; scale?: number }) => {
    setSectionRaw((current) => mergeWeddingSectionConfig(current, {
      ...(patch.positionX !== undefined ? { coverPhotoPositionX: patch.positionX } : {}),
      ...(patch.positionY !== undefined ? { coverPhotoPositionY: patch.positionY } : {}),
      ...(patch.scale !== undefined ? { coverPhotoScale: patch.scale } : {}),
    }))
    markPreview('shell')
  }
  const updatePortraitCrop = (side: 'groom' | 'bride', patch: { positionX?: number; positionY?: number; scale?: number }) => {
    setSectionRaw((current) => mergeWeddingSectionConfig(current, weddingPortraitCropPatch(side, patch)))
    markPreview('shell')
  }
  const coverFrameScaleEdit = visualEdit
    ? {
        scale: resolveCoverFrameScale(sectionConfig),
        label: tCover.frameSizeLabel,
        zoomOutLabel: tCover.coverPhotoZoomOut,
        zoomInLabel: tCover.coverPhotoZoomIn,
        onChange: (scale: number) => {
          setSectionRaw((current) => mergeWeddingSectionConfig(current, { coverFrameScale: clampWeddingFrameScale(scale) }))
          markPreview('shell')
        },
      }
    : undefined
  const coverPhotoEdit = visualEdit && coverPhotoUrl
    ? {
        x: sectionConfig.coverPhotoPositionX ?? 50,
        y: sectionConfig.coverPhotoPositionY ?? 50,
        scale: coverPhotoScale,
        onChange: updateCoverPhotoCrop,
        zoomOutLabel: tCover.coverPhotoZoomOut,
        zoomInLabel: tCover.coverPhotoZoomIn,
      }
    : undefined
  const stackPhotoEdit = (side: 'groom' | 'bride'): WeddingStackedPhotoEdit => {
    const frame = resolvePortraitPhotoFrame(sectionConfig, side)
    return {
      chooseLabel: tCover.choosePhoto,
      changeLabel: tCover.changePhoto,
      onFile: (file) => {
        void uploadPreviewPhoto(side, file)
      },
      crop: {
        x: frame.x,
        y: frame.y,
        scale: frame.scale,
        zoomOutLabel: tCover.coverPhotoZoomOut,
        zoomInLabel: tCover.coverPhotoZoomIn,
        onChange: (patch) => updatePortraitCrop(side, patch),
      },
    }
  }
  const coverEditProps = visualEdit
    ? {
        coverPhotoEdit,
        frameScaleEdit: coverFrameScaleEdit,
        choosePhotoLabel: tCover.choosePhoto,
        changePhotoLabel: tCover.changePhoto,
        onPhotoFile: (file: File) => {
          void uploadPreviewPhoto('cover', file)
        },
        pairLeftEdit: stackPhotoEdit('groom'),
        pairRightEdit: cardStructure.portraitLayout === 'pair' ? stackPhotoEdit('bride') : undefined,
        groomNameEdit: {
          value: groomDraft,
          onChange: (value: string) => editName('groom', value),
          onFocus: () => pickText('groomName'),
          label: tx.groomRole,
        },
        brideNameEdit: cardStructure.nameLayout === 'pair'
          ? {
              value: brideDraft,
              onChange: (value: string) => editName('bride', value),
              onFocus: () => pickText('brideName'),
              label: tx.brideRole,
            }
          : undefined,
      }
    : {}
  const patchShell = (patch: WeddingDeviceShell) => {
    if (templateEditor) {
      setShellDevice('mobile')
      setSharedShellDraft((current) => ({
        ...current,
        mobile: { ...current?.mobile, ...patch },
      }))
    } else {
      setSectionRaw((current) => mergeWeddingSectionConfig(current, withDeviceShell(parseWeddingSectionConfig(current), 'mobile', patch)))
    }
    markPreview('shell')
  }
  const editName = (side: 'groom' | 'bride', value: string) => {
    if (side === 'groom') setGroomDraft(value)
    else setBrideDraft(value)
    markPreview('text')
  }
  const patchPlace = (side: 'groom' | 'bride', key: keyof WeddingPlaceDraft, value: string) => {
    const setDraft = side === 'bride' ? setBridePlaceDraft : setGroomPlaceDraft
    setDraft((current) => ({ ...current, [key]: value }))
    markPreview('text')
  }
  const editCopy = (
    key:
      | 'intro'
      | 'story'
      | 'thanks'
      | 'address'
      | 'time'
      | 'date'
      | 'quote'
      | 'invite'
      | 'inviteEn'
      | 'dress'
      | 'groomParents'
      | 'brideParents'
      | 'groomHometown'
      | 'brideHometown'
      | 'map'
      | 'contact'
      | 'partyTime'
      | 'timeline',
    value: string,
  ) => {
    if (key === 'intro') setIntroDraft(value)
    if (key === 'story') setStoryDraft(value)
    if (key === 'thanks') setThanksDraft(value)
    if (key === 'quote') setQuoteDraft(value)
    if (key === 'invite') setInviteDraft(value)
    if (key === 'inviteEn') setInviteEnDraft(value)
    if (key === 'dress') setDressDraft(value)
    if (key === 'groomParents') setGroomParentsDraft(value)
    if (key === 'brideParents') setBrideParentsDraft(value)
    if (key === 'groomHometown') setGroomHometownDraft(value)
    if (key === 'brideHometown') setBrideHometownDraft(value)
    if (key === 'address') return patchPlace(editSide, 'address', value)
    if (key === 'time') return patchPlace(editSide, 'time', value)
    if (key === 'date') return patchPlace(editSide, 'date', value)
    if (key === 'map') return patchPlace(editSide, 'map', value)
    if (key === 'contact') return patchPlace(editSide, 'contact', value)
    if (key === 'partyTime') return patchPlace(editSide, 'partyTime', value)
    if (key === 'timeline') return patchPlace(editSide, 'timeline', value)
    markPreview('text')
  }
  const setPreviewFlag = (key: 'effects' | 'gift', value: boolean) => {
    if (key === 'effects') setEffectsEnabled(value)
    if (key === 'gift') setGiftQrEnabled(value)
    markPreview('text')
  }
  const updateGiftField = <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => {
    const text = String(value ?? '')
    if (key === 'groomGiftBankId') setGroomGiftBankId(text)
    if (key === 'groomGiftAccountNo') setGroomGiftAccountNo(text)
    if (key === 'groomGiftAccountName') setGroomGiftAccountName(text)
    if (key === 'brideGiftBankId') setBrideGiftBankId(text)
    if (key === 'brideGiftAccountNo') setBrideGiftAccountNo(text)
    if (key === 'brideGiftAccountName') setBrideGiftAccountName(text)
    markPreview('text')
  }
  const textCss = (role: WeddingTextRole) => weddingTextCss(sectionConfig.textStyles?.[role])
  const pickText = (role: WeddingTextRole) => {
    if (!hostEditor || !frameLines) return
    setTextPick(role)
  }
  useEffect(() => {
    if (!textPick) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        setTextPick(null)
        return
      }
      if (target.closest('[data-wedding-text-bar], [data-wedding-text]')) return
      setTextPick(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [textPick])
  const writeTextStyle = (role: WeddingTextRole, patch: { size?: number; font?: 'script' | 'soft' | 'formal' | 'lotus'; color?: string }) => {
    setSectionRaw((current) => {
      const config = parseWeddingSectionConfig(current)
      const prev = config.textStyles?.[role] ?? {}
      return mergeWeddingSectionConfig(current, {
        textStyles: { ...config.textStyles, [role]: { ...prev, ...patch } },
      })
    })
    markPreview('text')
  }
  const shellSource = templateEditor ? withoutPrivateShell(sectionConfig) : sectionConfig
  const sharedShellEntry = sharedShellDraft?.[layoutDevice] ?? sharedShellDraft?.mobile ?? sharedShellDraft?.desktop ?? null
  const shellPlace = resolveDeviceStackPlace(shellSource, layoutDevice, sharedShellEntry)
  const shellGroomRotate = resolveDeviceStackRotate(shellSource, layoutDevice, 'groom', sharedShellEntry)
  const shellBrideRotate = resolveDeviceStackRotate(shellSource, layoutDevice, 'bride', sharedShellEntry)
  const shellFrameScale = resolveDeviceFrameScale(shellSource, layoutDevice, sharedShellEntry)
  const hostShell = hostEditor
    ? {
        place: shellPlace,
        pinLayout: true,
        onPlace: frameLines ? (place: NonNullable<typeof shellPlace>) => patchShell(place) : undefined,
        firstRotate: shellGroomRotate,
        secondRotate: shellBrideRotate,
        onRotate: frameLines
          ? (side: 'first' | 'second', degrees: number) => patchShell(side === 'first' ? { groomRotate: degrees } : { brideRotate: degrees })
          : undefined,
        rotateLabel: tCover.stackFrameRotate,
        rotateLeftLabel: tCover.stackFrameRotateLeft,
        rotateRightLabel: tCover.stackFrameRotateRight,
        moveLabel: tCover.dragPlace,
        moveFrameLabel: tCover.stackMoveFrame,
        moveNameLabel: tCover.stackMoveName,
        frameScale: shellFrameScale,
        frameScaleEdit: frameLines
          ? {
              scale: shellFrameScale,
              label: tCover.frameSizeLabel,
              zoomOutLabel: tCover.coverPhotoZoomOut,
              zoomInLabel: tCover.coverPhotoZoomIn,
              onChange: (scale: number) => patchShell({ frameScale: scale }),
            }
          : undefined,
        firstNameEdit: frameLines
          ? {
              value: groomDraft,
              onChange: (value: string) => editName('groom', value),
              placeholder: tx.groomRole,
              label: tx.groomRole,
              caption: tx.groomRole,
            }
          : undefined,
        secondNameEdit: frameLines
          ? {
              value: brideDraft,
              onChange: (value: string) => editName('bride', value),
              placeholder: tx.brideRole,
              label: tx.brideRole,
              caption: tx.brideRole,
            }
          : undefined,
        firstEdit: frameLines ? stackPhotoEdit('groom') : undefined,
        secondEdit: frameLines ? stackPhotoEdit('bride') : undefined,
        showEmpty: frameLines,
        editTools: frameLines,
      }
    : null
  const previewDraftRef = useRef({
    groomDraft,
    brideDraft,
    introDraft,
    storyDraft,
    thanksDraft,
    quoteDraft,
    inviteDraft,
    inviteEnDraft,
    dressDraft,
    groomParentsDraft,
    brideParentsDraft,
    groomHometownDraft,
    brideHometownDraft,
    groomPlaceDraft,
    bridePlaceDraft,
    sectionRaw,
    sharedShellDraft,
    shellDevice,
    effectsEnabled,
    rsvpEnabled,
    giftQrEnabled,
    groomGiftBankId,
    groomGiftAccountNo,
    groomGiftAccountName,
    brideGiftBankId,
    brideGiftAccountNo,
    brideGiftAccountName,
  })
  previewDraftRef.current = {
    groomDraft,
    brideDraft,
    introDraft,
    storyDraft,
    thanksDraft,
    quoteDraft,
    inviteDraft,
    inviteEnDraft,
    dressDraft,
    groomParentsDraft,
    brideParentsDraft,
    groomHometownDraft,
    brideHometownDraft,
    groomPlaceDraft,
    bridePlaceDraft,
    sectionRaw,
    sharedShellDraft,
    shellDevice,
    effectsEnabled,
    rsvpEnabled,
    giftQrEnabled,
    groomGiftBankId,
    groomGiftAccountNo,
    groomGiftAccountName,
    brideGiftBankId,
    brideGiftAccountNo,
    brideGiftAccountName,
  }
  useEffect(() => {
    const canSave = hostEditor || (layoutPreview && ornamentEditor)
    if (!canSave || previewTick === 0) return
    const timer = window.setTimeout(() => {
      const draft = previewDraftRef.current
      const kind = previewKindRef.current
      previewKindRef.current = null
      const saveText = kind === 'text' || kind === 'both'
      const saveCardShell = (kind === 'shell' || kind === 'both') && !templateEditor
      const saveFrame = (kind === 'frame' || kind === 'both') && !templateEditor
      const saveSharedShell = (kind === 'shell' || kind === 'both') && templateEditor
      const pendingFrame = templateEditor ? pendingSharedFrameRef.current : null
      if (pendingFrame) pendingSharedFrameRef.current = null
      const jobs: Promise<{ ok?: true; error?: string }>[] = []
      if ((saveText || saveCardShell || saveFrame) && !samplePresetId) {
        jobs.push(saveWeddingPreviewEdit(card.id, {
          ...(saveText
            ? {
                groomName: draft.groomDraft,
                brideName: draft.brideDraft,
                coupleIntro: draft.introDraft,
                storyText: draft.storyDraft,
                thankYouText: draft.thanksDraft,
                loveQuote: draft.quoteDraft,
                invitationText: draft.inviteDraft,
                invitationTextEn: draft.inviteEnDraft,
                dressCode: draft.dressDraft,
                eventTimeline: draft.groomPlaceDraft.timeline || draft.bridePlaceDraft.timeline,
                groomParents: draft.groomParentsDraft,
                brideParents: draft.brideParentsDraft,
                groomHometown: draft.groomHometownDraft,
                brideHometown: draft.brideHometownDraft,
                mapUrl: draft.groomPlaceDraft.map || draft.bridePlaceDraft.map,
                groomInviteAddress: draft.groomPlaceDraft.address,
                brideInviteAddress: draft.bridePlaceDraft.address,
                groomInviteReceptionTime: draft.groomPlaceDraft.time,
                brideInviteReceptionTime: draft.bridePlaceDraft.time,
                groomInviteWeddingDate: draft.groomPlaceDraft.date,
                brideInviteWeddingDate: draft.bridePlaceDraft.date,
                groomInviteMapUrl: draft.groomPlaceDraft.map,
                brideInviteMapUrl: draft.bridePlaceDraft.map,
                groomInviteContact: draft.groomPlaceDraft.contact,
                brideInviteContact: draft.bridePlaceDraft.contact,
                groomInvitePartyStartTime: draft.groomPlaceDraft.partyTime,
                brideInvitePartyStartTime: draft.bridePlaceDraft.partyTime,
                groomInviteEventTimeline: draft.groomPlaceDraft.timeline,
                brideInviteEventTimeline: draft.bridePlaceDraft.timeline,
                textStyles: parseWeddingSectionConfig(draft.sectionRaw).textStyles,
                effectsEnabled: draft.effectsEnabled,
                rsvpEnabled: true,
                giftQrEnabled: draft.giftQrEnabled,
                groomGiftBankId: draft.groomGiftBankId,
                groomGiftAccountNo: draft.groomGiftAccountNo,
                groomGiftAccountName: draft.groomGiftAccountName,
                brideGiftBankId: draft.brideGiftBankId,
                brideGiftAccountNo: draft.brideGiftAccountNo,
                brideGiftAccountName: draft.brideGiftAccountName,
              }
            : {}),
          sectionConfig: saveCardShell || saveFrame ? draft.sectionRaw : undefined,
        }))
      }
      if (saveSharedShell) {
        const shell = draft.sharedShellDraft?.[draft.shellDevice]
        if (shell) {
          jobs.push(
            samplePresetId
              ? saveWeddingPresetShell(samplePresetId, draft.shellDevice, shell)
              : saveWeddingTemplateShell(card.id, draft.shellDevice, shell),
          )
        }
      }
      if (pendingFrame) {
        jobs.push(
          samplePresetId
            ? saveWeddingPresetFrame(samplePresetId, pendingFrame.frame, pendingFrame.side)
            : saveWeddingTemplateFrame(card.id, pendingFrame.frame, pendingFrame.side, draft.sectionRaw),
        )
      }
      void Promise.all(jobs).then((results) => {
        if (results.some((result) => !('ok' in result))) toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [card.id, hostEditor, layoutPreview, ornamentEditor, previewTick, samplePresetId, tImage.ornamentAdminFailed, templateEditor, toast])

  useLayoutEffect(() => {
    if (!layoutPreview) return
    doorStarted.current = true
    const html = document.documentElement
    const body = document.body
    html.setAttribute('data-wedding-layout-preview', '')
    html.style.minHeight = '0'
    body.style.minHeight = '0'
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) main.style.minHeight = '0'
    const post = () => {
      const cover = coverPreview ? document.querySelector('[data-cover-preview]') : null
      const letter = document.querySelector('main')
      const target = cover instanceof HTMLElement ? cover : letter instanceof HTMLElement ? letter : document.documentElement
      const height = Math.ceil(target.getBoundingClientRect().height)
      window.parent.postMessage({ type: 'wedding-preview-height', height }, window.location.origin)
    }
    post()
    const observer = new ResizeObserver(post)
    observer.observe(document.documentElement)
    const timers = [400, 1200, 2800].map((ms) => window.setTimeout(post, ms))
    return () => {
      observer.disconnect()
      timers.forEach((id) => window.clearTimeout(id))
      html.removeAttribute('data-wedding-layout-preview')
    }
  }, [coverCard, coverDraft, layoutPreview, letterCard, letterDraft])

  useEffect(() => {
    setMusicLoadFailed(false)
    setMusicFabPlaying(false)
  }, [musicDraftUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSharePageUrl(window.location.href)
  }, [])

  useEffect(() => {
    return () => {
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    }
  }, [])

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const html = document.documentElement
    const previousAnchor = html.style.overflowAnchor
    html.style.overflowAnchor = 'none'
    const onHide = () => {
      if (scrollTimer.current) {
        window.clearTimeout(scrollTimer.current)
        scrollTimer.current = null
      }
      stopWeddingInvitationAutoScroll()
    }
    let snapTimer = 0
    let snap: (() => void) | null = null
    const clearSnap = () => {
      if (snapTimer) window.clearTimeout(snapTimer)
      snapTimer = 0
      if (snap) window.removeEventListener('scroll', snap)
      snap = null
    }
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      onHide()
      scrollWeddingPageToTop()
      clearSnap()
      const until = performance.now() + 900
      let last = 0
      snap = () => {
        const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
        const jumped = y - last > 180
        last = y
        if (performance.now() < until && jumped) scrollWeddingPageToTop()
      }
      window.addEventListener('scroll', snap, { passive: true })
      snapTimer = window.setTimeout(clearSnap, 900)
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      clearSnap()
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
      html.style.overflowAnchor = previousAnchor
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  const revealEditCover = () => {
    setEditFace('cover')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const revealEditLetter = () => {
    setEditFace('letter')
    setContentVisible(true)
    window.requestAnimationFrame(() => {
      document.getElementById('wedding-letter-edit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const placeOrnament = (src: string) => {
    const surface = weddingOrnamentVisibleSurface()
    const current = surface === 'letter' ? (letterDraft ?? letterShown) : (coverDraft ?? coverShown)
    const spot = weddingOrnamentSpotOnPage(current.length, surface)
    setEditFace(surface)
    if (surface === 'letter') setLetterDraft([...current, { src, x: spot.x, y: spot.y, w: spot.w, free: true }])
    else setCoverDraft([...current, { src, x: spot.x, y: spot.y, w: spot.w, free: true }])
  }
  const enterEditMode = () => {
    setEditFace('cover')
    setTextPick(null)
    setFramePick(null)
    setLookOpen(false)
    doorStarted.current = false
    setOpened(false)
    setCoverGate(true)
    setContentVisible(true)
    setFrameLines(true)
  }
  const enterBrowseMode = () => {
    setEditFace('cover')
    setTextPick(null)
    setFramePick(null)
    setLookOpen(false)
    doorStarted.current = false
    setOpened(false)
    setCoverGate(true)
    setContentVisible(false)
    weddingMusicAudioRef.current?.pausePlayback()
    scrollWeddingPageToTop()
    setFrameLines(false)
  }

  useLayoutEffect(() => {
    if (!editorContent) return
    const html = document.documentElement
    const body = document.body
    html.style.overflow = opened ? '' : 'hidden'
    body.style.overflow = opened ? '' : 'hidden'
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
    }
  }, [editorContent, opened])

  useLayoutEffect(() => {
    if (opened || hostPreview || editorContent || (hostEditor && frameLines)) return
    stopWeddingInvitationAutoScroll()
    const pin = () => {
      const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
      if (y > 0) scrollWeddingPageToTop()
    }
    pin()
    const onShow = () => {
      stopWeddingInvitationAutoScroll()
      scrollWeddingPageToTop()
    }
    window.addEventListener('scroll', pin, { passive: true })
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('scroll', pin)
      window.removeEventListener('pageshow', onShow)
    }
  }, [editorContent, frameLines, hostEditor, hostPreview, opened])

  const chooseLetterHouse = (view: 'groom' | 'bride' | 'both') => {
    setLetterView(view)
    setHouseAskOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    openInvitation()
  }

  const requestOpen = () => {
    if (coverPreview) return
    if (hostEditor && frameLines) {
      revealEditLetter()
      return
    }
    if (letterView == null) {
      setHouseAskOpen(true)
      return
    }
    openInvitation()
  }

  useEffect(() => {
    if (!opened || !coverGate) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setCoverGate(false), reduced ? 0 : 520)
    return () => window.clearTimeout(timer)
  }, [coverGate, opened])

  const openInvitation = () => {
    if (doorStarted.current || opened) return
    doorStarted.current = true
    allowWeddingPageScroll()
    primeWeddingPageScroll()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (effectsEnabled) void weddingMusicAudioRef.current?.playFromUserGesture()
    setContentVisible(true)
    setOpened(true)
    openedAtRef.current = performance.now()
    if (!effectsEnabled) return
    if (hostEditor && (frameLinesRef.current || flowerHoldRef.current)) return
    if (reduced) {
      startWeddingInvitationAutoScroll()
      return
    }
    scrollTimer.current = window.setTimeout(() => {
      if (hostEditor && (frameLinesRef.current || flowerHoldRef.current)) return
      startWeddingInvitationAutoScroll()
    }, 5600)
  }

  useEffect(() => {
    if (!hostEditor) return
    if (frameLines || flowerHold || !opened || !effectsEnabled) {
      if (flowerHold && opened && !frameLines) resumeAfterFlowerRef.current = true
      else if (frameLines || !opened) resumeAfterFlowerRef.current = false
      if (scrollTimer.current) {
        window.clearTimeout(scrollTimer.current)
        scrollTimer.current = null
      }
      stopWeddingInvitationAutoScroll()
      return
    }
    const resumeHere = resumeAfterFlowerRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const elapsed = openedAtRef.current ? performance.now() - openedAtRef.current : 5600
    const delay = resumeHere || reduced ? 0 : Math.max(0, 5600 - elapsed)
    const timer = window.setTimeout(() => {
      resumeAfterFlowerRef.current = false
      startWeddingInvitationAutoScroll(resumeHere ? { fromCurrent: true } : undefined)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      stopWeddingInvitationAutoScroll()
    }
  }, [effectsEnabled, flowerHold, frameLines, hostEditor, opened])

  useEffect(() => {
    if (!hostEditor || frameLines) return
    setChromeHold(false)
    let timer: number | null = null
    let shown = false
    let overChrome = false
    let pressingChrome = false
    let gesture: { id: number; x: number; y: number; moved: boolean } | null = null
    const clearTimer = () => {
      if (!timer) return
      window.clearTimeout(timer)
      timer = null
    }
    const onChrome = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-wedding-host-chrome]'))
    const onFlower = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-ornament-hit], [data-ornament-tools], [role="dialog"]'))
    /** Nút trên thiệp (bản đồ, Mở thiệp, Có đi, Không đi, …) giữ cú bấm của chính nó. */
    const onCardControl = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(target.closest('a, button, input, textarea, select, label, summary, [role="button"], [role="link"]'))
    const conceal = () => {
      clearTimer()
      if (!shown) return
      shown = false
      setChromeHold(false)
    }
    const onFlowerIdle = () => conceal()
    window.addEventListener('wedding-browse-flower-idle', onFlowerIdle)
    const armHide = () => {
      clearTimer()
      timer = window.setTimeout(() => {
        timer = null
        if (overChrome || pressingChrome) return
        conceal()
      }, 3200)
    }
    const reveal = () => {
      if (!shown) {
        shown = true
        setChromeHold(true)
      }
      armHide()
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (onFlower(event.target)) return
      if (onChrome(event.target)) {
        overChrome = true
        pressingChrome = true
        gesture = null
        clearTimer()
        if (!shown) {
          shown = true
          setChromeHold(true)
        }
        return
      }
      overChrome = false
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    }
    const onMove = (event: PointerEvent) => {
      if (pressingChrome) return
      if (onChrome(event.target)) {
        overChrome = true
        clearTimer()
        return
      }
      if (overChrome) {
        overChrome = false
        if (shown) armHide()
      }
      if (!gesture || gesture.id !== event.pointerId) return
      const dist = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y)
      if (dist > 12) gesture.moved = true
    }
    const onUp = (event: PointerEvent) => {
      if (pressingChrome) {
        pressingChrome = false
        overChrome = onChrome(event.target)
        if (overChrome) return
        armHide()
      }
      if (!gesture || gesture.id !== event.pointerId) return
      const tap = !gesture.moved
      gesture = null
      if (!tap || onChrome(event.target) || onFlower(event.target)) return
      if (onCardControl(event.target)) {
        conceal()
        return
      }
      reveal()
    }
    const onLeaveChrome = (event: PointerEvent) => {
      if (!onChrome(event.target)) return
      const next = event.relatedTarget
      if (next instanceof Element && next.closest('[data-wedding-host-chrome]')) return
      overChrome = false
      if (!pressingChrome) armHide()
    }
    const onWheel = (event: WheelEvent) => {
      if (onChrome(event.target)) return
      conceal()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    window.addEventListener('pointerout', onLeaveChrome, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
      window.removeEventListener('pointerout', onLeaveChrome, true)
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('wedding-browse-flower-idle', onFlowerIdle)
      clearTimer()
    }
  }, [hostEditor, frameLines])

  useEffect(() => {
    if (!hostEditor) return
    if (frameLines) {
      doorStarted.current = false
      setOpened(false)
      setCoverGate(true)
      setContentVisible(true)
      return
    }
    doorStarted.current = false
    setOpened(false)
    setCoverGate(true)
    setContentVisible(false)
    setTextPick(null)
    setEditFace('cover')
    setFramePick(null)
    setLookOpen(false)
    scrollWeddingPageToTop()
  }, [frameLines, hostEditor])

  useLayoutEffect(() => {
    if (hostPreview) {
      allowWeddingPageScroll()
      releaseWeddingPageScrollLock()
      return
    }
    if (opened) {
      // Cùng lượt chạm Mở thiệp: gỡ khóa cuộn rồi nudge, iOS mới nhận scrollTo sau đó.
      allowWeddingPageScroll()
      primeWeddingPageScroll()
      const until = performance.now() + 900
      let last = 0
      const snapRestorationJump = () => {
        const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
        const jumped = y - last > 180
        last = y
        if (performance.now() < until && jumped) scrollWeddingPageToTop()
      }
      window.addEventListener('scroll', snapRestorationJump, { passive: true })
      return () => window.removeEventListener('scroll', snapRestorationJump)
    }
    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [hostPreview, opened])

  const guestDisplayName = useMemo(
    () => initialGuestDisplayName.trim() || card.guestName.trim(),
    [card.guestName, initialGuestDisplayName],
  )

  useEffect(() => {
    if (!guestDisplayName) return
    setGuestName((current) => current.trim() || guestDisplayName)
  }, [guestDisplayName])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromUrl = new URLSearchParams(window.location.search).get('email')
    if (fromUrl?.trim()) setReminderEmail(fromUrl.trim().toLowerCase())
  }, [])

  /** Lọc nội dung tiệc theo bên (nhà trai/gái) — từ URL, truyền từ server để tránh flash khi hydrate. */
  const guestDisplayVenue = useMemo((): WeddingGuestInviteVenue => {
    if (letterView === 'groom') return 'groom_home'
    if (letterView === 'bride') return 'bride_home'
    if (letterView === 'both') return ''
    return normalizeGuestInviteVenue(initialGuestInviteVenue)
  }, [initialGuestInviteVenue, letterView])

  /** Khối tên khách + địa chỉ trên bìa: lựa chọn nhà, URL venue, hoặc cài đặt preview. */
  const guestBlockVenue = useMemo((): WeddingGuestInviteVenue => {
    if (letterView === 'groom') return 'groom_home'
    if (letterView === 'bride') return 'bride_home'
    if (letterView === 'both' || letterView == null) return ''
    const fromUrl = normalizeGuestInviteVenue(initialGuestInviteVenue)
    return fromUrl || normalizeGuestInviteVenue(card.guestInviteVenue)
  }, [card.guestInviteVenue, initialGuestInviteVenue, letterView])

  const guestBlockVenueDisplay = useMemo(
    () => guestInviteVenueLabel(guestBlockVenue, tx),
    [guestBlockVenue, tx],
  )

  const textTokens = useMemo(
    () => ({
      groomName: asEditor ? groomDraft : card.groomName,
      brideName: asEditor ? brideDraft : card.brideName,
      guestName: guestDisplayName,
    }),
    [brideDraft, card.brideName, card.groomName, groomDraft, guestDisplayName, hostEditor],
  )

  const personalize = useCallback(
    (text: string) => resolveWeddingCardDisplayText(text, textTokens, uiLocale),
    [textTokens, uiLocale],
  )

  const nameHighlightClass = cn('font-semibold', theme.accentText, theme.textGlowHeading)
  const guestNameScriptClass = theme.contentCard === 'scallop'
    ? nameHighlightClass
    : cn(WEDDING_GUEST_NAME_CLASS, 'text-[1.45em] leading-none', theme.text, theme.textGlowHeading)
  const writeGuestName = useCallback(
    (text: string) => renderWeddingGuestName(text, guestDisplayName, guestNameScriptClass),
    [guestDisplayName, guestNameScriptClass],
  )

  const viewCard = useMemo(() => {
    if (!asEditor) return card
    return {
      ...card,
      groomName: groomDraft,
      brideName: brideDraft,
      coupleIntro: introDraft,
      storyText: storyDraft,
      thankYouText: thanksDraft,
      loveQuote: quoteDraft,
      invitationText: inviteDraft,
      invitationTextEn: inviteEnDraft,
      dressCode: dressDraft,
      eventTimeline: timelineDraft,
      mapUrl: mapDraft,
      partyStartTime: partyTimeDraft,
      groomParents: groomParentsDraft,
      brideParents: brideParentsDraft,
      groomHometown: groomHometownDraft,
      brideHometown: brideHometownDraft,
      groomInviteAddress: groomPlaceDraft.address,
      groomInviteReceptionTime: groomPlaceDraft.time,
      groomInviteWeddingDate: groomPlaceDraft.date || null,
      groomInvitePartyStartTime: groomPlaceDraft.partyTime,
      groomInviteMapUrl: groomPlaceDraft.map,
      groomInviteContact: groomPlaceDraft.contact,
      groomInviteEventTimeline: groomPlaceDraft.timeline,
      brideInviteAddress: bridePlaceDraft.address,
      brideInviteReceptionTime: bridePlaceDraft.time,
      brideInviteWeddingDate: bridePlaceDraft.date || null,
      brideInvitePartyStartTime: bridePlaceDraft.partyTime,
      brideInviteMapUrl: bridePlaceDraft.map,
      brideInviteContact: bridePlaceDraft.contact,
      brideInviteEventTimeline: bridePlaceDraft.timeline,
      sectionConfig: sectionRaw,
      effectsEnabled,
      rsvpEnabled,
      giftQrEnabled,
      groomGiftBankId,
      groomGiftAccountNo,
      groomGiftAccountName,
      brideGiftBankId,
      brideGiftAccountNo,
      brideGiftAccountName,
    }
  }, [
    brideDraft,
    brideGiftAccountName,
    brideGiftAccountNo,
    brideGiftBankId,
    brideParentsDraft,
    brideHometownDraft,
    bridePlaceDraft,
    card,
    dressDraft,
    effectsEnabled,
    giftQrEnabled,
    groomDraft,
    groomGiftAccountName,
    groomGiftAccountNo,
    groomGiftBankId,
    groomHometownDraft,
    groomParentsDraft,
    groomPlaceDraft,
    hostEditor,
    introDraft,
    inviteDraft,
    inviteEnDraft,
    mapDraft,
    partyTimeDraft,
    quoteDraft,
    rsvpEnabled,
    sectionRaw,
    storyDraft,
    thanksDraft,
    timelineDraft,
  ])
  const guestInviteLocation = useMemo(
    () => resolveGuestInviteLocation(asEditor ? viewCard : card, guestDisplayVenue),
    [card, guestDisplayVenue, hostEditor, viewCard],
  )
  const guestBlockLocation = useMemo(
    () => resolveGuestInviteLocation(asEditor ? viewCard : card, guestBlockVenue),
    [card, guestBlockVenue, hostEditor, viewCard],
  )

  const displayWeddingDateIso = useMemo(
    () => resolveWeddingDateIso(guestInviteLocation.weddingDate),
    [guestInviteLocation.weddingDate],
  )
  const displayWeddingDateLabel = useMemo(
    () =>
      formatWeddingDateForDisplay(
        displayWeddingDateIso ?? guestInviteLocation.weddingDate ?? card.weddingDate,
        uiLocale,
      ),
    [card.weddingDate, displayWeddingDateIso, guestInviteLocation.weddingDate, uiLocale],
  )
  const sharedCopyAddresses = useMemo(() => weddingSharedCopyAddresses(card), [card])
  const polishButton = (field: WeddingPolishField, value: string, onChange: (next: string) => void) => (
    <WeddingAiPolishButton
      field={field}
      value={value}
      onChange={onChange}
      locale={uiLocale}
      groomName={groomDraft}
      brideName={brideDraft}
      weddingDate={displayWeddingDateLabel || card.weddingDate}
      occasionKey={card.occasionKey}
      omitAddresses={sharedCopyAddresses}
    />
  )
  const withoutPartyAddress = useCallback(
    (text: string) => omitWeddingAddressesFromSharedCopy(text, sharedCopyAddresses),
    [sharedCopyAddresses],
  )
  const displayPersonalInvite = initialPersonalInvite.trim()
  const displayCoverPhotoUrl =
    coverPhotoUrlUnlessBackground(guestInviteLocation.coverImageUrl, pageBackground) || coverPhotoUrl
  const displayInvitationText = withoutPartyAddress(asEditor ? inviteDraft : guestInviteLocation.invitationText || card.invitationText)
  const displayInvitationTextEn = withoutPartyAddress(asEditor ? inviteEnDraft : guestInviteLocation.invitationTextEn || card.invitationTextEn)
  const shownInviteBody = useMemo(() => {
    const side = letterView === 'bride' ? 'bride' : letterView === 'groom' ? 'groom' : null
    if (asEditor && side) {
      const built = buildWeddingDemoPersonalInvite({
        side,
        groomName: groomDraft,
        brideName: brideDraft,
        groomParents: groomParentsDraft,
        brideParents: brideParentsDraft,
        weddingDate: guestBlockLocation.weddingDate,
        receptionTime: guestBlockLocation.receptionTime,
        partyStartTime: guestBlockLocation.partyStartTime,
        address: guestBlockLocation.address,
        guestName: guestDisplayName,
        locale: uiLocale,
        occasionKey: card.occasionKey,
      }).personalInvite.trim()
      if (built) return built
    }
    return displayPersonalInvite || personalize(tx.defaultInvitation)
  }, [
    brideDraft,
    brideParentsDraft,
    card.occasionKey,
    displayPersonalInvite,
    guestBlockLocation.address,
    guestBlockLocation.partyStartTime,
    guestBlockLocation.receptionTime,
    guestBlockLocation.weddingDate,
    guestDisplayName,
    groomDraft,
    groomParentsDraft,
    hostEditor,
    letterView,
    personalize,
    tx.defaultInvitation,
    uiLocale,
  ])
  const displayTimeline = useMemo(
    () => parseWeddingEventTimeline(asEditor ? timelineDraft : guestInviteLocation.eventTimeline || card.eventTimeline),
    [card.eventTimeline, guestInviteLocation.eventTimeline, hostEditor, timelineDraft],
  )
  const displayDressCode = withoutPartyAddress(asEditor ? dressDraft : guestInviteLocation.dressCode || card.dressCode)
  const displayThankYou = withoutPartyAddress(asEditor ? thanksDraft : guestInviteLocation.thankYouText || card.thankYouText)
  const displayVenue = asEditor ? addressDraft : guestInviteLocation.address || card.venue
  const displayMapUrl = asEditor ? mapDraft : guestInviteLocation.mapUrl || card.mapUrl
  const displayQuote = withoutPartyAddress(asEditor ? quoteDraft : card.loveQuote)
  const groomFamilyLine = asEditor ? groomParentsDraft : card.groomParents || card.groomName
  const brideFamilyLine = asEditor ? brideParentsDraft : card.brideParents || card.brideName
  const groomHometownLine = asEditor ? groomHometownDraft : card.groomInviteAddress.trim() || card.groomHometown
  const brideHometownLine = asEditor ? brideHometownDraft : card.brideInviteAddress.trim() || card.brideHometown
  const showBothHouses = letterView === 'both' && cardStructure.venueLayout !== 'one' && (cardStructure.venueLayout === 'two' || secondVenueOpen)
  const calendarExportInput = useMemo(
    () => ({
      title: personalize(tx.calendarEventTitle),
      description: personalize(displayInvitationText || tx.calendarEventDescription),
      location: displayVenue,
      weddingDateIso: (displayWeddingDateIso ?? weddingDateIso) ?? '',
      weddingTimeText: asEditor ? timeDraft : guestInviteLocation.receptionTime || card.weddingTime,
      partyStartTime: asEditor ? partyTimeDraft : guestInviteLocation.partyStartTime || card.partyStartTime,
      url: sharePageUrl || undefined,
    }),
    [
      card.brideName,
      card.groomName,
      card.partyStartTime,
      card.weddingTime,
      displayInvitationText,
      displayVenue,
      displayWeddingDateIso,
      guestInviteLocation.partyStartTime,
      guestInviteLocation.receptionTime,
      hostEditor,
      partyTimeDraft,
      sharePageUrl,
      timeDraft,
      tx.calendarEventDescription,
      tx.calendarEventTitle,
      weddingDateIso,
      personalize,
    ],
  )

  const saveGuestRsvp = useCallback(
    async (willAttend: boolean, adult: number, child: number, quiet = false) => {
      const name = (guestName.trim() || guestDisplayName).trim()
      if (!name) return
      const seq = ++rsvpSeq.current
      if (!quiet) setSubmitting(true)
      const safeAdult = willAttend ? Math.max(0, Math.min(20, adult)) : 0
      const safeChild = willAttend ? Math.max(0, Math.min(20, child)) : 0
      const formData = new FormData()
      formData.append('guestName', name)
      formData.append('attending', String(willAttend))
      formData.append('adultCount', String(safeAdult))
      formData.append('childCount', String(safeChild))
      formData.append('guestCount', String(safeAdult + safeChild))
      formData.append('message', quiet ? '' : message)
      formData.append('inviteVenue', guestDisplayVenue)
      const result = await submitWeddingGuestResponse(card.slug, formData)
      if (seq !== rsvpSeq.current) return
      if (!quiet) setSubmitting(false)
      if ('error' in result) {
        toast({ title: tx.submitErrorTitle, description: result.error, variant: 'destructive' })
        return
      }
      setGuestName(name)
      setAttending(willAttend)
      setCoverRsvpChoice(willAttend ? 'yes' : 'no')
      setContentChoice(willAttend ? 'yes' : 'no')
      if (!quiet) toast({ title: tx.submitSuccessTitle, description: tx.submitSuccessDesc })
      router.refresh()
    },
    [card.slug, guestDisplayName, guestDisplayVenue, guestName, message, router, toast, tx.submitErrorTitle, tx.submitSuccessDesc, tx.submitSuccessTitle],
  )

  const submit = async () => {
    if (!contentChoice) {
      toast({ title: tx.submitErrorTitle, description: tx.rsvpChoiceRequired, variant: 'destructive' })
      return
    }
    const willAttend = contentChoice === 'yes'
    const adult = willAttend ? partyAdult : 0
    const child = willAttend ? partyChild : 0
    setSubmitting(true)
    const formData = new FormData()
    formData.append('guestName', guestName)
    formData.append('attending', String(willAttend))
    formData.append('adultCount', String(adult))
    formData.append('childCount', String(child))
    formData.append('guestCount', String(adult + child))
    formData.append('message', message)
    formData.append('inviteVenue', guestDisplayVenue)
    const result = await submitWeddingGuestResponse(card.slug, formData)
    setSubmitting(false)
    if ('error' in result) {
      toast({ title: tx.submitErrorTitle, description: result.error, variant: 'destructive' })
      return
    }
    setAttending(willAttend)
    setCoverRsvpChoice(willAttend ? 'yes' : 'no')
    setContentChoice(willAttend ? 'yes' : 'no')
    toast({ title: tx.submitSuccessTitle, description: tx.submitSuccessDesc })
    setMessage('')
    router.refresh()
  }

  const openPartyModal = () => {
    if (submitting) return
    const adult = partyAdult + partyChild > 0 ? partyAdult : 1
    setDraftAdult(adult)
    setDraftChild(partyChild)
    setPartyModalOpen(true)
  }

  const confirmPartyModal = async () => {
    const adult = Math.max(0, Math.min(20, draftAdult))
    const child = Math.max(0, Math.min(20, draftChild))
    const safeAdult = adult + child > 0 ? adult : 1
    if (reminderEmail.trim() && (displayWeddingDateIso ?? weddingDateIso)) {
      const reminded = await submitReminder()
      if (!reminded) return
    }
    setPartyAdult(safeAdult)
    setPartyChild(child)
    setPartyModalOpen(false)
    setCoverRsvpChoice('yes')
    setContentChoice('yes')
    setAttending(true)
    void saveGuestRsvp(true, safeAdult, child)
  }

  const chooseCoverNo = () => {
    if (coverRsvpChoice === 'no' || submitting) return
    setPartyModalOpen(false)
    setCoverRsvpChoice('no')
    setContentChoice('no')
    setAttending(false)
    void saveGuestRsvp(false, 0, 0)
  }

  const submitReminder = async (): Promise<boolean> => {
    setReminderSubmitting(true)
    const formData = new FormData()
    formData.append('guestEmail', reminderEmail)
    formData.append('guestName', guestName.trim() || guestDisplayName)
    formData.append('daysBefore', reminderDaysBefore)
    formData.append('inviteVenue', guestDisplayVenue)
    formData.append('locale', uiLocale)
    const result = await subscribeWeddingReminder(card.slug, formData)
    setReminderSubmitting(false)
    if ('errorCode' in result && result.errorCode) {
      const desc =
        result.errorCode === 'INVALID_EMAIL'
          ? tx.reminderErrorInvalidEmail
          : result.errorCode === 'INVALID_DAYS'
            ? tx.reminderErrorInvalidDays
            : result.errorCode === 'NO_WEDDING_DATE'
              ? tx.reminderErrorNoDate
              : result.errorCode === 'WEDDING_PASSED'
                ? tx.reminderErrorPassed
                : result.errorCode === 'DAYS_TOO_LARGE'
                  ? tx.reminderErrorDaysTooLarge
                  : tx.reminderErrorGeneric
      toast({ title: tx.reminderErrorTitle, description: desc, variant: 'destructive' })
      return false
    }
    toast({
      title: tx.reminderSuccessTitle,
      description: tx.reminderSuccessDesc.replace('{days}', String(result.daysBefore ?? reminderDaysBefore)),
    })
    return true
  }

  return (
    <>
      <style>{`html:has([data-wedding-public]) [data-nanoai-chrome]{display:none !important}html:has([data-wedding-public]) [data-nanoai-shell]{padding-bottom:0 !important}`}</style>
      <div data-wedding-public="" hidden />
      <WeddingGuestNameFontLink />
      <Toaster />
      {partyModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={tx.coverPartyClose}
            onClick={() => setPartyModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-party-modal-title"
            className="relative max-h-[min(36rem,calc(100dvh-2rem))] w-full max-w-sm overflow-y-auto rounded-[1.5rem] bg-[#fff8f0] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <p id="pw-party-modal-title" className="font-serif text-xl font-semibold text-stone-900">
                {tx.coverAttendYes}
              </p>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-lg text-stone-700"
                aria-label={tx.coverPartyClose}
                onClick={() => setPartyModalOpen(false)}
              >
                ×
              </button>
            </div>
            <WeddingPartyCountFields
              adultCount={draftAdult}
              childCount={draftChild}
              adultLabel={tx.rsvpAdultLabel}
              childLabel={tx.rsvpChildLabel}
              disabled={submitting || reminderSubmitting}
              onChange={(adult, child) => {
                setDraftAdult(adult)
                setDraftChild(child)
              }}
            />
            {(displayWeddingDateIso ?? weddingDateIso) ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-white/80 p-3 text-left">
                <p className="text-sm font-semibold text-stone-800">{tx.coverReminderOptIn}</p>
                <p className="mt-1 text-[11px] leading-4 text-stone-500">{tx.reminderHint}</p>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-stone-800">{tx.reminderEmailLabel}</span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={reminderEmail}
                    disabled={submitting || reminderSubmitting}
                    onChange={(event) => setReminderEmail(event.target.value)}
                    placeholder={tx.reminderEmailPlaceholder}
                    className="mt-1 h-9 w-full rounded-full border border-stone-300 bg-white px-3 text-sm text-stone-900"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-stone-800">{tx.reminderDaysLabel}</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    inputMode="numeric"
                    value={reminderDaysBefore}
                    disabled={submitting || reminderSubmitting}
                    onChange={(event) => setReminderDaysBefore(event.target.value)}
                    placeholder={tx.reminderDaysPlaceholder}
                    className="mt-1 h-9 w-full rounded-full border border-stone-300 bg-white px-3 text-center text-sm text-stone-900"
                  />
                  <span className="mt-1 block text-[11px] leading-4 text-stone-500">{tx.reminderDaysHint}</span>
                </label>
              </div>
            ) : null}
            <button
              type="button"
              disabled={submitting || reminderSubmitting || draftAdult + draftChild < 1}
              onClick={() => void confirmPartyModal()}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full border-2 font-bold shadow-[0_6px_18px_rgba(0,0,0,0.28)] disabled:opacity-60"
              {...rsvpFill}
            >
              {submitting || reminderSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tx.coverPartyConfirm}
            </button>
          </div>
        </div>
      ) : null}
      {houseAskOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center text-neutral-900 shadow-2xl">
            <p className="font-serif text-xl">{tx.letterViewAsk}</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="h-11 rounded-full border-2 border-blue-700 bg-blue-100 font-semibold text-blue-950" onClick={() => chooseLetterHouse('groom')}>
                {tx.groomFamily}
              </button>
              <button type="button" className="h-11 rounded-full border-2 border-pink-600 bg-pink-100 font-semibold text-pink-950" onClick={() => chooseLetterHouse('bride')}>
                {tx.brideFamily}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {opened && effectsEnabled && !layoutPreview && !captureStill ? (
        <WeddingOpenEffects play burst={openBurstEffect} fall={openFallEffect} fallSeconds={openFallSeconds} themeId={theme.id} lookId={readyBackground?.id} />
      ) : null}
      {sampleDemo && !hostEditor && !captureStill && !quietFrame ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/95 p-1 shadow" role="group" aria-label={tImage.previewDesktop}>
            {(['desktop', 'mobile'] as const).map((id) => {
              const active = viewDevice === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  className={active ? 'h-8 rounded-full bg-neutral-900 px-3 text-xs font-semibold text-white' : 'h-8 rounded-full px-3 text-xs text-neutral-600'}
                  onClick={() => {
                    const nextUrl = new URL(window.location.href)
                    nextUrl.searchParams.set('device', id)
                    window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
                    applyWeddingDesignViewport(id, { natural: true })
                    setViewDevice(id)
                    setCoverDesignWidth(id === 'desktop' ? WEDDING_DESKTOP_WIDTH : WEDDING_MOBILE_WIDTH)
                  }}
                >
                  {id === 'desktop' ? tImage.previewDesktop : tImage.previewMobile}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      {hostEditor && !frameLines ? (
        <WeddingDraggableChrome storageKey="wedding-host-browse-chrome" defaultCorner="top-right" hidden={!chromeHold}>
          <div className="w-56 rounded-2xl bg-white/95 p-1.5 shadow-lg ring-1 ring-black/10">
            <button
              type="button"
              className="h-10 w-full rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white"
              onClick={enterEditMode}
            >
              {tImage.previewEditMode}
            </button>
            <WeddingOrnamentAdminBar
              locale={uiLocale}
              compact
              hint={`${tImage.ornamentAdminOnDevice.replace('{device}', viewDevice === 'desktop' ? tImage.previewDesktop : tImage.previewMobile)} ${templateEditor ? tImage.ornamentTemplateHint : tImage.ornamentCardHint}`}
              addLabel={tImage.ornamentAdminAdd}
              saveLabel={tImage.ornamentAdminSave}
              resetLabel={tImage.ornamentAdminReset}
              dirty={activeDraft != null}
              saving={ornamentSaving}
              showReset={!templateEditor}
              onAdd={placeOrnament}
              onReset={() => void resetOrnaments()}
            />
            <button
              type="button"
              className="mt-1 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-900"
              onClick={() => {
                window.location.assign(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(card.id)}`)
              }}
            >
              <X className="h-4 w-4" />
              {tx.exitPreviewFab}
            </button>
          </div>
        </WeddingDraggableChrome>
      ) : null}
      {hostEditor && !sampleDemo ? (
        <Dialog open={lookOpen} onOpenChange={(open) => { if (!lookBusy) setLookOpen(open) }}>
          <DialogContent overlayClassName="z-[200]" className="z-[200] flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle>{tImage.previewChangeLook}</DialogTitle>
              <DialogDescription>{tImage.previewChangeLookHint}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <WeddingSampleGallery
                locale={uiLocale}
                open={lookOpen}
                initialOccasion={card.occasionKey}
                cardOccasion={card.occasionKey}
                selectedId={lookPick}
                heading={tImage.sampleCardsTitle}
                aiHeading={tImage.sampleAiCardsTitle}
                libraryHeading={tImage.libraryAllHeading}
                hint=""
                photoNote={tImage.sampleCardPhotos}
                disabled={lookBusy}
                confirmLabel={tImage.backgroundPickedOk}
                confirmCloseLabel={tImage.previewChangeLookClose}
                confirmHint={tImage.previewChangeLookHint}
                onPreview={(sample) => setLookPick(sample.id)}
                onConfirm={(sample) => void applyPickedLook(sample.id)}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {hostEditor && frameLines ? (
        <Dialog open={framePick != null} onOpenChange={(open) => { if (!open) setFramePick(null) }}>
          <DialogContent overlayClassName="z-[200]" className="z-[200] flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle>{tCover.chooseFrame}</DialogTitle>
              <DialogDescription>{tCover.heroLayoutHint}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <WeddingFrameChoiceGrid
                locale={uiLocale}
                followLabel={tCover.frameFollowBackground}
                noneLabel={tCover.frameModeNone}
                kitPresetId={kitFrameId}
                library={frameLibrary.map((item) => ({
                  id: item.id,
                  imageUrl: item.imageUrl,
                  hole: item.hole,
                  panel: item.panel,
                  ink: item.ink,
                }))}
                selectedKey={weddingPreviewFrameSelectionKey(
                  sectionConfig,
                  framePick === 'bride' ? 'bride' : framePick === 'groom' || framePick === 'pair' ? 'groom' : 'cover',
                )}
                onChoose={(choice) => applyPreviewFrame(choice, framePick ?? 'cover')}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {hostPreview || sampleDemo ? <div className="pointer-events-none fixed inset-0 -z-10 bg-neutral-200" /> : null}
      <div className="contents">
      {hostEditor && frameLines ? (
        <WeddingDraggableChrome storageKey="wedding-host-edit-chrome" defaultCorner="top-right">
          <div className="w-56 rounded-2xl bg-white/95 p-1.5 shadow-lg ring-1 ring-black/10" role="group" aria-label={tImage.previewEditMode}>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-0.5">
            {(['desktop', 'mobile'] as const).map((id) => {
              const active = viewDevice === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  className={active ? 'h-8 rounded-lg bg-neutral-950 text-xs font-semibold text-white' : 'h-8 rounded-lg text-xs font-medium text-neutral-600'}
                  onClick={() => {
                    const draft = activeDraft
                    const show = () => {
                      const nextUrl = new URL(window.location.href)
                      nextUrl.searchParams.set('device', id)
                      window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
                      applyWeddingDesignViewport(id, { natural: true })
                      setViewDevice(id)
                      setCoverDesignWidth(id === 'desktop' ? WEDDING_DESKTOP_WIDTH : WEDDING_MOBILE_WIDTH)
                    }
                    if (!draft) {
                      show()
                      return
                    }
                    const surface = activeSurface
                    const saveDraft = samplePresetId
                      ? saveWeddingPresetOrnaments(samplePresetId, 'mobile', draft, surface)
                      : saveWeddingCardOrnaments(card.id, 'mobile', draft, surface)
                    void saveDraft.then((result) => {
                      if (result && 'ok' in result) {
                        if (surface === 'letter') {
                          if (templateEditor) setLetterShared(draft)
                          else setLetterCard(draft)
                          setLetterDraft(null)
                        } else if (templateEditor) {
                          setCoverShared(draft)
                          setCoverCard(null)
                          setCoverDraft(null)
                        } else {
                          setCoverCard(draft)
                          setCoverDraft(null)
                        }
                      } else {
                        toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
                      }
                      show()
                    })
                  }}
                >
                  {id === 'desktop' ? tImage.previewDesktop : tImage.previewMobile}
                </button>
              )
            })}
            </div>
            {!sampleDemo ? (
              <button
                type="button"
                className="mt-1 h-9 w-full rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-950"
                onClick={() => {
                  setLookPick('')
                  setLookOpen(true)
                }}
              >
                {tImage.previewChangeLook}
              </button>
            ) : null}
            <button
              type="button"
              className="mt-1 h-9 w-full rounded-xl bg-rose-600 text-xs font-semibold text-white"
              onClick={enterBrowseMode}
            >
              {tImage.previewBrowseMode}
            </button>
            <button
              type="button"
              className="mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white text-xs font-semibold text-rose-900"
              onClick={() => {
                window.location.assign(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(card.id)}`)
              }}
            >
              <X className="h-3.5 w-3.5" />
              {tx.exitPreviewFab}
            </button>
          </div>
        </WeddingDraggableChrome>
      ) : null}
      <main
        data-wedding-paper={theme.contentCard || undefined}
        data-wedding-reading={readingPlate ? '' : undefined}
        data-wedding-text-veil={weddingTextUsesVeil(readyBackground) ? '' : undefined}
        className={cn('relative z-0', layoutPreview ? 'min-h-0' : 'min-h-screen', (hostPreview || sampleDemo) && 'mx-auto max-w-full shadow-2xl', theme.pageBg, theme.text, kitSurface.className)}
        style={{ ...kitSurface.style, ...(readingPlate ? { ['--wedding-reading-plate' as string]: readingPlate } : {}), width: sampleDemo || hostPreview ? (viewDevice === 'desktop' ? (sampleDemo ? 'min(100vw, 90rem)' : 'min(72rem, calc(100vw - 3rem))') : `${WEDDING_MOBILE_WIDTH}px`) : undefined }}
      >
        {coverGate && (
          <>
            <div className={cn(coverPreview && 'relative z-10', opened && 'pointer-events-none wedding-cover-leave')} ref={coverPreview ? coverScrollRef : undefined}>
              <FittedCoverFrame
                active={!coverPreview}
                contain={hostPreview}
                fitHeight={sampleDemo}
                fitFrame={editorContent}
                designWidth={coverDesignWidth}
                backgroundColor={stageColor}
                maxScale={hostPreview || sampleDemo ? undefined : 1}
              >
              <div
                data-cover-preview={coverPreview ? '' : undefined}
                data-wedding-stage=""
                data-cover-theme={theme.id}
                className="relative mx-auto w-full overflow-visible bg-cover bg-center"
                style={{
                  ...weddingBackgroundStyle(
                    (previewLookOn ? '' : guestInviteLocation.coverImageUrl) || pageBackground,
                    theme,
                    WEDDING_BG_OVERLAY.cover,
                    { readingVignette: true },
                  ),
                  backgroundColor: stageColor,
                }}
              >
              <div data-wedding-ornament-frame="" data-wedding-ornament-surface="cover" className={effectsEnabled ? 'wedding-cover-ornament-open' : undefined}>
              {(ornamentEditor && coverPreview) || browseFlowers ? null : (
                <WeddingBackgroundOrnamentLayer ornaments={coverShown} animateRise={!hostEditor && !editorContent} className="absolute inset-0 z-20" />
              )}
              {(ornamentEditor && coverPreview) || browseFlowers ? (
                <WeddingOrnamentAdminLayer
                  ornaments={coverShown}
                  editable
                  className="absolute inset-0 z-[80]"
                  surface={editorStack ?? 'cover'}
                  zoomInLabel={tImage.ornamentAdminZoomIn}
                  zoomOutLabel={tImage.ornamentAdminZoomOut}
                  rotateLeftLabel={tImage.ornamentAdminRotateLeft}
                  rotateRightLabel={tImage.ornamentAdminRotateRight}
                  blurLabel={tImage.ornamentAdminBlur}
                  fadeLabel={tImage.ornamentAdminFade}
                  stillLabel={tImage.ornamentAdminMotionStill}
                  riseLabel={tImage.ornamentAdminMotionRise}
                  deleteLabel={tImage.ornamentAdminDelete}
                  frameLines={frameLines}
                  showTools={browseFlowers ? true : undefined}
                  toolIdleMs={browseFlowers ? 2000 : undefined}
                  onSelectionChange={browseFlowers ? onCoverFlowerSelection : undefined}
                  onToolsIdle={browseFlowers ? hideFlowerChrome : undefined}
                  onChange={setCoverDraft}
                />
              ) : null}
              </div>
              <div data-wedding-sheet-content="" data-wedding-cover-pad="" className={cn('flex flex-col items-center px-3 pb-4 pt-3 sm:px-4', weddingCoverCentersOnStage(coverPresetId) ? 'justify-center' : 'justify-start', ornamentEditor && coverPreview && 'pointer-events-none')} style={weddingCoverCentersOnStage(coverPresetId) ? { minHeight: coverDesignWidth >= WEDDING_DESKTOP_MIN_PX ? WEDDING_DESKTOP_HEIGHT : WEDDING_MOBILE_HEIGHT } : undefined}>
                <div
                  data-wedding-cover-column=""
                  className={cn(
                    'w-full max-w-[min(26rem,calc(100%-1.5rem))] sm:max-w-[min(28rem,calc(100%-2rem))] lg:max-w-[min(48rem,calc(100%-4rem))]',
                  )}
                >
                  {visualEdit ? (
                    <div className="pointer-events-auto relative z-50 mb-3 flex flex-wrap items-center justify-center gap-1.5">
                      <label className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-200 bg-white/95 px-3 text-[11px] font-semibold text-neutral-800 shadow-sm">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-rose-600"
                          checked={effectsEnabled}
                          onChange={(event) => setPreviewFlag('effects', event.target.checked)}
                        />
                        {tImage.previewEffectsEnable}
                      </label>
                      <button
                        type="button"
                        className="h-8 shrink-0 whitespace-nowrap rounded-full border border-neutral-200 bg-white/95 px-3 text-[11px] font-semibold text-neutral-800 shadow-sm"
                        onClick={revealEditLetter}
                      >
                        {tImage.previewLetter}
                      </button>
                    </div>
                  ) : null}
                  <WeddingCoverShellCard
                    fitViewport
                    breathe={false}
                    namesFlyIn={effectsEnabled}
                    presetId={coverPresetId}
                    aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                    frameMode={coverFrameMode}
                    photoOpen={coverPhotoOpen}
                    frameOpen={coverFrameOpen}
                    openMotion={effectsEnabled}
                    coverPhotoUrl={displayCoverPhotoUrl}
                    coverPhotoObjectPosition={coverPhotoObjectPosition}
                    coverPhotoScale={coverPhotoScale}
                    frameScale={resolveCoverFrameScale(sectionConfig)}
                    {...coverEditProps}
                    groomName={asEditor ? groomDraft : card.groomName}
                    brideName={asEditor ? brideDraft : card.brideName}
                    nameLayout={cardStructure.nameLayout}
                    weddingDate={displayWeddingDateLabel}
                    weddingTimeText={asEditor ? timeDraft || guestInviteLocation.displayTime || weddingDisplayTime : guestInviteLocation.displayTime || weddingDisplayTime}
                    guestName={guestDisplayName || undefined}
                    guestInviteVenue={guestBlockVenue}
                    guestInviteVenueLabel={guestBlockVenueDisplay || undefined}
                    editSide={visualEdit && (letterView === 'groom' || letterView === 'bride') ? letterView : undefined}
                    addressText={(asEditor ? addressDraft : guestBlockLocation.address) || undefined}
                    mapUrl={(asEditor ? mapDraft : guestBlockLocation.mapUrl) || undefined}
                    viewMapLabel={tx.guestInviteViewMap}
                    theme={theme}
                    invitationLabel={tx.invitation}
                    cordiallyInvitesLabel={tx.cordiallyInvites}
                    personalInviteText={shownInviteBody}
                    openButtonLabel={tx.openInvitation}
                    dateFallback={tx.dateFallback}
                    photoAlt={tx.coverPhotoAlt}
                    pairLeftUrl={groomPhotoUrl}
                    pairRightUrl={cardStructure.portraitLayout === 'pair' ? bridePhotoUrl : ''}
                    pairLeftCrop={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                    pairRightCrop={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                    stackPair={
                      heroStack
                        ? {
                            firstUrl: groomPhotoUrl,
                            secondUrl: bridePhotoUrl,
                            firstAlt: tx.groomRole,
                            secondAlt: tx.brideRole,
                            firstFrame: resolvePortraitPhotoFrame(sectionConfig, 'groom'),
                            secondFrame: resolvePortraitPhotoFrame(sectionConfig, 'bride'),
                            firstCaption: tx.groomRole,
                            secondCaption: tx.brideRole,
                            frameShell: groomShell ?? brideShell,
                            firstShell: groomShell,
                            secondShell: brideShell,
                            ...{
                              frameScale: shellFrameScale,
                              place: shellPlace,
                              firstRotate: shellGroomRotate,
                              secondRotate: shellBrideRotate,
                              ...(hostShell ?? {}),
                            },
                            firstNameStyle: textCss('groomName'),
                            secondNameStyle: textCss('brideName'),
                            onNamePress: hostEditor && frameLines ? (side) => pickText(side === 'first' ? 'groomName' : 'brideName') : undefined,
                          }
                        : undefined
                    }
                    buttonColor={buttonColor}
                    rsvpButtonColor={coverRsvpColor}
                    quickRsvp={
                      rsvpEnabled && guestDisplayName
                        ? {
                            yesLabel: tx.coverAttendYes,
                            noLabel: tx.coverAttendNo,
                            savedYesLabel: tx.coverRsvpSavedYes,
                            savedNoLabel: tx.coverRsvpSavedNo,
                            busy: submitting || partyModalOpen,
                            choice: coverRsvpChoice,
                            partyCount: partyAdult + partyChild,
                            onYes: openPartyModal,
                            onNo: chooseCoverNo,
                          }
                        : undefined
                    }
                    onOpen={requestOpen}
                  />
                </div>
              </div>
              </div>
              </FittedCoverFrame>
            </div>
          </>
        )}
        {/* Vỏ: tên bay từ hai bên một lần lúc hiện. Bấm mở thì gỡ vỏ và chạy chữ bên trong, không phát lại vỏ. */}
        {contentVisible && !coverPreview && !visualEdit ? (
          <nav
            data-wedding-letter-nav=""
            className={cn(
              'fixed top-0 z-[80] max-w-full -translate-x-1/2 border-b px-2 py-2 text-sm sm:px-3 sm:py-2.5',
              'left-1/2',
              theme.nav,
            )}
            style={{ width: sampleDemo || hostPreview ? (viewDevice === 'desktop' ? (sampleDemo ? 'min(100vw, 90rem)' : 'min(72rem, calc(100vw - 3rem))') : `${WEDDING_MOBILE_WIDTH}px`) : `min(100%, ${coverDesignWidth}px)` }}
          >
            <div className="mx-auto flex max-w-3xl snap-x gap-1 overflow-x-auto overscroll-x-contain px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
              <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#cover">{tx.navInvitation}</a>
              <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#event">{tx.navEvent}</a>
              <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#story">{tx.navStory}</a>
              <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#guest">{tx.navRsvp}</a>
            </div>
          </nav>
        ) : null}
        {!coverPreview ? (
        <div
          id="wedding-letter-edit"
          aria-hidden={contentVisible ? undefined : true}
          className={contentVisible ? 'relative pt-12' : 'pointer-events-none absolute inset-x-0 h-0 overflow-hidden opacity-0'}
        >
        {visualEdit ? (
          <div className="absolute inset-x-0 top-0 z-30 flex justify-center px-3 pt-3">
            <button
              type="button"
              className="h-8 rounded-full border border-neutral-200 bg-white/95 px-3 text-[11px] font-semibold text-neutral-800 shadow-sm"
              onClick={revealEditCover}
            >
              {tImage.previewCover}
            </button>
          </div>
        ) : null}
        <FittedCoverFrame active={!layoutPreview} designWidth={coverDesignWidth} backgroundColor="transparent" flow maxScale={hostPreview || sampleDemo ? undefined : 1}>
        {opened ? (
          <WeddingScrollingBackground
            urls={plateUrls.length > 0 ? plateUrls : pageBackground ? [pageBackground] : []}
            fallbackColor={stageColor}
          />
        ) : null}
        <div aria-hidden data-wedding-paper-wash="" className="pointer-events-none absolute inset-0" style={{ ...contentSurface, zIndex: 0 }} />
        <div data-wedding-letter-copy="" className={cn('relative', ornamentEditor && editorStack && 'pointer-events-none')} style={{ opacity: contentVisible ? 1 : 0 }}>
        <WeddingInvitationMotion enabled={effectsEnabled && !layoutPreview} instant={visualEdit} open={contentVisible}>
        {ornamentEditor && !editorStack && !asEditor ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-40">
            <div className="pointer-events-auto bg-white/95 px-3 py-2 shadow-sm">
            <WeddingOrnamentAdminBar
              locale={uiLocale}
              hint={`${tImage.ornamentAdminOnDevice.replace('{device}', tImage.previewMobile)} ${templateEditor ? tImage.ornamentTemplateHint : tImage.ornamentCardHint}`}
              addLabel={tImage.ornamentAdminAdd}
              saveLabel={tImage.ornamentAdminSave}
              resetLabel={tImage.ornamentAdminReset}
              dirty={letterDraft != null}
              saving={ornamentSaving}
              showReset={!templateEditor}
              onAdd={(src) => {
                const current = letterDraft ?? letterShown
                const spot = weddingOrnamentSpotOnPage(current.length, 'letter')
                setLetterDraft([...current, { src, x: spot.x, y: spot.y, w: spot.w, free: true }])
              }}
              onReset={() => void letterSave.reset()}
            />
            </div>
          </div>
        ) : null}
        <section
          id="cover"
          className={cn(
            'relative flex items-center justify-center px-3 sm:px-4',
            'min-h-0 py-4',
          )}
        >
          <WeddingReadableGlass themeId={theme.id} className="w-full min-w-0 max-w-3xl rounded-[1.75rem] p-5 text-center sm:rounded-[2.25rem] sm:p-6">
            {envelopeCover ? null : (
            <p className={cn(theme.contentCard === 'scallop' ? 'text-sm font-semibold uppercase tracking-[0.14em] sm:text-base sm:tracking-[0.18em]' : 'text-[11px] uppercase tracking-[0.28em] sm:text-xs sm:tracking-[0.4em]', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-kicker', theme.accentText, theme.textGlow)}>{tx.invitation}</p>
            )}
            {envelopeCover ? null : (
            <>
            <WeddingCoupleNames
              groomName={asEditor ? groomDraft : card.groomName}
              brideName={asEditor ? brideDraft : card.brideName}
              layout={cardStructure.nameLayout}
              flyIn={contentVisible && effectsEnabled}
              pace="opened"
              groomEdit={visualEdit ? {
                value: groomDraft,
                onChange: (value) => editName('groom', value),
                onFocus: () => pickText('groomName'),
                label: tx.groomRole,
              } : undefined}
              brideEdit={visualEdit && cardStructure.nameLayout === 'pair' ? {
                value: brideDraft,
                onChange: (value) => editName('bride', value),
                onFocus: () => pickText('brideName'),
                label: tx.brideRole,
              } : undefined}
              className={cn('mt-3 font-serif text-[clamp(1.35rem,8cqi,4.25rem)] font-semibold italic leading-none', theme.contentCard === 'scallop' && 'wedding-guest-name not-italic', theme.text, theme.textGlowHeading)}
            />
            {cardStructure.nameLayout === 'primary' && card.brideName.trim() ? (
              <p className={cn('mt-1 font-serif text-base italic sm:text-lg', theme.text, theme.textGlow)}>{card.brideName.trim()}</p>
            ) : null}
            </>
            )}
            {envelopeCover ? null : (
            <div className={cn('mt-1 mb-0 text-3xl leading-none sm:text-4xl', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-ornament', theme.accent, theme.textGlow)}>{theme.ornament}</div>
            )}
            <div>
            {envelopeCover ? (
              <div className={cn('mx-auto mt-1 w-full max-w-[32rem]', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-shell')}>
                <WeddingCoverShellCard
                  frameOnly
                  presetId={coverPresetId}
                  aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                  frameMode={coverFrameMode}
                  coverPhotoUrl={displayCoverPhotoUrl}
                  coverPhotoObjectPosition={coverPhotoObjectPosition}
                  coverPhotoScale={coverPhotoScale}
                  frameScale={resolveCoverFrameScale(sectionConfig)}
                  {...coverEditProps}
                  groomName={asEditor ? groomDraft : card.groomName}
                  brideName={asEditor ? brideDraft : card.brideName}
                  nameLayout={cardStructure.nameLayout}
                  theme={theme}
                  invitationLabel={tx.invitation}
                  cordiallyInvitesLabel={tx.cordiallyInvites}
                  openButtonLabel={tx.openInvitation}
                  dateFallback={tx.dateFallback}
                  photoAlt={tx.coverPhotoAlt}
                  pairLeftUrl={groomPhotoUrl}
                  pairRightUrl={cardStructure.portraitLayout === 'pair' ? bridePhotoUrl : ''}
                  pairLeftCrop={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                  pairRightCrop={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                />
              </div>
            ) : null}
            {displayQuote ? (
              <WeddingGuestTextSlot
                editing={visualEdit}
                draft={quoteDraft}
                ariaLabel={tImage.previewQuote}
                textKey="quote"
                onFocus={() => {}}
                toolbar={polishButton('loveQuote', quoteDraft, (value) => editCopy('quote', value))}
                onChange={(value) => editCopy('quote', value)}
                className={cn('mx-auto mt-4 max-w-lg font-serif sm:mt-5', theme.contentCard === 'scallop' ? 'text-xl font-semibold not-italic leading-8 sm:text-[1.65rem] sm:leading-9' : 'text-lg italic leading-7 sm:text-xl sm:leading-8', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-quote', theme.accentText, theme.textGlow)}
              >
                “{writeGuestName(personalize(displayQuote))}”
              </WeddingGuestTextSlot>
            ) : null}
            {!envelopeCover && !(heroStack || (coverFrameMode === 'none' && !displayCoverPhotoUrl)) ? (
              <div className={cn('mx-auto mt-6 w-full sm:mt-7', coverFrameMode === 'preset' || coverFrameMode === 'library' || coverFrameMode === 'ai' || coverFrameMode === 'none' ? (weddingCoverPhotoHead(coverPresetId) === 'leaf' ? 'max-w-2xl' : 'max-w-[32rem]') : '', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-invite')}>
                <WeddingCoverShellCard
                  frameOnly
                  presetId={coverPresetId}
                  aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                  frameMode={coverFrameMode}
                  coverPhotoUrl={displayCoverPhotoUrl}
                  coverPhotoObjectPosition={coverPhotoObjectPosition}
                  coverPhotoScale={coverPhotoScale}
                  frameScale={resolveCoverFrameScale(sectionConfig)}
                  {...coverEditProps}
                  groomName={asEditor ? groomDraft : card.groomName}
                  brideName={asEditor ? brideDraft : card.brideName}
                  nameLayout={cardStructure.nameLayout}
                  theme={theme}
                  invitationLabel={tx.invitation}
                  cordiallyInvitesLabel={tx.cordiallyInvites}
                  openButtonLabel={tx.openInvitation}
                  dateFallback={tx.dateFallback}
                  photoAlt={tx.coverPhotoAlt}
                  pairLeftUrl={groomPhotoUrl}
                  pairRightUrl={cardStructure.portraitLayout === 'pair' ? bridePhotoUrl : ''}
                  pairLeftCrop={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                  pairRightCrop={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                />
              </div>
            ) : null}
            {guestDisplayName ? (
              <WeddingGuestInviteBlock
                className="mx-auto mt-1 max-w-xl"
                guestName={guestDisplayName}
                inviteVenue={guestBlockVenue}
                cordiallyInvitesLabel={tx.cordiallyInvites}
                venueLabel={guestBlockVenueDisplay}
                editSide={visualEdit && (letterView === 'groom' || letterView === 'bride') ? letterView : undefined}
                weddingDateLabel={displayWeddingDateLabel || undefined}
                weddingTimeText={guestBlockLocation.displayTime || weddingDisplayTime}
                addressText={guestBlockLocation.address}
                mapUrl={guestBlockLocation.mapUrl}
                viewMapLabel={tx.guestInviteViewMap}
                personalInviteText={shownInviteBody}
                personalInviteClassName={cn('max-w-xl', theme.contentCard === 'scallop' ? 'text-base font-semibold leading-7 sm:text-lg sm:leading-8' : 'text-sm leading-7 sm:text-base sm:leading-8', theme.contentCard === 'scallop' ? theme.text : theme.mutedText, theme.textGlow)}
                plainBodyName={theme.contentCard === 'scallop'}
                scriptLines={contentVisible && effectsEnabled}
                panelClassName={theme.panelStrong}
                cordiallyClassName={cn(theme.contentCard === 'scallop' ? 'text-sm font-semibold tracking-normal sm:text-base' : '', theme.contentCard === 'scallop' ? theme.text : theme.mutedText, theme.textGlow)}
                nameClassName={cn(theme.text, theme.textGlowHeading)}
                venueClassName={cn(theme.accentText, theme.textGlow, 'tracking-wide')}
                addressClassName={cn(theme.mutedText, theme.textGlow)}
                weddingThemeId={theme.id}
                buttonColor={buttonColor}
              />
            ) : (
              <p className={cn('mx-auto mt-1 max-w-xl whitespace-pre-line', theme.contentCard === 'scallop' ? 'text-base font-medium leading-7 sm:text-lg sm:leading-8' : 'text-sm leading-7 sm:text-base sm:leading-8', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-invite', theme.mutedText, theme.textGlow)}>
                {writeGuestName(personalize(shownInviteBody))}
              </p>
            )}
            {displayInvitationTextEn && !displayPersonalInvite ? (
              <p className={cn('mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-7', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-invite-en', theme.mutedText, theme.textGlow)}>
                {writeGuestName(personalize(displayInvitationTextEn))}
              </p>
            ) : null}
            {(displayWeddingDateIso ?? weddingDateIso) ? (
              <div className={cn('mx-auto mt-6 max-w-lg', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-after')}>
                <WeddingCountdownBlock
                  weddingDateIso={(displayWeddingDateIso ?? weddingDateIso)!}
                  weddingTimeText={guestInviteLocation.receptionTime || card.weddingTime}
                  partyStartTime={guestInviteLocation.partyStartTime || card.partyStartTime}
                  locale={uiLocale}
                  tx={txCal}
                  className={cn(theme.textGlow, 'font-medium')}
                  onDarkPaper={Boolean(theme.darkPaper) && theme.contentCard !== 'scallop'}
                />
              </div>
            ) : null}
            {(showMusic || visualEdit) && !captureStill && (
              <div className={cn('relative mx-auto mt-5 w-full rounded-3xl p-4 text-left', contentVisible && effectsEnabled && 'wedding-open-line wedding-open-after', theme.panelUi)}>
                {visualEdit ? (
                  <div className={showMusic ? 'mb-3' : undefined}>
                    <WeddingMusicLibraryPicker
                      items={musicLibrary}
                      selectedUrl={musicDraftUrl}
                      credit={tMu.seedCredit}
                      chooseLabel={tMu.chooseMusic}
                      chooseAgainLabel={tMu.chooseAgain}
                      previewLabel={tMu.previewListen}
                      stopPreviewLabel={tMu.stopPreview}
                      okLabel={tMu.confirmPick}
                      title={tMu.pickerTitle}
                      uploadLabel={tMu.uploadLabel}
                      uploadHint={tMu.uploadHint}
                      uploadProgress={tMu.uploadProgress}
                      uploadSaved={tMu.uploadSaved}
                      uploadPartial={tMu.uploadPartial}
                      uploadSkipped={tMu.uploadSkipped}
                      uploadTooLarge={tMu.uploadTooLarge}
                      uploadInvalidType={tMu.uploadInvalidType}
                      uploadFailed={tMu.uploadFailed}
                      deleteTrackLabel={tMu.deleteTrack}
                      deleteTrackConfirm={tMu.deleteTrackConfirm}
                      deleteDenied={tMu.deleteDenied}
                      deleteFailed={tMu.deleteFailed}
                      canDelete={templateEditor}
                      onLibraryChange={setMusicLibrary}
                      onTrackRemoved={(audioUrl) => {
                        if (musicDraftUrl !== audioUrl) return
                        void choosePreviewMusic('')
                      }}
                      onSelect={(audioUrl) => {
                        void choosePreviewMusic(audioUrl)
                      }}
                    />
                  </div>
                ) : null}
                {showMusic ? (
                <>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Music className={cn('h-4 w-4', theme.accent)} />
                  {tx.musicTitle}
                </p>
                <WeddingInvitationAudio
                  ref={weddingMusicAudioRef}
                  src={demoMix.length ? '' : musicDraftUrl}
                  trackQueue={demoMix.length ? demoMix : undefined}
                  loop={demoMix.length === 0}
                  playStartSec={demoMix.length ? null : card.musicPlayStartSec}
                  playEndSec={demoMix.length ? null : card.musicPlayEndSec}
                  preload={demoMix.length ? 'none' : 'auto'}
                  className="w-full"
                  onSourceError={() => setMusicLoadFailed(true)}
                  onReady={() => setMusicLoadFailed(false)}
                  onPlayingChange={reportMusicPlaying}
                  aria-label={
                    uiLocale === 'en'
                      ? 'Play invitation background music'
                      : uiLocale === 'zh'
                        ? '播放请柬背景音乐'
                        : uiLocale === 'ja'
                          ? '招待状のBGMを再生'
                          : uiLocale === 'ko'
                            ? '청첩장 배경음악 재생'
                            : 'Phát nhạc nền thiệp'
                  }
                />
                {musicLoadFailed && (
                  <p className="mt-2 text-xs text-destructive">{txMusic.playbackLoadFailed}</p>
                )}
                </>
                ) : null}
              </div>
            )}
            </div>
          </WeddingReadableGlass>
        </section>

        <section
          className="px-3 py-3 sm:px-4"
        >
          <div className={PUBLIC_COLUMN}>
            {(visualEdit || groomFamilyLine.trim() || groomHometownLine.trim() || (cardStructure.venueLayout !== 'one' && (brideFamilyLine.trim() || brideHometownLine.trim()))) ? (
            <WeddingReadableGlass className="rounded-[1.75rem] p-4 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('text-[11px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]', theme.accentText, theme.textGlow)}>{tx.familiesIntro}</p>
              <div className={cn('mt-4 grid gap-2 sm:mt-6 sm:gap-4', cardStructure.venueLayout !== 'one' && (visualEdit || brideFamilyLine.trim() || brideHometownLine.trim()) && (visualEdit || groomFamilyLine.trim() || groomHometownLine.trim()) && 'grid-cols-2')}>
                {(visualEdit || groomFamilyLine.trim() || groomHometownLine.trim()) ? (
                  <div className={cn('min-w-0 rounded-2xl p-2.5 sm:rounded-3xl sm:p-4', theme.panelStrong, visualEdit && 'text-left')}>
                    {visualEdit ? (
                      <div className="space-y-2">
                        <p data-wedding-field-name="" style={weddingEditSideLabelStyle('groom', true)}>{tx.groomFamily}</p>
                        {polishButton('parentsLine', groomParentsDraft, (value) => editCopy('groomParents', value))}
                        <textarea
                          aria-label={tx.groomFamily}
                          value={groomParentsDraft}
                          onChange={(event) => editCopy('groomParents', event.target.value)}
                          rows={2}
                          className={`w-full rounded-xl border border-dashed ${WEDDING_EDIT_SIDE.groom.fieldBorder} bg-white/80 px-3 py-2 text-sm text-stone-900`}
                        />
                        <input
                          aria-label={tx.hometownLabel}
                          value={groomHometownDraft}
                          onChange={(event) => editCopy('groomHometown', event.target.value)}
                          placeholder={tx.hometownLabel}
                          className={`h-10 w-full rounded-xl border border-dashed ${WEDDING_EDIT_SIDE.groom.fieldBorder} bg-white/80 px-3 text-sm text-stone-900`}
                        />
                      </div>
                    ) : (
                      <>
                        <p className={cn('text-sm', theme.mutedText, theme.textGlow)}>
                          {tx.groomFamily}
                        </p>
                        {groomFamilyLine.trim() ? (
                          <p className={cn('mt-1 whitespace-pre-line break-words font-serif text-base leading-snug sm:text-xl', theme.text, theme.textGlow)}>{groomFamilyLine}</p>
                        ) : null}
                        {groomHometownLine.trim() ? (
                          <p className={cn('mt-1.5 whitespace-pre-line break-words text-xs leading-5 sm:mt-2 sm:text-base sm:leading-6', theme.mutedText, theme.textGlow)}>
                            {tx.hometownLabel}: {groomHometownLine.trim()}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
                {(cardStructure.venueLayout !== 'one' && (visualEdit || brideFamilyLine.trim() || brideHometownLine.trim())) ? (
                  <div className={cn('min-w-0 rounded-2xl p-2.5 sm:rounded-3xl sm:p-4', theme.panelStrong, visualEdit && 'text-left')}>
                    {visualEdit ? (
                      <div className="space-y-2">
                        <p data-wedding-field-name="" style={weddingEditSideLabelStyle('bride', true)}>{tx.brideFamily}</p>
                        {polishButton('parentsLine', brideParentsDraft, (value) => editCopy('brideParents', value))}
                        <textarea
                          aria-label={tx.brideFamily}
                          value={brideParentsDraft}
                          onChange={(event) => editCopy('brideParents', event.target.value)}
                          rows={2}
                          className={`w-full rounded-xl border border-dashed ${WEDDING_EDIT_SIDE.bride.fieldBorder} bg-white/80 px-3 py-2 text-sm text-stone-900`}
                        />
                        <input
                          aria-label={tx.hometownLabel}
                          value={brideHometownDraft}
                          onChange={(event) => editCopy('brideHometown', event.target.value)}
                          placeholder={tx.hometownLabel}
                          className={`h-10 w-full rounded-xl border border-dashed ${WEDDING_EDIT_SIDE.bride.fieldBorder} bg-white/80 px-3 text-sm text-stone-900`}
                        />
                      </div>
                    ) : (
                      <>
                        <p className={cn('text-sm', theme.mutedText, theme.textGlow)}>
                          {tx.brideFamily}
                        </p>
                        {brideFamilyLine.trim() ? (
                          <p className={cn('mt-1 whitespace-pre-line break-words font-serif text-base leading-snug sm:text-xl', theme.text, theme.textGlow)}>{brideFamilyLine}</p>
                        ) : null}
                        {brideHometownLine.trim() ? (
                          <p className={cn('mt-1.5 whitespace-pre-line break-words text-xs leading-5 sm:mt-2 sm:text-base sm:leading-6', theme.mutedText, theme.textGlow)}>
                            {tx.hometownLabel}: {brideHometownLine.trim()}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </WeddingReadableGlass>
            ) : null}
            {!heroStack && (visualEdit || groomPhotoUrl.trim() || bridePhotoUrl.trim()) ? (
              <WeddingReadableGlass reveal className="rounded-[1.75rem] px-4 py-5 text-center sm:rounded-[2rem] sm:px-6 sm:py-7">
                <WeddingCouplePortraits
                  groomName={asEditor ? groomDraft : card.groomName}
                  brideName={asEditor ? brideDraft : card.brideName}
                  groomImageUrl={groomPhotoUrl}
                  brideImageUrl={bridePhotoUrl}
                  layout={cardStructure.portraitLayout}
                  groomLabel={tx.groomRole}
                  brideLabel={tx.brideRole}
                  groomFrame={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                  brideFrame={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                  groomShell={groomShell}
                  brideShell={brideShell}
                  groomFrameScale={resolvePortraitFrameScale(sectionConfig, 'groom')}
                  brideFrameScale={resolvePortraitFrameScale(sectionConfig, 'bride')}
                  theme={theme}
                  showEmpty={visualEdit}
                  choosePhotoLabel={tCover.choosePhoto}
                  groomChoosePhotoLabel={tCover.chooseGroomPhoto}
                  brideChoosePhotoLabel={tCover.chooseBridePhoto}
                  chooseFrameLabel={tCover.chooseFrame}
                  onPhotoFile={visualEdit ? (side, file) => { void uploadPreviewPhoto(side, file) } : undefined}
                  onChooseFrame={visualEdit ? (side) => setFramePick(side) : undefined}
                  groomPhotoEdit={visualEdit ? stackPhotoEdit('groom').crop : undefined}
                  bridePhotoEdit={visualEdit ? stackPhotoEdit('bride').crop : undefined}
                  pairFrameScaleEdit={
                    visualEdit && cardStructure.portraitLayout === 'pair'
                      ? {
                          scale: resolvePortraitFrameScale(sectionConfig, 'groom'),
                          label: tCover.frameSizeLabel,
                          zoomOutLabel: tCover.coverPhotoZoomOut,
                          zoomInLabel: tCover.coverPhotoZoomIn,
                          onChange: (scale) => {
                            const value = clampWeddingFrameScale(scale)
                            setSectionRaw((current) => mergeWeddingSectionConfig(current, {
                              groomPortraitFrameScale: value,
                              bridePortraitFrameScale: value,
                            }))
                            markPreview('shell')
                          },
                        }
                      : undefined
                  }
                />
              </WeddingReadableGlass>
            ) : null}
            <WeddingReadableGlass id="story" reveal className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('text-[11px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]', theme.accentText, theme.textGlow)}>{tx.coupleIntroTitle}</p>
              <WeddingGuestTextSlot
                editing={Boolean(hostEditor && frameLines)}
                draft={introDraft}
                ariaLabel={tx.coupleIntroTitle}
                textKey="intro"
                onFocus={() => pickText('intro')}
                toolbar={polishButton('coupleIntro', introDraft, (value) => editCopy('intro', value))}
                onChange={(value) => editCopy('intro', value)}
                style={textCss('intro')}
                className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}
              >
                {renderWeddingHighlightedText(
                  withoutPartyAddress(asEditor ? introDraft : card.coupleIntro) || withoutPartyAddress(asEditor ? storyDraft : card.storyText) || tx.defaultCoupleIntro,
                  textTokens,
                  uiLocale,
                  nameHighlightClass,
                  guestNameScriptClass,
                )}
              </WeddingGuestTextSlot>
              {visualEdit && albumPhotoUrls.length === 0 ? (
                <div className="mt-4 flex justify-center">
                  <div>
                    <WeddingDeviceFileInput
                      className="h-12 min-w-[11.5rem] rounded-full bg-[#f0c14b] px-7 text-base font-bold tracking-wide text-[#3f2a12] shadow-[0_6px_16px_rgba(0,0,0,0.28)] ring-2 ring-[#fff3c4]"
                      multiple
                      label={
                        <span className="inline-flex items-center gap-2">
                          <ImagePlus className="h-5 w-5" aria-hidden />
                          {tCover.chooseWeddingAlbum}
                        </span>
                      }
                      onFiles={(files) => {
                        if (!files.length) return
                        const body = new FormData()
                        body.set('cardId', card.id)
                        for (const file of files) body.append('albumImages', file)
                        void saveWeddingPreviewMedia(body).then((result) => {
                          if (!result || 'error' in result) {
                            toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
                            return
                          }
                          setMediaLocal((current) => ({ ...current, album: result.albumImageUrls }))
                        })
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </WeddingReadableGlass>
            {albumPhotoUrls.length > 0 ? (
              <WeddingSectionCard theme={theme} title={tx.albumTitle} className="relative min-w-0" contentClassName="min-w-0 -mx-1 sm:-mx-2">
                <WeddingAlbumStage
                  urls={albumPhotoUrls}
                  alt={tx.albumAlt}
                  layoutId={albumLayoutId}
                  locale={uiLocale}
                  crops={sectionConfig.albumPhotoCrops}
                  edit={
                    visualEdit
                      ? {
                          onChange: (index, patch) => {
                            const frame = sectionConfig.albumPhotoCrops?.find((item) => item.index === index)
                            setSectionRaw((raw) => mergeWeddingSectionConfig(raw, {
                              albumPhotoCrops: upsertAlbumPhotoCrop(parseWeddingSectionConfig(raw).albumPhotoCrops, index, {
                                x: patch.positionX ?? frame?.x ?? 50,
                                y: patch.positionY ?? frame?.y ?? 0,
                                scale: patch.scale ?? frame?.scale ?? 1,
                              }),
                            }))
                            markPreview('shell')
                          },
                          onRemove: (index) => {
                            const next = albumPhotoUrls.filter((_, itemIndex) => itemIndex !== index)
                            setMediaLocal((current) => ({ ...current, album: next }))
                            setSectionRaw((raw) => mergeWeddingSectionConfig(raw, {
                              albumPhotoCrops: shiftAlbumPhotoCropsAfterRemove(parseWeddingSectionConfig(raw).albumPhotoCrops, index),
                            }))
                            markPreview('shell')
                            const body = new FormData()
                            body.set('cardId', card.id)
                            body.set('albumImageUrls', next.join('\n'))
                            void saveWeddingPreviewMedia(body)
                          },
                          removeLabel: tImage.customReferenceRemove,
                        }
                      : undefined
                  }
                  onExpand={(index) => setActiveAlbumIndex(index)}
                  onOpenAlbum={() => {
                    setActiveAlbumIndex(null)
                    setAlbumOpen(true)
                  }}
                />
                {visualEdit ? (
                  <div className="mt-3">
                    <div className="w-full space-y-2">
                    <p className="text-center text-xs font-semibold text-stone-600">{tImage.previewAlbumLayout}</p>
                    <div className="flex flex-wrap justify-center gap-1">
                      {WEDDING_ALBUM_LAYOUTS.map((layout) => {
                        const active = albumLayoutId === layout.id
                        return (
                          <button
                            key={layout.id}
                            type="button"
                            aria-pressed={active}
                            className={active ? 'h-8 rounded-full bg-rose-600 px-2.5 text-[11px] font-semibold text-white' : 'h-8 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-800'}
                            onClick={() => {
                              setSectionRaw((current) => mergeWeddingSectionConfig(current, { albumLayoutId: layout.id }))
                              markPreview('shell')
                            }}
                          >
                            {layout.label[uiLocale]}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex justify-center pt-1">
                    <WeddingDeviceFileInput
                      className="h-12 min-w-[11.5rem] rounded-full bg-[#f0c14b] px-7 text-base font-bold tracking-wide text-[#3f2a12] shadow-[0_6px_16px_rgba(0,0,0,0.28)] ring-2 ring-[#fff3c4]"
                      multiple
                      label={
                        <span className="inline-flex items-center gap-2">
                          <ImagePlus className="h-5 w-5" aria-hidden />
                          {tCover.chooseWeddingAlbum}
                        </span>
                      }
                      onFiles={(files) => {
                        if (!files.length) return
                        const body = new FormData()
                        body.set('cardId', card.id)
                        for (const file of files) body.append('albumImages', file)
                        void saveWeddingPreviewMedia(body).then((result) => {
                          if (!result || 'error' in result) {
                            toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
                            return
                          }
                          setMediaLocal((current) => ({ ...current, album: result.albumImageUrls }))
                        })
                      }}
                    />
                    </div>
                    </div>
                  </div>
                ) : null}
                {albumPhotoUrls.length > 0 ? (
                <p className={cn('mt-3 text-center text-sm', theme.mutedText, theme.textGlow)}>
                  {albumLayoutId === 'grid' ? tx.albumGridHint : tx.albumHint}
                </p>
                ) : null}
              </WeddingSectionCard>
            ) : null}
          </div>
        </section>

        <section
          id="event"
          className="px-3 py-3 sm:px-4"
        >
          <div className={PUBLIC_COLUMN}>
            {showBothHouses ? (
              <div className="space-y-4">
                {(['groom', 'bride'] as const).map((side) => {
                  const loc = resolveGuestInviteLocation(asEditor ? viewCard : card, side === 'groom' ? 'groom_home' : 'bride_home')
                  const draft = side === 'bride' ? bridePlaceDraft : groomPlaceDraft
                  const iso = resolveWeddingDateIso(loc.weddingDate)
                  const label = side === 'groom' ? tx.groomFamily : tx.brideFamily
                  return (
                    <WeddingReadableGlass
                      key={side}
                      reveal
                      className="rounded-[1.75rem] p-4 text-center sm:rounded-[2rem] sm:p-5"
                    >
                      <div>
                        {visualEdit ? (
                          <WeddingEventPlaceEditor
                            side={side}
                            title={label}
                            date={draft.date}
                            time={draft.time}
                            partyTime={draft.partyTime}
                            address={draft.address}
                            map={draft.map}
                            contact={draft.contact}
                            dateLabel={tImage.previewFieldDate}
                            timeLabel={tImage.previewFieldReception}
                            partyLabel={tImage.previewFieldParty}
                            addressLabel={tImage.previewFieldVenue}
                            mapLabel={tImage.previewFieldMap}
                            contactLabel={tImage.previewFieldContact}
                            onFocus={() => pickText('event')}
                            onChange={(key, value) => patchPlace(side, key, value)}
                            style={textCss('event')}
                          />
                        ) : (
                          <p className={cn('text-[11px] uppercase tracking-[0.22em] sm:text-xs', theme.accentText, theme.textGlow)}>
                            {label}
                          </p>
                        )}
                      </div>
                      {iso ? (
                        <WeddingEventCalendarBlock
                          weddingDateIso={iso}
                          weddingTimeText={loc.receptionTime}
                          partyStartTime={loc.partyStartTime}
                          locale={uiLocale}
                          tx={txCal}
                          textGlow={theme.textGlow}
                          onDarkPaper={Boolean(theme.darkPaper) && theme.contentCard !== 'scallop'}
                          onCreamPaper={theme.contentCard === 'scallop'}
                          className="mb-4 mt-4"
                          showCountdown={false}
                        />
                      ) : (
                        <p className="mb-4 mt-4 text-lg font-semibold">
                          {loc.weddingDate || tx.dateFallback} · {loc.displayTime || tx.timeFallback}
                        </p>
                      )}
                      {!loc.address ? null : (
                        <div className="relative mt-4">
                          <p className={cn('flex items-start justify-center gap-2 text-center text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)} style={textCss('event')}>
                            <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', theme.accent)} />
                            <span>{loc.address}</span>
                          </p>
                        </div>
                      )}
                      {loc.contact ? (
                        <p className={cn('mt-3 text-sm', theme.mutedText, theme.textGlow)}>
                          {tx.contactLabel}: {loc.contact}
                        </p>
                      ) : null}
                      {loc.mapUrl ? (
                        <>
                          <WeddingMapEmbed mapUrl={loc.mapUrl} title={txMusic.publicMapEmbedTitle} className="mt-4" />
                          <a
                            href={loc.mapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-semibold shadow-md transition-colors active:scale-[0.98] [&_svg]:text-current"
                            {...buttonFill}
                          >
                            <MapPin className="h-4 w-4" aria-hidden />
                            {tx.openMaps}
                          </a>
                        </>
                      ) : null}
                    </WeddingReadableGlass>
                  )
                })}
              </div>
            ) : (
            <WeddingReadableGlass reveal className="rounded-[1.75rem] p-4 text-center sm:rounded-[2rem] sm:p-5">
              {visualEdit ? (
                <div className="mb-6 space-y-4 text-left">
                  {cardStructure.venueLayout !== 'one' ? (
                    (letterView === 'bride' ? ['bride', 'groom'] as const : ['groom', 'bride'] as const).map((side) => {
                      const draft = side === 'bride' ? bridePlaceDraft : groomPlaceDraft
                      return (
                        <WeddingEventPlaceEditor
                          key={side}
                          side={side}
                          title={side === 'groom' ? tx.groomFamily : tx.brideFamily}
                          date={draft.date}
                          time={draft.time}
                          partyTime={draft.partyTime}
                          address={draft.address}
                          map={draft.map}
                          contact={draft.contact}
                          dateLabel={tImage.previewFieldDate}
                          timeLabel={tImage.previewFieldReception}
                          partyLabel={tImage.previewFieldParty}
                          addressLabel={tImage.previewFieldVenue}
                          mapLabel={tImage.previewFieldMap}
                          contactLabel={tImage.previewFieldContact}
                          onFocus={() => pickText('event')}
                          onChange={(key, value) => patchPlace(side, key, value)}
                          style={textCss('event')}
                        />
                      )
                    })
                  ) : (
                    <WeddingEventPlaceEditor
                      side={editSide}
                      title={editSide === 'bride' ? tx.brideFamily : tx.groomFamily}
                      date={dateDraft}
                      time={timeDraft}
                      partyTime={partyTimeDraft}
                      address={addressDraft}
                      map={mapDraft}
                      contact={contactDraft}
                      dateLabel={tImage.previewFieldDate}
                      timeLabel={tImage.previewFieldReception}
                      partyLabel={tImage.previewFieldParty}
                      addressLabel={tImage.previewFieldVenue}
                      mapLabel={tImage.previewFieldMap}
                      contactLabel={tImage.previewFieldContact}
                      onFocus={() => pickText('event')}
                      onChange={(key, value) => editCopy(key, value)}
                      style={textCss('event')}
                    />
                  )}
                </div>
              ) : null}
              {(displayWeddingDateIso ?? weddingDateIso) ? (
                <WeddingEventCalendarBlock
                  weddingDateIso={(displayWeddingDateIso ?? weddingDateIso)!}
                  weddingTimeText={guestInviteLocation.receptionTime || card.weddingTime}
                  partyStartTime={guestInviteLocation.partyStartTime || card.partyStartTime}
                  locale={uiLocale}
                  tx={txCal}
                  textGlow={theme.textGlow}
                  onDarkPaper={Boolean(theme.darkPaper) && theme.contentCard !== 'scallop'}
                  onCreamPaper={theme.contentCard === 'scallop'}
                  className="mb-4 mt-4"
                  showCountdown={false}
                />
              ) : displayWeddingDateLabel ? (
                <p className="mb-4 mt-4 text-lg font-semibold">
                  {displayWeddingDateLabel} · {guestInviteLocation.displayTime || weddingDisplayTime || tx.timeFallback}
                </p>
              ) : (
                <p className="mb-4 mt-4 text-lg font-semibold">
                  {tx.dateFallback} · {guestInviteLocation.displayTime || weddingDisplayTime || tx.timeFallback}
                </p>
              )}
              <div className="relative mt-4">
                <p className={cn('flex items-start justify-center gap-2 text-center text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)} style={textCss('event')}>
                  <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', theme.accent)} />
                  <span>{displayVenue}</span>
                </p>
              </div>
              {(asEditor ? contactDraft : guestInviteLocation.contact) ? (
                <p
                  className={cn('mt-3 text-sm', theme.mutedText, theme.textGlow)}
                >
                  {tx.contactLabel}: {asEditor ? contactDraft : guestInviteLocation.contact}
                </p>
              ) : null}
              <WeddingInvitationShareActions
                className="mt-4"
                calendar={calendarExportInput}
                shareUrl={sharePageUrl}
                tx={{
                  addToGoogleCalendar: tx.addToGoogleCalendar,
                  downloadCalendarFile: tx.downloadCalendarFile,
                  shareZalo: tx.shareZalo,
                }}
                buttonColor={buttonColor}
              />
              {displayMapUrl && (
                <>
                  <WeddingMapEmbed mapUrl={displayMapUrl} title={txMusic.publicMapEmbedTitle} className="mt-4" />
                  <a
                    href={displayMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-semibold shadow-md transition-colors active:scale-[0.98] [&_svg]:text-current"
                    {...buttonFill}
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {tx.openMaps}
                  </a>
                </>
              )}
            </WeddingReadableGlass>
            )}
            <WeddingReadableGlass reveal className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] sm:text-xs sm:tracking-[0.3em]', theme.accentText, theme.textGlow)}>
                <CalendarDays className="h-4 w-4" />
                {tx.timelineTitle}
              </p>
              <div>
              {visualEdit ? null : displayTimeline.length > 0 ? (
                <WeddingTimelineList
                  items={displayTimeline.map((item, index) => {
                    const content = weddingTimelineItemContent(item)
                    const plain = content ? personalize(content) : ''
                    return {
                      key: `${item.time}-${item.title}-${index}`,
                      time: item.time,
                      label: plain,
                      content: plain ? writeGuestName(plain) : null,
                    }
                  })}
                  panelClassName={theme.panelStrong}
                  textClassName={theme.text}
                  mutedClassName={theme.mutedText}
                  accentTextClassName={theme.accentText}
                  textGlow={theme.textGlow}
                />
              ) : (
                <p className={cn('mt-5 leading-8', theme.mutedText, theme.textGlow)}>{writeGuestName(personalize(tx.defaultTimeline))}</p>
              )}
              {visualEdit ? (
                <div className="mt-4 text-left">
                  {cardStructure.venueLayout !== 'one' ? (
                    <div className="space-y-5 rounded-2xl bg-white/95 p-3 text-left shadow-lg">
                      {(letterView === 'bride' ? ['bride', 'groom'] as const : ['groom', 'bride'] as const).map((side) => (
                        <div key={side}>
                          <p data-wedding-field-name="" style={weddingEditSideLabelStyle(side, true)}>{side === 'groom' ? tx.groomFamily : tx.brideFamily}</p>
                          <WeddingTimelineDraftEditor
                            value={side === 'bride' ? bridePlaceDraft.timeline : groomPlaceDraft.timeline}
                            addLabel={tImage.previewTimelineAdd}
                            removeLabel={tImage.previewTimelineRemove}
                            timeLabel={tx.timeFallback}
                            titleLabel={tx.timelineTitle}
                            borderClass={WEDDING_EDIT_SIDE[side].fieldBorder}
                            removeClass={WEDDING_EDIT_SIDE[side].label}
                            polish={polishButton('eventTimeline', side === 'bride' ? bridePlaceDraft.timeline : groomPlaceDraft.timeline, (value) => patchPlace(side, 'timeline', value))}
                            onChange={(value) => patchPlace(side, 'timeline', value)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/95 p-3 text-left shadow-lg">
                      <WeddingTimelineDraftEditor
                        value={timelineDraft}
                        addLabel={tImage.previewTimelineAdd}
                        removeLabel={tImage.previewTimelineRemove}
                        timeLabel={tx.timeFallback}
                        titleLabel={tx.timelineTitle}
                        borderClass={WEDDING_EDIT_SIDE[editSide].fieldBorder}
                        removeClass={WEDDING_EDIT_SIDE[editSide].label}
                        polish={polishButton('eventTimeline', timelineDraft, (value) => editCopy('timeline', value))}
                        onChange={(value) => editCopy('timeline', value)}
                      />
                    </div>
                  )}
                </div>
              ) : null}
              </div>
              {(displayDressCode || visualEdit) ? (
                <div className={cn('mt-6 rounded-3xl p-4', theme.panelStrong)}>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <p className={cn('text-xs uppercase tracking-[0.24em]', theme.accentText, theme.textGlow)}>{tx.dressCodeTitle}</p>
                    {visualEdit ? polishButton('dressCode', dressDraft, (value) => editCopy('dress', value)) : null}
                  </div>
                  {visualEdit ? (
                    <textarea
                      aria-label={tx.dressCodeTitle}
                      value={dressDraft}
                      onChange={(event) => editCopy('dress', event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-dashed border-rose-300 bg-white/80 px-3 py-2 text-left text-sm text-stone-900"
                    />
                  ) : (
                    <p className={cn('mt-2 whitespace-pre-line', theme.text, theme.textGlow)}>{writeGuestName(personalize(displayDressCode))}</p>
                  )}
                </div>
              ) : null}
            </WeddingReadableGlass>
          </div>
        </section>

        {(visualEdit || shouldShowPublicGiftBoxForSide(viewCard, guestInviteLocation.side)) && (
          <div
            className={cn('relative', shouldShowPublicGiftBoxForSide(viewCard, guestInviteLocation.side) || visualEdit ? 'border-y' : 'h-0 overflow-hidden')}
            style={{ borderColor: weddingGiftBoxLook(readyBackground?.id, card.masterImageUrl).band }}
          >
            {visualEdit ? (
              <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">
                <label className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-rose-900 shadow">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-rose-600"
                    checked={giftQrEnabled}
                    onChange={(event) => setPreviewFlag('gift', event.target.checked)}
                  />
                  {tImage.previewGiftEnable}
                </label>
                {giftQrEnabled ? (
                <WeddingGiftAccountsForm
                  card={viewCard}
                  banks={vietQrBanks}
                  tx={txGift}
                  update={updateGiftField}
                  hideSecondary={invitationOccasionShape(card.occasionKey) === 'single'}
                />
                ) : null}
              </div>
            ) : null}
            {shouldShowPublicGiftBoxForSide(viewCard, guestInviteLocation.side) ? (
              <WeddingGiftEnvelopeBlock
                card={viewCard}
                tx={txGift}
                sideFilter={guestInviteLocation.side}
                seal={invitationSeal(card.occasionKey)}
                look={weddingGiftBoxLook(readyBackground?.id, card.masterImageUrl)}
              />
            ) : null}
          </div>
        )}

        <section
          className="px-3 py-3 sm:px-4"
        >
          <div className={PUBLIC_COLUMN}>
          {(withoutPartyAddress(asEditor ? storyDraft : card.storyText).trim() !== '' && withoutPartyAddress(asEditor ? storyDraft : card.storyText).trim() !== withoutPartyAddress(asEditor ? introDraft : card.coupleIntro).trim()) ? (
            <WeddingSectionCard theme={theme} title={tx.storyTitle}>
              <WeddingGuestTextSlot
                editing={Boolean(hostEditor && frameLines)}
                draft={storyDraft}
                ariaLabel={tx.storyTitle}
                textKey="story"
                onFocus={() => pickText('story')}
                toolbar={polishButton('storyText', storyDraft, (value) => editCopy('story', value))}
                onChange={(value) => editCopy('story', value)}
                style={textCss('story')}
                className={cn('whitespace-pre-line text-center leading-8', theme.mutedText, theme.textGlow)}
              >
                {renderWeddingHighlightedText(withoutPartyAddress(asEditor ? storyDraft : card.storyText), textTokens, uiLocale, nameHighlightClass, guestNameScriptClass)}
              </WeddingGuestTextSlot>
            </WeddingSectionCard>
          ) : null}
          <WeddingSectionCard theme={theme} title={tx.rsvpTitle} id="guest">
              <div className={cn('space-y-4 rounded-2xl p-3 sm:p-4 md:p-5', theme.panelUi)}>
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.guestNameLabel}</Label>
                  <Input className={cn('min-h-11', paperField)} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={tx.guestNamePlaceholder} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={submitting || partyModalOpen}
                    aria-pressed={contentChoice === 'yes'}
                    onClick={openPartyModal}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center rounded-full border-2 px-3 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-60',
                      contentChoice === 'yes'
                        ? cn('shadow-[0_6px_18px_rgba(0,0,0,0.28)] ring-2 ring-white/80 ring-offset-2', ringOffsetClass)
                        : 'shadow-[0_6px_18px_rgba(0,0,0,0.28)]',
                    )}
                    {...rsvpFill}
                  >
                    {tx.coverAttendYes}
                    {contentChoice === 'yes' ? (
                      <span className="ml-1.5 tabular-nums">{` · ${partyAdult + partyChild}`}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={submitting || partyModalOpen}
                    aria-pressed={contentChoice === 'no'}
                    onClick={chooseCoverNo}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center rounded-full border-2 px-3 text-sm font-bold shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.98] disabled:opacity-60',
                      contentChoice === 'no'
                        ? cn('border-stone-800 bg-white text-stone-900 ring-2 ring-stone-300 ring-offset-2', ringOffsetClass)
                        : 'border-stone-300 bg-white text-stone-900',
                    )}
                  >
                    {tx.coverAttendNo}
                  </button>
                </div>
                {contentChoice === 'yes' ? (
                  <p className={cn('text-center text-xs font-medium', theme.accentText)} role="status">
                    {tx.coverRsvpSavedYes}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.wishLabel}</Label>
                  <WeddingWishPresetPicker
                    openLabel={tx.wishPresetOpen}
                    closeLabel={tx.coverPartyClose}
                    list={tx.wishPresetList}
                    value={message}
                    disabled={submitting}
                    theme={theme}
                    onPick={setMessage}
                  />
                  <Textarea className={cn('min-h-28', paperField)} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tx.wishPlaceholder} />
                </div>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  variant="outline"
                  className="min-h-11 w-full rounded-full border-2 font-semibold shadow-md [&_svg]:text-current"
                  {...buttonFill}
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {tx.submitResponse}
                </Button>
              </div>
            </WeddingSectionCard>
          {displayWeddingDateIso && (
            <WeddingSectionCard theme={theme} title={tx.reminderTitle}>
              <div className={cn('space-y-4 rounded-2xl p-3 sm:p-4 md:p-5', theme.panelUi)}>
                <p className={cn('text-sm leading-6', theme.mutedText, theme.textGlow)}>{tx.reminderHint}</p>
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.reminderEmailLabel}</Label>
                  <Input
                    className={cn('min-h-11', paperField)}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={reminderEmail}
                    onChange={(e) => setReminderEmail(e.target.value)}
                    placeholder={tx.reminderEmailPlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.reminderDaysLabel}</Label>
                  <Input
                    className={cn('min-h-11', paperField)}
                    type="number"
                    min="1"
                    max="90"
                    value={reminderDaysBefore}
                    onChange={(e) => setReminderDaysBefore(e.target.value)}
                    placeholder={tx.reminderDaysPlaceholder}
                  />
                  <p className={cn('text-xs', theme.mutedText, theme.textGlow)}>{tx.reminderDaysHint}</p>
                </div>
                <Button
                  type="button"
                  onClick={submitReminder}
                  disabled={reminderSubmitting}
                  variant="outline"
                  className="min-h-11 w-full rounded-full border-2 font-semibold shadow-md [&_svg]:text-current"
                  {...buttonFill}
                >
                  {reminderSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                  {tx.reminderSubmit}
                </Button>
              </div>
            </WeddingSectionCard>
          )}

          {compiledWishes === 0 && (
          <WeddingSectionCard theme={theme}>
            <p className={cn('text-center text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
              {renderWeddingHighlightedText(
                guestDisplayName ? tx.noWishesPersonal : tx.noWishes,
                textTokens,
                uiLocale,
                nameHighlightClass,
                guestNameScriptClass,
              )}
            </p>
          </WeddingSectionCard>
          )}
          </div>
        </section>
        <section
          className="px-3 py-4 text-center sm:px-4"
        >
          <WeddingReadableGlass reveal className="mx-auto max-w-3xl rounded-[1.75rem] p-5 sm:rounded-[2rem] sm:p-8">
            <Sparkles className={cn('mx-auto h-8 w-8', theme.accent, theme.textGlow)} />
            <h2 className={cn('mt-4 font-serif text-3xl font-semibold italic sm:text-4xl', theme.text, theme.textGlowHeading)}>{tx.thankYouTitle}</h2>
            <WeddingGuestTextSlot
              editing={Boolean(hostEditor && frameLines)}
              draft={thanksDraft}
              ariaLabel={tx.thankYouTitle}
              textKey="thanks"
              onFocus={() => pickText('thanks')}
              toolbar={polishButton('thankYouText', thanksDraft, (value) => editCopy('thanks', value))}
              onChange={(value) => editCopy('thanks', value)}
              style={textCss('thanks')}
              className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}
            >
              {renderWeddingHighlightedText(
                displayThankYou || tx.defaultThankYou,
                textTokens,
                uiLocale,
                nameHighlightClass,
                guestNameScriptClass,
              )}
            </WeddingGuestTextSlot>
            <p className={cn('mt-6 font-serif text-2xl sm:text-3xl', theme.accent, theme.textGlow)}>{theme.ornament}</p>
            {compiledWishes > 0 && (
              <div className="mt-8 space-y-6">
                <WeddingSideWishGroup title={tx.groomFamily} wishes={sideWishes.groom} theme={theme} />
                <WeddingSideWishGroup title={tx.brideFamily} wishes={sideWishes.bride} theme={theme} />
                <WeddingSideWishGroup title={tx.wishesTitle} wishes={sideWishes.other} theme={theme} />
              </div>
            )}
          </WeddingReadableGlass>
        </section>
        </WeddingInvitationMotion>
        </div>
        <div data-wedding-ornament-frame="flow" data-wedding-ornament-surface="letter" data-cover-theme={theme.id} className={effectsEnabled && contentVisible ? 'wedding-cover-ornament-open' : undefined}>
        {(contentVisible || visualEdit || (ornamentEditor && !hostEditor)) ? (
        (browseFlowers && contentVisible) || (ornamentEditor && !hostEditor) ? (
          <WeddingOrnamentAdminLayer
            ornaments={letterShown}
            editable
            className="absolute inset-0 z-[80]"
            surface={editorStack ?? 'letter'}
            zoomInLabel={tImage.ornamentAdminZoomIn}
            zoomOutLabel={tImage.ornamentAdminZoomOut}
            rotateLeftLabel={tImage.ornamentAdminRotateLeft}
            rotateRightLabel={tImage.ornamentAdminRotateRight}
            blurLabel={tImage.ornamentAdminBlur}
            fadeLabel={tImage.ornamentAdminFade}
            stillLabel={tImage.ornamentAdminMotionStill}
            riseLabel={tImage.ornamentAdminMotionRise}
            deleteLabel={tImage.ornamentAdminDelete}
            frameLines={frameLines}
            showTools={browseFlowers ? true : undefined}
            toolIdleMs={browseFlowers ? 2000 : undefined}
            onSelectionChange={browseFlowers ? onLetterFlowerSelection : undefined}
            onToolsIdle={browseFlowers ? hideFlowerChrome : undefined}
            onChange={setLetterDraft}
          />
        ) : (
          <WeddingBackgroundOrnamentLayer ornaments={letterShown} animateRise={!hostEditor} className="absolute inset-0 z-20" />
        )
        ) : null}
        </div>
        </FittedCoverFrame>
        </div>
        ) : null}
        {opened && !layoutPreview && !captureStill && effectsEnabled && showMusic && !musicLoadFailed && (
          <button
            type="button"
            className={cn(
              'fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              theme.darkPaper
                ? musicFabPlaying
                  ? 'border border-[#e8c87a]/40 bg-[#6b1020] text-[#f6e4b8] ring-2 ring-[#e8c87a]/25 hover:bg-[#7a1828]'
                  : 'border border-[#e8c87a]/50 bg-[#4a0c16]/92 text-[#f6e4b8] backdrop-blur-md hover:bg-[#6b1020]'
                : musicFabPlaying
                  ? 'border border-white/25 bg-rose-700 text-white ring-2 ring-white/15 hover:bg-rose-800 focus-visible:ring-white/50'
                  : 'border border-rose-200/90 bg-white/95 text-rose-600 backdrop-blur-md hover:bg-rose-50 focus-visible:ring-rose-400',
            )}
            aria-label={musicFabPlaying ? txMusic.publicFabPauseAria : txMusic.publicFabPlayAria}
            aria-pressed={musicFabPlaying}
            onClick={() => weddingMusicAudioRef.current?.togglePlayback()}
          >
            <WeddingMusicFabVisual playing={musicFabPlaying} className={musicFabPlaying || theme.darkPaper ? undefined : 'text-rose-600'} />
          </button>
        )}
        {albumOpen && activeAlbumIndex === null && typeof document !== 'undefined'
          ? createPortal(
              <div className="fixed inset-0 z-[220] overflow-y-auto bg-black/85 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-4 sm:py-6">
                <div className="mx-auto max-w-5xl">
                  <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow sm:mb-4 sm:p-3">
                    <button
                      type="button"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white"
                      onClick={() => setAlbumOpen(false)}
                    >
                      <X className="h-4 w-4" />
                      {tx.closeGallery}
                    </button>
                    <p className="min-w-0 flex-1 truncate text-right font-semibold">{tx.albumTitle}</p>
                  </div>
                  <WeddingAlbumGalleryGrid
                    urls={albumPhotoUrls}
                    alt={tx.albumAlt}
                    crops={sectionConfig.albumPhotoCrops}
                    onSelect={(index) => {
                      setAlbumOpen(false)
                      setActiveAlbumIndex(index)
                    }}
                  />
                </div>
              </div>,
              document.body,
            )
          : null}
        {activeAlbumIndex !== null && (
          <WeddingAlbumLightbox
            urls={albumPhotoUrls}
            crops={sectionConfig.albumPhotoCrops}
            index={activeAlbumIndex}
            onIndexChange={setActiveAlbumIndex}
            onCloseToInvitation={() => {
              setActiveAlbumIndex(null)
              setAlbumOpen(false)
            }}
            onOpenGallery={() => {
              setActiveAlbumIndex(null)
              setAlbumOpen(true)
            }}
          />
        )}
        {sampleDemo ? <div className="h-24" aria-hidden /> : null}
      </main>
      </div>
      {hostEditor && frameLines && textPick ? (
        <WeddingTextStyleBar
          title={
            textPick === 'groomName' ? tx.groomRole
            : textPick === 'brideName' ? tx.brideRole
            : textPick === 'intro' ? tx.coupleIntroTitle
            : textPick === 'story' ? tx.storyTitle
            : textPick === 'thanks' ? tx.thankYouTitle
            : tx.dateFallback
          }
          style={sectionConfig.textStyles?.[textPick] ?? {}}
          sizeLabel={tImage.textStyleSize}
          fontLabel={tImage.textStyleFont}
          colorLabel={tImage.textStyleColor}
          fonts={[
            { id: 'script', label: tImage.textFontScript },
            { id: 'soft', label: tImage.textFontSoft },
            { id: 'formal', label: tImage.textFontFormal },
            { id: 'lotus', label: tImage.textFontLotus },
          ]}
          onChange={(patch) => writeTextStyle(textPick, patch)}
          onClose={() => setTextPick(null)}
        />
      ) : null}
      {hostPreview ? (
        <WeddingDraggableFab
          label={tx.exitPreviewFab}
          storageKey="wedding-exit-preview-fab"
          defaultCorner="top-left"
          hidden={hostEditor}
          icon={<X className="h-4 w-4" />}
          onClick={() => {
            window.location.assign(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(card.id)}`)
          }}
        />
      ) : null}
    </>
  )
}

