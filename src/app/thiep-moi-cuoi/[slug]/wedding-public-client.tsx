'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Heart, Loader2, MapPin, Music, Send, Sparkles, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { WeddingAiImage, WeddingCard, WeddingImageType, WeddingWish } from '@/lib/db/wedding-cards-pg'
import { submitWeddingGuestResponse, subscribeWeddingReminder } from './actions'
import { WeddingAlbumLightbox } from './wedding-album-lightbox'
import { WeddingAlbumGalleryGrid, WeddingAlbumPreviewGrid } from '@/components/wedding/wedding-album-grid'
import { WeddingInvitationAudio, type WeddingInvitationAudioHandle } from '@/components/wedding/wedding-invitation-audio'
import { WeddingMusicFabVisual } from '@/components/wedding/wedding-music-fab-visual'
import { WeddingMapEmbed } from '@/components/wedding/wedding-map-embed'
import { WeddingEventCalendarBlock } from '@/components/wedding/wedding-event-calendar-block'
import { WeddingCountdownBlock } from '@/components/wedding/wedding-countdown-block'
import { WeddingGiftEnvelopeBlock } from '@/components/wedding/wedding-gift-envelope-block'
import { WeddingInvitationShareActions } from '@/components/wedding/wedding-invitation-share-actions'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { shouldShowPublicGiftBoxForSide } from '@/lib/wedding/wedding-gift-vietqr'
import { resolveWeddingDisplayTime } from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso, formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { getWeddingTheme, weddingBackgroundStyle, weddingNavLinkClass, WEDDING_BG_OVERLAY } from '@/lib/wedding/wedding-theme'
import { WeddingSectionCard } from '@/components/wedding/wedding-section-card'
import { DEFAULT_WEDDING_COVER_PRESET_ID } from '@/lib/wedding/wedding-cover-presets'
import {
  parseWeddingSectionConfig,
  resolveCoverPhotoObjectPosition,
  resolveCoverPhotoScale,
  resolveCoverPhotoUrl,
} from '@/lib/wedding/wedding-section-config'
import { WeddingCoverShellCard } from '@/components/wedding/wedding-cover-shell-card'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import {
  guestInviteVenueLabel,
  normalizeGuestInviteVenue,
  type WeddingGuestInviteVenue,
} from '@/lib/wedding/wedding-guest-invite-venue'
import { resolveGuestInviteLocation } from '@/lib/wedding/wedding-guest-invite-location'
import { resolveWeddingCardDisplayText } from '@/lib/wedding/wedding-card-text-interpolate'
import { renderWeddingHighlightedText } from '@/lib/wedding/wedding-card-text-highlight'
import { parseWeddingEventTimeline, weddingTimelineItemContent } from '@/lib/wedding/wedding-event-timeline'
import { startWeddingInvitationAutoScroll } from '@/hooks/use-wedding-invitation-auto-scroll'

function firstImageByType(images: WeddingAiImage[], type: WeddingImageType, fallback?: string | null) {
  return images.find((image) => image.type === type && image.status === 'completed')?.imageUrl || fallback || ''
}

const PUBLIC_COLUMN = 'mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-7'
const COVER_FADE_MS = 1800
const CONTENT_REVEAL_DELAY_MS = 900
const CONTENT_REVEAL_MS = 1650
const OVERLAY_REMOVE_DELAY_MS = 2350

export default function WeddingPublicClient({
  card,
  wishes,
  images,
}: {
  card: WeddingCard
  wishes: WeddingWish[]
  images: WeddingAiImage[]
}) {
  const { toast } = useToast()
  const uiLocale = readWebLocaleFromDocumentCookie()
  const txMusic = useMemo(() => getDictionary(uiLocale).weddingCardAiMusic, [uiLocale])
  const txCal = useMemo(() => getDictionary(uiLocale).weddingCardCalendar, [uiLocale])
  const txGift = useMemo(() => getDictionary(uiLocale).weddingGiftBox, [uiLocale])
  const tx = useMemo(() => getDictionary(uiLocale).weddingCardPublic, [uiLocale])
  const theme = useMemo(() => getWeddingTheme(card.selectedStyleId), [card.selectedStyleId])
  const sectionImages = useMemo(
    () => ({
      cover: firstImageByType(images, 'cover', card.masterImageUrl),
      invitation: firstImageByType(images, 'invitation', card.masterImageUrl),
      event: firstImageByType(images, 'event', card.masterImageUrl),
      rsvp: firstImageByType(images, 'rsvp', card.masterImageUrl),
      album: firstImageByType(images, 'album', card.masterImageUrl),
      gift_qr: firstImageByType(images, 'gift_qr', card.masterImageUrl),
      thanks: firstImageByType(images, 'thanks', card.masterImageUrl),
    }),
    [card.masterImageUrl, images],
  )
  const sectionConfig = useMemo(() => parseWeddingSectionConfig(card.sectionConfig), [card.sectionConfig])
  const coverPresetId = sectionConfig.coverPresetId || DEFAULT_WEDDING_COVER_PRESET_ID
  const coverPhotoUrl = resolveCoverPhotoUrl(sectionConfig)
  const coverPhotoObjectPosition = resolveCoverPhotoObjectPosition(sectionConfig)
  const coverPhotoScale = resolveCoverPhotoScale(sectionConfig)
  const weddingDateIso = useMemo(() => resolveWeddingDateIso(card.weddingDate), [card.weddingDate])
  const weddingDateLabel = useMemo(
    () => formatWeddingDateForDisplay(weddingDateIso ?? card.weddingDate, uiLocale),
    [card.weddingDate, uiLocale, weddingDateIso],
  )
  const weddingDisplayTime = useMemo(
    () => resolveWeddingDisplayTime(card.weddingTime, card.partyStartTime) || card.weddingTime,
    [card.partyStartTime, card.weddingTime],
  )
  const [musicLoadFailed, setMusicLoadFailed] = useState(false)
  const [musicFabPlaying, setMusicFabPlaying] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [attending, setAttending] = useState(true)
  const [guestCount, setGuestCount] = useState('1')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reminderEmail, setReminderEmail] = useState('')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [opened, setOpened] = useState(false)
  const [unfolding, setUnfolding] = useState(false)
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

  const guestDisplayName = useMemo(() => {
    if (typeof window === 'undefined') return card.guestName.trim()
    const fromUrl = new URLSearchParams(window.location.search).get('guest')
    return fromUrl?.trim() || card.guestName.trim()
  }, [card.guestName])

  useEffect(() => {
    if (!guestDisplayName) return
    setGuestName((current) => current.trim() || guestDisplayName)
  }, [guestDisplayName])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromUrl = new URLSearchParams(window.location.search).get('email')
    if (fromUrl?.trim()) setReminderEmail(fromUrl.trim().toLowerCase())
  }, [])

  /** Chỉ từ URL — lọc nội dung tiệc theo bên (nhà trai/gái). */
  const guestDisplayVenue = useMemo((): WeddingGuestInviteVenue => {
    if (typeof window === 'undefined') return ''
    const fromUrl = new URLSearchParams(window.location.search).get('venue')
    return fromUrl ? normalizeGuestInviteVenue(fromUrl) : ''
  }, [])

  /** Khối tên khách + địa chỉ trên bìa: URL venue hoặc cài đặt preview trong editor. */
  const guestBlockVenue = useMemo((): WeddingGuestInviteVenue => {
    if (typeof window === 'undefined') return normalizeGuestInviteVenue(card.guestInviteVenue)
    const fromUrl = new URLSearchParams(window.location.search).get('venue')
    return fromUrl ? normalizeGuestInviteVenue(fromUrl) : normalizeGuestInviteVenue(card.guestInviteVenue)
  }, [card.guestInviteVenue])

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
  const displayCoverPhotoUrl = guestInviteLocation.coverImageUrl || coverPhotoUrl
  const displayInvitationText = guestInviteLocation.invitationText || card.invitationText
  const displayInvitationTextEn = guestInviteLocation.invitationTextEn || card.invitationTextEn
  const displayTimeline = useMemo(
    () => parseWeddingEventTimeline(guestInviteLocation.eventTimeline || card.eventTimeline),
    [card.eventTimeline, guestInviteLocation.eventTimeline],
  )
  const displayDressCode = guestInviteLocation.dressCode || card.dressCode
  const displayThankYou = guestInviteLocation.thankYouText || card.thankYouText
  const displayVenue = guestInviteLocation.address || card.venue
  const displayMapUrl = guestInviteLocation.mapUrl || card.mapUrl
  const groomFamilyLine = card.groomParents || card.groomName
  const brideFamilyLine = card.brideParents || card.brideName
  const groomHometownLine = card.groomHometown
  const brideHometownLine = card.brideHometown
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

  const submit = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.append('guestName', guestName)
    formData.append('attending', String(attending))
    formData.append('guestCount', guestCount)
    formData.append('message', message)
    const result = await submitWeddingGuestResponse(card.slug, formData)
    setSubmitting(false)
    if ('error' in result) {
      toast({ title: tx.submitErrorTitle, description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: tx.submitSuccessTitle, description: tx.submitSuccessDesc })
    setGuestName('')
    setMessage('')
  }

  const submitReminder = async () => {
    setReminderSubmitting(true)
    const formData = new FormData()
    formData.append('guestEmail', reminderEmail)
    formData.append('guestName', guestName)
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
      return
    }
    toast({
      title: tx.reminderSuccessTitle,
      description: tx.reminderSuccessDesc.replace('{days}', String(result.daysBefore ?? reminderDaysBefore)),
    })
  }

  return (
    <>
      <Toaster />
      <main className={cn('min-h-screen', theme.pageBg, theme.text)}>
        {!opened && (
          <section
            className={cn(
              'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cover bg-center px-3 py-[calc(0.75rem+env(safe-area-inset-top))] sm:items-center sm:px-4 sm:py-4',
              unfolding && 'pointer-events-none',
            )}
            style={weddingBackgroundStyle(
              guestInviteLocation.coverImageUrl || sectionImages.cover,
              theme,
              WEDDING_BG_OVERLAY.cover,
              { readingVignette: true },
            )}
          >
            {/* Vỏ thiệp — nhẹ nhàng nâng lên và tan dần */}
            <div
              className="relative z-10 w-full max-w-[min(26rem,calc(100vw-1.5rem))] transition-all sm:max-w-[min(26rem,calc(100vw-2rem))]"
              style={{
                transitionDuration: `${COVER_FADE_MS}ms`,
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                opacity: unfolding ? 0 : 1,
                transform: unfolding ? 'translateY(-44px) scale(0.94)' : 'translateY(0) scale(1)',
                filter: unfolding ? 'blur(10px)' : 'blur(0)',
              }}
            >
            <WeddingCoverShellCard
              presetId={coverPresetId}
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
              openButtonLabel={tx.openInvitation}
              dateFallback={tx.dateFallback}
              photoAlt={tx.coverPhotoAlt}
              onOpen={() => {
                if (unfolding) return
                setUnfolding(true)
                window.setTimeout(() => {
                  setContentVisible(true)
                  window.setTimeout(() => {
                    setOpened(true)
                    if (card.effectsEnabled) {
                      void weddingMusicAudioRef.current?.playFromUserGesture()
                      startWeddingInvitationAutoScroll()
                    }
                  }, OVERLAY_REMOVE_DELAY_MS - CONTENT_REVEAL_DELAY_MS)
                }, CONTENT_REVEAL_DELAY_MS)
              }}
            />
            </div>
          </section>
        )}
        {/* Nội dung thiệp — hiện dần sau khi mở */}
        <div
          className="transition-all"
          style={{
            transitionDuration: `${CONTENT_REVEAL_MS}ms`,
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.985)',
          }}
        >
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
          style={weddingBackgroundStyle(sectionImages.cover, theme, WEDDING_BG_OVERLAY.hero, { readingVignette: true })}
        >
          <WeddingReadableGlass theme={theme} strength="hero" className="w-full max-w-3xl rounded-[1.75rem] p-5 text-center sm:rounded-[2.25rem] sm:p-6 md:p-10">
            <p className={cn('text-[11px] uppercase tracking-[0.28em] sm:text-xs sm:tracking-[0.4em]', theme.accentText, theme.textGlow)}>{tx.weddingInvitation}</p>
            <Heart className={cn('mx-auto mt-4 h-8 w-8 fill-current opacity-80 sm:mt-6 sm:h-10 sm:w-10', theme.accent, theme.textGlow)} />
            <h1 className={cn('mt-4 break-words font-serif text-4xl font-semibold italic leading-tight sm:mt-6 sm:text-5xl md:text-7xl', theme.text, theme.textGlowHeading)}>
              {card.groomName} & {card.brideName}
            </h1>
            {card.loveQuote && (
              <p className={cn('mx-auto mt-4 max-w-lg font-serif text-lg italic leading-7 sm:mt-5 sm:text-xl sm:leading-8', theme.accentText, theme.textGlow)}>
                “{personalize(card.loveQuote)}”
              </p>
            )}
            <p className={cn('mx-auto mt-5 max-w-xl whitespace-pre-line text-sm leading-7 sm:mt-6 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
              {personalize(displayInvitationText || tx.defaultInvitation)}
            </p>
            {displayInvitationTextEn && (
              <p className={cn('mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-7', theme.mutedText, theme.textGlow)}>
                {personalize(displayInvitationTextEn)}
              </p>
            )}
            {guestDisplayName && (
              <WeddingGuestInviteBlock
                className="mx-auto mt-6 max-w-md"
                guestName={guestDisplayName}
                inviteVenue={guestBlockVenue}
                cordiallyInvitesLabel={tx.cordiallyInvites}
                venueLabel={guestBlockVenueDisplay}
                weddingDateLabel={displayWeddingDateLabel || undefined}
                weddingTimeText={guestBlockLocation.displayTime || weddingDisplayTime}
                addressText={guestBlockLocation.address}
                mapUrl={guestBlockLocation.mapUrl}
                viewMapLabel={tx.guestInviteViewMap}
                panelClassName={theme.panelStrong}
                cordiallyClassName={cn(theme.mutedText, theme.textGlow)}
                nameClassName={cn(theme.text, theme.textGlowHeading)}
                venueClassName={cn(theme.accentText, theme.textGlow, 'tracking-wide')}
                addressClassName={cn(theme.mutedText, theme.textGlow)}
                weddingThemeId={theme.id}
              />
            )}
            {(displayWeddingDateIso ?? weddingDateIso) ? (
              <div className="mx-auto mt-6 max-w-lg">
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
              <div className={cn('mx-auto mt-5 max-w-md rounded-3xl p-4 text-left', theme.panelUi)}>

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
          </WeddingReadableGlass>
        </section>

        <section
          className={cn('bg-cover bg-center px-3 py-10 sm:px-4 sm:py-16', theme.softGradient)}
          style={weddingBackgroundStyle(sectionImages.invitation, theme, WEDDING_BG_OVERLAY.section)}
        >
          <div className={PUBLIC_COLUMN}>
            <WeddingReadableGlass theme={theme} strength="section" className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('text-[11px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]', theme.accentText, theme.textGlow)}>{tx.familiesIntro}</p>
              <div className="mt-6 flex flex-col gap-4">
                {(groomFamilyLine.trim() || groomHometownLine.trim()) && (
                  <div className={cn('rounded-3xl p-4', theme.panelStrong)}>
                    <p className={cn('text-sm', theme.mutedText, theme.textGlow)}>{tx.groomFamily}</p>
                    <p className={cn('mt-1 whitespace-pre-line break-words font-serif text-lg sm:text-xl', theme.text, theme.textGlow)}>{groomFamilyLine}</p>
                    {groomHometownLine.trim() ? (
                      <p className={cn('mt-2 whitespace-pre-line break-words text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)}>
                        {tx.hometownLabel}: {groomHometownLine.trim()}
                      </p>
                    ) : null}
                  </div>
                )}
                {(brideFamilyLine.trim() || brideHometownLine.trim()) && (
                  <div className={cn('rounded-3xl p-4', theme.panelStrong)}>
                    <p className={cn('text-sm', theme.mutedText, theme.textGlow)}>{tx.brideFamily}</p>
                    <p className={cn('mt-1 whitespace-pre-line break-words font-serif text-lg sm:text-xl', theme.text, theme.textGlow)}>{brideFamilyLine}</p>
                    {brideHometownLine.trim() ? (
                      <p className={cn('mt-2 whitespace-pre-line break-words text-sm leading-6 sm:text-base', theme.mutedText, theme.textGlow)}>
                        {tx.hometownLabel}: {brideHometownLine.trim()}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </WeddingReadableGlass>
            <WeddingReadableGlass theme={theme} strength="section" className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('text-[11px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]', theme.accentText, theme.textGlow)}>{tx.coupleIntroTitle}</p>
              <p className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
                {renderWeddingHighlightedText(
                  card.coupleIntro || card.storyText || tx.defaultCoupleIntro,
                  textTokens,
                  uiLocale,
                  nameHighlightClass,
                )}
              </p>
            </WeddingReadableGlass>
          </div>
        </section>

        <section
          id="event"
          className="bg-cover bg-center px-3 py-10 sm:px-4 sm:py-16"
          style={weddingBackgroundStyle(sectionImages.event, theme, WEDDING_BG_OVERLAY.section)}
        >
          <div className={PUBLIC_COLUMN}>
            <WeddingReadableGlass theme={theme} strength="section" className="rounded-[1.75rem] p-4 text-center sm:rounded-[2rem] sm:p-5">
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
            <WeddingReadableGlass theme={theme} strength="section" className="rounded-[1.75rem] p-5 text-center sm:rounded-[2rem] sm:p-6">
              <p className={cn('flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] sm:text-xs sm:tracking-[0.3em]', theme.accentText, theme.textGlow)}>
                <CalendarDays className="h-4 w-4" />
                {tx.timelineTitle}
              </p>
              {displayTimeline.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {displayTimeline.map((item, index) => {
                    const content = weddingTimelineItemContent(item)
                    return (
                      <div
                        key={`${item.time}-${item.title}-${index}`}
                        className={cn('rounded-3xl p-4 text-center sm:text-left', theme.panelStrong)}
                      >
                        <p className={cn('leading-relaxed', theme.text, theme.textGlow)}>
                          {item.time ? (
                            <span className={cn('font-serif font-semibold tabular-nums', theme.accentText, theme.textGlow)}>
                              {item.time}
                            </span>
                          ) : null}
                          {item.time && content ? (
                            <span className={cn('mx-2 font-normal', theme.mutedText, theme.textGlow)}>·</span>
                          ) : null}
                          {content ? (
                            <span className={cn(item.time ? 'font-medium' : 'font-semibold')}>{personalize(content)}</span>
                          ) : null}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className={cn('mt-5 leading-8', theme.mutedText, theme.textGlow)}>{personalize(tx.defaultTimeline)}</p>
              )}
              {displayDressCode && (
                <div className={cn('mt-6 rounded-3xl p-4', theme.panelStrong)}>
                  <p className={cn('text-xs uppercase tracking-[0.24em]', theme.accentText, theme.textGlow)}>{tx.dressCodeTitle}</p>
                  <p className={cn('mt-2 whitespace-pre-line', theme.text, theme.textGlow)}>{personalize(displayDressCode)}</p>
                </div>
              )}
            </WeddingReadableGlass>
          </div>
        </section>

        {shouldShowPublicGiftBoxForSide(card, guestInviteLocation.side) && (
          <div
            className="border-y border-amber-200/50 bg-cover bg-center"
            style={weddingBackgroundStyle(sectionImages.gift_qr, theme, WEDDING_BG_OVERLAY.dense)}
          >
            <WeddingGiftEnvelopeBlock card={card} tx={txGift} sideFilter={guestInviteLocation.side} />
          </div>
        )}

        <section
          id="story"
          className="bg-cover bg-center px-3 py-10 sm:px-4 sm:py-16"
          style={weddingBackgroundStyle(sectionImages.album, theme, WEDDING_BG_OVERLAY.section)}
        >
          <div className={PUBLIC_COLUMN}>
          {card.storyText && (
            <WeddingSectionCard theme={theme} title={tx.storyTitle}>
              <p className={cn('whitespace-pre-line text-center leading-8', theme.mutedText, theme.textGlow)}>
                {renderWeddingHighlightedText(card.storyText, textTokens, uiLocale, nameHighlightClass)}
              </p>
            </WeddingSectionCard>
          )}
          {card.albumImageUrls.length > 0 && (
            <WeddingSectionCard theme={theme} title={tx.albumTitle}>
              <button
                type="button"
                onClick={() => setActiveAlbumIndex(0)}
                className="group w-full text-left"
              >
                <WeddingAlbumPreviewGrid
                  urls={card.albumImageUrls}
                  alt={tx.albumAlt}
                  extraCount={Math.max(0, card.albumImageUrls.length - 2)}
                />
              </button>
              <p className={cn('mt-3 text-center text-sm', theme.mutedText, theme.textGlow)}>
                {tx.albumHint}
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
                  <Button className="min-h-11" variant={!attending ? 'default' : 'outline'} onClick={() => setAttending(false)}>{tx.attendNo}</Button>
                </div>
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.guestCountLabel}</Label>
                  <Input className="min-h-11" type="number" min="0" max="20" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className={cn(theme.text, theme.textGlow)}>{tx.wishLabel}</Label>
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

          <WeddingSectionCard theme={theme} title={wishes.length === 0 ? undefined : tx.wishesTitle}>
            {wishes.length === 0 && (
              <p className={cn('text-center text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
                {renderWeddingHighlightedText(
                  guestDisplayName ? tx.noWishesPersonal : tx.noWishes,
                  textTokens,
                  uiLocale,
                  nameHighlightClass,
                )}
              </p>
            )}
            <div className="space-y-3">
              {wishes.map((wish) => (
                <div key={wish.id} className={cn('rounded-2xl p-4', theme.panelStrong)}>
                  <p className={cn('font-semibold', theme.text, theme.textGlow)}>{wish.guestName}</p>
                  <p className={cn('mt-1 text-sm', theme.mutedText, theme.textGlow)}>{wish.message}</p>
                </div>
              ))}
            </div>
          </WeddingSectionCard>
          </div>
        </section>
        <section
          className="bg-cover bg-center px-3 py-12 text-center sm:px-4 sm:py-20"
          style={weddingBackgroundStyle(sectionImages.thanks, theme, WEDDING_BG_OVERLAY.hero, { readingVignette: true })}
        >
          <WeddingReadableGlass theme={theme} strength="hero" className="mx-auto max-w-2xl rounded-[1.75rem] p-5 sm:rounded-[2rem] sm:p-8">
            <Sparkles className={cn('mx-auto h-8 w-8', theme.accent, theme.textGlow)} />
            <h2 className={cn('mt-4 font-serif text-3xl font-semibold italic sm:text-4xl', theme.text, theme.textGlowHeading)}>{tx.thankYouTitle}</h2>
            <p className={cn('mt-5 whitespace-pre-line text-sm leading-7 sm:text-base sm:leading-8', theme.mutedText, theme.textGlow)}>
              {renderWeddingHighlightedText(
                displayThankYou || tx.defaultThankYou,
                textTokens,
                uiLocale,
                nameHighlightClass,
              )}
            </p>
            <p className={cn('mt-6 font-serif text-2xl sm:text-3xl', theme.accent, theme.textGlow)}>{theme.ornament}</p>
          </WeddingReadableGlass>
        </section>
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
