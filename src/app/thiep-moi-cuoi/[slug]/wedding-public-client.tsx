'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, MapPin, Music, Send, Sparkles, Bell, X } from 'lucide-react'
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
import { resolveWeddingAlbumLayoutId } from '@/lib/wedding/wedding-album-layouts'
import { WeddingInvitationAudio, type WeddingInvitationAudioHandle } from '@/components/wedding/wedding-invitation-audio'
import { WeddingMusicFabVisual } from '@/components/wedding/wedding-music-fab-visual'
import { WeddingMapEmbed } from '@/components/wedding/wedding-map-embed'
import { WeddingEventCalendarBlock } from '@/components/wedding/wedding-event-calendar-block'
import { WeddingCountdownBlock } from '@/components/wedding/wedding-countdown-block'
import { WeddingGiftEnvelopeBlock } from '@/components/wedding/wedding-gift-envelope-block'
import {
  applyInvitationCalendarCopy,
  applyInvitationGiftCopy,
  applyInvitationMusicCopy,
  applyInvitationOccasionPublicCopy,
  invitationOccasionShape,
  invitationSeal,
} from '@/lib/wedding/invitation-occasion'
import { WeddingInvitationShareActions } from '@/components/wedding/wedding-invitation-share-actions'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { shouldShowPublicGiftBoxForSide } from '@/lib/wedding/wedding-gift-vietqr'
import { weddingGiftBoxLook } from '@/lib/wedding/wedding-gift-box-look'
import { resolveWeddingDisplayTime } from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso, formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { bindWeddingButtonFill, resolveWeddingButtonColor } from '@/lib/wedding/wedding-button-colors'
import { getWeddingTheme, isWeddingDarkTheme, weddingBackgroundStyle, weddingNavLinkClass, weddingThemeIsDark, WEDDING_BG_OVERLAY } from '@/lib/wedding/wedding-theme'
import { WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { WeddingOrnamentAdminBar, WeddingOrnamentAdminLayer, weddingOrnamentSpotOnPage } from '@/components/wedding/wedding-ornament-admin'
import { applyWeddingSampleLook, resetWeddingCardOrnaments, resetWeddingPresetOrnaments, saveWeddingCardOrnaments, saveWeddingPresetFrame, saveWeddingPresetOrnaments, saveWeddingPresetShell, saveWeddingPreviewEdit, saveWeddingTemplateFrame, saveWeddingTemplateShell } from '@/app/tao-thiep-moi-cuoi-ai/actions'
import { WeddingSampleCardPicker } from '@/components/wedding/wedding-sample-card-picker'
import { isWeddingSamplePhotoUrl, WEDDING_SAMPLE_CARDS } from '@/lib/wedding/wedding-sample-cards'
import { WeddingScrollingBackground } from '@/components/wedding/wedding-scrolling-background'
import { applyWeddingKitTheme, resolveWeddingChromeKit, weddingFramePatchForStyle, weddingHeroPhotoLayout, weddingKitSurface, weddingReadingPlate, weddingUsesPairedAiFrame, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { resolveWeddingShownOrnaments, weddingOrnamentLayoutKey, weddingOrnamentListsEqual } from '@/lib/wedding/wedding-background-ornament-store'
import { publishWeddingOrnamentTruth, subscribeWeddingOrnamentTruth } from '@/lib/wedding/wedding-ornament-sync'
import { readWeddingPreviewLook, WEDDING_PREVIEW_READY_MESSAGE, weddingPreviewLookToken } from '@/lib/wedding/wedding-preview-look'
import { WeddingSectionCard } from '@/components/wedding/wedding-section-card'
import { DEFAULT_WEDDING_COVER_PRESET_ID, getWeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'
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
import { WeddingStackedCouplePhotos } from '@/components/wedding/wedding-stacked-couple-photos'
import { WeddingWishPresetPicker } from '@/components/wedding/wedding-wish-preset-picker'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { WeddingGuestNameFontLink, renderWeddingGuestName, WEDDING_GUEST_NAME_CLASS } from '@/components/wedding/wedding-guest-name-font'
import { WeddingDraggableChrome, WeddingDraggableFab } from '@/components/wedding/wedding-draggable-fab'
import {
  guestInviteVenueLabel,
  normalizeGuestInviteVenue,
  type WeddingGuestInviteVenue,
} from '@/lib/wedding/wedding-guest-invite-venue'
import { resolveGuestInviteLocation } from '@/lib/wedding/wedding-guest-invite-location'
import { omitWeddingAddressesFromSharedCopy, weddingSharedCopyAddresses } from '@/lib/wedding/wedding-shared-copy'
import { resolveWeddingCardDisplayText } from '@/lib/wedding/wedding-card-text-interpolate'
import { renderWeddingHighlightedText } from '@/lib/wedding/wedding-card-text-highlight'
import { WeddingTimelineList } from '@/components/wedding/wedding-timeline-list'
import { parseWeddingEventTimeline, weddingTimelineItemContent } from '@/lib/wedding/wedding-event-timeline'
import {
  allowWeddingPageScroll,
  primeWeddingPageScroll,
  releaseWeddingPageScrollLock,
  scrollWeddingPageToTop,
  startWeddingInvitationAutoScroll,
  stopWeddingInvitationAutoScroll,
} from '@/hooks/use-wedding-invitation-auto-scroll'
import { applyWeddingDesignViewport, WEDDING_DESKTOP_HEIGHT, WEDDING_DESKTOP_MIN_PX, WEDDING_DESKTOP_WIDTH, WEDDING_MOBILE_HEIGHT, WEDDING_MOBILE_WIDTH } from '@/lib/wedding/wedding-design-viewport'

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

/** Ô sửa nằm đè lên chữ khách đang hiện. Chiều khối không đổi, nên hoa văn không trượt khi bật nét khung. */
function WeddingGuestTextSlot(props: {
  editing: boolean
  draft: string
  ariaLabel: string
  textKey: string
  onFocus: () => void
  onChange: (value: string) => void
  className: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
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
          className={cn(props.className, 'absolute inset-0 z-[1] !m-0 h-auto w-full resize-none overflow-hidden border-0 bg-transparent p-0')}
        />
      ) : null}
    </div>
  )
}

function FittedCoverFrame(props: { active: boolean; designWidth: number; backgroundColor: string; flow?: boolean; contain?: boolean; fitHeight?: boolean; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState(0)

  useLayoutEffect(() => {
    if (!props.active) return
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const fit = () => {
      const height = inner.offsetHeight
      if (height < 1 || outer.clientWidth < 1) return
      const widthScale = outer.clientWidth / props.designWidth
      const heightScale = outer.clientHeight > 0 ? outer.clientHeight / height : widthScale
      const next = props.fitHeight ? Math.min(widthScale, heightScale) : widthScale
      setScale((current) => (Math.abs(current - next) < 0.004 ? current : next))
      setContentHeight((current) => (Math.abs(current - height) < 1 ? current : height))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [props.active, props.designWidth, props.fitHeight])

  if (!props.active) return <div className="relative" data-wedding-stage="">{props.children}</div>

  const scaledHeight = contentHeight * scale
  const boxed = Math.abs(scale - 1) >= 0.004
  if (props.flow) {
    return (
      <div ref={outerRef} className="relative w-full" style={boxed ? { height: scaledHeight || undefined, overflow: 'clip' } : undefined}>
        <div
          ref={innerRef}
          className={boxed ? 'absolute left-0 top-0' : 'relative'}
          data-wedding-stage=""
          style={{ width: props.designWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {props.children}
        </div>
      </div>
    )
  }
  return (
    <div
      ref={outerRef}
      className={props.fitHeight ? 'fixed z-50 overflow-hidden' : props.contain ? 'relative mx-auto min-h-screen w-full overflow-x-hidden' : 'fixed inset-0 z-50 overflow-x-hidden overflow-y-auto'}
      style={props.fitHeight
        ? { backgroundColor: props.backgroundColor, width: props.designWidth, maxWidth: '100vw', left: '50%', transform: 'translateX(-50%)', top: 0, bottom: '4.75rem' }
        : { backgroundColor: props.backgroundColor }}
    >
      <div style={{ width: props.designWidth * scale, height: scaledHeight || undefined, margin: '0 auto' }}>
        <div ref={innerRef} data-wedding-stage="" style={{ width: props.designWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {props.children}
        </div>
      </div>
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
  ornamentLayoutKey = '',
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
}) {
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
  const initialInvite = resolveGuestInviteLocation(card, editSide === 'bride' ? 'bride_home' : 'groom_home')
  const [sectionRaw, setSectionRaw] = useState(card.sectionConfig)
  const [previewPlates, setPreviewPlates] = useState<string[] | null>(null)
  const [previewStyleId, setPreviewStyleId] = useState<string | null>(null)
  const [previewLookOn, setPreviewLookOn] = useState(false)
  const [sharedFrame, setSharedFrame] = useState<WeddingSharedFrame | null>(initialSharedFrame)
  const pendingSharedFrameRef = useRef<{ frame: WeddingSharedFrame | null; side: 'cover' | 'groom' | 'bride' } | null>(null)
  const [groomDraft, setGroomDraft] = useState(card.groomName)
  const [brideDraft, setBrideDraft] = useState(card.brideName)
  const [introDraft, setIntroDraft] = useState(card.coupleIntro)
  const [storyDraft, setStoryDraft] = useState(card.storyText)
  const [thanksDraft, setThanksDraft] = useState(card.thankYouText)
  const [addressDraft, setAddressDraft] = useState(initialInvite.address)
  const [timeDraft, setTimeDraft] = useState(initialInvite.receptionTime)
  const [dateDraft, setDateDraft] = useState(initialInvite.weddingDate ?? '')
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
  const displayedSectionRaw = previewLookOn || hostEditor || ornamentEditor ? sectionRaw : card.sectionConfig
  const sectionConfig = useMemo(() => {
    const parsed = parseWeddingSectionConfig(displayedSectionRaw)
    if (sampleDemo || !isWeddingSamplePhotoUrl(parsed.coverPhotoUrl)) return parsed
    return { ...parsed, coverPhotoUrl: '' }
  }, [displayedSectionRaw, sampleDemo])
  const groomSource = photoOverride ? photoOverride.groom : card.groomImageUrl
  const brideSource = photoOverride ? photoOverride.bride : card.brideImageUrl
  const albumSource = photoOverride ? photoOverride.album : card.albumImageUrls
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
  const heroStack =
    invitationOccasionShape(card.occasionKey) === 'couple' && weddingHeroPhotoLayout(readyBackground) === 'stack'
  const shownCover = resolveShownCoverFrame(sectionConfig, kitFrameId, pairedAiFrame ? null : sharedFrame)
  const coverPresetId = pairedAiFrame ? sectionConfig.coverPresetId || DEFAULT_WEDDING_COVER_PRESET_ID : shownCover.presetId || DEFAULT_WEDDING_COVER_PRESET_ID
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
  const coverPhotoUrl = coverPhotoUrlUnlessBackground(resolveCoverPhotoUrl(sectionConfig), pageBackground)
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
  const [opened, setOpened] = useState(layoutPreview && !coverPreview)
  const [coverDesignWidth, setCoverDesignWidth] = useState(WEDDING_MOBILE_WIDTH)
  const [coverCard, setCoverCard] = useState(ornamentMobile)
  const [coverShared, setCoverShared] = useState(ornamentSharedMobile)
  const [letterCard, setLetterCard] = useState(ornamentLetterMobile)
  const [letterShared, setLetterShared] = useState(ornamentLetterSharedMobile)
  const [sharedShellDraft, setSharedShellDraft] = useState(sharedShell)
  const [shellDevice, setShellDevice] = useState<'desktop' | 'mobile'>('mobile')
  const [frameLines, setFrameLines] = useState(!sampleDemo)
  const [chromeHold, setChromeHold] = useState(false)
  const [lookOrnaments, setLookOrnaments] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [coverDraft, setCoverDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [letterDraft, setLetterDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const activeSurface: OrnamentFace = editorStack ?? (opened ? 'letter' : 'cover')
  const layoutDevice: 'desktop' | 'mobile' = (sampleDemo || hostPreview || layoutPreview) && viewDevice === 'desktop' ? 'desktop' : 'mobile'
  const coverSaved = resolveWeddingShownOrnaments({
    defaults: readyBackground?.ornaments,
    cardSheet: coverCard,
    sharedSheet: coverShared,
    sharedBase: sampleFlowers ? null : ornamentOverride,
    templateEditor,
  })
  const letterSaved = resolveWeddingShownOrnaments({
    defaults: readyBackground?.ornaments,
    cardSheet: letterCard,
    sharedSheet: letterShared,
    templateEditor,
  })
  const coverShown = coverDraft ?? (previewLookOn && activeSurface === 'cover' ? lookOrnaments : null) ?? coverSaved
  const letterShown = letterDraft ?? (previewLookOn && activeSurface === 'letter' ? lookOrnaments : null) ?? letterSaved
  const activeDraft = activeSurface === 'letter' ? letterDraft : coverDraft
  const activeShown = activeSurface === 'letter' ? letterShown : coverShown
  const setActiveDraft = activeSurface === 'letter' ? setLetterDraft : setCoverDraft
  const tImage = getDictionary(uiLocale).weddingCardAiImage
  const tCover = getDictionary(uiLocale).weddingCardAiCover
  const previewLookOnRef = useRef(false)
  previewLookOnRef.current = previewLookOn
  const ornamentSyncSource = useRef(Math.random().toString(36).slice(2))
  const failOrnamentSave = useCallback(() => {
    toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
  }, [tImage.ornamentAdminFailed, toast])
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
  const pageBackgroundRef = useRef(pageBackground)
  const previewLookTokenRef = useRef('')
  shownSectionRef.current = sectionConfig
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
  const coverScrollRef = useRef<HTMLDivElement>(null)
  const doorStarted = useRef(false)
  const [contentVisible, setContentVisible] = useState(layoutPreview && !coverPreview)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [activeAlbumIndex, setActiveAlbumIndex] = useState<number | null>(null)
  const [sharePageUrl, setSharePageUrl] = useState('')
  const weddingMusicAudioRef = useRef<WeddingInvitationAudioHandle>(null)
  const reportMusicPlaying = useCallback((playing: boolean) => {
    setMusicFabPlaying(playing)
  }, [])
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('device') === 'desktop' ? 'desktop' : 'mobile'
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
  const editCopy = (key: 'intro' | 'story' | 'thanks' | 'address' | 'time' | 'date', value: string) => {
    if (key === 'intro') setIntroDraft(value)
    if (key === 'story') setStoryDraft(value)
    if (key === 'thanks') setThanksDraft(value)
    if (key === 'address') setAddressDraft(value)
    if (key === 'time') setTimeDraft(value)
    if (key === 'date') setDateDraft(value)
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
        editTools: frameLines,
      }
    : null
  const previewDraftRef = useRef({
    groomDraft,
    brideDraft,
    introDraft,
    storyDraft,
    thanksDraft,
    addressDraft,
    timeDraft,
    dateDraft,
    sectionRaw,
    sharedShellDraft,
    shellDevice,
  })
  previewDraftRef.current = {
    groomDraft,
    brideDraft,
    introDraft,
    storyDraft,
    thanksDraft,
    addressDraft,
    timeDraft,
    dateDraft,
    sectionRaw,
    sharedShellDraft,
    shellDevice,
  }
  useEffect(() => {
    const canSave = hostEditor || (layoutPreview && ornamentEditor)
    if (!canSave || previewTick === 0) return
    const timer = window.setTimeout(() => {
      const draft = previewDraftRef.current
      const kind = previewKindRef.current
      previewKindRef.current = null
      const side = editSide === 'bride'
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
                groomInviteAddress: side ? undefined : draft.addressDraft,
                brideInviteAddress: side ? draft.addressDraft : undefined,
                groomInviteReceptionTime: side ? undefined : draft.timeDraft,
                brideInviteReceptionTime: side ? draft.timeDraft : undefined,
                groomInviteWeddingDate: side ? undefined : draft.dateDraft,
                brideInviteWeddingDate: side ? draft.dateDraft : undefined,
                textStyles: parseWeddingSectionConfig(draft.sectionRaw).textStyles,
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
  }, [card.id, editSide, hostEditor, layoutPreview, ornamentEditor, previewTick, samplePresetId, tImage.ornamentAdminFailed, templateEditor, toast])

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
  }, [card.musicUrl])

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

  useLayoutEffect(() => {
    if (opened || hostPreview) return
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
  }, [hostPreview, opened])

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
    if (letterView == null) {
      setHouseAskOpen(true)
      return
    }
    openInvitation()
  }

  const openInvitation = () => {
    if (doorStarted.current || opened) return
    doorStarted.current = true
    allowWeddingPageScroll()
    primeWeddingPageScroll()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (card.effectsEnabled) void weddingMusicAudioRef.current?.playFromUserGesture()
    setContentVisible(true)
    setOpened(true)
    openedAtRef.current = performance.now()
    if (!card.effectsEnabled) return
    if (hostEditor && frameLinesRef.current) return
    if (reduced) {
      startWeddingInvitationAutoScroll()
      return
    }
    scrollTimer.current = window.setTimeout(() => {
      if (hostEditor && frameLinesRef.current) return
      startWeddingInvitationAutoScroll()
    }, 5600)
  }

  useEffect(() => {
    if (!hostEditor) return
    if (frameLines || !opened || !card.effectsEnabled) {
      if (scrollTimer.current) {
        window.clearTimeout(scrollTimer.current)
        scrollTimer.current = null
      }
      stopWeddingInvitationAutoScroll()
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const elapsed = openedAtRef.current ? performance.now() - openedAtRef.current : 5600
    const delay = reduced ? 0 : Math.max(0, 5600 - elapsed)
    const timer = window.setTimeout(() => startWeddingInvitationAutoScroll(), delay)
    return () => {
      window.clearTimeout(timer)
      stopWeddingInvitationAutoScroll()
    }
  }, [card.effectsEnabled, frameLines, hostEditor, opened])

  useEffect(() => {
    if (!hostEditor || frameLines) return
    setChromeHold(false)
    let timer: number | null = null
    let shown = false
    let overChrome = false
    let pressingChrome = false
    let blockMove = false
    let holdTimer: number | null = null
    let gesture: { id: number; x: number; y: number; moved: boolean; held: boolean; up: boolean } | null = null
    const clearHoldTimer = () => {
      if (!holdTimer) return
      window.clearTimeout(holdTimer)
      holdTimer = null
    }
    const onChrome = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-wedding-host-chrome]'))
    const conceal = () => {
      if (timer) window.clearTimeout(timer)
      timer = null
      if (!shown) return
      shown = false
      setChromeHold(false)
    }
    const armHide = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        if (overChrome || pressingChrome || gesture?.up) return
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
      if (onChrome(event.target)) {
        overChrome = true
        pressingChrome = true
        blockMove = false
        gesture = null
        if (timer) window.clearTimeout(timer)
        timer = null
        if (!shown) {
          shown = true
          setChromeHold(true)
        }
        return
      }
      overChrome = false
      if (event.pointerType === 'mouse') {
        blockMove = true
        conceal()
        return
      }
      clearHoldTimer()
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, held: false, up: false }
      holdTimer = window.setTimeout(() => {
        holdTimer = null
        if (gesture && !gesture.moved) gesture.held = true
      }, 350)
    }
    const onMove = (event: PointerEvent) => {
      if (pressingChrome) return
      if (event.pointerType === 'mouse') {
        if (blockMove) return
        if (onChrome(event.target)) {
          overChrome = true
          if (timer) window.clearTimeout(timer)
          timer = null
          if (!shown) {
            shown = true
            setChromeHold(true)
          }
          return
        }
        overChrome = false
        reveal()
        return
      }
      if (!gesture || gesture.id !== event.pointerId) return
      const dx = event.clientX - gesture.x
      const dy = event.clientY - gesture.y
      const dist = Math.hypot(dx, dy)
      if (!gesture.held && dist > 12) {
        gesture.moved = true
        clearHoldTimer()
        conceal()
        return
      }
      if (!gesture.held) return
      if (dy <= -36 && Math.abs(dy) >= Math.abs(dx)) {
        gesture.up = true
        gesture.moved = true
        reveal()
        return
      }
      if (dy > 16) {
        gesture.moved = true
        conceal()
      }
    }
    const onUp = (event: PointerEvent) => {
      if (pressingChrome) {
        pressingChrome = false
        overChrome = onChrome(event.target)
        if (overChrome) return
        armHide()
      }
      if (event.pointerType === 'mouse') {
        blockMove = false
        return
      }
      clearHoldTimer()
      if (!gesture || gesture.id !== event.pointerId) return
      const swipeUp = gesture.up
      const tap = !gesture.moved
      gesture = null
      if (swipeUp) {
        reveal()
        return
      }
      if (!tap || onChrome(event.target)) return
      if (shown) conceal()
      else reveal()
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
      if (timer) window.clearTimeout(timer)
      clearHoldTimer()
    }
  }, [hostEditor, frameLines])

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

  const guestBlockLocation = useMemo(
    () => resolveGuestInviteLocation(card, guestBlockVenue),
    [card, guestBlockVenue],
  )

  const textTokens = useMemo(
    () => ({
      groomName: hostEditor ? groomDraft : card.groomName,
      brideName: hostEditor ? brideDraft : card.brideName,
      guestName: guestDisplayName,
    }),
    [brideDraft, card.brideName, card.groomName, groomDraft, guestDisplayName, hostEditor],
  )

  const personalize = useCallback(
    (text: string) => resolveWeddingCardDisplayText(text, textTokens, uiLocale),
    [textTokens, uiLocale],
  )

  const nameHighlightClass = cn('font-semibold', theme.accentText, theme.textGlowHeading)
  const guestNameScriptClass = cn(WEDDING_GUEST_NAME_CLASS, 'text-[1.45em] leading-none', theme.text, theme.textGlowHeading)
  const writeGuestName = useCallback(
    (text: string) => renderWeddingGuestName(text, guestDisplayName, guestNameScriptClass),
    [guestDisplayName, guestNameScriptClass],
  )

  const viewCard = useMemo(() => {
    if (!hostEditor) return card
    const sidePatch = editSide === 'bride'
      ? {
          brideName: brideDraft,
          brideInviteAddress: addressDraft,
          brideInviteReceptionTime: timeDraft,
          brideInviteWeddingDate: dateDraft || null,
        }
      : {
          groomName: groomDraft,
          groomInviteAddress: addressDraft,
          groomInviteReceptionTime: timeDraft,
          groomInviteWeddingDate: dateDraft || null,
        }
    return {
      ...card,
      ...sidePatch,
      groomName: groomDraft,
      brideName: brideDraft,
      coupleIntro: introDraft,
      storyText: storyDraft,
      thankYouText: thanksDraft,
      sectionConfig: sectionRaw,
    }
  }, [addressDraft, brideDraft, card, dateDraft, editSide, groomDraft, hostEditor, introDraft, sectionRaw, storyDraft, thanksDraft, timeDraft])
  const guestInviteLocation = useMemo(
    () => resolveGuestInviteLocation(hostEditor ? viewCard : card, guestDisplayVenue),
    [card, guestDisplayVenue, hostEditor, viewCard],
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
  const withoutPartyAddress = useCallback(
    (text: string) => omitWeddingAddressesFromSharedCopy(text, sharedCopyAddresses),
    [sharedCopyAddresses],
  )
  const displayPersonalInvite = initialPersonalInvite.trim()
  const displayCoverPhotoUrl =
    coverPhotoUrlUnlessBackground(guestInviteLocation.coverImageUrl, pageBackground) || coverPhotoUrl
  const displayInvitationText = withoutPartyAddress(guestInviteLocation.invitationText || card.invitationText)
  const displayInvitationTextEn = withoutPartyAddress(guestInviteLocation.invitationTextEn || card.invitationTextEn)
  const displayTimeline = useMemo(
    () => parseWeddingEventTimeline(guestInviteLocation.eventTimeline || card.eventTimeline),
    [card.eventTimeline, guestInviteLocation.eventTimeline],
  )
  const displayDressCode = withoutPartyAddress(guestInviteLocation.dressCode || card.dressCode)
  const displayThankYou = withoutPartyAddress(hostEditor ? thanksDraft : guestInviteLocation.thankYouText || card.thankYouText)
  const displayVenue = hostEditor ? addressDraft : guestInviteLocation.address || card.venue
  const displayMapUrl = guestInviteLocation.mapUrl || card.mapUrl
  const groomFamilyLine = card.groomParents || card.groomName
  const brideFamilyLine = card.brideParents || card.brideName
  const groomHometownLine = card.groomInviteAddress.trim() || card.groomHometown
  const brideHometownLine = card.brideInviteAddress.trim() || card.brideHometown
  const showBothHouses = letterView === 'both'
  const calendarExportInput = useMemo(
    () => ({
      title: personalize(tx.calendarEventTitle),
      description: personalize(displayInvitationText || tx.calendarEventDescription),
      location: displayVenue,
      weddingDateIso: (displayWeddingDateIso ?? weddingDateIso) ?? '',
      weddingTimeText: guestInviteLocation.receptionTime || card.weddingTime,
      partyStartTime: guestInviteLocation.partyStartTime || card.partyStartTime,
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
      sharePageUrl,
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
              <button type="button" className="h-11 rounded-full border-2 border-sky-600 bg-sky-300 font-semibold text-sky-950" onClick={() => chooseLetterHouse('groom')}>
                {tx.groomFamily}
              </button>
              <button type="button" className="h-11 rounded-full border-2 border-rose-600 bg-rose-300 font-semibold text-rose-950" onClick={() => chooseLetterHouse('bride')}>
                {tx.brideFamily}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {opened && card.effectsEnabled && !layoutPreview ? (
        <WeddingOpenEffects play burst={openBurstEffect} fall={openFallEffect} fallSeconds={openFallSeconds} themeId={theme.id} lookId={readyBackground?.id} />
      ) : null}
      {sampleDemo && !hostEditor ? (
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
      {hostEditor ? (
        <WeddingDraggableChrome storageKey="wedding-host-editor-chrome" defaultCorner="top-right" hidden={!frameLines && !chromeHold}>
          <div className="w-[13.25rem] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white/95 p-1.5 shadow-lg ring-1 ring-black/10" role="group" aria-label={templateEditor ? tImage.ornamentTemplateHint : tImage.ornamentCardHint}>
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
            <button
              type="button"
              aria-pressed={frameLines}
              className={frameLines ? 'mt-1 h-9 w-full rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800' : 'mt-1 h-9 w-full rounded-xl bg-rose-600 text-xs font-semibold text-white'}
              onClick={() => {
                setFrameLines((shown) => {
                  if (shown) setTextPick(null)
                  return !shown
                })
              }}
            >
              {frameLines ? tImage.previewBrowseMode : tImage.previewEditMode}
            </button>
            {frameLines && !sampleDemo ? (
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
            {frameLines ? (
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
              onAdd={(src) => {
                const spot = weddingOrnamentSpotOnPage()
                setActiveDraft([...(activeDraft ?? activeShown), { src, x: spot.x, y: spot.y, w: spot.w }])
              }}
              onReset={() => void resetOrnaments()}
            />
            ) : null}
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
              <WeddingSampleCardPicker
                locale={uiLocale}
                samples={WEDDING_SAMPLE_CARDS}
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
      {hostPreview || sampleDemo ? <div className="pointer-events-none fixed inset-0 -z-10 bg-neutral-200" /> : null}
      <main
        data-wedding-paper={theme.contentCard || undefined}
        data-wedding-reading={readingPlate ? '' : undefined}
        className={cn('relative z-0', layoutPreview ? 'min-h-0' : 'min-h-screen', (hostPreview || sampleDemo) && 'mx-auto max-w-full shadow-2xl', theme.pageBg, theme.text, kitSurface.className)}
        style={{ ...kitSurface.style, ...(readingPlate ? { ['--wedding-reading-plate' as string]: readingPlate } : {}), width: sampleDemo || hostPreview ? (viewDevice === 'desktop' ? (sampleDemo ? 'min(100vw, 90rem)' : 'min(72rem, calc(100vw - 3rem))') : `${WEDDING_MOBILE_WIDTH}px`) : undefined }}
      >
        {!opened && (
          <>
            <div className={cn(coverPreview && 'relative z-10 overflow-x-clip')} ref={coverPreview ? coverScrollRef : undefined}>
              <FittedCoverFrame
                active={!coverPreview}
                contain={hostPreview}
                fitHeight={sampleDemo}
                designWidth={coverDesignWidth}
                backgroundColor={stageColor}
              >
              <div
                data-cover-preview={coverPreview ? '' : undefined}
                data-wedding-stage=""
                className="relative mx-auto w-full overflow-x-clip bg-cover bg-center"
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
              <div data-wedding-ornament-frame="">
              {(ornamentEditor && coverPreview) || (hostEditor && !(sampleDemo && !frameLines)) ? null : (
                <WeddingBackgroundOrnamentLayer ornaments={coverShown} className="absolute inset-0 z-20" />
              )}
              {(ornamentEditor && coverPreview) || (hostEditor && !(sampleDemo && !frameLines)) ? (
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
                  onChange={setCoverDraft}
                />
              ) : null}
              </div>
              <div data-wedding-sheet-content="" data-wedding-cover-pad="" className={cn('flex flex-col items-center px-3 pb-4 pt-3 sm:px-4', coverPresetId === 'song_hy' ? 'justify-center' : 'justify-start', ornamentEditor && coverPreview && 'pointer-events-none')} style={coverPresetId === 'song_hy' ? { minHeight: coverDesignWidth >= WEDDING_DESKTOP_MIN_PX ? WEDDING_DESKTOP_HEIGHT : WEDDING_MOBILE_HEIGHT } : undefined}>
                <div
                  data-wedding-cover-column=""
                  className={cn(
                    'w-full max-w-[min(26rem,calc(100%-1.5rem))] sm:max-w-[min(28rem,calc(100%-2rem))] lg:max-w-[min(48rem,calc(100%-4rem))]',
                  )}
                >
                  <WeddingCoverShellCard
                    fitViewport={false}
                    breathe={false}
                    namesFlyIn={card.effectsEnabled}
                    presetId={coverPresetId}
                    aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                    frameMode={coverFrameMode}
                    photoOpen={coverPhotoOpen}
                    frameOpen={coverFrameOpen}
                    openMotion={card.effectsEnabled}
                    coverPhotoUrl={displayCoverPhotoUrl}
                    coverPhotoObjectPosition={coverPhotoObjectPosition}
                    coverPhotoScale={coverPhotoScale}
                    frameScale={resolveCoverFrameScale(sectionConfig)}
                    groomName={hostEditor ? groomDraft : card.groomName}
                    brideName={hostEditor ? brideDraft : card.brideName}
                    weddingDate={displayWeddingDateLabel}
                    weddingTimeText={hostEditor ? timeDraft || guestInviteLocation.displayTime || weddingDisplayTime : guestInviteLocation.displayTime || weddingDisplayTime}
                    guestName={guestDisplayName || undefined}
                    guestInviteVenue={guestBlockVenue}
                    guestInviteVenueLabel={guestBlockVenueDisplay || undefined}
                    addressText={(hostEditor ? addressDraft : guestBlockLocation.address) || undefined}
                    mapUrl={guestBlockLocation.mapUrl || undefined}
                    viewMapLabel={tx.guestInviteViewMap}
                    theme={theme}
                    invitationLabel={tx.invitation}
                    cordiallyInvitesLabel={tx.cordiallyInvites}
                    personalInviteText={displayPersonalInvite || undefined}
                    openButtonLabel={tx.openInvitation}
                    dateFallback={tx.dateFallback}
                    photoAlt={tx.coverPhotoAlt}
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
                      card.rsvpEnabled && guestDisplayName
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
        {contentVisible && !coverPreview ? (
          <nav
            className={cn(
              'fixed top-0 z-[80] border-b px-2 py-2 text-sm sm:px-3 sm:py-2.5',
              hostPreview || sampleDemo ? 'left-1/2 max-w-full -translate-x-1/2' : 'inset-x-0',
              theme.nav,
            )}
            style={sampleDemo || hostPreview ? { width: viewDevice === 'desktop' ? (sampleDemo ? 'min(100vw, 90rem)' : 'min(72rem, calc(100vw - 3rem))') : `${WEDDING_MOBILE_WIDTH}px` } : undefined}
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
        <div className={contentVisible ? 'pt-12' : 'hidden'}>
        <FittedCoverFrame active={!layoutPreview} designWidth={coverDesignWidth} backgroundColor="transparent" flow>
        {opened ? (
          <WeddingScrollingBackground
            urls={plateUrls.length > 0 ? plateUrls : pageBackground ? [pageBackground] : []}
            fallbackColor={stageColor}
          />
        ) : null}
        <div className={cn('relative', ornamentEditor && editorStack && 'pointer-events-none')} style={{ opacity: contentVisible ? 1 : 0 }}>
        <WeddingInvitationMotion enabled={card.effectsEnabled && !layoutPreview}>
        {ornamentEditor && !editorStack && !hostEditor ? (
          <div className="sticky top-0 z-40 bg-white/95 px-3 py-2">
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
                const spot = weddingOrnamentSpotOnPage()
                setLetterDraft([...(letterDraft ?? letterShown), { src, x: spot.x, y: spot.y, w: spot.w }])
              }}
              onReset={() => void letterSave.reset()}
            />
          </div>
        ) : null}
        <section
          id="cover"
          className={cn(
            'relative flex items-center justify-center bg-cover bg-center px-3 sm:px-4',
            'min-h-0 py-4',
          )}
          style={contentSurface}
        >
          <WeddingReadableGlass themeId={theme.id} className="w-full min-w-0 max-w-3xl rounded-[1.75rem] p-5 text-center sm:rounded-[2.25rem] sm:p-6">
            {envelopeCover ? null : (
            <p className={cn('text-[11px] uppercase tracking-[0.28em] sm:text-xs sm:tracking-[0.4em]', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-kicker', theme.accentText, theme.textGlow)}>{tx.invitation}</p>
            )}
            {envelopeCover || !heroStack ? null : (
              <WeddingStackedCouplePhotos
                firstUrl={groomPhotoUrl}
                secondUrl={bridePhotoUrl}
                firstAlt={tx.groomRole}
                secondAlt={tx.brideRole}
                firstFrame={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                secondFrame={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                firstName={hostEditor ? groomDraft : card.groomName}
                secondName={hostEditor ? brideDraft : card.brideName}
                firstCaption={tx.groomRole}
                secondCaption={tx.brideRole}
                frameShell={groomShell ?? brideShell}
                firstShell={groomShell}
                secondShell={brideShell}
                {...{
                  frameScale: shellFrameScale,
                  place: shellPlace,
                  firstRotate: shellGroomRotate,
                  secondRotate: shellBrideRotate,
                  ...(hostShell ?? {}),
                }}
                firstNameStyle={textCss('groomName')}
                secondNameStyle={textCss('brideName')}
                onNamePress={hostEditor && frameLines ? (side) => pickText(side === 'first' ? 'groomName' : 'brideName') : undefined}
                nameClassName={cn(theme.text, theme.textGlowHeading)}
                className={cn('mt-1', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-invite')}
              />
            )}
            {envelopeCover || heroStack ? null : (
            <WeddingCoupleNames
              groomName={card.groomName}
              brideName={card.brideName}
              flyIn={contentVisible && card.effectsEnabled}
              pace="opened"
              className={cn('mt-3 font-serif text-[clamp(1.35rem,8cqi,4.25rem)] font-semibold italic leading-none', theme.contentCard === 'scallop' && 'wedding-guest-name not-italic', theme.text, theme.textGlowHeading)}
            />
            )}
            {envelopeCover ? null : (
            <div className={cn('mt-1 mb-0 text-3xl leading-none sm:text-4xl', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-ornament', theme.accent, theme.textGlow)}>{theme.ornament}</div>
            )}
            <div>
            {withoutPartyAddress(card.loveQuote) && (
              <p className={cn('mx-auto mt-4 max-w-lg font-serif text-lg italic leading-7 sm:mt-5 sm:text-xl sm:leading-8', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-quote', theme.accentText, theme.textGlow)}>
                “{writeGuestName(personalize(withoutPartyAddress(card.loveQuote)))}”
              </p>
            )}
            {envelopeCover || !(heroStack || (coverFrameMode === 'none' && !displayCoverPhotoUrl)) ? (
              <div className={cn('mx-auto mt-6 w-full sm:mt-7', coverFrameMode === 'preset' || coverFrameMode === 'library' || coverFrameMode === 'ai' || coverFrameMode === 'none' ? 'max-w-[32rem]' : '', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-invite')}>
                <WeddingCoverShellCard
                  frameOnly
                  presetId={coverPresetId}
                  aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                  frameMode={coverFrameMode}
                  coverPhotoUrl={displayCoverPhotoUrl}
                  coverPhotoObjectPosition={coverPhotoObjectPosition}
                  coverPhotoScale={coverPhotoScale}
                  frameScale={resolveCoverFrameScale(sectionConfig)}
                  groomName={card.groomName}
                  brideName={card.brideName}
                  theme={theme}
                  invitationLabel={tx.invitation}
                  cordiallyInvitesLabel={tx.cordiallyInvites}
                  openButtonLabel={tx.openInvitation}
                  dateFallback={tx.dateFallback}
                  photoAlt={tx.coverPhotoAlt}
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
                weddingDateLabel={displayWeddingDateLabel || undefined}
                weddingTimeText={guestBlockLocation.displayTime || weddingDisplayTime}
                addressText={guestBlockLocation.address}
                mapUrl={guestBlockLocation.mapUrl}
                viewMapLabel={tx.guestInviteViewMap}
                personalInviteText={displayPersonalInvite || undefined}
                personalInviteClassName={cn('max-w-xl text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}
                scriptLines={contentVisible && card.effectsEnabled}
                panelClassName={theme.panelStrong}
                cordiallyClassName={cn(theme.mutedText, theme.textGlow)}
                nameClassName={cn(theme.text, theme.textGlowHeading)}
                venueClassName={cn(theme.accentText, theme.textGlow, 'tracking-wide')}
                addressClassName={cn(theme.mutedText, theme.textGlow)}
                weddingThemeId={theme.id}
                buttonColor={buttonColor}
              />
            ) : (
              <>
                <p className={cn('mx-auto mt-1 max-w-xl whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-invite', theme.mutedText, theme.textGlow)}>
                  {writeGuestName(personalize(displayPersonalInvite || displayInvitationText || tx.defaultInvitation))}
                </p>
                {displayInvitationTextEn && !displayPersonalInvite ? (
                  <p className={cn('mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-7', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-invite-en', theme.mutedText, theme.textGlow)}>
                    {writeGuestName(personalize(displayInvitationTextEn))}
                  </p>
                ) : null}
              </>
            )}
            {(displayWeddingDateIso ?? weddingDateIso) ? (
              <div className={cn('mx-auto mt-6 max-w-lg', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-after')}>
                <WeddingCountdownBlock
                  weddingDateIso={(displayWeddingDateIso ?? weddingDateIso)!}
                  weddingTimeText={guestInviteLocation.receptionTime || card.weddingTime}
                  partyStartTime={guestInviteLocation.partyStartTime || card.partyStartTime}
                  locale={uiLocale}
                  tx={txCal}
                  className={cn(theme.textGlow, 'font-medium')}
                />
              </div>
            ) : null}
            {card.musicUrl && (
              <div className={cn('mx-auto mt-5 w-full rounded-3xl p-4 text-left', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-after', theme.panelUi)}>

                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Music className={cn('h-4 w-4', theme.accent)} />
                  {tx.musicTitle}
                </p>
                <WeddingInvitationAudio
                  ref={weddingMusicAudioRef}
                  src={card.musicUrl}
                  loop
                  playStartSec={card.musicPlayStartSec}
                  playEndSec={card.musicPlayEndSec}
                  preload="auto"
                  className="w-full"
                  onSourceError={() => setMusicLoadFailed(true)}
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
              </div>
            )}
            </div>
          </WeddingReadableGlass>
        </section>

        <section
          className="bg-cover bg-center px-3 py-3 sm:px-4"
          style={contentSurface}
        >
          <div className={PUBLIC_COLUMN}>
            {(groomFamilyLine.trim() || groomHometownLine.trim() || brideFamilyLine.trim() || brideHometownLine.trim()) ? (
            <WeddingReadableGlass reveal className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('text-[11px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]', theme.accentText, theme.textGlow)}>{tx.familiesIntro}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {(groomFamilyLine.trim() || groomHometownLine.trim()) ? (
                  <div className={cn('rounded-3xl p-4', theme.panelStrong)}>
                    <p className={cn('text-sm', theme.mutedText, theme.textGlow)}>{tx.groomFamily}</p>
                    {groomFamilyLine.trim() ? (
                      <p className={cn('mt-1 whitespace-pre-line break-words font-serif text-lg sm:text-xl', theme.text, theme.textGlow)}>{groomFamilyLine}</p>
                    ) : null}
                    {groomHometownLine.trim() ? (
                      <p className={cn('mt-2 whitespace-pre-line break-words text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)}>
                        {tx.hometownLabel}: {groomHometownLine.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {(brideFamilyLine.trim() || brideHometownLine.trim()) ? (
                  <div className={cn('rounded-3xl p-4', theme.panelStrong)}>
                    <p className={cn('text-sm', theme.mutedText, theme.textGlow)}>{tx.brideFamily}</p>
                    {brideFamilyLine.trim() ? (
                      <p className={cn('mt-1 whitespace-pre-line break-words font-serif text-lg sm:text-xl', theme.text, theme.textGlow)}>{brideFamilyLine}</p>
                    ) : null}
                    {brideHometownLine.trim() ? (
                      <p className={cn('mt-2 whitespace-pre-line break-words text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)}>
                        {tx.hometownLabel}: {brideHometownLine.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </WeddingReadableGlass>
            ) : null}
            {!heroStack && (groomPhotoUrl.trim() || bridePhotoUrl.trim()) ? (
              <WeddingReadableGlass reveal className="rounded-[1.75rem] px-4 py-5 text-center sm:rounded-[2rem] sm:px-6 sm:py-7">
                <WeddingCouplePortraits
                  groomName={card.groomName}
                  brideName={card.brideName}
                  groomImageUrl={groomPhotoUrl}
                  brideImageUrl={bridePhotoUrl}
                  groomLabel={tx.groomRole}
                  brideLabel={tx.brideRole}
                  groomFrame={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                  brideFrame={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                  groomShell={groomShell}
                  brideShell={brideShell}
                  groomFrameScale={resolvePortraitFrameScale(sectionConfig, 'groom')}
                  brideFrameScale={resolvePortraitFrameScale(sectionConfig, 'bride')}
                  theme={theme}
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
                onChange={(value) => editCopy('intro', value)}
                style={textCss('intro')}
                className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}
              >
                {renderWeddingHighlightedText(
                  withoutPartyAddress(hostEditor ? introDraft : card.coupleIntro) || withoutPartyAddress(hostEditor ? storyDraft : card.storyText) || tx.defaultCoupleIntro,
                  textTokens,
                  uiLocale,
                  nameHighlightClass,
                  guestNameScriptClass,
                )}
              </WeddingGuestTextSlot>
            </WeddingReadableGlass>
            {albumPhotoUrls.length > 0 && (
              <WeddingSectionCard theme={theme} title={tx.albumTitle} className="relative z-[100] min-w-0" contentClassName="min-w-0 -mx-1 sm:-mx-2">
                <WeddingAlbumStage
                  urls={albumPhotoUrls}
                  alt={tx.albumAlt}
                  layoutId={albumLayoutId}
                  locale={uiLocale}
                  crops={sectionConfig.albumPhotoCrops}
                  onExpand={(index) => setActiveAlbumIndex(index)}
                  onOpenAlbum={() => {
                    setActiveAlbumIndex(null)
                    setAlbumOpen(true)
                  }}
                />
                <p className={cn('mt-3 text-center text-sm', theme.mutedText, theme.textGlow)}>
                  {albumLayoutId === 'grid' ? tx.albumGridHint : tx.albumHint}
                </p>
              </WeddingSectionCard>
            )}
          </div>
        </section>

        <section
          id="event"
          className="bg-cover bg-center px-3 py-3 sm:px-4"
          style={contentSurface}
        >
          <div className={PUBLIC_COLUMN}>
            {showBothHouses ? (
              <div className="space-y-4">
                {(['groom', 'bride'] as const).map((side) => {
                  const loc = resolveGuestInviteLocation(card, side === 'groom' ? 'groom_home' : 'bride_home')
                  const iso = resolveWeddingDateIso(loc.weddingDate)
                  const label = side === 'groom' ? tx.groomFamily : tx.brideFamily
                  return (
                    <WeddingReadableGlass
                      key={side}
                      reveal
                      className="rounded-[1.75rem] p-4 text-center sm:rounded-[2rem] sm:p-5"
                    >
                      <p className={cn('text-[11px] uppercase tracking-[0.22em] sm:text-xs', theme.accentText, theme.textGlow)}>
                        {label}
                      </p>
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
                      {loc.address ? (
                        <p className={cn('mt-4 flex items-start justify-center gap-2 text-center text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)} style={textCss('event')}>
                          <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', theme.accent)} />
                          <span>{loc.address}</span>
                        </p>
                      ) : null}
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
                  className="mb-4"
                  showCountdown={false}
                />
              ) : displayWeddingDateLabel ? (
                <p className="mb-4 text-lg font-semibold">
                  {displayWeddingDateLabel} · {guestInviteLocation.displayTime || weddingDisplayTime || tx.timeFallback}
                </p>
              ) : (
                <p className="mb-4 text-lg font-semibold">
                  {tx.dateFallback} · {guestInviteLocation.displayTime || weddingDisplayTime || tx.timeFallback}
                </p>
              )}
              <div className="relative mt-4">
              <p className={cn('flex items-start justify-center gap-2 text-center text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)} style={textCss('event')}>
                <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', theme.accent)} />
                <span>{displayVenue}</span>
              </p>
              {hostEditor && frameLines ? (
                <div className="absolute inset-x-0 top-0 z-[80] mx-auto grid max-w-md gap-2 rounded-xl bg-white/95 p-2 text-left shadow-lg">
                  <input
                    aria-label={tx.dateFallback}
                    data-wedding-text="event"
                    type="date"
                    value={dateDraft}
                    onFocus={() => pickText('event')}
                    onChange={(event) => editCopy('date', event.target.value)}
                    style={textCss('event')}
                    className="h-10 rounded-xl border border-dashed border-rose-300 bg-white/80 px-3 text-sm text-stone-900"
                  />
                  <input
                    aria-label={tx.timeFallback}
                    data-wedding-text="event"
                    value={timeDraft}
                    onFocus={() => pickText('event')}
                    onChange={(event) => editCopy('time', event.target.value)}
                    style={textCss('event')}
                    className="h-10 rounded-xl border border-dashed border-rose-300 bg-white/80 px-3 text-sm text-stone-900"
                  />
                  <textarea
                    aria-label={tx.guestInviteViewMap}
                    data-wedding-text="event"
                    value={addressDraft}
                    onFocus={() => pickText('event')}
                    onChange={(event) => editCopy('address', event.target.value)}
                    rows={2}
                    style={textCss('event')}
                    className="rounded-xl border border-dashed border-rose-300 bg-white/80 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
              ) : null}
              </div>
              {guestInviteLocation.contact ? (
                <p className={cn('mt-3 text-sm', theme.mutedText, theme.textGlow)}>
                  {tx.contactLabel}: {guestInviteLocation.contact}
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
              {displayTimeline.length > 0 ? (
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
              {displayDressCode && (
                <div className={cn('mt-6 rounded-3xl p-4', theme.panelStrong)}>
                  <p className={cn('text-xs uppercase tracking-[0.24em]', theme.accentText, theme.textGlow)}>{tx.dressCodeTitle}</p>
                  <p className={cn('mt-2 whitespace-pre-line', theme.text, theme.textGlow)}>{writeGuestName(personalize(displayDressCode))}</p>
                </div>
              )}
            </WeddingReadableGlass>
          </div>
        </section>

        {shouldShowPublicGiftBoxForSide(card, guestInviteLocation.side) && (
          <div
            className="border-y bg-cover bg-center"
            style={{ ...contentSurface, borderColor: weddingGiftBoxLook(readyBackground?.id, card.masterImageUrl).band }}
          >
            <WeddingGiftEnvelopeBlock
              card={card}
              tx={txGift}
              sideFilter={guestInviteLocation.side}
              seal={invitationSeal(card.occasionKey)}
              look={weddingGiftBoxLook(readyBackground?.id, card.masterImageUrl)}
            />
          </div>
        )}

        <section
          className="bg-cover bg-center px-3 py-3 sm:px-4"
          style={contentSurface}
        >
          <div className={PUBLIC_COLUMN}>
          {withoutPartyAddress(hostEditor ? storyDraft : card.storyText).trim() !== '' && withoutPartyAddress(hostEditor ? storyDraft : card.storyText).trim() !== withoutPartyAddress(hostEditor ? introDraft : card.coupleIntro).trim() ? (
            <WeddingSectionCard theme={theme} title={tx.storyTitle}>
              <WeddingGuestTextSlot
                editing={Boolean(hostEditor && frameLines)}
                draft={storyDraft}
                ariaLabel={tx.storyTitle}
                textKey="story"
                onFocus={() => pickText('story')}
                onChange={(value) => editCopy('story', value)}
                style={textCss('story')}
                className={cn('whitespace-pre-line text-center leading-8', theme.mutedText, theme.textGlow)}
              >
                {renderWeddingHighlightedText(withoutPartyAddress(hostEditor ? storyDraft : card.storyText), textTokens, uiLocale, nameHighlightClass, guestNameScriptClass)}
              </WeddingGuestTextSlot>
            </WeddingSectionCard>
          ) : null}
          {card.rsvpEnabled && (
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
          )}
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
          className="bg-cover bg-center px-3 py-4 text-center sm:px-4"
          style={contentSurface}
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
        <div data-wedding-ornament-frame="flow">
        {(contentVisible || ornamentEditor) ? (
        ornamentEditor ? (
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
            onChange={setLetterDraft}
          />
        ) : (
          <WeddingBackgroundOrnamentLayer ornaments={letterShown} className="absolute inset-0 z-20" />
        )
        ) : null}
        </div>
        </FittedCoverFrame>
        </div>
        ) : null}
        {opened && !layoutPreview && card.effectsEnabled && card.musicUrl && !musicLoadFailed && (
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
        {albumOpen && activeAlbumIndex === null && (
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-4 sm:py-6">
            <div className="mx-auto max-w-5xl">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow sm:mb-4">
                <p className="min-w-0 truncate font-semibold">{tx.albumTitle}</p>
                <Button variant="outline" size="sm" onClick={() => setAlbumOpen(false)}>
                  {tx.closeGallery}
                </Button>
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
          </div>
        )}
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
          hidden={hostEditor && !frameLines && !chromeHold}
          icon={<X className="h-4 w-4" />}
          onClick={() => {
            window.location.assign(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(card.id)}`)
          }}
        />
      ) : null}
    </>
  )
}

