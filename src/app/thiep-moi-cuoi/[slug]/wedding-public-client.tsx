'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, MapPin, Music, Send, Sparkles, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  invitationSeal,
} from '@/lib/wedding/invitation-occasion'
import { WeddingInvitationShareActions } from '@/components/wedding/wedding-invitation-share-actions'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { shouldShowPublicGiftBoxForSide } from '@/lib/wedding/wedding-gift-vietqr'
import { resolveWeddingDisplayTime } from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso, formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { getWeddingTheme, isWeddingDarkTheme, weddingBackgroundStyle, weddingNavLinkClass, WEDDING_BG_OVERLAY } from '@/lib/wedding/wedding-theme'
import { WeddingSectionCard } from '@/components/wedding/wedding-section-card'
import { DEFAULT_WEDDING_COVER_PRESET_ID } from '@/lib/wedding/wedding-cover-presets'
import {
  parseWeddingSectionConfig,
  resolveCoverAiFrame,
  resolveCoverFrameMode,
  resolveCoverFrameOpen,
  resolveOpenBurstEffect,
  resolveOpenFallEffect,
  resolveCoverPhotoObjectPosition,
  resolveCoverPhotoOpen,
  resolveCoverPhotoScale,
  resolveCoverPhotoUrl,
  resolvePortraitPhotoFrame,
  resolvePortraitShell,
} from '@/lib/wedding/wedding-section-config'
import { WeddingCoverShellCard } from '@/components/wedding/wedding-cover-shell-card'
import { WeddingInvitationMotion } from '@/components/wedding/wedding-invitation-motion'
import { WeddingOpenEffects } from '@/components/wedding/wedding-open-effects'
import { WeddingPartyCountFields } from '@/components/wedding/wedding-party-count-fields'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingCoupleNames } from '@/components/wedding/wedding-couple-names'
import { WeddingCouplePortraits } from '@/components/wedding/wedding-couple-portraits'
import { WeddingWishPresetPicker } from '@/components/wedding/wedding-wish-preset-picker'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { WeddingGuestNameFontLink, renderWeddingGuestName, WEDDING_GUEST_NAME_CLASS } from '@/components/wedding/wedding-guest-name-font'
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
  scrollWeddingPageToTop,
  startWeddingInvitationAutoScroll,
  stopWeddingInvitationAutoScroll,
} from '@/hooks/use-wedding-invitation-auto-scroll'

const PUBLIC_COLUMN = 'mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-7'

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

export default function WeddingPublicClient({
  card,
  sideWishes,
  initialGuestDisplayName = '',
  initialGuestInviteVenue = '',
  initialLetterView = 'groom',
  askLetterView = false,
  initialPersonalInvite = '',
  initialGuestRsvp = null,
}: {
  card: WeddingCard
  sideWishes: WeddingSideWishGroups
  initialGuestDisplayName?: string
  initialGuestInviteVenue?: WeddingGuestInviteVenue
  initialLetterView?: 'groom' | 'bride' | 'both'
  askLetterView?: boolean
  initialPersonalInvite?: string
  initialGuestRsvp?: PublishedGuestRsvpSnapshot | null
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
  const theme = useMemo(() => getWeddingTheme(card.selectedStyleId), [card.selectedStyleId])
  const pageBackground = card.masterImageUrl?.trim() || ''
  const sectionConfig = useMemo(() => parseWeddingSectionConfig(card.sectionConfig), [card.sectionConfig])
  const coverPresetId = sectionConfig.coverPresetId || DEFAULT_WEDDING_COVER_PRESET_ID
  const coverAiFrame = useMemo(() => resolveCoverAiFrame(sectionConfig), [sectionConfig])
  const coverFrameMode = useMemo(() => resolveCoverFrameMode(sectionConfig), [sectionConfig])
  const coverPhotoOpen = useMemo(() => resolveCoverPhotoOpen(sectionConfig), [sectionConfig])
  const coverFrameOpen = useMemo(() => resolveCoverFrameOpen(sectionConfig), [sectionConfig])
  const openBurstEffect = useMemo(() => resolveOpenBurstEffect(sectionConfig), [sectionConfig])
  const openFallEffect = useMemo(() => resolveOpenFallEffect(sectionConfig), [sectionConfig])
  const albumLayoutId = resolveWeddingAlbumLayoutId(sectionConfig.albumLayoutId)
  const coverPhotoUrl = resolveCoverPhotoUrl(sectionConfig)
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
  const [attending, setAttending] = useState(() => seedParty(initialGuestRsvp).attending)
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
  const rsvpSeq = useRef(0)
  const partyTimer = useRef<number | null>(null)
  const [reminderEmail, setReminderEmail] = useState('')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [coverReminderOn, setCoverReminderOn] = useState(false)
  const [letterView, setLetterView] = useState<'groom' | 'bride' | 'both' | null>(
    () => (askLetterView ? null : initialLetterView),
  )
  const [houseAskOpen, setHouseAskOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const scrollTimer = useRef<number | null>(null)
  const coverScrollRef = useRef<HTMLDivElement>(null)
  const doorStarted = useRef(false)
  const [contentVisible, setContentVisible] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [activeAlbumIndex, setActiveAlbumIndex] = useState<number | null>(null)
  const [sharePageUrl, setSharePageUrl] = useState('')
  const weddingMusicAudioRef = useRef<WeddingInvitationAudioHandle>(null)
  const reportMusicPlaying = useCallback((playing: boolean) => {
    setMusicFabPlaying(playing)
  }, [])
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
    if (opened) return
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
  }, [opened])

  const chooseLetterHouse = (view: 'groom' | 'bride' | 'both') => {
    setLetterView(view)
    setHouseAskOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    openInvitation()
  }

  const requestOpen = () => {
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
    if (!card.effectsEnabled) return
    if (reduced) {
      startWeddingInvitationAutoScroll()
      return
    }
    scrollTimer.current = window.setTimeout(() => startWeddingInvitationAutoScroll(), 5600)
  }

  useLayoutEffect(() => {
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
  }, [opened])

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
      groomName: card.groomName,
      brideName: card.brideName,
      guestName: guestDisplayName,
    }),
    [card.brideName, card.groomName, guestDisplayName],
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

  const guestInviteLocation = useMemo(
    () => resolveGuestInviteLocation(card, guestDisplayVenue),
    [card, guestDisplayVenue],
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
  const displayCoverPhotoUrl = guestInviteLocation.coverImageUrl || coverPhotoUrl
  const displayInvitationText = withoutPartyAddress(guestInviteLocation.invitationText || card.invitationText)
  const displayInvitationTextEn = withoutPartyAddress(guestInviteLocation.invitationTextEn || card.invitationTextEn)
  const displayTimeline = useMemo(
    () => parseWeddingEventTimeline(guestInviteLocation.eventTimeline || card.eventTimeline),
    [card.eventTimeline, guestInviteLocation.eventTimeline],
  )
  const displayDressCode = withoutPartyAddress(guestInviteLocation.dressCode || card.dressCode)
  const displayThankYou = withoutPartyAddress(guestInviteLocation.thankYouText || card.thankYouText)
  const displayVenue = guestInviteLocation.address || card.venue
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
      if (!quiet) toast({ title: tx.submitSuccessTitle, description: tx.submitSuccessDesc })
      router.refresh()
    },
    [card.slug, guestDisplayName, guestDisplayVenue, guestName, message, router, toast, tx.submitErrorTitle, tx.submitSuccessDesc, tx.submitSuccessTitle],
  )

  const submit = async () => {
    const adult = attending ? partyAdult : 0
    const child = attending ? partyChild : 0
    setSubmitting(true)
    const formData = new FormData()
    formData.append('guestName', guestName)
    formData.append('attending', String(attending))
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
    setCoverRsvpChoice(attending ? 'yes' : 'no')
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
    if (coverReminderOn && displayWeddingDateIso) {
      const reminded = await submitReminder()
      if (!reminded) return
    }
    if (partyTimer.current) window.clearTimeout(partyTimer.current)
    setPartyAdult(safeAdult)
    setPartyChild(child)
    setPartyModalOpen(false)
    setCoverRsvpChoice('yes')
    setAttending(true)
    void saveGuestRsvp(true, safeAdult, child)
  }

  const chooseCoverNo = () => {
    if (coverRsvpChoice === 'no' || submitting) return
    if (partyTimer.current) window.clearTimeout(partyTimer.current)
    setPartyModalOpen(false)
    setCoverRsvpChoice('no')
    setAttending(false)
    void saveGuestRsvp(false, 0, 0)
  }

  const changeParty = (adult: number, child: number) => {
    setPartyAdult(adult)
    setPartyChild(child)
    if (partyTimer.current) window.clearTimeout(partyTimer.current)
    partyTimer.current = window.setTimeout(() => {
      void saveGuestRsvp(true, adult, child, true)
    }, 450)
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
            {displayWeddingDateIso ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-white/80 p-3">
                <label className="flex items-start gap-2 text-left text-sm font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-800"
                    checked={coverReminderOn}
                    disabled={submitting || reminderSubmitting}
                    onChange={(event) => setCoverReminderOn(event.target.checked)}
                  />
                  <span>{tx.coverReminderOptIn}</span>
                </label>
                {coverReminderOn ? (
                  <div className="mt-3 space-y-3">
                    <label className="block text-left">
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
                    <label className="block text-left">
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
              </div>
            ) : null}
            <button
              type="button"
              disabled={submitting || reminderSubmitting || draftAdult + draftChild < 1}
              onClick={() => void confirmPartyModal()}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full border-2 border-emerald-800 bg-emerald-800 font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.28)] disabled:opacity-60"
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
      {opened && card.effectsEnabled ? (
        <WeddingOpenEffects play burst={openBurstEffect} fall={openFallEffect} />
      ) : null}
      <main className={cn('min-h-screen', theme.pageBg, theme.text)}>
        {!opened && (
          <>
            <div
              ref={coverScrollRef}
              className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-cover bg-center"
              style={{
                ...weddingBackgroundStyle(
                  guestInviteLocation.coverImageUrl || pageBackground,
                  theme,
                  WEDDING_BG_OVERLAY.cover,
                  { readingVignette: true },
                ),
                backgroundColor: isWeddingDarkTheme(theme.id) ? '#0f172a' : '#fffdf8',
              }}
            >
              <div className="flex min-h-full flex-col items-center justify-start px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.35rem,env(safe-area-inset-top))] sm:px-4 sm:pb-4 sm:pt-3">
                <div
                  className={cn(
                    'w-full max-w-[min(26rem,calc(100vw-1.5rem))] sm:max-w-[min(28rem,calc(100vw-2rem))] lg:max-w-[min(36rem,calc(100vw-4rem))]',
                  )}
                >
                  <WeddingCoverShellCard
                    fitViewport
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
                    groomName={card.groomName}
                    brideName={card.brideName}
                    weddingDate={displayWeddingDateLabel}
                    weddingTimeText={guestInviteLocation.displayTime || weddingDisplayTime}
                    guestName={guestDisplayName || undefined}
                    guestInviteVenue={guestBlockVenue}
                    guestInviteVenueLabel={guestBlockVenueDisplay || undefined}
                    addressText={guestBlockLocation.address || undefined}
                    mapUrl={guestBlockLocation.mapUrl || undefined}
                    viewMapLabel={tx.guestInviteViewMap}
                    theme={theme}
                    invitationLabel={tx.invitation}
                    cordiallyInvitesLabel={tx.cordiallyInvites}
                    personalInviteText={displayPersonalInvite || undefined}
                    openButtonLabel={tx.openInvitation}
                    dateFallback={tx.dateFallback}
                    photoAlt={tx.coverPhotoAlt}
                    quickRsvp={
                      card.rsvpEnabled && guestDisplayName
                        ? {
                            yesLabel: tx.coverAttendYes,
                            noLabel: tx.coverAttendNo,
                            savedYesLabel: tx.coverRsvpSavedYes,
                            savedNoLabel: tx.coverRsvpSavedNo,
                            busy: submitting || partyModalOpen,
                            choice: coverRsvpChoice,
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
          </>
        )}
        {/* Vỏ: tên bay từ hai bên một lần lúc hiện. Bấm mở thì gỡ vỏ và chạy chữ bên trong, không phát lại vỏ. */}
        <div style={{ opacity: contentVisible ? 1 : 0 }}>
        <WeddingInvitationMotion enabled={card.effectsEnabled}>
        <nav
          className={cn(
            'sticky top-0 z-30 border-b px-2 py-2 text-sm backdrop-blur-xl backdrop-saturate-150 sm:px-3 sm:py-2.5',
            theme.nav,
          )}
        >
          <div className="mx-auto flex max-w-2xl snap-x gap-1 overflow-x-auto overscroll-x-contain px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
            <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#cover">{tx.navInvitation}</a>
            <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#event">{tx.navEvent}</a>
            <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#story">{tx.navStory}</a>
            <a className={cn(weddingNavLinkClass(theme), 'snap-start whitespace-nowrap')} href="#guest">{tx.navRsvp}</a>
          </div>
        </nav>
        <section
          id="cover"
          className="relative flex min-h-[100svh] items-center justify-center bg-cover bg-center px-3 py-8 sm:px-4 sm:py-12"
          style={weddingBackgroundStyle(pageBackground, theme, WEDDING_BG_OVERLAY.hero, { readingVignette: true })}
        >
          <WeddingReadableGlass theme={theme} strength="hero" className="w-full max-w-3xl rounded-[1.75rem] p-5 text-center sm:rounded-[2.25rem] sm:p-6 md:p-10">
            <p className={cn('text-[11px] uppercase tracking-[0.28em] sm:text-xs sm:tracking-[0.4em]', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-kicker', theme.accentText, theme.textGlow)}>{tx.invitation}</p>
            <WeddingCoupleNames
              groomName={card.groomName}
              brideName={card.brideName}
              flyIn={contentVisible && card.effectsEnabled}
              pace="opened"
              className={cn('mt-3 font-serif text-[clamp(1.35rem,8cqi,4.25rem)] font-semibold italic leading-none', theme.text, theme.textGlowHeading)}
            />
            <div className={cn('mt-1 mb-0 text-3xl leading-none sm:text-4xl', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-ornament', theme.accent, theme.textGlow)}>{theme.ornament}</div>
            <div>
            {withoutPartyAddress(card.loveQuote) && (
              <p className={cn('mx-auto mt-4 max-w-lg font-serif text-lg italic leading-7 sm:mt-5 sm:text-xl sm:leading-8', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-quote', theme.accentText, theme.textGlow)}>
                “{writeGuestName(personalize(withoutPartyAddress(card.loveQuote)))}”
              </p>
            )}
            {coverFrameMode === 'none' && !displayCoverPhotoUrl ? null : (
              <div className={cn('mx-auto mt-6 w-full sm:mt-7', coverFrameMode === 'preset' || coverFrameMode === 'library' || coverFrameMode === 'ai' || coverFrameMode === 'none' ? 'max-w-[32rem]' : '', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-invite')}>
                <WeddingCoverShellCard
                  frameOnly
                  presetId={coverPresetId}
                  aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                  frameMode={coverFrameMode}
                  coverPhotoUrl={displayCoverPhotoUrl}
                  coverPhotoObjectPosition={coverPhotoObjectPosition}
                  coverPhotoScale={coverPhotoScale}
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
            )}
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
              <div className={cn('mx-auto mt-5 max-w-md rounded-3xl p-4 text-left', contentVisible && card.effectsEnabled && 'wedding-open-line wedding-open-after', theme.panelUi)}>

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
          className={cn('bg-cover bg-center px-3 py-10 sm:px-4 sm:py-16', theme.softGradient)}
          style={weddingBackgroundStyle(pageBackground, theme, WEDDING_BG_OVERLAY.section)}
        >
          <div className={PUBLIC_COLUMN}>
            {(groomFamilyLine.trim() || groomHometownLine.trim() || brideFamilyLine.trim() || brideHometownLine.trim()) ? (
            <WeddingReadableGlass theme={theme} strength="section" reveal className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
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
            {(card.groomImageUrl.trim() || card.brideImageUrl.trim()) ? (
              <WeddingReadableGlass theme={theme} strength="section" reveal className="rounded-[1.75rem] px-4 py-5 text-center sm:rounded-[2rem] sm:px-6 sm:py-7">
                <WeddingCouplePortraits
                  groomName={card.groomName}
                  brideName={card.brideName}
                  groomImageUrl={card.groomImageUrl}
                  brideImageUrl={card.brideImageUrl}
                  groomLabel={tx.groomRole}
                  brideLabel={tx.brideRole}
                  groomFrame={resolvePortraitPhotoFrame(sectionConfig, 'groom')}
                  brideFrame={resolvePortraitPhotoFrame(sectionConfig, 'bride')}
                  groomShell={resolvePortraitShell(sectionConfig, 'groom')}
                  brideShell={resolvePortraitShell(sectionConfig, 'bride')}
                  theme={theme}
                />
              </WeddingReadableGlass>
            ) : null}
            <WeddingReadableGlass id="story" theme={theme} strength="section" reveal className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('text-[11px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]', theme.accentText, theme.textGlow)}>{tx.coupleIntroTitle}</p>
              <p className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
                {renderWeddingHighlightedText(
                  withoutPartyAddress(card.coupleIntro) || withoutPartyAddress(card.storyText) || tx.defaultCoupleIntro,
                  textTokens,
                  uiLocale,
                  nameHighlightClass,
                  guestNameScriptClass,
                )}
              </p>
            </WeddingReadableGlass>
            {card.albumImageUrls.length > 0 && (
              <WeddingSectionCard theme={theme} title={tx.albumTitle} className="min-w-0" contentClassName="min-w-0 -mx-1 sm:-mx-2">
                <WeddingAlbumStage
                  urls={card.albumImageUrls}
                  alt={tx.albumAlt}
                  layoutId={albumLayoutId}
                  locale={uiLocale}
                  crops={sectionConfig.albumPhotoCrops}
                  onExpand={(index) => setActiveAlbumIndex(index)}
                />
                <p className={cn('mt-3 text-center text-sm', theme.mutedText, theme.textGlow)}>{tx.albumHint}</p>
              </WeddingSectionCard>
            )}
          </div>
        </section>

        <section
          id="event"
          className="bg-cover bg-center px-3 py-10 sm:px-4 sm:py-16"
          style={weddingBackgroundStyle(pageBackground, theme, WEDDING_BG_OVERLAY.section)}
        >
          <div className={PUBLIC_COLUMN}>
            {showBothHouses ? (
              <div className="space-y-4">
                {(['groom', 'bride'] as const).map((side) => {
                  const loc = resolveGuestInviteLocation(card, side === 'groom' ? 'groom_home' : 'bride_home')
                  const iso = resolveWeddingDateIso(loc.weddingDate)
                  const timeline = parseWeddingEventTimeline(loc.eventTimeline)
                  const label = side === 'groom' ? tx.groomFamily : tx.brideFamily
                  return (
                    <WeddingReadableGlass
                      key={side}
                      theme={theme}
                      strength="section"
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
                          className="mb-4 mt-4"
                          showCountdown={false}
                        />
                      ) : (
                        <p className="mb-4 mt-4 text-lg font-semibold">
                          {loc.weddingDate || tx.dateFallback} · {loc.displayTime || tx.timeFallback}
                        </p>
                      )}
                      {loc.address ? (
                        <p className={cn('mt-4 flex items-start justify-center gap-2 text-center text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)}>
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
                            className={cn(
                              'mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors active:scale-[0.98]',
                              theme.mapButton,
                            )}
                          >
                            <MapPin className="h-4 w-4" aria-hidden />
                            {tx.openMaps}
                          </a>
                        </>
                      ) : null}
                      {timeline.length > 0 ? (
                        <WeddingTimelineList
                          className="mt-5"
                          items={timeline.map((item, index) => {
                            const content = weddingTimelineItemContent(item)
                            return {
                              key: `${side}-${item.time}-${index}`,
                              time: item.time,
                              content: content ? writeGuestName(personalize(content)) : null,
                            }
                          })}
                          panelClassName={theme.panelStrong}
                          textClassName={theme.text}
                          mutedClassName={theme.mutedText}
                          accentTextClassName={theme.accentText}
                          textGlow={theme.textGlow}
                        />
                      ) : null}
                    </WeddingReadableGlass>
                  )
                })}
              </div>
            ) : (
            <WeddingReadableGlass theme={theme} strength="section" reveal className="rounded-[1.75rem] p-4 text-center sm:rounded-[2rem] sm:p-5">
              {(displayWeddingDateIso ?? weddingDateIso) ? (
                <WeddingEventCalendarBlock
                  weddingDateIso={(displayWeddingDateIso ?? weddingDateIso)!}
                  weddingTimeText={guestInviteLocation.receptionTime || card.weddingTime}
                  partyStartTime={guestInviteLocation.partyStartTime || card.partyStartTime}
                  locale={uiLocale}
                  tx={txCal}
                  textGlow={theme.textGlow}
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
              <p className={cn('mt-4 flex items-start justify-center gap-2 text-center text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)}>
                <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', theme.accent)} />
                <span>{displayVenue}</span>
              </p>
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
                buttonClassName={theme.mapButton}
              />
              {displayMapUrl && (
                <>
                  <WeddingMapEmbed mapUrl={displayMapUrl} title={txMusic.publicMapEmbedTitle} className="mt-4" />
                  <a
                    href={displayMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors active:scale-[0.98]',
                      theme.mapButton,
                    )}
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {tx.openMaps}
                  </a>
                </>
              )}
            </WeddingReadableGlass>
            )}
            {showBothHouses && !displayDressCode ? null : (
            <WeddingReadableGlass theme={theme} strength="section" reveal className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              {showBothHouses ? null : (
                <>
              <p className={cn('flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] sm:text-xs sm:tracking-[0.3em]', theme.accentText, theme.textGlow)}>
                <CalendarDays className="h-4 w-4" />
                {tx.timelineTitle}
              </p>
              {displayTimeline.length > 0 ? (
                <WeddingTimelineList
                  items={displayTimeline.map((item, index) => {
                    const content = weddingTimelineItemContent(item)
                    return {
                      key: `${item.time}-${item.title}-${index}`,
                      time: item.time,
                      content: content ? writeGuestName(personalize(content)) : null,
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
                </>
              )}
              {displayDressCode && (
                <div className={cn('mt-6 rounded-3xl p-4', theme.panelStrong)}>
                  <p className={cn('text-xs uppercase tracking-[0.24em]', theme.accentText, theme.textGlow)}>{tx.dressCodeTitle}</p>
                  <p className={cn('mt-2 whitespace-pre-line', theme.text, theme.textGlow)}>{writeGuestName(personalize(displayDressCode))}</p>
                </div>
              )}
            </WeddingReadableGlass>
            )}
          </div>
        </section>

        {shouldShowPublicGiftBoxForSide(card, guestInviteLocation.side) && (
          <div
            className="border-y border-amber-200/50 bg-cover bg-center"
            style={weddingBackgroundStyle(pageBackground, theme, WEDDING_BG_OVERLAY.dense)}
          >
            <WeddingGiftEnvelopeBlock
              card={card}
              tx={txGift}
              sideFilter={guestInviteLocation.side}
              seal={invitationSeal(card.occasionKey)}
            />
          </div>
        )}

        <section
          className="bg-cover bg-center px-3 py-10 sm:px-4 sm:py-16"
          style={weddingBackgroundStyle(pageBackground, theme, WEDDING_BG_OVERLAY.section)}
        >
          <div className={PUBLIC_COLUMN}>
          {withoutPartyAddress(card.storyText) && withoutPartyAddress(card.storyText).trim() !== withoutPartyAddress(card.coupleIntro).trim() && (
            <WeddingSectionCard theme={theme} title={tx.storyTitle}>
              <p className={cn('whitespace-pre-line text-center leading-8', theme.mutedText, theme.textGlow)}>
                {renderWeddingHighlightedText(withoutPartyAddress(card.storyText), textTokens, uiLocale, nameHighlightClass, guestNameScriptClass)}
              </p>
            </WeddingSectionCard>
          )}
          {card.rsvpEnabled && (
            <WeddingSectionCard theme={theme} title={tx.rsvpTitle} id="guest">
              <div className={cn('space-y-4 rounded-2xl p-3 sm:p-4 md:p-5', theme.panelUi)}>
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.guestNameLabel}</Label>
                  <Input className="min-h-11" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={tx.guestNamePlaceholder} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button className="min-h-11" variant={attending ? 'default' : 'outline'} onClick={() => setAttending(true)}>{tx.attendYes}</Button>
                  <Button className="min-h-11" variant={!attending ? 'default' : 'outline'} onClick={() => (guestDisplayName ? chooseCoverNo() : setAttending(false))}>{tx.attendNo}</Button>
                </div>
                {attending ? (
                  <WeddingPartyCountFields
                    adultCount={partyAdult}
                    childCount={partyChild}
                    adultLabel={tx.rsvpAdultLabel}
                    childLabel={tx.rsvpChildLabel}
                    disabled={submitting}
                    onChange={(adult, child) => {
                      if (coverRsvpChoice === 'yes') changeParty(adult, child)
                      else {
                        setPartyAdult(adult)
                        setPartyChild(child)
                      }
                    }}
                  />
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
                  <Textarea className="min-h-28" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tx.wishPlaceholder} />
                </div>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  variant="outline"
                  className={cn('min-h-11 w-full rounded-full border-0 font-semibold', theme.button)}
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
                    className="min-h-11"
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
                    className="min-h-11"
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
                  className={cn('min-h-11 w-full rounded-full border-0 font-semibold', theme.button)}
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
          className="bg-cover bg-center px-3 py-12 text-center sm:px-4 sm:py-20"
          style={weddingBackgroundStyle(pageBackground, theme, WEDDING_BG_OVERLAY.hero, { readingVignette: true })}
        >
          <WeddingReadableGlass theme={theme} strength="hero" reveal className="mx-auto max-w-2xl rounded-[1.75rem] p-5 sm:rounded-[2rem] sm:p-8">
            <Sparkles className={cn('mx-auto h-8 w-8', theme.accent, theme.textGlow)} />
            <h2 className={cn('mt-4 font-serif text-3xl font-semibold italic sm:text-4xl', theme.text, theme.textGlowHeading)}>{tx.thankYouTitle}</h2>
            <p className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
              {renderWeddingHighlightedText(
                displayThankYou || tx.defaultThankYou,
                textTokens,
                uiLocale,
                nameHighlightClass,
                guestNameScriptClass,
              )}
            </p>
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
        {opened && card.effectsEnabled && card.musicUrl && !musicLoadFailed && (
          <button
            type="button"
            className={cn(
              'fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              musicFabPlaying
                ? 'border border-white/25 bg-rose-700 text-white ring-2 ring-white/15 hover:bg-rose-800 focus-visible:ring-white/50'
                : 'border border-rose-200/90 bg-white/95 text-rose-600 backdrop-blur-md hover:bg-rose-50 focus-visible:ring-rose-400',
            )}
            aria-label={musicFabPlaying ? txMusic.publicFabPauseAria : txMusic.publicFabPlayAria}
            aria-pressed={musicFabPlaying}
            onClick={() => weddingMusicAudioRef.current?.togglePlayback()}
          >
            <WeddingMusicFabVisual playing={musicFabPlaying} className={musicFabPlaying ? undefined : 'text-rose-600'} />
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
                urls={card.albumImageUrls}
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
            urls={card.albumImageUrls}
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
      </main>
    </>
  )
}
