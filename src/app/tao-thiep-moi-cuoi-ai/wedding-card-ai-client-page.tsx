'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ExternalLink, Eye, Heart, Loader2, MapPin, Pencil, Plus, QrCode, Trash2, Upload, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  applyWeddingBackgroundFromLibrary,
  resetWeddingCardOrnaments,
  saveWeddingCardOrnaments,
  createNewWeddingCard,
  deleteWeddingCard,
  loadWeddingCardFacts,
  loadWeddingCardWorkspace,
  publishCurrentWeddingCard,
  saveWeddingCardBrief,
  composeWeddingSampleCopy,
} from './actions'
import { WeddingAiPolishTextarea } from './wedding-ai-polish-textarea'
import { DepositCreditPopup } from '@/components/deposit-credit-popup'
import { WeddingCreditTopUpProvider } from '@/components/wedding/wedding-credit-topup'
import { WeddingAiLibraryGrid } from '@/components/wedding/wedding-ai-library-grid'
import type { WeddingAiImage, WeddingBackgroundLibraryItem, WeddingCard, WeddingCardSummary, WeddingCoverFrameLibraryItem, WeddingMusicLibraryRow, WeddingRsvp } from '@/lib/db/wedding-cards-pg'
import { WeddingCouplePortraits } from '@/components/wedding/wedding-couple-portraits'
import { WeddingDraggableFab } from '@/components/wedding/wedding-draggable-fab'
import { WeddingMusicLibraryPicker } from '@/components/wedding/wedding-music-library-picker'
import {
  WeddingInvitationAudio,
  type WeddingInvitationAudioHandle,
} from '@/components/wedding/wedding-invitation-audio'
import { WeddingEventCalendarBlock } from '@/components/wedding/wedding-event-calendar-block'
import { WeddingGiftAccountsForm } from '@/components/wedding/wedding-gift-accounts-form'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { formatWeddingMusicSecondsForInput, parseWeddingMusicTimeToSeconds } from '@/lib/wedding/parse-music-play-time'
import {
  INVITATION_OCCASION_GROUPS,
  applyInvitationCoverSectionDescription,
  invitationCoverPhotoCopy,
  applyInvitationOccasionPublicCopy,
  invitationEditorCopy,
  invitationOccasionShape,
  invitationOccasionShapeChangeNote,
  normalizeInvitationOccasion,
  type InvitationOccasionKey,
} from '@/lib/wedding/invitation-occasion'
import { isInvitationGiftReady } from '@/lib/wedding/wedding-gift-vietqr'
import { WEDDING_CARD_TEXT_TOKEN_HINT } from '@/lib/wedding/wedding-card-text-interpolate'
import { omitWeddingAddressesFromSharedCopy, stripSharedWeddingCopy, weddingSharedCopyAddresses } from '@/lib/wedding/wedding-shared-copy'
import { WeddingTimelineList } from '@/components/wedding/wedding-timeline-list'
import { parseWeddingEventTimeline, weddingTimelineItemContent } from '@/lib/wedding/wedding-event-timeline'
import { resolveWeddingDateIso, formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { useVietQrBanks } from '@/hooks/use-vietqr-banks'
import { resolveWeddingButtonColor } from '@/lib/wedding/wedding-button-colors'
import { getWeddingTheme, weddingBackgroundStyle, WEDDING_BG_OVERLAY } from '@/lib/wedding/wedding-theme'
import { DEFAULT_WEDDING_COVER_PRESET_ID, getWeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'
import { WeddingOrnamentAdminBar, WeddingOrnamentAdminLayer } from '@/components/wedding/wedding-ornament-admin'
import { splitLibraryByRecommendation } from '@/lib/wedding/wedding-ai-library-match'
import { WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { WeddingSampleCardPicker } from '@/components/wedding/wedding-sample-card-picker'
import { WeddingSampleDemoFrame } from '@/components/wedding/wedding-sample-demo-bar'
import { WeddingLiveDevicePreviews } from '@/components/wedding/wedding-live-device-preview'
import { WeddingDesignScale } from '@/components/wedding/wedding-design-scale'
import { resolveWeddingCardOrnaments, weddingCardOrnamentLayoutKey, weddingOrnamentDeviceKey, weddingOrnamentLayoutKey } from '@/lib/wedding/wedding-background-ornament-store'
import { publishWeddingOrnamentTruth, subscribeWeddingOrnamentTruth } from '@/lib/wedding/wedding-ornament-sync'
import { weddingBackgroundPlateUrls } from '@/lib/wedding/wedding-background-plates'
import { findWeddingSampleCard, isWeddingSamplePhotoUrl, stripWeddingSamplePhotos, weddingLibrarySampleSectionPatch, WEDDING_SAMPLE_CARDS } from '@/lib/wedding/wedding-sample-cards'
import { WeddingSampleComposeModal } from '@/components/wedding/wedding-sample-compose-modal'
import {
  applyComposeCopyToCard,
  carryWeddingSampleFacts,
  resolveWeddingSampleNameReuse,
  weddingSampleShowsLoveStoryHints,
  type WeddingSampleComposeFields,
} from '@/lib/wedding/wedding-sample-compose'
import { isWeddingInsufficientCredit } from '@/lib/wedding/wedding-credit-shortfall'
import { weddingPreviewLookToken, type WeddingPreviewLook } from '@/lib/wedding/wedding-preview-look'
import { applyWeddingKitTheme, findWeddingBackgroundPreset, findWeddingFrameForBackground, resolveWeddingChromeKit, weddingAiBackgroundKit, weddingAiKitSectionPatch, weddingFramePatchForStyle, weddingHeroPhotoLayout, weddingKitSurface, weddingPairedFrameSectionPatch, weddingReadyBackgroundSectionPatch, weddingUsesPairedAiFrame, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { weddingStyleIdFromPrompt } from '@/lib/wedding/build-wedding-image-prompt'
import {
  appendWeddingSideInviteSettingsToFormData,
  EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
  ownSidePartyFields,
  weddingSideInviteSettingsFromCard,
  type WeddingSideInviteSettings,
} from '@/lib/wedding/wedding-side-invite-settings'
import { WeddingSideInviteSettingsPanel } from './khach-moi/wedding-side-invite-settings-panel'
import {
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  type WeddingSectionConfig,
  resolveCoverAiFrame,
  remapAlbumPhotoCrops,
  resolveAlbumPhotoFrame,
  resolveCoverFrameOpen,
  resolveCoverFrameScale,
  resolveOpenBurstEffect,
  resolveOpenFallEffect,
  resolveOpenFallSeconds,
  openFallSecondsStopIndex,
  resolveCoverPhotoObjectPosition,
  resolveCoverPhotoOpen,
  resolveCoverPhotoScale,
  coverPhotoUrlUnlessBackground,
  resolveCoverPhotoUrl,
  resolvePortraitPhotoFrame,
  resolvePortraitFrameScale,
  resolveStackFrameRotate,
  resolveStackPlace,
  clearWeddingFrameChoice,
  resolveShownCoverFrame,
  resolveShownPortraitShell,
  clampWeddingFrameScale,
  shiftAlbumPhotoCropsAfterRemove,
  upsertAlbumPhotoCrop,
  type WeddingOpenBurstEffect,
  type WeddingOpenFallEffect,
  type WeddingPortraitShellFrame,
  WEDDING_OPEN_BURST_EFFECTS,
  WEDDING_OPEN_FALL_EFFECTS,
  WEDDING_OPEN_FALL_SECOND_STOPS,
} from '@/lib/wedding/wedding-section-config'
import { WeddingOpenEffects } from '@/components/wedding/wedding-open-effects'
import { WeddingStackedCouplePhotos, type WeddingStackedFrameScaleEdit, type WeddingStackedNameEdit, type WeddingStackedPhotoEdit } from '@/components/wedding/wedding-stacked-couple-photos'
import { WeddingAlbumLayoutPicker } from '@/components/wedding/wedding-album-stage'
import { WeddingAlbumPhotoCropThumb } from '@/components/wedding/wedding-album-photo-crop-thumb'
import { FrameEdgeGrips, FrameScaleDragBar, WeddingCoverShellCard, WeddingFramedPhoto, type FrameScaleEdit } from '@/components/wedding/wedding-cover-shell-card'
import type { WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { WeddingCountdownBlock } from '@/components/wedding/wedding-countdown-block'
import { buildWeddingDemoPersonalInvite } from '@/lib/wedding/build-personal-wedding-invite'
import {
  getWeddingStylePreset,
  WEDDING_STYLE_PRESETS,
} from '@/lib/wedding/wedding-style-presets'
import { guestInviteVenueLabel, type WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { resolveGuestInviteLocation } from '@/lib/wedding/wedding-guest-invite-location'

const AUTO_SAVE_DEBOUNCE_MS = 800
const LOCAL_DRAFT_VERSION = 1

type WeddingLocalDraft = {
  version: typeof LOCAL_DRAFT_VERSION
  savedAt: number
  card: WeddingCard
  musicStartInput: string
  musicEndInput: string
  musicClearOnSave: boolean
}

function weddingLocalDraftKey(cardId: string) {
  return `nanoai:wedding-card-draft:${cardId}`
}

function previewTimelineItems(raw: string) {
  return parseWeddingEventTimeline(raw).filter((item) => item.time.trim() || weddingTimelineItemContent(item).trim())
}

function readWeddingLocalDraft(cardId: string): WeddingLocalDraft | null {
  if (typeof window === 'undefined' || !cardId) return null
  try {
    const raw = window.localStorage.getItem(weddingLocalDraftKey(cardId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WeddingLocalDraft>
    if (parsed.version !== LOCAL_DRAFT_VERSION || !parsed.card || parsed.card.id !== cardId) return null
    return parsed as WeddingLocalDraft
  } catch {
    return null
  }
}

function writeWeddingLocalDraft(draft: WeddingLocalDraft) {
  if (typeof window === 'undefined' || !draft.card.id) return
  try {
    window.localStorage.setItem(weddingLocalDraftKey(draft.card.id), JSON.stringify(draft))
  } catch {
    // Local draft is a safety net only; server autosave remains the source of truth.
  }
}

function clearWeddingLocalDraft(cardId: string) {
  if (typeof window === 'undefined' || !cardId) return
  try {
    window.localStorage.removeItem(weddingLocalDraftKey(cardId))
  } catch {
    // ignore
  }
}

function mergeServerCardWithLocalDraft(serverCard: WeddingCard, draftCard: WeddingCard): WeddingCard {
  return {
    ...serverCard,
    ...draftCard,
    id: serverCard.id,
    userId: serverCard.userId,
    slug: serverCard.slug,
    masterImageId: serverCard.masterImageId,
    masterImageUrl: serverCard.masterImageUrl,
    isPublished: serverCard.isPublished,
    publishedAt: serverCard.publishedAt,
  }
}

function mergeCardMediaAfterSave(prev: WeddingCard, server: WeddingCard): WeddingCard {
  const next: WeddingCard = { ...prev }
  let changed = false
  const assignIfChanged = <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => {
    if (value !== prev[key]) {
      next[key] = value
      changed = true
    }
  }
  assignIfChanged('groomImageUrl', server.groomImageUrl)
  assignIfChanged('brideImageUrl', server.brideImageUrl)
  if (server.musicUrl) assignIfChanged('musicUrl', server.musicUrl)
  if (server.giftQrImageUrl) assignIfChanged('giftQrImageUrl', server.giftQrImageUrl)
  assignIfChanged('albumImageUrls', server.albumImageUrls)
  if (server.sectionConfig) assignIfChanged('sectionConfig', server.sectionConfig)
  assignIfChanged('isPublished', server.isPublished)
  assignIfChanged('publishedAt', server.publishedAt)
  assignIfChanged('masterImageId', server.masterImageId)
  assignIfChanged('masterImageUrl', server.masterImageUrl)
  return changed ? next : prev
}

function buildSavedSnapshotForCard(card: WeddingCard) {
  const fmt = (n: number | null) => (n != null && Number.isFinite(n) ? String(n) : '')
  return buildPersistSnapshot({
    card,
    weddingDateIso: resolveWeddingDateIso(card.weddingDate),
    musicStartInput: fmt(card.musicPlayStartSec),
    musicEndInput: fmt(card.musicPlayEndSec),
    musicClearOnSave: false,
    coverImageFile: null,
    coverClearOnSave: false,
    groomPortraitFile: null,
    bridePortraitFile: null,
    groomPortraitClear: false,
    bridePortraitClear: false,
    musicFile: null,
    albumImageFiles: [],
  })
}

function buildPersistSnapshot(input: {
  card: WeddingCard
  weddingDateIso: string | null
  musicStartInput: string
  musicEndInput: string
  musicClearOnSave: boolean
  coverImageFile: File | null
  coverClearOnSave: boolean
  groomPortraitFile: File | null
  bridePortraitFile: File | null
  groomPortraitClear: boolean
  bridePortraitClear: boolean
  musicFile: File | null
  albumImageFiles: File[]
}): string {
  const { card, weddingDateIso, musicStartInput, musicEndInput, musicClearOnSave } = input
  const fk = (f: File | null) => (f ? `${f.name}:${f.size}:${f.lastModified}` : '')
  const albumKeys = input.albumImageFiles.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|')
  return JSON.stringify({
    occasionKey: normalizeInvitationOccasion(card.occasionKey),
    groomName: card.groomName,
    brideName: card.brideName,
    weddingDate: weddingDateIso ?? '',
    weddingTime: card.weddingTime,
    partyStartTime: card.partyStartTime,
    venue: card.venue,
    mapUrl: card.mapUrl,
    invitationText: card.invitationText,
    invitationTextEn: card.invitationTextEn,
    guestName: card.guestName,
    guestInviteVenue: card.guestInviteVenue,
    storyText: card.storyText,
    coupleIntro: card.coupleIntro,
    loveQuote: card.loveQuote,
    eventTimeline: card.eventTimeline,
    dressCode: card.dressCode,
    thankYouText: card.thankYouText,
    sectionConfig: card.sectionConfig,
    albumImageUrls: card.albumImageUrls,
    groomParents: card.groomParents,
    brideParents: card.brideParents,
    groomHometown: card.groomHometown,
    brideHometown: card.brideHometown,
    sideInvite: weddingSideInviteSettingsFromCard(card),
    groomImageUrl: card.groomImageUrl,
    brideImageUrl: card.brideImageUrl,
    selectedStyleId: card.selectedStyleId,
    colorPalette: card.colorPalette,
    rsvpEnabled: card.rsvpEnabled,
    giftQrEnabled: card.giftQrEnabled,
    giftQrImageUrl: card.giftQrImageUrl,
    groomGiftBankId: card.groomGiftBankId,
    groomGiftAccountNo: card.groomGiftAccountNo,
    groomGiftAccountName: card.groomGiftAccountName,
    brideGiftBankId: card.brideGiftBankId,
    brideGiftAccountNo: card.brideGiftAccountNo,
    brideGiftAccountName: card.brideGiftAccountName,
    effectsEnabled: card.effectsEnabled,
    musicUrl: card.musicUrl,
    musicClearOnSave,
    musicPlayStartSec: card.musicPlayStartSec,
    musicPlayEndSec: card.musicPlayEndSec,
    musicStartInput,
    musicEndInput,
    coverFk: fk(input.coverImageFile),
    coverClearOnSave: input.coverClearOnSave,
    groomPortraitFk: fk(input.groomPortraitFile),
    bridePortraitFk: fk(input.bridePortraitFile),
    groomPortraitClear: input.groomPortraitClear,
    bridePortraitClear: input.bridePortraitClear,
    musicFk: fk(input.musicFile),
    albumKeys,
  })
}

function weddingQuickViewHref(slug: string) {
  const params = new URLSearchParams({
    demo: '1',
    view: 'groom',
    venue: 'groom_home',
  })
  return `/thiep-moi-cuoi/${encodeURIComponent(slug)}?${params.toString()}`
}

function weddingCardListTitle(row: Pick<WeddingCardSummary, 'occasionKey' | 'groomName' | 'brideName'>) {
  const groom = row.groomName.trim()
  const bride = row.brideName.trim()
  if (invitationOccasionShape(row.occasionKey) === 'single') return groom || 'Thiệp mới'
  if (groom && bride) return `${groom} & ${bride}`
  return groom || bride || 'Thiệp mới'
}

function summaryFromCard(card: WeddingCard): WeddingCardSummary {
  return {
    id: card.id,
    slug: card.slug,
    occasionKey: normalizeInvitationOccasion(card.occasionKey),
    groomName: card.groomName,
    brideName: card.brideName,
    isPublished: card.isPublished,
    updatedAt: new Date().toISOString(),
  }
}

function rememberCardInUrl(cardId: string) {
  if (typeof window === 'undefined' || !cardId) return
  const url = new URL(window.location.href)
  if (url.searchParams.get('cardId') === cardId) return
  url.searchParams.set('cardId', cardId)
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

function emptyBrief(styleId = 'luxury'): WeddingCard {
  return {
    id: '',
    userId: '',
    slug: '',
    occasionKey: 'wedding',
    groomName: '',
    brideName: '',
    weddingDate: '',
    weddingTime: '',
    partyStartTime: '',
    venue: '',
    mapUrl: '',
    invitationText: '',
    invitationTextEn: '',
    guestName: '',
    guestInviteVenue: '',
    storyText: '',
    coupleIntro: '',
    loveQuote: '',
    eventTimeline: '',
    dressCode: '',
    thankYouText: '',
    sectionConfig: '{}',
    albumImageUrls: [],
    groomParents: '',
    brideParents: '',
    groomHometown: '',
    brideHometown: '',
    ...EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
    groomInviteWeddingDate: null,
    brideInviteWeddingDate: null,
    groomImageUrl: '',
    brideImageUrl: '',
    musicUrl: '',
    musicPlayStartSec: null,
    musicPlayEndSec: null,
    selectedStyleId: styleId,
    colorPalette: getWeddingStylePreset(styleId).palette,
    masterImageId: null,
    rsvpEnabled: true,
    giftQrEnabled: false,
    giftQrImageUrl: '',
    groomGiftBankId: '',
    groomGiftAccountNo: '',
    groomGiftAccountName: '',
    brideGiftBankId: '',
    brideGiftAccountNo: '',
    brideGiftAccountName: '',
    isPublished: false,
    publishedAt: null,
    masterImageUrl: null,
    effectsEnabled: true,
  }
}

function cardWithAiBackgroundKit(
  card: WeddingCard,
  images: WeddingAiImage[],
  library: WeddingBackgroundLibraryItem[],
  frames: WeddingCoverFrameLibraryItem[],
): WeddingCard {
  const section = parseWeddingSectionConfig(card.sectionConfig)
  if (section.backgroundPresetId) return card
  const master = images.find((image) => image.id === card.masterImageId) ?? images.find((image) => image.type === 'master')
  const cardStyle = WEDDING_STYLE_PRESETS.some((preset) => preset.id === card.selectedStyleId) ? card.selectedStyleId : ''
  const styleId = section.backgroundKitStyleId || weddingStyleIdFromPrompt(master?.prompt || '') || cardStyle
  const frame = findWeddingFrameForBackground(master?.imageUrl, library, frames)
  if (!styleId && !frame) return card
  const lookId = styleId ? resolveWeddingChromeKit({ backgroundKitStyleId: styleId })?.look.styleId || styleId : card.selectedStyleId
  return {
    ...card,
    selectedStyleId: lookId,
    colorPalette: getWeddingStylePreset(lookId).palette,
    sectionConfig: mergeWeddingSectionConfig(card.sectionConfig, {
      ...(styleId ? weddingAiKitSectionPatch(styleId) : {}),
      ...(frame ? weddingPairedFrameSectionPatch(frame) : {}),
    }),
  }
}

export default function WeddingCardAiClientPage() {
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<WebLocale>(DEFAULT_WEB_LOCALE)
  const [card, setCard] = useState<WeddingCard>(() => emptyBrief())
  const [savedCards, setSavedCards] = useState<WeddingCardSummary[]>([])
  const [switchingCard, setSwitchingCard] = useState(false)
  const [images, setImages] = useState<WeddingAiImage[]>([])
  const [library, setLibrary] = useState<WeddingBackgroundLibraryItem[]>([])
  const [ornamentLayouts, setOrnamentLayouts] = useState<Record<string, WeddingBackgroundOrnament[]>>({})
  const [ornamentDraft, setOrnamentDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [ornamentSaving, setOrnamentSaving] = useState(false)
  const [frameLibrary, setFrameLibrary] = useState<WeddingCoverFrameLibraryItem[]>([])
  const [sharedFrames, setSharedFrames] = useState<Record<string, WeddingSharedFrame>>({})
  const [ornamentAdmin, setOrnamentAdmin] = useState(false)
  const [backgroundPageOpen, setBackgroundPageOpen] = useState(false)
  const [backgroundNotice, setBackgroundNotice] = useState<{
    title: string
    description?: string
    error?: boolean
  } | null>(null)
  const [backgroundConfirmOpen, setBackgroundConfirmOpen] = useState(false)
  const [backgroundPreviewLarge, setBackgroundPreviewLarge] = useState(false)
  const [samplePreviewId, setSamplePreviewId] = useState<string | null>(null)
  const pendingSampleUseRef = useRef('')
  const sampleApplyLockRef = useRef(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSampleId, setComposeSampleId] = useState('')
  const [composeReturnPreview, setComposeReturnPreview] = useState(false)
  const [composeGroom, setComposeGroom] = useState('')
  const [composeBride, setComposeBride] = useState('')
  const [composeStory, setComposeStory] = useState('')
  const [composeNameError, setComposeNameError] = useState(false)
  const [composeBusy, setComposeBusy] = useState(false)
  const [musicLibrary, setMusicLibrary] = useState<WeddingMusicLibraryRow[]>([])
  const [applyingLibraryId, setApplyingLibraryId] = useState<string | null>(null)
  const [rsvps, setRsvps] = useState<WeddingRsvp[]>([])
  const [coverRsvpPreview, setCoverRsvpPreview] = useState<'yes' | 'no' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLetterView, setPreviewLetterView] = useState<'groom' | 'bride'>('groom')
  const [letterAskOpen, setLetterAskOpen] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)
  const previewBusyRef = useRef(false)
  const [occasionPickerOpen, setOccasionPickerOpen] = useState(false)
  const [pickedOccasion, setPickedOccasion] = useState<InvitationOccasionKey>('wedding')
  const [occasionShapePrompt, setOccasionShapePrompt] = useState<InvitationOccasionKey | null>(null)
  const [openEffectPreview, setOpenEffectPreview] = useState(0)
  const [creditTopUpOpen, setCreditTopUpOpen] = useState(false)
  const creditTopUpOpenRef = useRef(false)
  const [origin, setOrigin] = useState('')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicClearOnSave, setMusicClearOnSave] = useState(false)
  const [musicStartInput, setMusicStartInput] = useState('')
  const [musicEndInput, setMusicEndInput] = useState('')
  const [pickedMusicPreviewUrl, setPickedMusicPreviewUrl] = useState<string | null>(null)
  const [albumImageFiles, setAlbumImageFiles] = useState<File[]>([])
  const [albumPendingPreviews, setAlbumPendingPreviews] = useState<string[]>([])
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [coverClearOnSave, setCoverClearOnSave] = useState(false)
  const [groomPortraitFile, setGroomPortraitFile] = useState<File | null>(null)
  const [bridePortraitFile, setBridePortraitFile] = useState<File | null>(null)
  const [groomPortraitClear, setGroomPortraitClear] = useState(false)
  const [bridePortraitClear, setBridePortraitClear] = useState(false)
  const musicPreviewAudioRef = useRef<WeddingInvitationAudioHandle>(null)
  const vietBanks = useVietQrBanks()

  useEffect(() => {
    setUiLocale(readWebLocaleFromDocumentCookie())
  }, [])
  useEffect(() => {
    const urls = albumImageFiles.map((file) => URL.createObjectURL(file))
    setAlbumPendingPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [albumImageFiles])
  const tMu = useMemo(() => getDictionary(uiLocale).weddingCardAiMusic, [uiLocale])
  const txCal = useMemo(() => getDictionary(uiLocale).weddingCardCalendar, [uiLocale])
  const txGift = useMemo(() => getDictionary(uiLocale).weddingGiftBox, [uiLocale])
  const tBrief = useMemo(() => getDictionary(uiLocale).weddingCardAiBrief, [uiLocale])
  const tImage = useMemo(() => getDictionary(uiLocale).weddingCardAiImage, [uiLocale])
  const coverPhotoCopy = useMemo(
    () => invitationCoverPhotoCopy(card.occasionKey, uiLocale),
    [card.occasionKey, uiLocale],
  )
  const txCover = useMemo(() => {
    const base = getDictionary(uiLocale).weddingCardAiCover
    return {
      ...base,
      sectionDescription: applyInvitationCoverSectionDescription(base.sectionDescription, card.occasionKey, uiLocale),
      uploadLabel: coverPhotoCopy.uploadLabel,
    }
  }, [card.occasionKey, coverPhotoCopy.uploadLabel, uiLocale])
  const txPublic = useMemo(() => getDictionary(uiLocale).weddingCardPublic, [uiLocale])

  useEffect(() => {
    const fmt = (n: number | null) => (n != null && Number.isFinite(n) ? String(n) : '')
    setMusicStartInput(fmt(card.musicPlayStartSec))
    setMusicEndInput(fmt(card.musicPlayEndSec))
  }, [card.id, card.musicPlayStartSec, card.musicPlayEndSec])

  useEffect(() => {
    if (!musicFile) {
      setPickedMusicPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(musicFile)
    setPickedMusicPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [musicFile])

  const [pickedCoverPreviewUrl, setPickedCoverPreviewUrl] = useState<string | null>(null)
  const [pickedGroomPortraitUrl, setPickedGroomPortraitUrl] = useState<string | null>(null)
  const [pickedBridePortraitUrl, setPickedBridePortraitUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!coverImageFile) {
      setPickedCoverPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(coverImageFile)
    setPickedCoverPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverImageFile])
  useEffect(() => {
    if (!groomPortraitFile) {
      setPickedGroomPortraitUrl(null)
      return
    }
    const url = URL.createObjectURL(groomPortraitFile)
    setPickedGroomPortraitUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [groomPortraitFile])
  useEffect(() => {
    if (!bridePortraitFile) {
      setPickedBridePortraitUrl(null)
      return
    }
    const url = URL.createObjectURL(bridePortraitFile)
    setPickedBridePortraitUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [bridePortraitFile])

  useEffect(() => {
    setOrigin(window.location.origin)
    let mounted = true
    const search = new URLSearchParams(window.location.search)
    const requestedId = search.get('cardId')?.trim() || ''
    const useSample = search.get('useSample')?.trim() || ''
    const openSamples = search.get('openSamples') === '1'
    if (useSample || openSamples) {
      if (useSample) pendingSampleUseRef.current = useSample
      if (openSamples) setBackgroundPageOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('useSample')
      url.searchParams.delete('openSamples')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
    loadWeddingCardWorkspace(requestedId)
      .then((result) => {
        if (!mounted) return
        if ('error' in result) {
          toast({ title: 'Không mở được thiệp', description: result.error, variant: 'destructive' })
          return
        }
        lastSavedPersistRef.current = buildSavedSnapshotForCard(result.card)
        baselineHydratedRef.current = true
        const localDraft = readWeddingLocalDraft(result.card.id)
        const baseCard = localDraft
          ? mergeServerCardWithLocalDraft(result.card, localDraft.card)
          : result.card
        const openedBase = stripSharedWeddingCopy(ownSidePartyFields(cardWithAiBackgroundKit(baseCard, result.images, result.library, result.frameLibrary)))
        const opened = stripWeddingSamplePhotos(openedBase)
        if (isWeddingSamplePhotoUrl(openedBase.groomImageUrl)) setGroomPortraitClear(true)
        if (isWeddingSamplePhotoUrl(openedBase.brideImageUrl)) setBridePortraitClear(true)
        if (isWeddingSamplePhotoUrl(parseWeddingSectionConfig(openedBase.sectionConfig).coverPhotoUrl)) setCoverClearOnSave(true)
        if (localDraft) {
          setCard(opened)
          setMusicStartInput(localDraft.musicStartInput)
          setMusicEndInput(localDraft.musicEndInput)
          setMusicClearOnSave(localDraft.musicClearOnSave)
          setAutosaveBanner({ message: 'Đã khôi phục bản nháp chưa kịp lưu. Hệ thống sẽ tự lưu lại.', variant: 'success' })
        } else {
          setCard(opened)
        }
        setImages(result.images)
        setLibrary(result.library)
        setOrnamentLayouts(result.ornamentLayouts ?? {})
        setFrameLibrary(result.frameLibrary)
        setSharedFrames(result.sharedFrames ?? {})
        setOrnamentAdmin(Boolean(result.ornamentAdmin))
        setMusicLibrary(result.musicLibrary)
        setRsvps(result.rsvps)
        setSavedCards(result.cards)
        rememberCardInUrl(result.card.id)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        toast({
          title: 'Không mở được thiệp',
          description: error instanceof Error ? error.message : 'Không tải được danh sách thiệp.',
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- chỉ hydrate thiệp một lần khi mở trang

  const sharedCopyAddresses = useMemo(
    () => weddingSharedCopyAddresses(card),
    [card.venue, card.groomHometown, card.brideHometown, card.groomInviteAddress, card.brideInviteAddress],
  )
  const masterImage = images.find((image) => image.id === card.masterImageId) ?? images.find((image) => image.type === 'master')
  const sectionConfig = useMemo(() => parseWeddingSectionConfig(card.sectionConfig), [card.sectionConfig])
  const readyBackground = resolveWeddingChromeKit(sectionConfig)
  const ornamentKey = weddingOrnamentLayoutKey({
    backgroundPresetId: sectionConfig.backgroundPresetId,
    backgroundKitStyleId: sectionConfig.backgroundKitStyleId,
    masterImageUrl: masterImage?.imageUrl,
  })
  const cardMobileOrnamentKey = weddingOrnamentDeviceKey(weddingCardOrnamentLayoutKey(card.id), 'mobile')
  const sharedMobileOrnamentKey = weddingOrnamentDeviceKey(ornamentKey, 'mobile')
  const resolvedOrnaments = resolveWeddingCardOrnaments({
    defaults: readyBackground?.ornaments,
    layouts: ornamentLayouts,
    sharedBaseKey: ornamentKey,
    cardId: card.id,
    device: 'mobile',
    templateEditor: ornamentAdmin,
  })
  const backgroundOrnaments = ornamentDraft ?? resolvedOrnaments
  const ornamentDraftRef = useRef(ornamentDraft)
  const ornamentSyncRef = useRef({ source: '', sharedKey: '', cardKey: '' })
  if (!ornamentSyncRef.current.source) ornamentSyncRef.current.source = Math.random().toString(36).slice(2)
  ornamentSyncRef.current.sharedKey = sharedMobileOrnamentKey
  ornamentSyncRef.current.cardKey = cardMobileOrnamentKey
  ornamentDraftRef.current = ornamentDraft
  const ornamentKeyRef = useRef(ornamentKey)
  useEffect(() => {
    if (ornamentKeyRef.current === ornamentKey) return
    ornamentKeyRef.current = ornamentKey
    setOrnamentDraft(null)
  }, [ornamentKey])
  useEffect(() => {
    if (!card.id || !ornamentDraft) return
    publishWeddingOrnamentTruth({
      source: ornamentSyncRef.current.source,
      cardId: card.id,
      template: ornamentAdmin,
      ornaments: ornamentDraft,
    })
  }, [card.id, ornamentAdmin, ornamentDraft])
  useEffect(() => {
    if (!card.id) return
    return subscribeWeddingOrnamentTruth(card.id, ornamentSyncRef.current.source, (message) => {
      if (ornamentDraftRef.current) return
      setOrnamentLayouts((prev) => {
        const next = { ...prev }
        const key = message.template ? ornamentSyncRef.current.sharedKey : ornamentSyncRef.current.cardKey
        if (!key) return prev
        if (!message.ornaments) delete next[key]
        else next[key] = message.ornaments
        if (message.template && ornamentSyncRef.current.cardKey) delete next[ornamentSyncRef.current.cardKey]
        return next
      })
    })
  }, [card.id])
  const resetOrnaments = async () => {
    if (!card.id || ornamentSaving) return
    setOrnamentSaving(true)
    try {
      const result = await resetWeddingCardOrnaments(card.id, 'mobile')
      if ('error' in result) {
        toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
        return
      }
      const clearedKey = ornamentAdmin && sharedMobileOrnamentKey ? sharedMobileOrnamentKey : cardMobileOrnamentKey
      setOrnamentLayouts((prev) => {
        const next = { ...prev }
        delete next[clearedKey]
        if (ornamentAdmin && cardMobileOrnamentKey) delete next[cardMobileOrnamentKey]
        return next
      })
      setOrnamentDraft(null)
      if (card.id) {
        publishWeddingOrnamentTruth({
          source: ornamentSyncRef.current.source,
          cardId: card.id,
          template: ornamentAdmin,
          ornaments: null,
        })
      }
    } finally {
      setOrnamentSaving(false)
    }
  }
  useEffect(() => {
    if (!ornamentDraft || !card.id) return
    if (card.slug && !ornamentAdmin) return
    const snapshot = ornamentDraft
    const storeKey = ornamentAdmin && sharedMobileOrnamentKey ? sharedMobileOrnamentKey : cardMobileOrnamentKey
    const timer = window.setTimeout(() => {
      void (async () => {
        setOrnamentSaving(true)
        try {
          const result = await saveWeddingCardOrnaments(card.id, 'mobile', snapshot)
          if ('error' in result) {
            toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
            return
          }
          setOrnamentLayouts((prev) => {
            const next = { ...prev, [storeKey]: result.ornaments }
            if (result.template && cardMobileOrnamentKey && cardMobileOrnamentKey !== storeKey) delete next[cardMobileOrnamentKey]
            return next
          })
          setOrnamentDraft((current) => (current === snapshot ? null : current))
          publishWeddingOrnamentTruth({
            source: ornamentSyncRef.current.source,
            cardId: card.id,
            template: Boolean(result.template),
            ornaments: result.ornaments,
          })
        } finally {
          setOrnamentSaving(false)
        }
      })()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [card.id, card.slug, cardMobileOrnamentKey, ornamentAdmin, ornamentDraft, sharedMobileOrnamentKey, tImage.ornamentAdminFailed, toast])
  const kitSurface = weddingKitSurface(readyBackground)
  const selectedTheme = useMemo(
    () => applyWeddingKitTheme(getWeddingTheme(readyBackground?.look.styleId ?? card.selectedStyleId), readyBackground),
    [card.selectedStyleId, readyBackground],
  )
  const styleColors = weddingFramePatchForStyle(readyBackground?.look.styleId ?? card.selectedStyleId)
  const buttonColorId = readyBackground?.look.buttonColorId ?? styleColors.buttonColorId
  const buttonColor = resolveWeddingButtonColor(buttonColorId)
  const coverRsvpColor = resolveWeddingButtonColor(readyBackground?.look.coverRsvpColorId ?? styleColors.coverRsvpColorId)
  const pairedAiFrame = weddingUsesPairedAiFrame(sectionConfig) ? resolveCoverAiFrame(sectionConfig) : null
  const kitFrameId = pairedAiFrame ? undefined : readyBackground?.coverPresetId
  const activeSharedFrame = pairedAiFrame ? null : sharedFrames[ornamentKey] ?? null
  const shownCover = resolveShownCoverFrame(sectionConfig, kitFrameId, activeSharedFrame)
  const coverPresetId = pairedAiFrame ? sectionConfig.coverPresetId || DEFAULT_WEDDING_COVER_PRESET_ID : shownCover.presetId || DEFAULT_WEDDING_COVER_PRESET_ID
  const envelopeCover = getWeddingCoverPreset(coverPresetId).layout === 'envelope'
  const coverAiFrame = pairedAiFrame ?? shownCover.library ?? null
  const coverFrameMode = pairedAiFrame
    ? sectionConfig.coverFrameMode === 'ai'
      ? 'ai'
      : 'library'
    : shownCover.mode
  const frameLink = useMemo(() => {
    const imageUrl = (coverFrameMode === 'library' || coverFrameMode === 'ai' ? coverAiFrame?.src : '')?.trim() || ''
    if (!imageUrl) return null
    const row = frameLibrary.find((item) => item.imageUrl === imageUrl)
    return { imageUrl, referenceImageUrl: row?.referenceImageUrl ?? '' }
  }, [coverAiFrame?.src, coverFrameMode, frameLibrary])
  const backgroundGroups = useMemo(() => {
    const taken = new Set(WEDDING_SAMPLE_CARDS.flatMap((sample) => sample.libraryImageUrl ? [sample.libraryImageUrl] : []))
    return splitLibraryByRecommendation(library.filter((item) => !taken.has(item.imageUrl)), frameLink)
  }, [frameLink, library])
  const coverPhotoOpen = resolveCoverPhotoOpen(sectionConfig)
  const coverFrameOpen = resolveCoverFrameOpen(sectionConfig)
  const openBurstEffect = resolveOpenBurstEffect(sectionConfig)
  const openFallEffect = resolveOpenFallEffect(sectionConfig)
  const openFallSeconds = resolveOpenFallSeconds(sectionConfig)
  const coverPhotoPositionX = sectionConfig.coverPhotoPositionX ?? 50
  const coverPhotoPositionY = sectionConfig.coverPhotoPositionY ?? 50
  const coverPhotoObjectPosition = resolveCoverPhotoObjectPosition(sectionConfig)
  const coverPhotoScale = resolveCoverPhotoScale(sectionConfig)
  const coverBackgroundUrl = readyBackground?.plates[0] || masterImage?.imageUrl?.trim() || ''
  const presetPlateUrls = weddingBackgroundPlateUrls(masterImage?.imageUrl, images, sectionConfig.backgroundPresetId)
  const previewPlateUrls = presetPlateUrls.length > 0 ? presetPlateUrls : coverBackgroundUrl ? [coverBackgroundUrl] : []
  const previewLook: WeddingPreviewLook = {
    sectionConfig: card.sectionConfig || '{}',
    selectedStyleId: card.selectedStyleId || '',
    plateUrls: previewPlateUrls,
    ornaments: backgroundOrnaments,
    ornamentKey,
    sharedFrame: activeSharedFrame,
  }
  const previewLookToken = weddingPreviewLookToken(previewLook)
  const storedCoverPhotoUrl = resolveCoverPhotoUrl(sectionConfig)
  const storedCoverIsBackground =
    Boolean(storedCoverPhotoUrl) &&
    (!coverPhotoUrlUnlessBackground(storedCoverPhotoUrl, coverBackgroundUrl) ||
      library.some((item) => item.imageUrl === storedCoverPhotoUrl))
  const coverPhotoPreviewUrl =
    coverClearOnSave || (!pickedCoverPreviewUrl && storedCoverIsBackground)
      ? ''
      : pickedCoverPreviewUrl || storedCoverPhotoUrl
  const groomPortraitPreviewUrl = groomPortraitClear ? '' : pickedGroomPortraitUrl || card.groomImageUrl
  const bridePortraitPreviewUrl = bridePortraitClear ? '' : pickedBridePortraitUrl || card.brideImageUrl
  useEffect(() => {
    if (loading || coverImageFile || coverClearOnSave || !storedCoverIsBackground) return
    setCard((prev) => {
      const current = resolveCoverPhotoUrl(parseWeddingSectionConfig(prev.sectionConfig))
      if (!current || current !== storedCoverPhotoUrl) return prev
      return {
        ...prev,
        sectionConfig: mergeWeddingSectionConfig(prev.sectionConfig, { coverPhotoUrl: '' }),
      }
    })
  }, [loading, coverImageFile, coverClearOnSave, storedCoverIsBackground, storedCoverPhotoUrl])
  const publishUrl = card.isPublished && card.slug && origin ? `${origin}/thiep-moi-cuoi/${card.slug}` : ''
  const weddingDateIso = useMemo(
    () => resolveWeddingDateIso(card.weddingDate),
    [card.weddingDate],
  )
  const missing = useMemo(() => {
    const items = []
    const singleOccasion = invitationOccasionShape(card.occasionKey) === 'single'
    if (singleOccasion) {
      if (!card.groomName.trim()) items.push('tên')
    } else if (!card.groomName || !card.brideName) items.push('tên cô dâu/chú rể')
    const hasPartyDate = Boolean(weddingDateIso || card.groomInviteWeddingDate || card.brideInviteWeddingDate)
    const hasPartyPlace = Boolean(
      card.venue ||
        card.groomInviteAddress ||
        card.brideInviteAddress ||
        card.groomHometown ||
        card.brideHometown,
    )
    if (!hasPartyDate) items.push('ngày tiệc')
    if (!hasPartyPlace) items.push('địa chỉ tiệc')
    if (!readyBackground && !masterImage?.imageUrl) items.push('ảnh chính')
    if (!card.mapUrl && !card.groomInviteMapUrl && !card.brideInviteMapUrl) items.push('Google Maps')
    return items
  }, [card, masterImage, readyBackground, weddingDateIso])
  const occasionKey = normalizeInvitationOccasion(card.occasionKey)
  const occasionCopy = invitationEditorCopy(occasionKey)
  const singleOccasion = invitationOccasionShape(occasionKey) === 'single'
  const heroStack = !singleOccasion && weddingHeroPhotoLayout(readyBackground) === 'stack'

  const update = <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => setCard((prev) => ({ ...prev, [key]: value }))

  const requestOccasionChange = (next: InvitationOccasionKey) => {
    if (next === occasionKey) return
    if (invitationOccasionShape(next) !== invitationOccasionShape(occasionKey)) {
      setOccasionShapePrompt(next)
      return
    }
    update('occasionKey', next)
  }
  const applySideSettings = (next: WeddingSideInviteSettings) => {
    setCard((prev) => ({
      ...prev,
      ...next,
      groomInviteWeddingDate: next.groomInviteWeddingDate || null,
      brideInviteWeddingDate: next.brideInviteWeddingDate || null,
      weddingDate: next.groomInviteWeddingDate || next.brideInviteWeddingDate || prev.weddingDate,
    }))
  }

  const weddingDateDisplay = useMemo(
    () => (weddingDateIso ? formatWeddingDateForDisplay(weddingDateIso, uiLocale) : ''),
    [weddingDateIso, uiLocale],
  )
  const groomLetterPreview = useMemo(() => resolveGuestInviteLocation(card, 'groom_home'), [card])
  const brideLetterPreview = useMemo(() => resolveGuestInviteLocation(card, 'bride_home'), [card])
  const guestInviteLocationPreview = previewLetterView === 'bride' ? brideLetterPreview : groomLetterPreview
  const previewDateIso = useMemo(
    () => resolveWeddingDateIso(guestInviteLocationPreview.weddingDate) ?? weddingDateIso,
    [guestInviteLocationPreview.weddingDate, weddingDateIso],
  )
  const previewWeddingDateLabel = useMemo(
    () =>
      formatWeddingDateForDisplay(
        previewDateIso ?? guestInviteLocationPreview.weddingDate ?? card.weddingDate,
        uiLocale,
      ),
    [card.weddingDate, guestInviteLocationPreview.weddingDate, previewDateIso, uiLocale],
  )
  const previewDemoVenue: WeddingGuestInviteVenue =
    card.guestInviteVenue || (previewLetterView === 'bride' ? 'bride_home' : 'groom_home')
  const previewDemo = useMemo(
    () =>
      buildWeddingDemoPersonalInvite({
        side: previewDemoVenue === 'bride_home' ? 'bride' : 'groom',
        groomName: card.groomName,
        brideName: card.brideName,
        groomParents: card.groomParents,
        brideParents: card.brideParents,
        weddingDate: guestInviteLocationPreview.weddingDate,
        receptionTime: guestInviteLocationPreview.receptionTime,
        partyStartTime: guestInviteLocationPreview.partyStartTime,
        address: guestInviteLocationPreview.address,
        guestName: card.guestName,
        locale: uiLocale,
      }),
    [
      card.brideName,
      card.brideParents,
      card.groomName,
      card.groomParents,
      card.guestName,
      guestInviteLocationPreview.address,
      guestInviteLocationPreview.partyStartTime,
      guestInviteLocationPreview.receptionTime,
      guestInviteLocationPreview.weddingDate,
      previewDemoVenue,
      uiLocale,
    ],
  )
  const previewDemoVenueLabel = useMemo(
    () => guestInviteVenueLabel(previewDemoVenue, txPublic),
    [previewDemoVenue, txPublic],
  )
  const previewPublic = useMemo(
    () => applyInvitationOccasionPublicCopy(txPublic, occasionKey, uiLocale),
    [occasionKey, txPublic, uiLocale],
  )
  const previewFamilies = useMemo(() => {
    const groomParents = card.groomParents.trim()
    const brideParents = singleOccasion ? '' : card.brideParents.trim()
    const groomHometown = card.groomHometown.trim()
    const brideHometown = singleOccasion ? '' : card.brideHometown.trim()
    return {
      groomParents,
      brideParents,
      groomHometown,
      brideHometown,
      visible: Boolean(groomParents || brideParents || groomHometown || brideHometown),
    }
  }, [card.brideHometown, card.brideParents, card.groomHometown, card.groomParents, singleOccasion])
  const previewEvents = useMemo(() => {
    const groom = { id: 'groom' as const, label: previewPublic.groomFamily, loc: groomLetterPreview }
    if (singleOccasion) return [groom]
    const bride = { id: 'bride' as const, label: previewPublic.brideFamily, loc: brideLetterPreview }
    const signature = (loc: typeof groomLetterPreview) =>
      [loc.address, loc.weddingDate ?? '', loc.displayTime, loc.eventTimeline, loc.contact].join('\n')
    if (signature(groom.loc) === signature(bride.loc)) {
      return [previewLetterView === 'bride' ? bride : groom]
    }
    return [groom, bride]
  }, [brideLetterPreview, groomLetterPreview, previewLetterView, previewPublic.brideFamily, previewPublic.groomFamily, singleOccasion])
  const previewStory = card.storyText.trim()
  const previewIntro = card.coupleIntro.trim()
  const previewThanks = card.thankYouText.trim()
  const previewDress = card.dressCode.trim()
  const openLetterView = async (view: 'groom' | 'bride') => {
    setPreviewLetterView(view)
    setLetterAskOpen(false)
    const current = persistInputsRef.current
    if (!current.card.id || previewBusyRef.current) return
    previewBusyRef.current = true
    setPreviewBusy(true)
    try {
      const unchanged = buildPersistSnapshot(current) === lastSavedPersistRef.current
      if (!unchanged) {
        const saved = await commitSaveBrief(false, { hideSuccess: true })
        if (!saved) return
      }
      const cardId = persistInputsRef.current.card.id
      const result = await publishCurrentWeddingCard(cardId)
      if ('error' in result) {
        toast({ title: 'Chưa mở được xem thử', description: result.error, variant: 'destructive' })
        return
      }
      const url = new URL(`/thiep-moi-cuoi/${encodeURIComponent(result.card.slug)}`, window.location.origin)
      url.searchParams.set('view', view)
      url.searchParams.set('demo', '1')
      url.searchParams.set('venue', view === 'bride' ? 'bride_home' : 'groom_home')
      url.searchParams.set('guest', previewDemo.guestDisplayName)
      window.location.assign(`${url.pathname}${url.search}`)
    } finally {
      previewBusyRef.current = false
      setPreviewBusy(false)
    }
  }

  const selectAlbumLayout = (albumLayoutId: string) => {
    update('sectionConfig', mergeWeddingSectionConfig(card.sectionConfig, { albumLayoutId }))
  }

  const updateAlbumPhotoCrop = (index: number, patch: { positionX?: number; positionY?: number; scale?: number }) => {
    setCard((prev) => {
      const config = parseWeddingSectionConfig(prev.sectionConfig)
      const current = resolveAlbumPhotoFrame(config.albumPhotoCrops, index)
      return {
        ...prev,
        sectionConfig: mergeWeddingSectionConfig(prev.sectionConfig, {
          albumPhotoCrops: upsertAlbumPhotoCrop(config.albumPhotoCrops, index, {
            x: patch.positionX ?? current.x,
            y: patch.positionY ?? current.y,
            scale: patch.scale ?? current.scale,
          }),
        }),
      }
    })
  }

  const removeSavedAlbumPhoto = (index: number) => {
    setCard((prev) => {
      const config = parseWeddingSectionConfig(prev.sectionConfig)
      return {
        ...prev,
        albumImageUrls: prev.albumImageUrls.filter((_, photoIndex) => photoIndex !== index),
        sectionConfig: mergeWeddingSectionConfig(prev.sectionConfig, {
          albumPhotoCrops: shiftAlbumPhotoCropsAfterRemove(config.albumPhotoCrops, index),
        }),
      }
    })
  }

  const groomPortraitFrame = resolvePortraitPhotoFrame(sectionConfig, 'groom')
  const bridePortraitFrame = resolvePortraitPhotoFrame(sectionConfig, 'bride')
  const groomPortraitShell = resolveShownPortraitShell(sectionConfig, 'groom', kitFrameId, activeSharedFrame)
  const bridePortraitShell = resolveShownPortraitShell(sectionConfig, 'bride', kitFrameId, activeSharedFrame)
  const stackFrameShell = groomPortraitShell ?? bridePortraitShell

  const updatePortraitCrop = (
    side: 'groom' | 'bride',
    patch: { positionX?: number; positionY?: number; scale?: number },
  ) => {
    setCard((prev) => {
      const config = parseWeddingSectionConfig(prev.sectionConfig)
      const current = resolvePortraitPhotoFrame(config, side)
      const next = {
        x: patch.positionX ?? current.x,
        y: patch.positionY ?? current.y,
        scale: patch.scale ?? current.scale,
      }
      return {
        ...prev,
        sectionConfig: mergeWeddingSectionConfig(
          prev.sectionConfig,
          side === 'groom'
            ? { groomPhotoPositionX: next.x, groomPhotoPositionY: next.y, groomPhotoScale: next.scale }
            : { bridePhotoPositionX: next.x, bridePhotoPositionY: next.y, bridePhotoScale: next.scale },
        ),
      }
    })
  }

  const updateCoverPhotoCrop = (patch: {
    positionX?: number
    positionY?: number
    scale?: number
  }) => {
    setCard((prev) => {
      const current = parseWeddingSectionConfig(prev.sectionConfig)
      return {
        ...prev,
        sectionConfig: mergeWeddingSectionConfig(prev.sectionConfig, {
          coverPhotoPositionX: patch.positionX ?? current.coverPhotoPositionX ?? 50,
          coverPhotoPositionY: patch.positionY ?? current.coverPhotoPositionY ?? 50,
          coverPhotoScale: patch.scale ?? resolveCoverPhotoScale(current),
        }),
      }
    })
  }

  const previewMusicStartSec = useMemo(() => parseWeddingMusicTimeToSeconds(musicStartInput.trim()) ?? null, [musicStartInput])
  const previewMusicEndSec = useMemo(() => parseWeddingMusicTimeToSeconds(musicEndInput.trim()) ?? null, [musicEndInput])
  const musicPreviewSrc = pickedMusicPreviewUrl ?? (!musicClearOnSave && card.musicUrl ? card.musicUrl : '')

  const persistInputsRef = useRef({
    card,
    weddingDateIso,
    musicStartInput,
    musicEndInput,
    musicClearOnSave,
    coverImageFile,
    coverClearOnSave,
    groomPortraitFile,
    bridePortraitFile,
    groomPortraitClear,
    bridePortraitClear,
    musicFile,
    albumImageFiles,
  })
  useEffect(() => {
    let pulling = false
    const pullSideSettings = () => {
      if (document.visibilityState === 'hidden' || pulling) return
      const local = persistInputsRef.current
      if (!local.card.id || !baselineHydratedRef.current || persistInFlightRef.current) return
      if (autosaveTimerRef.current) return
      const localSide = JSON.stringify(weddingSideInviteSettingsFromCard(local.card))
      let savedSide = ''
      try {
        savedSide = JSON.stringify(JSON.parse(lastSavedPersistRef.current).sideInvite ?? null)
      } catch {
        return
      }
      if (localSide !== savedSide) return
      pulling = true
      void loadWeddingCardWorkspace(local.card.id).then((result) => {
        pulling = false
        if ('error' in result || persistInFlightRef.current) return
        const current = persistInputsRef.current
        const currentSide = JSON.stringify(weddingSideInviteSettingsFromCard(current.card))
        if (currentSide !== savedSide) return
        const serverSide = weddingSideInviteSettingsFromCard(result.card)
        if (JSON.stringify(serverSide) === currentSide) return
        const nextCard: WeddingCard = {
          ...current.card,
          ...serverSide,
          groomInviteWeddingDate: serverSide.groomInviteWeddingDate || null,
          brideInviteWeddingDate: serverSide.brideInviteWeddingDate || null,
        }
        lastSavedPersistRef.current = buildPersistSnapshot({ ...current, card: nextCard })
        setCard(nextCard)
      })
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) pullSideSettings()
    }
    document.addEventListener('visibilitychange', pullSideSettings)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', pullSideSettings)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  persistInputsRef.current = {
    card,
    weddingDateIso,
    musicStartInput,
    musicEndInput,
    musicClearOnSave,
    coverImageFile,
    coverClearOnSave,
    groomPortraitFile,
    bridePortraitFile,
    groomPortraitClear,
    bridePortraitClear,
    musicFile,
    albumImageFiles,
  }

  const persistFingerprint = useMemo(
    () =>
      buildPersistSnapshot({
        card,
        weddingDateIso,
        musicStartInput,
        musicEndInput,
        musicClearOnSave,
        coverImageFile,
        coverClearOnSave,
        groomPortraitFile,
        bridePortraitFile,
        groomPortraitClear,
        bridePortraitClear,
        musicFile,
        albumImageFiles,
      }),
    [
      card,
      weddingDateIso,
      musicStartInput,
      musicEndInput,
      musicClearOnSave,
      coverImageFile,
      coverClearOnSave,
      groomPortraitFile,
      bridePortraitFile,
      groomPortraitClear,
      bridePortraitClear,
      musicFile,
      albumImageFiles,
    ],
  )

  const lastSavedPersistRef = useRef('')
  const baselineHydratedRef = useRef(false)
  const autosaveTimerRef = useRef<number | null>(null)
  const persistInFlightRef = useRef(false)
  const persistQueuedRef = useRef(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autosaveBanner, setAutosaveBanner] = useState<
    null | { message: string; variant: 'success' | 'destructive' }
  >(null)
  useEffect(() => {
    if (!autosaveBanner) return
    const t = window.setTimeout(() => setAutosaveBanner(null), 2600)
    return () => window.clearTimeout(t)
  }, [autosaveBanner])

  useEffect(() => {
    if (loading || !card.id) return
    if (!baselineHydratedRef.current) {
      lastSavedPersistRef.current = persistFingerprint
      baselineHydratedRef.current = true
    }
  }, [loading, card.id, persistFingerprint])

  useEffect(() => {
    if (loading || !card.id || !baselineHydratedRef.current) return
    if (persistFingerprint === lastSavedPersistRef.current) {
      clearWeddingLocalDraft(card.id)
      return
    }
    writeWeddingLocalDraft({
      version: LOCAL_DRAFT_VERSION,
      savedAt: Date.now(),
      card,
      musicStartInput,
      musicEndInput,
      musicClearOnSave,
    })
  }, [card, loading, musicClearOnSave, musicEndInput, musicStartInput, persistFingerprint])

  const SAVE_BRIEF_TIMEOUT_MS = 5 * 60 * 1000

  const commitSaveBrief = async (silent: boolean, options?: { hideSuccess?: boolean }): Promise<boolean> => {
    const p = persistInputsRef.current
    if (!p.card.id) return false

    if (!silent) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }

    if (persistInFlightRef.current) {
      persistQueuedRef.current = true
      return false
    }
    persistInFlightRef.current = true
    if (silent) setAutoSaving(true)
    else setSaving(true)

    try {
      const c = p.card
      const submittedFingerprint = buildPersistSnapshot(p)
      const formData = new FormData()
      Object.entries({
        cardId: c.id,
        occasionKey: normalizeInvitationOccasion(c.occasionKey),
        groomName: c.groomName,
        brideName: c.brideName,
        weddingDate: p.weddingDateIso ?? '',
        weddingTime: c.weddingTime,
        partyStartTime: c.partyStartTime,
        venue: c.venue,
        mapUrl: c.mapUrl,
        invitationText: c.invitationText,
        invitationTextEn: c.invitationTextEn,
        guestName: c.guestName,
        guestInviteVenue: c.guestInviteVenue,
        storyText: c.storyText,
        coupleIntro: c.coupleIntro,
        loveQuote: c.loveQuote,
        eventTimeline: c.eventTimeline,
        dressCode: c.dressCode,
        thankYouText: c.thankYouText,
        sectionConfig: c.sectionConfig || '{}',
        albumImageUrls: c.albumImageUrls.join('\n'),
        groomParents: c.groomParents,
        brideParents: c.brideParents,
        groomHometown: c.groomHometown,
        brideHometown: c.brideHometown,
        groomImageUrl: c.groomImageUrl,
        brideImageUrl: c.brideImageUrl,
        selectedStyleId: c.selectedStyleId,
        colorPalette: c.colorPalette,
        rsvpEnabled: String(c.rsvpEnabled),
        giftQrEnabled: String(c.giftQrEnabled),
        giftQrImageUrl: c.giftQrImageUrl,
        groomGiftBankId: c.groomGiftBankId,
        groomGiftAccountNo: c.groomGiftAccountNo,
        groomGiftAccountName: c.groomGiftAccountName,
        brideGiftBankId: c.brideGiftBankId,
        brideGiftAccountNo: c.brideGiftAccountNo,
        brideGiftAccountName: c.brideGiftAccountName,
        effectsEnabled: String(c.effectsEnabled),
      }).forEach(([key, value]) => formData.append(key, value))
      appendWeddingSideInviteSettingsToFormData(formData, weddingSideInviteSettingsFromCard(c))
      formData.append('musicPlayStartSec', p.musicStartInput.trim())
      formData.append('musicPlayEndSec', p.musicEndInput.trim())
      if (p.coverImageFile) formData.append('coverImage', p.coverImageFile)
      if (p.coverClearOnSave) formData.append('coverClear', 'true')
      if (p.groomPortraitFile) formData.append('groomImage', p.groomPortraitFile)
      if (p.bridePortraitFile) formData.append('brideImage', p.bridePortraitFile)
      if (p.groomPortraitClear) formData.append('groomImageClear', 'true')
      if (p.bridePortraitClear) formData.append('brideImageClear', 'true')
      if (p.musicFile) {
        formData.append('musicFile', p.musicFile)
        formData.append('musicTitle', p.musicFile.name)
      } else if (!p.musicClearOnSave && c.musicUrl) {
        formData.append('musicLibraryUrl', c.musicUrl)
      }
      if (p.musicClearOnSave) formData.append('musicClear', 'true')
      p.albumImageFiles.forEach((file) => formData.append('albumImages', file))

      const result = await Promise.race([
        saveWeddingCardBrief(formData),
        new Promise<{ error: string }>((resolve) => {
          setTimeout(
            () =>
              resolve({
                error:
                  'Hết thời gian chờ (5 phút). Kiểm tra mạng, thử file nhạc/ảnh nhỏ hơn, hoặc lưu khi không đính kèm album.',
              }),
            SAVE_BRIEF_TIMEOUT_MS,
          )
        }),
      ])
      if ('error' in result) {
        if (!silent) {
          toast({ title: 'Lưu thất bại', description: result.error, variant: 'destructive' })
        } else {
          setAutosaveBanner({ message: tBrief.autoSaveFailedLabel, variant: 'destructive' })
        }
        return false
      }
      const latestFingerprint = buildPersistSnapshot(persistInputsRef.current)
      const hasNewerLocalChanges = latestFingerprint !== submittedFingerprint
      lastSavedPersistRef.current = hasNewerLocalChanges ? submittedFingerprint : buildSavedSnapshotForCard(result.card)
      if (hasNewerLocalChanges) {
        setMusicLibrary(result.musicLibrary)
        setCard((prev) =>
          prev.isPublished === result.card.isPublished && prev.publishedAt === result.card.publishedAt
            ? prev
            : { ...prev, isPublished: result.card.isPublished, publishedAt: result.card.publishedAt },
        )
        if (silent) {
          setAutosaveBanner({ message: tBrief.autoSavedLabel, variant: 'success' })
        } else if (!options?.hideSuccess) {
          toast({ title: 'Đã lưu nội dung thiệp' })
        }
        setSavedCards((prev) => [summaryFromCard(result.card), ...prev.filter((item) => item.id !== result.card.id)])
        window.setTimeout(() => {
          const latest = buildPersistSnapshot(persistInputsRef.current)
          if (latest !== lastSavedPersistRef.current) void commitSaveBrief(true)
        }, AUTO_SAVE_DEBOUNCE_MS)
        return true
      }
      clearWeddingLocalDraft(result.card.id)
      setCard((prev) => mergeCardMediaAfterSave(prev, result.card))
      setCoverImageFile(null)
      setCoverClearOnSave(false)
      setGroomPortraitFile(null)
      setBridePortraitFile(null)
      setGroomPortraitClear(false)
      setBridePortraitClear(false)
      setMusicFile(null)
      setMusicClearOnSave(false)
      setMusicLibrary(result.musicLibrary)
      setAlbumImageFiles([])
      setSavedCards((prev) => [summaryFromCard(result.card), ...prev.filter((item) => item.id !== result.card.id)])

      window.setTimeout(() => {
        lastSavedPersistRef.current = buildPersistSnapshot(persistInputsRef.current)
        clearWeddingLocalDraft(result.card.id)
      }, 0)

      if (silent) {
        setAutosaveBanner({ message: tBrief.autoSavedLabel, variant: 'success' })
      } else if (!options?.hideSuccess) {
        toast({ title: 'Đã lưu nội dung thiệp' })
      }
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!silent) {
        toast({
          title: 'Lưu thất bại',
          description: msg.trim() ? msg : 'Máy chủ không phản hồi hoặc lỗi mạng. Thử lại sau hoặc tải lại trang.',
          variant: 'destructive',
        })
      } else {
        setAutosaveBanner({ message: tBrief.autoSaveFailedLabel, variant: 'destructive' })
      }
      return false
    } finally {
      persistInFlightRef.current = false
      if (silent) setAutoSaving(false)
      else setSaving(false)
      if (persistQueuedRef.current) {
        persistQueuedRef.current = false
        window.setTimeout(() => {
          const latest = buildPersistSnapshot(persistInputsRef.current)
          if (latest !== lastSavedPersistRef.current) void commitSaveBrief(true)
        }, AUTO_SAVE_DEBOUNCE_MS)
      }
    }
  }

  useEffect(() => {
    if (loading || !card.id) return
    if (persistFingerprint === lastSavedPersistRef.current) return

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(async () => {
      autosaveTimerRef.current = null
      const p = persistInputsRef.current
      if (!p.card.id) return
      const latest = buildPersistSnapshot(p)
      if (latest === lastSavedPersistRef.current) return

      await commitSaveBrief(true)
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [loading, persistFingerprint, card.id]) // eslint-disable-line react-hooks/exhaustive-deps -- debounce theo fingerprint; commitSaveBrief đọc persistInputsRef

  useEffect(() => {
    if (loading || !card.id) return
    const flushPendingSave = () => {
      const p = persistInputsRef.current
      if (!p.card.id) return
      const latest = buildPersistSnapshot(p)
      if (latest === lastSavedPersistRef.current) return
      if (persistInFlightRef.current) {
        persistQueuedRef.current = true
        return
      }
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      void commitSaveBrief(true)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSave()
    }
    window.addEventListener('pagehide', flushPendingSave)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushPendingSave)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [card.id, loading, persistFingerprint]) // eslint-disable-line react-hooks/exhaustive-deps -- flush reads latest refs

  const frameScaleEditFor = (side: 'cover' | 'groom' | 'bride', scale: number): FrameScaleEdit => ({
    scale,
    label: txCover.frameSizeLabel,
    zoomOutLabel: txCover.coverPhotoZoomOut,
    zoomInLabel: txCover.coverPhotoZoomIn,
    onChange: (next) => {
      const value = clampWeddingFrameScale(next)
      const patch =
        side === 'cover'
          ? { coverFrameScale: value }
          : side === 'groom'
            ? { groomPortraitFrameScale: value }
            : { bridePortraitFrameScale: value }
      update('sectionConfig', mergeWeddingSectionConfig(card.sectionConfig, patch))
    },
  })

  const stackPhotoEdit = (side: 'groom' | 'bride'): WeddingStackedPhotoEdit => {
    const frame = side === 'groom' ? groomPortraitFrame : bridePortraitFrame
    return {
      chooseLabel: txCover.choosePhoto,
      changeLabel: txCover.changePhoto,
      onFile: (file) => {
        if (side === 'groom') {
          setGroomPortraitFile(file)
          setGroomPortraitClear(false)
        } else {
          setBridePortraitFile(file)
          setBridePortraitClear(false)
        }
      },
      crop: {
        x: frame.x,
        y: frame.y,
        scale: frame.scale,
        zoomOutLabel: txCover.coverPhotoZoomOut,
        zoomInLabel: txCover.coverPhotoZoomIn,
        onChange: (patch) => updatePortraitCrop(side, patch),
      },
    }
  }

  const stackPairFrameScale = (): WeddingStackedFrameScaleEdit => ({
    scale: resolvePortraitFrameScale(sectionConfig, 'groom'),
    label: txCover.frameSizeLabel,
    zoomOutLabel: txCover.coverPhotoZoomOut,
    zoomInLabel: txCover.coverPhotoZoomIn,
    onChange: (next) => {
      const value = clampWeddingFrameScale(next)
      update(
        'sectionConfig',
        mergeWeddingSectionConfig(card.sectionConfig, {
          groomPortraitFrameScale: value,
          bridePortraitFrameScale: value,
        }),
      )
    },
  })

  const pairPortraitFrameScale = resolvePortraitFrameScale(sectionConfig, 'groom')
  useEffect(() => {
    const bride = resolvePortraitFrameScale(sectionConfig, 'bride')
    if (pairPortraitFrameScale === bride) return
    update(
      'sectionConfig',
      mergeWeddingSectionConfig(card.sectionConfig, {
        groomPortraitFrameScale: pairPortraitFrameScale,
        bridePortraitFrameScale: pairPortraitFrameScale,
      }),
    )
  }, [pairPortraitFrameScale, sectionConfig.bridePortraitFrameScale]) // eslint-disable-line react-hooks/exhaustive-deps -- chỉ kéo hai cỡ khung về một giá trị

  const stackPlace = resolveStackPlace(sectionConfig)
  const setStackPlace = (place: ReturnType<typeof resolveStackPlace>) => {
    if (!place) return
    update('sectionConfig', mergeWeddingSectionConfig(card.sectionConfig, place))
  }
  const setStackRotate = (side: 'first' | 'second', degrees: number) => {
    update(
      'sectionConfig',
      mergeWeddingSectionConfig(
        card.sectionConfig,
        side === 'first' ? { stackGroomFrameRotate: degrees } : { stackBrideFrameRotate: degrees },
      ),
    )
  }
  const stackRotate = {
    firstRotate: resolveStackFrameRotate(sectionConfig, 'groom'),
    secondRotate: resolveStackFrameRotate(sectionConfig, 'bride'),
    onRotate: setStackRotate,
    rotateLabel: txCover.stackFrameRotate,
    rotateLeftLabel: txCover.stackFrameRotateLeft,
    rotateRightLabel: txCover.stackFrameRotateRight,
  }

  const stackNameEdit = (side: 'groom' | 'bride'): WeddingStackedNameEdit =>
    side === 'groom'
      ? {
          value: card.groomName,
          onChange: (value) => update('groomName', value),
          placeholder: occasionCopy.primaryName,
          label: occasionCopy.primaryName,
          caption: occasionCopy.primaryRole,
        }
      : {
          value: card.brideName,
          onChange: (value) => update('brideName', value),
          placeholder: occasionCopy.secondaryName,
          label: occasionCopy.secondaryName,
          caption: occasionCopy.secondaryRole,
        }

  const setOpenCelebration = (patch: { openBurstEffect?: WeddingOpenBurstEffect; openFallEffect?: WeddingOpenFallEffect; openFallSeconds?: number }) => {
    update('sectionConfig', mergeWeddingSectionConfig(card.sectionConfig, patch))
  }

  const burstEffectLabel: Record<WeddingOpenBurstEffect, string> = {
    bloom: tBrief.openBurstBloom,
    petals: tBrief.openBurstPetals,
    hearts: tBrief.openBurstHearts,
    stars: tBrief.openBurstStars,
    fireworks: tBrief.openBurstFireworks,
    gold: tBrief.openBurstGold,
    butterflies: tBrief.openBurstButterflies,
    none: tBrief.openEffectNone,
  }
  const fallEffectLabel: Record<WeddingOpenFallEffect, string> = {
    petals: tBrief.openFallPetals,
    hearts: tBrief.openFallHearts,
    stars: tBrief.openFallStars,
    fireworks: tBrief.openFallFireworks,
    gold: tBrief.openFallGold,
    snow: tBrief.openFallSnow,
    confetti: tBrief.openFallConfetti,
    lanterns: tBrief.openFallLanterns,
    none: tBrief.openEffectNone,
  }

  const revealCreditTopUp = async () => {
    creditTopUpOpenRef.current = true
    await commitSaveBrief(true)
    setCreditTopUpOpen(true)
    toast({ title: tImage.creditShortTitle, description: tImage.creditShortKeep, duration: 7000 })
  }

  const applyLibraryImage = async (
    libraryId: string,
    kitStyleId?: string,
    themeKey?: string,
    options?: { commitCard?: boolean },
  ): Promise<WeddingCard | null> => {
    const source = persistInputsRef.current.card
    if (!source.id || applyingLibraryId) return null
    setApplyingLibraryId(libraryId)
    const formData = new FormData()
    formData.append('cardId', source.id)
    formData.append('libraryId', libraryId)
    formData.append('type', 'master')
    setBackgroundNotice(null)
    const commitCard = options?.commitCard !== false
    try {
      const result = await applyWeddingBackgroundFromLibrary(formData)
      if ('error' in result && result.error) {
        setBackgroundNotice({ title: 'Không chọn được ảnh', description: result.error, error: true })
        return null
      }
      const fresh = await loadWeddingCardWorkspace(persistInputsRef.current.card.id)
      if ('error' in fresh) return null
      const next = cardWithAiBackgroundKit(fresh.card, fresh.images, fresh.library, fresh.frameLibrary)
      const produced = !kitStyleId
        ? { ...next, weddingDate: source.weddingDate }
        : stripWeddingSamplePhotos({
            ...next,
            weddingDate: source.weddingDate,
            selectedStyleId: kitStyleId,
            colorPalette: getWeddingStylePreset(kitStyleId).palette,
            sectionConfig: mergeWeddingSectionConfig(next.sectionConfig, weddingLibrarySampleSectionPatch(kitStyleId, themeKey)),
          })
      setImages(fresh.images)
      setLibrary(fresh.library)
      setOrnamentLayouts(fresh.ornamentLayouts ?? {})
      setFrameLibrary(fresh.frameLibrary)
      setSharedFrames(fresh.sharedFrames ?? {})
      setOrnamentAdmin(Boolean(fresh.ornamentAdmin))
      setMusicLibrary(fresh.musicLibrary)
      setRsvps(fresh.rsvps)
      setSavedCards(fresh.cards)
      if (commitCard) {
        setCard(produced)
        setBackgroundConfirmOpen(true)
        setSamplePreviewId(null)
        setBackgroundNotice(kitStyleId ? {
          title: tImage.sampleCardAppliedTitle,
          description: tImage.sampleCardAppliedHint,
        } : {
          title: 'Đã chọn ảnh chính từ kho',
          description: 'Không trừ credit.',
        })
      }
      return produced
    } catch {
      setBackgroundNotice({ title: 'Không chọn được ảnh', description: 'Thử lại.', error: true })
      return null
    } finally {
      setApplyingLibraryId(null)
    }
  }

  const stageSampleCard = (
    source: WeddingCard,
    next: WeddingCard,
    notice: { title: string; description: string },
    options?: { quiet?: boolean },
  ) => {
    const groomClear = isWeddingSamplePhotoUrl(source.groomImageUrl)
    const brideClear = isWeddingSamplePhotoUrl(source.brideImageUrl)
    const coverClear = isWeddingSamplePhotoUrl(parseWeddingSectionConfig(source.sectionConfig).coverPhotoUrl)
    setGroomPortraitFile(null)
    setBridePortraitFile(null)
    setGroomPortraitClear(groomClear)
    setBridePortraitClear(brideClear)
    setCoverImageFile(null)
    setCoverClearOnSave(coverClear)
    setAlbumImageFiles([])
    persistInputsRef.current = {
      ...persistInputsRef.current,
      card: next,
      groomPortraitFile: null,
      bridePortraitFile: null,
      groomPortraitClear: groomClear,
      bridePortraitClear: brideClear,
      coverImageFile: null,
      coverClearOnSave: coverClear,
      albumImageFiles: [],
    }
    setCard(next)
    setSamplePreviewId(null)
    if (!options?.quiet) {
      setBackgroundConfirmOpen(true)
      setBackgroundNotice(notice)
    }
  }

  const applySampleCard = async (
    sampleId: string,
    copy?: WeddingSampleComposeFields,
    options?: { quiet?: boolean },
  ): Promise<boolean> => {
    const sample = WEDDING_SAMPLE_CARDS.find((item) => item.id === sampleId)
    const preset = sample?.aiStyleId
      ? weddingAiBackgroundKit(sample.aiStyleId)
      : sample
        ? findWeddingBackgroundPreset(sample.backgroundPresetId)
        : undefined
    const source = persistInputsRef.current.card
    if (!source.id || !sample || !preset || applyingLibraryId) return false
    const notice = copy
      ? { title: tImage.sampleComposeSavedTitle, description: tImage.sampleComposeSavedHint }
      : { title: tImage.sampleCardAppliedTitle, description: tImage.sampleCardAppliedHint }
    const withCopy = (visual: WeddingCard) => (copy ? applyComposeCopyToCard(visual, copy, sample.dressCode) : visual)
    if (sample.libraryImageUrl) {
      const item = library.find((row) => row.imageUrl === sample.libraryImageUrl)
      if (!item) return false
      const loaded = await applyLibraryImage(item.id, sample.aiStyleId || 'floral', sample.id, { commitCard: false })
      if (!loaded) return false
      stageSampleCard(source, withCopy(loaded), notice, options)
      return true
    }
    const style = getWeddingStylePreset(sample.aiStyleId || preset.look.styleId)
    const cleared = clearWeddingFrameChoice(clearWeddingFrameChoice(source.sectionConfig, 'cover'), 'pair')
    const visual = stripWeddingSamplePhotos({
      ...source,
      selectedStyleId: sample.aiStyleId || preset.look.styleId,
      colorPalette: style.palette,
      sectionConfig: mergeWeddingSectionConfig(cleared, {
        ...(sample.aiStyleId ? weddingAiKitSectionPatch(sample.aiStyleId) : weddingReadyBackgroundSectionPatch(preset)),
      }),
    })
    stageSampleCard(source, withCopy(visual), notice, options)
    return true
  }

  const openSampleComposeRef = useRef<(sampleId: string, returnToPreview: boolean) => void>(() => {})
  openSampleComposeRef.current = (sampleId, returnToPreview) => {
    const sample = findWeddingSampleCard(sampleId)
    if (!sample || !persistInputsRef.current.card.id || composeBusy || sampleApplyLockRef.current) return
    const openNameModal = () => {
      const current = persistInputsRef.current.card
      setComposeSampleId(sampleId)
      setComposeReturnPreview(returnToPreview)
      setComposeGroom(current.groomName)
      setComposeBride(current.brideName)
      setComposeStory('')
      setComposeNameError(false)
      if (returnToPreview) setSamplePreviewId(null)
      setComposeOpen(true)
    }
    const reuse = resolveWeddingSampleNameReuse({
      current: persistInputsRef.current.card,
      saved: savedCards,
      wedding: weddingSampleShowsLoveStoryHints(sample),
    })
    if (reuse.ask) {
      openNameModal()
      return
    }
    sampleApplyLockRef.current = true
    void (async () => {
      try {
        let donor: WeddingCard | null = null
        if (reuse.donorId) {
          const loaded = await loadWeddingCardFacts(reuse.donorId)
          if ('error' in loaded) {
            openNameModal()
            return
          }
          donor = loaded.card
        }
        setSamplePreviewId(null)
        setBackgroundPageOpen(false)
        const applied = await applySampleCard(sampleId, undefined, { quiet: true })
        if (!applied) {
          setBackgroundPageOpen(true)
          return
        }
        if (donor) {
          const merged = carryWeddingSampleFacts(persistInputsRef.current.card, donor)
          const groomClear = !merged.groomImageUrl || isWeddingSamplePhotoUrl(merged.groomImageUrl)
          const brideClear = !merged.brideImageUrl || isWeddingSamplePhotoUrl(merged.brideImageUrl)
          const coverUrl = parseWeddingSectionConfig(merged.sectionConfig).coverPhotoUrl || ''
          const coverClear = !coverUrl || isWeddingSamplePhotoUrl(coverUrl)
          const musicStartInput = persistInputsRef.current.musicStartInput.trim()
            ? persistInputsRef.current.musicStartInput
            : merged.musicPlayStartSec != null
              ? formatWeddingMusicSecondsForInput(merged.musicPlayStartSec)
              : ''
          const musicEndInput = persistInputsRef.current.musicEndInput.trim()
            ? persistInputsRef.current.musicEndInput
            : merged.musicPlayEndSec != null
              ? formatWeddingMusicSecondsForInput(merged.musicPlayEndSec)
              : ''
          const musicClearOnSave = merged.musicUrl.trim() ? false : persistInputsRef.current.musicClearOnSave
          persistInputsRef.current = {
            ...persistInputsRef.current,
            card: merged,
            weddingDateIso: resolveWeddingDateIso(merged.weddingDate) ?? persistInputsRef.current.weddingDateIso,
            musicStartInput,
            musicEndInput,
            musicClearOnSave,
            groomPortraitClear: groomClear,
            bridePortraitClear: brideClear,
            coverClearOnSave: coverClear,
          }
          setCard(merged)
          setMusicStartInput(musicStartInput)
          setMusicEndInput(musicEndInput)
          setMusicClearOnSave(musicClearOnSave)
          setGroomPortraitClear(groomClear)
          setBridePortraitClear(brideClear)
          setCoverClearOnSave(coverClear)
        }
        setComposeOpen(false)
        setComposeReturnPreview(false)
        setBackgroundConfirmOpen(false)
        setSamplePreviewId(null)
        const saved = await commitSaveBrief(false, { hideSuccess: true })
        if (saved) {
          toast({ title: tImage.sampleCardAppliedTitle, description: tImage.sampleComposeKeptHint })
        }
      } finally {
        sampleApplyLockRef.current = false
      }
    })()
  }
  useEffect(() => {
    const id = pendingSampleUseRef.current
    if (!id || !card.id) return
    pendingSampleUseRef.current = ''
    openSampleComposeRef.current(id, false)
  }, [card.id])
  useEffect(() => {
    if (!samplePreviewId) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; id?: string } | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'wedding-sample-exit') {
        setSamplePreviewId(null)
        return
      }
      if (data.type === 'wedding-sample-use' && data.id) openSampleComposeRef.current(data.id, true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [samplePreviewId])

  const cancelSampleCompose = () => {
    if (composeBusy) return
    const sampleId = composeSampleId
    const back = composeReturnPreview
    setComposeOpen(false)
    if (back && sampleId) {
      setBackgroundPageOpen(true)
      setBackgroundConfirmOpen(false)
      setSamplePreviewId(sampleId)
    }
  }

  const confirmSampleCompose = async () => {
    const sample = findWeddingSampleCard(composeSampleId)
    if (!sample || composeBusy) return
    const wedding = weddingSampleShowsLoveStoryHints(sample)
    const groomName = composeGroom.trim()
    const brideName = composeBride.trim()
    if ((wedding && (!groomName || !brideName)) || !groomName) {
      setComposeNameError(true)
      return
    }
    setComposeNameError(false)
    setComposeBusy(true)
    const formData = new FormData()
    formData.append('occasionKey', wedding ? 'wedding' : normalizeInvitationOccasion(sample.occasionKey ?? card.occasionKey))
    formData.append('groomName', groomName)
    formData.append('brideName', brideName)
    formData.append('storyNotes', composeStory.trim())
    formData.append('weddingDate', persistInputsRef.current.weddingDateIso || persistInputsRef.current.card.weddingDate || '')
    const result = await composeWeddingSampleCopy(formData)
    if ('error' in result && result.error) {
      setComposeBusy(false)
      if (isWeddingInsufficientCredit(result)) {
        setCreditTopUpOpen(true)
        return
      }
      toast({ title: 'Chưa soạn được lời thiệp', description: result.error, variant: 'destructive' })
      return
    }
    if (!('coupleIntro' in result)) {
      setComposeBusy(false)
      return
    }
    const addresses = weddingSharedCopyAddresses(persistInputsRef.current.card)
    const copy: WeddingSampleComposeFields = {
      groomName,
      brideName,
      coupleIntro: omitWeddingAddressesFromSharedCopy(result.coupleIntro, addresses),
      loveQuote: omitWeddingAddressesFromSharedCopy(result.loveQuote, addresses),
      storyText: omitWeddingAddressesFromSharedCopy(result.storyText, addresses),
      thankYouText: omitWeddingAddressesFromSharedCopy(result.thankYouText, addresses),
    }
    const applied = await applySampleCard(sample.id, copy)
    if (!applied) {
      const current = persistInputsRef.current.card
      const next = applyComposeCopyToCard(current, copy, sample.dressCode)
      persistInputsRef.current = { ...persistInputsRef.current, card: next }
      setCard(next)
      setBackgroundNotice({
        title: tImage.sampleComposeSavedTitle,
        description: tImage.sampleComposeWordsOnly,
      })
    }
    setComposeReturnPreview(false)
    setComposeOpen(false)
    setComposeBusy(false)
    setBackgroundPageOpen(false)
    setBackgroundConfirmOpen(false)
    setSamplePreviewId(null)
    const saved = await commitSaveBrief(false, { hideSuccess: true })
    if (saved) {
      toast({
        title: tImage.sampleComposeSavedTitle,
        description: applied
          ? result.charged > 0
            ? tImage.sampleComposeSavedHint
            : tImage.sampleComposeSavedPlain
          : tImage.sampleComposeWordsOnly,
      })
    }
  }

  const publish = async () => {
    const saved = await commitSaveBrief(false, { hideSuccess: true })
    if (!saved) return
    const cardId = persistInputsRef.current.card.id
    if (!cardId) return
    const result = await publishCurrentWeddingCard(cardId)
    if ('error' in result) {
      toast({ title: 'Lưu thất bại', description: result.error, variant: 'destructive' })
    } else {
      setCard((prev) => ({
        ...result.card,
        weddingDate: prev.weddingDate,
      }))
      setSavedCards((prev) => [summaryFromCard(result.card), ...prev.filter((item) => item.id !== result.card.id)])
      toast({ title: 'Đã xuất bản link thiệp', description: 'Nội dung đã tự lưu. Không tốn credit.' })
    }
  }

  const showWorkspace = (
    result: {
      card: WeddingCard
      images: WeddingAiImage[]
      rsvps: WeddingRsvp[]
      library: WeddingBackgroundLibraryItem[]
      frameLibrary: WeddingCoverFrameLibraryItem[]
      musicLibrary: WeddingMusicLibraryRow[]
      cards: WeddingCardSummary[]
      ornamentLayouts?: Record<string, WeddingBackgroundOrnament[]>
      sharedFrames?: Record<string, WeddingSharedFrame>
      ornamentAdmin?: boolean
    },
    options?: { restoreLocalDraft?: boolean },
  ) => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    setMusicFile(null)
    setMusicClearOnSave(false)
    setAlbumImageFiles([])
    setCoverImageFile(null)
    setCoverClearOnSave(false)
    setGroomPortraitFile(null)
    setBridePortraitFile(null)
    setGroomPortraitClear(false)
    setBridePortraitClear(false)
    setExtraPrompt('')
    setStyleReferenceFile(null)
    setStyleReferenceUrl('')
    setPreviewLetterView('groom')
    setLetterAskOpen(false)
    const localDraft = options?.restoreLocalDraft ? readWeddingLocalDraft(result.card.id) : null
    const loadedCard = localDraft
      ? ownSidePartyFields(mergeServerCardWithLocalDraft(result.card, localDraft.card))
      : ownSidePartyFields(result.card)
    const nextBase = stripSharedWeddingCopy(loadedCard)
    const nextCard = stripWeddingSamplePhotos(nextBase)
    if (isWeddingSamplePhotoUrl(nextBase.groomImageUrl)) setGroomPortraitClear(true)
    if (isWeddingSamplePhotoUrl(nextBase.brideImageUrl)) setBridePortraitClear(true)
    if (isWeddingSamplePhotoUrl(parseWeddingSectionConfig(nextBase.sectionConfig).coverPhotoUrl)) setCoverClearOnSave(true)
    lastSavedPersistRef.current = buildSavedSnapshotForCard(loadedCard)
    baselineHydratedRef.current = true
    if (localDraft) {
      setMusicStartInput(localDraft.musicStartInput)
      setMusicEndInput(localDraft.musicEndInput)
      setMusicClearOnSave(localDraft.musicClearOnSave)
      setAutosaveBanner({ message: 'Đã khôi phục bản nháp chưa kịp lưu. Hệ thống sẽ tự lưu lại.', variant: 'success' })
    }
    setCard(nextCard)
    setImages(result.images)
    setLibrary(result.library)
    setOrnamentLayouts(result.ornamentLayouts ?? {})
    setFrameLibrary(result.frameLibrary)
    setSharedFrames(result.sharedFrames ?? {})
    setOrnamentAdmin(Boolean(result.ornamentAdmin))
    setMusicLibrary(result.musicLibrary)
    setRsvps(result.rsvps)
    setSavedCards(result.cards)
    rememberCardInUrl(result.card.id)
  }

  const openSavedCard = async (cardId: string) => {
    if (!cardId || cardId === persistInputsRef.current.card.id || switchingCard) return
    setSwitchingCard(true)
    try {
      const current = persistInputsRef.current
      const unchanged = Boolean(current.card.id) && buildPersistSnapshot(current) === lastSavedPersistRef.current
      if (!unchanged) {
        const saved = await commitSaveBrief(false, { hideSuccess: true })
        if (!saved) return
      }
      const result = await loadWeddingCardWorkspace(cardId)
      if ('error' in result) {
        toast({ title: 'Không mở được thiệp', description: result.error, variant: 'destructive' })
        return
      }
      showWorkspace(result, { restoreLocalDraft: true })
      document.getElementById('wedding-card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } finally {
      setSwitchingCard(false)
    }
  }

  const createFreshCard = async (nextOccasion: InvitationOccasionKey) => {
    if (switchingCard) return
    setSwitchingCard(true)
    try {
      const current = persistInputsRef.current
      const unchanged = Boolean(current.card.id) && buildPersistSnapshot(current) === lastSavedPersistRef.current
      if (current.card.id && !unchanged) {
        const saved = await commitSaveBrief(false, { hideSuccess: true })
        if (!saved) return
      }
      const result = await createNewWeddingCard(nextOccasion, 'single')
      if ('error' in result) {
        toast({ title: 'Không tạo được thiệp mới', description: result.error, variant: 'destructive' })
        return
      }
      showWorkspace(result)
      setOccasionPickerOpen(false)
      toast({
        title: 'Đã tạo thiệp và xuất link',
        description: 'Link công khai có ngay. Thiệp vừa rồi vẫn nằm trong danh sách.',
      })
      document.getElementById('wedding-card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } finally {
      setSwitchingCard(false)
    }
  }

  const removeSavedCard = async (cardId: string) => {
    const row = savedCards.find((item) => item.id === cardId)
    const title = row ? weddingCardListTitle(row) : 'thiệp này'
    if (!window.confirm(`Xóa «${title}»? Link đã xuất bản và khách mời của thiệp này cũng mất.`)) return
    setSwitchingCard(true)
    try {
      const result = await deleteWeddingCard(cardId)
      if ('error' in result) {
        toast({ title: 'Không xóa được thiệp', description: result.error, variant: 'destructive' })
        return
      }
      clearWeddingLocalDraft(cardId)
      if (cardId !== persistInputsRef.current.card.id) {
        setSavedCards(result.cards)
        toast({ title: 'Đã xóa thiệp' })
        return
      }
      const next = result.cards[0]
      if (!next) {
        const created = await createNewWeddingCard()
        if ('error' in created) {
          toast({ title: 'Đã xóa thiệp', description: created.error, variant: 'destructive' })
          return
        }
        showWorkspace(created)
      } else {
        const loaded = await loadWeddingCardWorkspace(next.id)
        if ('error' in loaded) {
          setSavedCards(result.cards)
          toast({ title: 'Đã xóa thiệp', description: loaded.error, variant: 'destructive' })
          return
        }
        showWorkspace(loaded)
      }
      toast({ title: 'Đã xóa thiệp' })
    } finally {
      setSwitchingCard(false)
    }
  }

  const closeBackgroundPicker = () => {
    setBackgroundPageOpen(false)
    setBackgroundConfirmOpen(false)
    setBackgroundNotice(null)
    setBackgroundPreviewLarge(false)
    setSamplePreviewId(null)
  }

  const openBackgroundPicker = () => {
    setBackgroundConfirmOpen(false)
    setBackgroundNotice(null)
    setBackgroundPreviewLarge(false)
    setSamplePreviewId(null)
    setBackgroundPageOpen(true)
  }

  const backgroundPicked = backgroundConfirmOpen && !backgroundNotice?.error
  const samplePreviewOpen = Boolean(samplePreviewId)
  const pickerWide = backgroundPreviewLarge || samplePreviewOpen

  const backgroundNoticeBlock = backgroundNotice ? (
    <div
      role="status"
      className={cn(
        'rounded-xl px-3 py-2 text-sm',
        backgroundNotice.error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900',
      )}
    >
      <p className="font-medium">{backgroundNotice.title}</p>
      {backgroundNotice.description ? (
        <p className="mt-0.5 text-xs leading-relaxed">{backgroundNotice.description}</p>
      ) : null}
    </div>
  ) : null

  const previewFab = (
    <WeddingDraggableFab
      label={txPublic.previewTryFab}
      storageKey="wedding-editor-preview-fab-v4"
      defaultCorner="bottom-left"
      desktopWorkColumn
      disabled={loading || previewBusy || !card.id}
      zIndex={2147483001}
      icon={previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
      onClick={() => {
        if (singleOccasion) void openLetterView('groom')
        else setLetterAskOpen(true)
      }}
    />
  )

  if (loading) {
    return (
      <>
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
        {previewFab}
      </>
    )
  }

  return (
    <WeddingCreditTopUpProvider onShort={() => { void revealCreditTopUp() }}>
    <>
      <DepositCreditPopup
        open={creditTopUpOpen}
        overlayClassName="z-[280]"
        contentClassName="z-[280]"
        onOpenChange={(open) => {
          creditTopUpOpenRef.current = open
          setCreditTopUpOpen(open)
        }}
        onCreditsUpdated={() => {
          toast({ title: tImage.creditReadyAgain, duration: 6000 })
        }}
      />
      <Toaster />
      <div className="mx-auto max-w-6xl space-y-6 px-2 pb-10">
        <div className="rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm ring-1 ring-rose-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-rose-600">AI Wedding Invitation</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Tạo thiệp cưới AI – thiệp mời cưới online</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Xem trước nội dung. Chữ tiếng Việt do hệ thống render riêng.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                onClick={() => {
                  setPickedOccasion('wedding')
                  setOccasionPickerOpen(true)
                }}
                disabled={switchingCard || saving}
              >
                {switchingCard ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Tạo thiệp mới
              </Button>
              <div className="rounded-2xl bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
                <b>Credit:</b> Xem thiệp mẫu không trừ credit. Dùng mẫu rồi OK: AI soạn lời mở đầu, quote, câu chuyện và lời cảm ơn miễn phí. Mỗi lần Tối ưu AI từng đoạn sau đó = 0,1 credit. Sửa tay, preview, QR, RSVP, tải ảnh, xuất bản = 0 credit.
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle>Thiệp đã lưu</CardTitle>
            <CardDescription>Mỗi thiệp giữ riêng. Khách mời, Thống kê và Xem nhanh mở đúng thiệp đó. Sửa để chỉnh nội dung, Xóa khi không dùng.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có thiệp nào.</p>
            ) : (
              savedCards.map((item) => {
                const active = item.id === card.id
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex flex-col gap-2 rounded-2xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
                      active ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="min-w-0 sm:max-w-[16rem]">
                      <p className="truncate text-sm font-medium text-slate-950">{weddingCardListTitle(item)}</p>
                      <p className="text-xs text-slate-500">
                        {invitationEditorCopy(item.occasionKey).label}
                        {' · '}
                        {item.isPublished ? 'Đã xuất bản' : 'Nháp'}
                        {active ? ' · Đang sửa' : ''}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center gap-1.5 sm:justify-end">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(item.id)}`}>
                          <Users className="mr-1 h-3.5 w-3.5" />
                          Khách mời
                        </Link>
                      </Button>
                      {item.isPublished && item.slug ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={weddingQuickViewHref(item.slug)} target="_blank" rel="noreferrer">
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Xem nhanh
                          </a>
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" disabled title="Xuất bản thiệp để xem link">
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Xem nhanh
                        </Button>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={switchingCard}
                        onClick={() => {
                          if (active) {
                            document.getElementById('wedding-card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            return
                          }
                          void openSavedCard(item.id)
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-rose-700"
                        disabled={switchingCard}
                        onClick={() => void removeSavedCard(item.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Xóa
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Dialog
          open={backgroundPageOpen}
          onOpenChange={(open) => {
            if (!open) closeBackgroundPicker()
          }}
        >
          <DialogContent
            overlayClassName="z-[200]"
            showCloseButton={!backgroundPicked}
            className={cn(
              'z-[200] flex flex-col overflow-hidden',
              pickerWide
                ? 'h-[96dvh] max-h-[96dvh] w-[min(96vw,44rem)] max-w-[96vw] sm:max-w-[44rem]'
                : 'max-h-[85vh] sm:max-w-lg',
            )}
          >
            <DialogHeader className={samplePreviewOpen ? 'sr-only' : backgroundPicked ? 'shrink-0' : 'shrink-0 pr-10'}>
              <DialogTitle>
                {backgroundPicked
                  ? tImage.sampleCardAppliedTitle
                  : backgroundPreviewLarge
                    ? tImage.backgroundPreviewTitle
                    : tImage.sampleCardsTitle}
              </DialogTitle>
              <DialogDescription className={backgroundPicked || pickerWide ? 'sr-only' : undefined}>
                {backgroundPicked
                  ? backgroundNotice?.description || tImage.sampleCardAppliedHint
                  : tImage.sampleCardsHint}
              </DialogDescription>
            </DialogHeader>
            {backgroundPicked ? (
              <div className="space-y-4">
                {coverBackgroundUrl ? (
                  <img src={coverBackgroundUrl} alt="" className="max-h-48 w-full rounded-2xl object-cover object-top" />
                ) : null}
                {backgroundNoticeBlock}
                <Button type="button" className="w-full" onClick={closeBackgroundPicker}>
                  {tImage.backgroundPickedOk}
                </Button>
              </div>
            ) : samplePreviewOpen && samplePreviewId ? (
              <WeddingSampleDemoFrame sampleId={samplePreviewId} title={tImage.sampleCardsTitle} />
            ) : (
            <div className={cn('min-h-0 flex-1', pickerWide ? 'flex flex-col overflow-hidden' : 'space-y-4 overflow-y-auto')}>
            {backgroundNotice?.error ? backgroundNoticeBlock : null}
            {backgroundPreviewLarge ? null : (
              <WeddingSampleCardPicker
                locale={uiLocale}
                samples={WEDDING_SAMPLE_CARDS}
                selectedId={sectionConfig.backgroundPresetId}
                heading={tImage.sampleCardsTitle}
                aiHeading={tImage.sampleAiCardsTitle}
                libraryHeading={tImage.libraryAllHeading}
                hint={tImage.sampleCardsHint}
                photoNote={tImage.sampleCardPhotos}
                ornamentLayouts={ornamentLayouts}
                disabled={Boolean(applyingLibraryId) || !card.id}
                onPreview={(sample) => {
                  const params = new URLSearchParams()
                  if (card.id) params.set('cardId', card.id)
                  window.location.assign(`/thiep-mau/${encodeURIComponent(sample.id)}?${params}`)
                }}
              />
            )}
            {samplePreviewOpen || (!backgroundGroups.recommended.length && !backgroundGroups.rest.length) ? null : (
            <WeddingAiLibraryGrid
              recommended={backgroundGroups.recommended}
              rest={backgroundGroups.rest}
              selectedUrl={sectionConfig.backgroundPresetId ? undefined : masterImage?.imageUrl}
              onSelect={(item) => void applyLibraryImage(item.id)}
              recommendedLabel={tImage.libraryRecommendedHeading}
              libraryLabel={tImage.libraryAllHeading}
              emptyLabel={tImage.backgroundLibraryEmpty}
              disabled={Boolean(applyingLibraryId)}
              busyId={applyingLibraryId}
              preview={{
                openLabel: tImage.backgroundPreviewOpen,
                title: tImage.backgroundPreviewTitle,
                selectLabel: tImage.backgroundPreviewSelect,
                backLabel: tImage.back,
              }}
              onPreviewChange={setBackgroundPreviewLarge}
            />
            )}
            </div>
            )}
          </DialogContent>
        </Dialog>
        <WeddingSampleComposeModal
          locale={uiLocale}
          open={composeOpen}
          wedding={weddingSampleShowsLoveStoryHints(findWeddingSampleCard(composeSampleId) ?? {})}
          busy={composeBusy}
          groomLabel={
            weddingSampleShowsLoveStoryHints(findWeddingSampleCard(composeSampleId) ?? {})
              ? tImage.sampleComposeGroom
              : occasionCopy.primaryName
          }
          brideLabel={
            weddingSampleShowsLoveStoryHints(findWeddingSampleCard(composeSampleId) ?? {})
              ? tImage.sampleComposeBride
              : occasionCopy.secondaryName
          }
          groomName={composeGroom}
          brideName={composeBride}
          storyNotes={composeStory}
          nameError={composeNameError}
          onGroomName={(value) => {
            setComposeGroom(value)
            if (value.trim()) setComposeNameError(false)
          }}
          onBrideName={(value) => {
            setComposeBride(value)
            if (value.trim()) setComposeNameError(false)
          }}
          onStoryNotes={setComposeStory}
          onCancel={cancelSampleCompose}
          onConfirm={() => void confirmSampleCompose()}
        />
        <div id="wedding-card-editor" className="grid w-full min-w-0 max-w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="w-full min-w-0 max-w-full space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{tImage.backgroundSectionTitle}</CardTitle>
                <CardDescription>{tImage.backgroundSectionHint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {coverBackgroundUrl ? (
                  <div className="relative overflow-hidden rounded-xl">
                    <img src={coverBackgroundUrl} alt="" className="max-h-40 w-full object-cover object-top" />
                    {readyBackground && readyBackground.ornaments.length > 0 ? (
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                        {tImage.readyBackgroundLayered}
                      </span>
                    ) : readyBackground && readyBackground.plates.length > 1 ? (
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                        {tImage.readyBackgroundSet.replaceAll('{n}', String(readyBackground.plates.length))}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-24 items-center justify-center rounded-xl bg-muted px-4 text-center text-sm text-muted-foreground">
                    {tImage.backgroundEmptyPreview}
                  </div>
                )}
                <Button type="button" className="w-full sm:w-auto" onClick={openBackgroundPicker}>
                  {coverBackgroundUrl ? tImage.chooseBackgroundAgain : tImage.chooseBackground}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{txCover.sectionTitle}</CardTitle>
                <CardDescription>{txCover.sectionDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{tImage.readyBackgroundLocked}</p>
                {ornamentAdmin ? (
                  <WeddingOrnamentAdminBar
                    locale={uiLocale}
                    hint={tImage.ornamentTemplateHint}
                    addLabel={tImage.ornamentAdminAdd}
                    saveLabel={tImage.ornamentAdminSave}
                    resetLabel={tImage.ornamentAdminReset}
                    dirty={ornamentDraft != null}
                    saving={ornamentSaving}
                    showReset
                    onAdd={(src) => setOrnamentDraft([...(ornamentDraft ?? backgroundOrnaments), { src, x: 8, y: 12, w: 22 }])}
                    onReset={() => void resetOrnaments()}
                  />
                ) : null}
                <div className="rounded-2xl border border-dashed p-4">
                  <WeddingDesignScale device="mobile">
                  <div
                    data-wedding-stage=""
                    className={cn('relative w-full overflow-x-clip bg-cover bg-center', kitSurface.className)}
                    style={{ ...weddingBackgroundStyle(coverBackgroundUrl, selectedTheme, WEDDING_BG_OVERLAY.cover), ...kitSurface.style }}
                  >
                    <div data-wedding-ornament-frame="">
                      {ornamentAdmin ? (
                        <WeddingOrnamentAdminLayer
                          ornaments={backgroundOrnaments}
                          editable
                          className="absolute inset-0 z-[80]"
                          surface="cover"
                          zoomInLabel={tImage.ornamentAdminZoomIn}
                          zoomOutLabel={tImage.ornamentAdminZoomOut}
                          rotateLeftLabel={tImage.ornamentAdminRotateLeft}
                          rotateRightLabel={tImage.ornamentAdminRotateRight}
                          blurLabel={tImage.ornamentAdminBlur}
                          fadeLabel={tImage.ornamentAdminFade}
                          stillLabel={tImage.ornamentAdminMotionStill}
                          riseLabel={tImage.ornamentAdminMotionRise}
                          deleteLabel={tImage.ornamentAdminDelete}
                          onChange={setOrnamentDraft}
                        />
                      ) : (
                        <WeddingBackgroundOrnamentLayer ornaments={backgroundOrnaments} className="absolute inset-0 z-20" />
                      )}
                    </div>
                    <div data-wedding-sheet-content="" data-wedding-cover-pad="" className={cn('flex flex-col items-center px-3 pb-4 pt-3', coverPresetId === 'song_hy' ? 'min-h-[844px] justify-center' : 'justify-start')}>
                      <div data-wedding-cover-column="" className="mx-auto w-full max-w-[min(26rem,calc(100%-1.5rem))]">
                    <WeddingCoverShellCard
                      key={`${coverFrameMode ?? 'shell'}-${coverPhotoOpen}-${coverFrameOpen}`}
                      presetId={coverPresetId}
                      aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                      frameMode={coverFrameMode}
                      photoOpen={coverPhotoOpen}
                      frameOpen={coverFrameOpen}
                      openMotion
                      motionKey={`${coverFrameMode ?? 'shell'}-${coverPhotoOpen}-${coverFrameOpen}`}
                      coverPhotoUrl={coverPhotoPreviewUrl}
                      coverPhotoObjectPosition={coverPhotoObjectPosition}
                      coverPhotoScale={coverPhotoScale}
                      frameScale={resolveCoverFrameScale(sectionConfig)}
                      frameScaleEdit={frameScaleEditFor('cover', resolveCoverFrameScale(sectionConfig))}
                      coverPhotoEdit={
                        coverPhotoPreviewUrl
                          ? {
                              x: coverPhotoPositionX,
                              y: coverPhotoPositionY,
                              scale: coverPhotoScale,
                              onChange: updateCoverPhotoCrop,
                              zoomOutLabel: txCover.coverPhotoZoomOut,
                              zoomInLabel: txCover.coverPhotoZoomIn,
                            }
                          : undefined
                      }
                      groomName={card.groomName || '—'}
                      brideName={card.brideName || '—'}
                      weddingDate={weddingDateDisplay || card.weddingDate}
                      weddingTimeText={guestInviteLocationPreview.displayTime || card.weddingTime}
                      guestName={previewDemo.guestDisplayName}
                      guestInviteVenue={previewDemoVenue}
                      guestInviteVenueLabel={previewDemoVenueLabel || undefined}
                      addressText={guestInviteLocationPreview.address || undefined}
                      mapUrl={guestInviteLocationPreview.mapUrl || undefined}
                      viewMapLabel={txPublic.guestInviteViewMap}
                      personalInviteText={previewDemo.personalInvite}
                      theme={selectedTheme}
                      invitationLabel={txCover.previewLabel}
                      cordiallyInvitesLabel={txCover.previewGuestPrefix}
                      openButtonLabel={txCover.previewOpenButton}
                      buttonColor={buttonColor}
                      rsvpButtonColor={coverRsvpColor}
                      quickRsvp={
                        card.rsvpEnabled
                          ? {
                              yesLabel: previewPublic.coverAttendYes,
                              noLabel: previewPublic.coverAttendNo,
                              savedYesLabel: previewPublic.coverRsvpSavedYes,
                              savedNoLabel: previewPublic.coverRsvpSavedNo,
                              choice: coverRsvpPreview,
                              partyCount: coverRsvpPreview === 'yes' ? 1 : undefined,
                              onYes: () => setCoverRsvpPreview((choice) => (choice === 'yes' ? null : 'yes')),
                              onNo: () => setCoverRsvpPreview((choice) => (choice === 'no' ? null : 'no')),
                            }
                          : undefined
                      }
                      dateFallback={txPublic.dateFallback}
                      photoAlt={coverPhotoCopy.alt}
                      stackPair={
                        heroStack
                          ? {
                              firstUrl: groomPortraitPreviewUrl,
                              secondUrl: bridePortraitPreviewUrl,
                              firstAlt: occasionCopy.primaryPhoto,
                              secondAlt: occasionCopy.secondaryPhoto,
                              firstFrame: groomPortraitFrame,
                              secondFrame: bridePortraitFrame,
                              firstEdit: stackPhotoEdit('groom'),
                              secondEdit: stackPhotoEdit('bride'),
                              firstNameEdit: stackNameEdit('groom'),
                              secondNameEdit: stackNameEdit('bride'),
                              frameScaleEdit: stackPairFrameScale(),
                              frameShell: stackFrameShell,
                              firstShell: groomPortraitShell,
                              secondShell: bridePortraitShell,
                              place: stackPlace,
                              onPlace: setStackPlace,
                              moveLabel: txCover.dragPlace,
                              moveFrameLabel: txCover.stackMoveFrame,
                              moveNameLabel: txCover.stackMoveName,
                              ...stackRotate,
                              showEmpty: true,
                            }
                          : undefined
                      }
                      choosePhotoLabel={txCover.choosePhoto}
                      changePhotoLabel={txCover.changePhoto}
                      onPhotoFile={(file) => {
                        setCoverImageFile(file)
                        setCoverClearOnSave(false)
                      }}
                    />
                      </div>
                    </div>
                  </div>
                  </WeddingDesignScale>
                </div>
                {heroStack ? (
                  <p className="text-xs text-muted-foreground">{txCover.heroLayoutStackPhotoHint}</p>
                ) : (
                  <>
                <DeviceImagePicker
                  className="flex w-full rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted sm:w-auto"
                  label={
                    <>
                      <Upload className="h-4 w-4" />
                      {txCover.coverUploadDevice}
                    </>
                  }
                  onFiles={(files) => {
                    const file = files[0]
                    if (!file) return
                    setCoverImageFile(file)
                    setCoverClearOnSave(false)
                  }}
                />
                <p className="text-xs text-muted-foreground">{txCover.uploadHint}</p>
                {!coverImageFile && resolveCoverPhotoUrl(sectionConfig) ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setCoverClearOnSave(true)}>
                    {txCover.removeCustomCover}
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">{txCover.aiCoverHint}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle>{occasionCopy.stepTitle}</CardTitle>
                    <CardDescription>{tBrief.step2Description}</CardDescription>
                  </div>
                  <div className="flex min-h-[1.25rem] shrink-0 items-start sm:max-w-[240px] sm:justify-end">
                    {autoSaving || autosaveBanner ? (
                      <p
                        role="status"
                        className={cn(
                          'text-xs sm:text-right sm:text-sm',
                          !autoSaving && autosaveBanner?.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {autoSaving ? tBrief.autoSavingLabel : autosaveBanner?.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Loại thiệp</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={occasionKey}
                    onChange={(e) => requestOccasionChange(normalizeInvitationOccasion(e.target.value))}
                  >
                    {(['wedding', 'engagement', 'full_month', 'first_birthday', 'birthday', 'longevity', 'grand_opening', 'housewarming', 'gathering', 'graduation', 'anniversary', 'ceremony'] as const).map((key) => (
                      <option key={key} value={key}>{invitationEditorCopy(key).label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{occasionCopy.blurb}</p>
                </div>
                {heroStack ? null : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={occasionCopy.primaryName} value={card.groomName} onChange={(v) => update('groomName', v)} />
                  <Field label={occasionCopy.secondaryName} value={card.brideName} onChange={(v) => update('brideName', v)} />
                </div>
                )}
                {heroStack ? null : (
                <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ImageUploadField
                    label={occasionCopy.primaryPhoto}
                    inputId="wedding-groom-portrait-file"
                    currentUrl={groomPortraitPreviewUrl}
                    frame="portrait"
                    crop={{
                      positionX: groomPortraitFrame.x,
                      positionY: groomPortraitFrame.y,
                      scale: groomPortraitFrame.scale,
                      onChange: (patch) => updatePortraitCrop('groom', patch),
                    }}
                    onFileChange={(file) => {
                      setGroomPortraitFile(file)
                      if (file) setGroomPortraitClear(false)
                    }}
                    onRemove={
                      groomPortraitPreviewUrl
                        ? () => {
                            setGroomPortraitFile(null)
                            setGroomPortraitClear(true)
                            update('groomImageUrl', '')
                          }
                        : undefined
                    }
                    choosePhotoLabel={txCover.choosePhoto}
                    shell={groomPortraitShell}
                    frameScale={pairPortraitFrameScale}
                  />
                  <ImageUploadField
                    label={occasionCopy.secondaryPhoto}
                    inputId="wedding-bride-portrait-file"
                    currentUrl={bridePortraitPreviewUrl}
                    frame="portrait"
                    crop={{
                      positionX: bridePortraitFrame.x,
                      positionY: bridePortraitFrame.y,
                      scale: bridePortraitFrame.scale,
                      onChange: (patch) => updatePortraitCrop('bride', patch),
                    }}
                    onFileChange={(file) => {
                      setBridePortraitFile(file)
                      if (file) setBridePortraitClear(false)
                    }}
                    onRemove={
                      bridePortraitPreviewUrl
                        ? () => {
                            setBridePortraitFile(null)
                            setBridePortraitClear(true)
                            update('brideImageUrl', '')
                          }
                        : undefined
                    }
                    choosePhotoLabel={txCover.choosePhoto}
                    shell={bridePortraitShell}
                    frameScale={pairPortraitFrameScale}
                  />
                </div>
                <div className="flex justify-center">
                  <FrameScaleDragBar edit={stackPairFrameScale()} />
                </div>
                </>
                )}
                {heroStack ? null : <p className="text-xs text-muted-foreground">{occasionCopy.portraitHint}</p>}
                <p className="text-xs text-muted-foreground">{occasionCopy.sharedHint}</p>
                <div className="space-y-2">
                  <Label>Lời mời tiếng Anh (tùy chọn)</Label>
                  <Textarea
                    value={card.invitationTextEn}
                    onChange={(e) => update('invitationTextEn', e.target.value)}
                    placeholder="Cordially invites you to celebrate with our family..."
                    className="min-h-24"
                  />
                  <p className="text-xs text-muted-foreground">Để trống thì thiệp không hiện câu tiếng Anh.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <WeddingAiPolishTextarea
                    label={occasionCopy.introLabel}
                    field="coupleIntro"
                    value={card.coupleIntro}
                    onChange={(v) => update('coupleIntro', v)}
                    card={card}
                    omitAddresses={sharedCopyAddresses}
                    weddingDateLabel={weddingDateDisplay}
                    placeholder={occasionCopy.introPlaceholder}
                    className="min-h-28"
                  />
                  <WeddingAiPolishTextarea
                    label={occasionCopy.quoteLabel}
                    field="loveQuote"
                    value={card.loveQuote}
                    onChange={(v) => update('loveQuote', v)}
                    card={card}
                    omitAddresses={sharedCopyAddresses}
                    weddingDateLabel={weddingDateDisplay}
                    placeholder={occasionCopy.quotePlaceholder}
                    className="min-h-28"
                  />
                </div>
                <WeddingAiPolishTextarea
                  label="Dress code / lưu ý khách mời"
                  field="dressCode"
                  value={card.dressCode}
                  onChange={(v) => update('dressCode', v)}
                  card={card}
                  omitAddresses={sharedCopyAddresses}
                  weddingDateLabel={weddingDateDisplay}
                  placeholder="Ví dụ: Tông màu kem, be, nâu nhạt. Vui lòng đến trước giờ làm lễ 15 phút."
                  className="min-h-32"
                />
                <WeddingAiPolishTextarea
                  label={occasionCopy.storyLabel}
                  field="storyText"
                  value={card.storyText}
                  onChange={(v) => update('storyText', v)}
                  card={card}
                  omitAddresses={sharedCopyAddresses}
                  weddingDateLabel={weddingDateDisplay}
                  placeholder={occasionCopy.storyPlaceholder}
                  className="min-h-24"
                />
                <WeddingAiPolishTextarea
                  label="Lời cảm ơn cuối thiệp"
                  field="thankYouText"
                  value={card.thankYouText}
                  onChange={(v) => update('thankYouText', v)}
                  card={card}
                  omitAddresses={sharedCopyAddresses}
                  weddingDateLabel={weddingDateDisplay}
                  placeholder={occasionCopy.thanksPlaceholder}
                  hint={WEDDING_CARD_TEXT_TOKEN_HINT}
                  className="min-h-24"
                />
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-1">
                    <Label>{occasionCopy.venueTitle}</Label>
                    <p className="text-xs text-muted-foreground">{occasionCopy.venueNote}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-sky-800">{occasionCopy.primaryFamily}</p>
                    <WeddingSideInviteSettingsPanel
                      side="groom"
                      card={card}
                      settings={weddingSideInviteSettingsFromCard(card)}
                      saving={saving}
                      onChange={applySideSettings}
                      onParentsChange={(value) => update('groomParents', value)}
                      placeNoun={occasionCopy.placeNounPrimary}
                      parentsLabel={occasionCopy.parentsLabel}
                      dateLabel={occasionCopy.dateLabel}
                      hint={occasionCopy.panelHint}
                    />
                  </div>
                  {singleOccasion ? null : (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-rose-700">{occasionCopy.secondaryFamily}</p>
                    <WeddingSideInviteSettingsPanel
                      side="bride"
                      card={card}
                      settings={weddingSideInviteSettingsFromCard(card)}
                      saving={saving}
                      onChange={applySideSettings}
                      onParentsChange={(value) => update('brideParents', value)}
                      placeNoun={occasionCopy.placeNounSecondary}
                    />
                  </div>
                  )}
                </div>
                <div className="w-full min-w-0 max-w-full space-y-3 overflow-hidden rounded-2xl border p-3">
                  <Label>{occasionCopy.albumLabel}</Label>
                  <p className="text-xs text-muted-foreground">
                    Trên khung xem album: kéo ảnh để căn góc, lăn chuột hoặc thanh zoom để phóng, nút X để xóa. Nút mũi tên vẫn chuyển ảnh. Nhấp đúp để về vị trí ban đầu. Ảnh mới tự lưu.
                  </p>
                  <DeviceImagePicker
                    multiple
                    className="flex w-full rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted"
                    label={
                      <>
                        <Upload className="h-4 w-4" />
                        Chọn nhiều ảnh album
                      </>
                    }
                    onFiles={(picked) => {
                      setAlbumImageFiles((prev) => {
                        const room = Math.max(0, 30 - card.albumImageUrls.length - prev.length)
                        return room > 0 ? [...prev, ...picked.slice(0, room)] : prev
                      })
                    }}
                  />
                  {(card.albumImageUrls.length > 0 || albumPendingPreviews.length > 0) && (
                    <div className="grid w-full min-w-0 max-w-full grid-cols-3 gap-2 sm:gap-3">
                      {card.albumImageUrls.map((url, index) => {
                        const frame = resolveAlbumPhotoFrame(sectionConfig.albumPhotoCrops, index)
                        return (
                          <WeddingAlbumPhotoCropThumb
                            key={`${url}-${index}`}
                            imageUrl={url}
                            positionX={frame.x}
                            positionY={frame.y}
                            scale={frame.scale}
                            removeLabel={tImage.customReferenceRemove}
                            onRemove={() => removeSavedAlbumPhoto(index)}
                            onChange={(patch) => updateAlbumPhotoCrop(index, patch)}
                          />
                        )
                      })}
                      {albumPendingPreviews.map((url, index) => (
                        <div key={url} className="relative aspect-[3/4] w-full min-w-0 max-w-full overflow-hidden rounded-xl bg-black/5">
                          <img src={url} alt="Ảnh album mới" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                            aria-label={tImage.customReferenceRemove}
                            onClick={() => setAlbumImageFiles((prev) => prev.filter((_, photoIndex) => photoIndex !== index))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden">
                    <Label>Kiểu xem album trên thiệp</Label>
                    <p className="text-xs text-muted-foreground">Xem đúng kiểu album trên thiệp, vừa xem vừa căn ảnh. Khách mời chỉ xem, không chỉnh được.</p>
                    <WeddingAlbumLayoutPicker
                      locale={uiLocale}
                      selectedId={sectionConfig.albumLayoutId}
                      previewUrls={card.albumImageUrls}
                      crops={sectionConfig.albumPhotoCrops}
                      onSelect={selectAlbumLayout}
                      onCropChange={updateAlbumPhotoCrop}
                      onRemove={removeSavedAlbumPhoto}
                      removeLabel={tImage.customReferenceRemove}
                    />
                  </div>
                  <Textarea
                    value={card.albumImageUrls.join('\n')}
                    onChange={(e) => {
                      const albumImageUrls = e.target.value.split('\n').map((url) => url.trim()).filter(Boolean)
                      setCard((prev) => {
                        const config = parseWeddingSectionConfig(prev.sectionConfig)
                        return {
                          ...prev,
                          albumImageUrls,
                          sectionConfig: mergeWeddingSectionConfig(prev.sectionConfig, {
                            albumPhotoCrops: remapAlbumPhotoCrops(prev.albumImageUrls, config.albumPhotoCrops, albumImageUrls),
                          }),
                        }
                      })
                    }}
                    placeholder="Hoặc dán URL ảnh album, mỗi dòng một ảnh"
                    className="min-h-20"
                  />
                  <p className="text-xs text-muted-foreground">Thêm, sửa và căn góc ảnh album không tốn credit. Mọi thay đổi tự lưu, không cần bấm Lưu.</p>
                </div>
                <Field label="Bảng màu AI" value={card.colorPalette} onChange={(v) => update('colorPalette', v)} />
                <div className="space-y-3 rounded-2xl border p-3">
                  <Label>{tMu.libraryHeading}</Label>
                  <p className="text-xs text-muted-foreground">{tMu.libraryHint}</p>
                  <WeddingMusicLibraryPicker
                    items={musicLibrary}
                    selectedUrl={!musicClearOnSave && !musicFile ? card.musicUrl : ''}
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
                    uploadTooLarge={tMu.uploadTooLarge}
                    uploadInvalidType={tMu.uploadInvalidType}
                    uploadFailed={tMu.uploadFailed}
                    deleteTrackLabel={tMu.deleteTrack}
                    deleteTrackConfirm={tMu.deleteTrackConfirm}
                    deleteDenied={tMu.deleteDenied}
                    deleteFailed={tMu.deleteFailed}
                    canDelete={ornamentAdmin}
                    onLibraryChange={setMusicLibrary}
                    onTrackRemoved={(audioUrl) => {
                      if (card.musicUrl !== audioUrl) return
                      update('musicUrl', '')
                      setCard((prev) => ({ ...prev, musicPlayStartSec: null, musicPlayEndSec: null }))
                      setMusicFile(null)
                      setMusicClearOnSave(false)
                      setMusicStartInput('')
                      setMusicEndInput('')
                    }}
                    onSelect={(audioUrl) => {
                      update('musicUrl', audioUrl)
                      setMusicFile(null)
                      setMusicClearOnSave(false)
                    }}
                  />
                  <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
                    <input
                      type="file"
                      accept="audio/*"
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      style={{ touchAction: 'manipulation' }}
                      onChange={(event) => {
                        const f = event.target.files?.[0] ?? null
                        setMusicFile(f)
                        if (f) setMusicClearOnSave(false)
                      }}
                    />
                    <Upload className="pointer-events-none h-4 w-4" />
                    <span className="pointer-events-none">{tMu.uploadLabel}</span>
                  </label>
                  <p className="text-xs text-muted-foreground">{tMu.sharedUploadNote}</p>
                  {!musicClearOnSave && !musicFile && !card.musicUrl ? (
                    <p className="text-xs text-muted-foreground">Chưa có nhạc. Bấm «Chọn nhạc» hoặc tải file để có nhạc nền trên thiệp.</p>
                  ) : null}
                  {musicClearOnSave && card.musicUrl && !musicFile && (
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Đã đánh dấu gỡ nhạc. Thiệp tự lưu sẽ xóa file nhạc.
                      <button
                        type="button"
                        className="ml-2 underline"
                        onClick={() => setMusicClearOnSave(false)}
                      >
                        Huỷ
                      </button>
                    </p>
                  )}
                  {!musicClearOnSave && (musicFile || card.musicUrl) && (
                    <div className="space-y-3">
                      {musicPreviewSrc ? (
                        <WeddingInvitationAudio
                          ref={musicPreviewAudioRef}
                          key={musicPreviewSrc}
                          src={musicPreviewSrc}
                          loop
                          playStartSec={previewMusicStartSec}
                          playEndSec={previewMusicEndSec}
                          preload="metadata"
                        />
                      ) : null}
                      {musicPreviewSrc ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            const raw = musicPreviewAudioRef.current?.getCurrentPlaybackTimeSec()
                            if (raw == null) return
                            setMusicStartInput(formatWeddingMusicSecondsForInput(raw))
                          }}
                        >
                          {tMu.useCurrentPlaybackAsStart}
                        </Button>
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{tMu.playStartLabel}</Label>
                          <Input
                            value={musicStartInput}
                            onChange={(e) => setMusicStartInput(e.target.value)}
                            placeholder={tMu.playStartPlaceholder}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{tMu.playEndLabel}</Label>
                          <Input
                            value={musicEndInput}
                            onChange={(e) => setMusicEndInput(e.target.value)}
                            placeholder={tMu.playEndPlaceholder}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{tMu.segmentHint}</p>
                      {!musicFile && card.musicUrl ? (
                        <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setMusicClearOnSave(true)}>
                          Gỡ nhạc (lưu để áp dụng)
                        </Button>
                      ) : null}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Chọn trong kho hoặc tải file. Không nhập link Zing / Spotify. Thêm / đổi / nghe thử không tốn credit.
                  </p>
                </div>
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Toggle label={tBrief.effectsToggleLabel} checked={card.effectsEnabled} onChange={(v) => update('effectsEnabled', v)} />
                    <p className="text-xs text-muted-foreground">{tBrief.effectsToggleDesc}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs text-muted-foreground">
                        {tBrief.openBurstLabel}
                        <select
                          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                          value={openBurstEffect}
                          onChange={(event) => setOpenCelebration({ openBurstEffect: event.target.value as WeddingOpenBurstEffect })}
                        >
                          {WEDDING_OPEN_BURST_EFFECTS.map((id) => (
                            <option key={id} value={id}>{burstEffectLabel[id]}</option>
                          ))}
                        </select>
                        <span className="mt-1 block">{tBrief.openBurstHint}</span>
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        {tBrief.openFallLabel}
                        <select
                          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                          value={openFallEffect}
                          onChange={(event) => setOpenCelebration({ openFallEffect: event.target.value as WeddingOpenFallEffect })}
                        >
                          {WEDDING_OPEN_FALL_EFFECTS.map((id) => (
                            <option key={id} value={id}>{fallEffectLabel[id]}</option>
                          ))}
                        </select>
                        <span className="mt-1 block">{tBrief.openFallHint}</span>
                      </label>
                      {openFallEffect !== 'none' ? (
                        <label className="block text-xs text-muted-foreground sm:col-span-2">
                          <span className="flex items-center justify-between gap-3">
                            <span>{tBrief.openFallDurationLabel}</span>
                            <span className="font-medium text-foreground">
                              {openFallSeconds <= 0
                                ? tBrief.openFallDurationForever
                                : tBrief.openFallDurationSeconds.replace('{n}', String(openFallSeconds))}
                            </span>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={WEDDING_OPEN_FALL_SECOND_STOPS.length - 1}
                            step={1}
                            value={openFallSecondsStopIndex(openFallSeconds)}
                            onChange={(event) => {
                              const stop = WEDDING_OPEN_FALL_SECOND_STOPS[Number(event.target.value)]
                              if (stop === undefined) return
                              setOpenCelebration({ openFallSeconds: stop })
                            }}
                            className="mt-2 h-2 w-full cursor-pointer accent-indigo-600"
                          />
                          <span className="mt-1 block">{tBrief.openFallDurationHint}</span>
                        </label>
                      ) : null}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setOpenEffectPreview((n) => n + 1)}>
                      {tBrief.openEffectPreview}
                    </Button>
                    {openEffectPreview > 0 ? (
                      <WeddingOpenEffects
                        key={openEffectPreview}
                        play
                        burst={openBurstEffect}
                        fall={openFallEffect}
                        fallSeconds={openFallSeconds}
                        span="preview"
                        themeId={readyBackground?.look.styleId ?? card.selectedStyleId}
                        lookId={readyBackground?.id}
                      />
                    ) : null}
                  </div>
                </div>
                <Toggle label="Bật RSVP" checked={card.rsvpEnabled} onChange={(v) => update('rsvpEnabled', v)} />
                <div className="space-y-4 border-t pt-4">
                  <Toggle
                    label="Bật hộp / QR mừng cưới (VietQR)"
                    checked={card.giftQrEnabled}
                    onChange={(v) => update('giftQrEnabled', v)}
                  />
                  {card.giftQrEnabled && (
                    <>
                      <WeddingGiftAccountsForm
                        card={card}
                        banks={vietBanks}
                        tx={txGift}
                        update={update}
                        hideSecondary={singleOccasion}
                        primaryTitle={occasionKey === 'wedding' ? undefined : occasionCopy.primaryRole || occasionCopy.label}
                        secondaryTitle={occasionKey === 'wedding' ? undefined : occasionCopy.secondaryRole}
                        hint={
                          singleOccasion
                            ? 'Bật hộp mừng: điền đủ ngân hàng, số TK và tên chủ TK để tạo mã VietQR. Hoặc dán một URL ảnh QR.'
                            : undefined
                        }
                      />
                      <div className="space-y-1">
                        <Field
                          label={txGift.legacyImageLabel}
                          value={card.giftQrImageUrl}
                          onChange={(v) => update('giftQrImageUrl', v)}
                        />
                        <p className="text-xs text-muted-foreground">{txGift.legacyImageDesc}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Cao hơn màn hình thì Chrome kéo cả trang xuống đáy mỗi lần preview đổi chiều cao. */}
          <div className="w-full min-w-0 max-w-full space-y-6 [overflow-anchor:none] lg:sticky lg:top-24 lg:z-[1] lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
            <Card>
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle>3 & 8. Preview nháp</CardTitle>
                    <CardDescription>{tImage.previewColumnNote}</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => (singleOccasion ? openLetterView('groom') : setLetterAskOpen(true))}
                  >
                    Xem thiệp
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {missing.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Cần kiểm tra thêm: {missing.join(', ')}.
                  </div>
                )}
                {card.slug ? (
                  <WeddingLiveDevicePreviews
                    slug={card.slug}
                    guestName={previewDemo.guestDisplayName}
                    letterView={previewLetterView}
                    editable
                    locale={uiLocale}
                    desktopLabel={tImage.previewDesktop}
                    mobileLabel={tImage.previewMobile}
                    coverLabel={tImage.previewCover}
                    letterLabel={tImage.previewLetter}
                    hint={tImage.previewDeviceHint}
                    refreshLabel={tImage.previewRefresh}
                    look={previewLook}
                    lookToken={previewLookToken}
                    showReset
                    onOrnamentsSaved={(ornaments) => {
                      const key = ornamentAdmin && sharedMobileOrnamentKey ? sharedMobileOrnamentKey : cardMobileOrnamentKey
                      if (!key) return
                      setOrnamentLayouts((prev) => {
                        const next = { ...prev }
                        if (!ornaments) delete next[key]
                        else next[key] = ornaments
                        if (ornamentAdmin && cardMobileOrnamentKey && cardMobileOrnamentKey !== key) delete next[cardMobileOrnamentKey]
                        return next
                      })
                    }}
                  />
                ) : (
                  <WeddingOrnamentAdminBar
                    locale={uiLocale}
                    hint={ornamentAdmin ? tImage.ornamentTemplateHint : tImage.ornamentAdminHint}
                    addLabel={tImage.ornamentAdminAdd}
                    saveLabel={tImage.ornamentAdminSave}
                    resetLabel={tImage.ornamentAdminReset}
                    dirty={ornamentDraft != null}
                    saving={ornamentSaving}
                    showReset
                    onAdd={(src) => setOrnamentDraft([...(ornamentDraft ?? backgroundOrnaments), { src, x: 8, y: 8, w: 36 }])}
                    onReset={() => void resetOrnaments()}
                  />
                )}
                {card.slug ? null : (
                <div data-wedding-stage="" data-wedding-paper={selectedTheme.contentCard || undefined} className={cn('relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[1.65rem] border border-white/60 shadow-lg', kitSurface.className)} style={kitSurface.style}>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={weddingBackgroundStyle(coverBackgroundUrl, selectedTheme, WEDDING_BG_OVERLAY.hero, { readingVignette: true })}
                  />
                  <div data-wedding-ornament-frame="">
                  <WeddingOrnamentAdminLayer
                    ornaments={backgroundOrnaments}
                    editable
                    className="absolute inset-0 z-[80]"
                    zoomInLabel={tImage.ornamentAdminZoomIn}
                    zoomOutLabel={tImage.ornamentAdminZoomOut}
                    blurLabel={tImage.ornamentAdminBlur}
                    fadeLabel={tImage.ornamentAdminFade}
                    stillLabel={tImage.ornamentAdminMotionStill}
                    riseLabel={tImage.ornamentAdminMotionRise}
                    deleteLabel={tImage.ornamentAdminDelete}
                    onChange={setOrnamentDraft}
                  />
                  </div>
                    <div
                    className={cn(
                      'relative z-[1] px-3 py-3 text-center',
                      selectedTheme.text,
                      'pointer-events-none',
                    )}
                  >
                    <WeddingReadableGlass
                      className="w-full rounded-2xl px-3 py-3.5"
                    >
                      <div className="flex w-full min-w-0 flex-col items-stretch gap-2 text-center">
                        {envelopeCover ? null : (
                        <p className={cn('w-full text-[10px] uppercase tracking-[0.28em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                          {occasionCopy.previewEyebrow}
                        </p>
                        )}
                        {envelopeCover || !heroStack ? null : (
                          <WeddingStackedCouplePhotos
                            firstUrl={groomPortraitPreviewUrl}
                            secondUrl={bridePortraitPreviewUrl}
                            firstAlt={occasionCopy.primaryPhoto}
                            secondAlt={occasionCopy.secondaryPhoto}
                            firstFrame={groomPortraitFrame}
                            secondFrame={bridePortraitFrame}
                            firstName={card.groomName}
                            secondName={card.brideName}
                            firstCaption={occasionCopy.primaryRole}
                            secondCaption={occasionCopy.secondaryRole}
                            frameScale={resolvePortraitFrameScale(sectionConfig, 'groom')}
                            frameShell={stackFrameShell}
                            firstShell={groomPortraitShell}
                            secondShell={bridePortraitShell}
                            place={stackPlace}
                            firstRotate={stackRotate.firstRotate}
                            secondRotate={stackRotate.secondRotate}
                            nameClassName={cn(selectedTheme.text, selectedTheme.textGlowHeading)}
                            compact
                          />
                        )}
                        {envelopeCover || heroStack ? null : (
                        <div className="w-full min-w-0">
                          <h2 className={cn('w-full text-balance font-serif text-[clamp(1.35rem,8cqi,1.85rem)] font-semibold italic leading-tight', selectedTheme.textGlowHeading)}>
                            {card.groomName || occasionCopy.primaryRole || occasionCopy.label}
                          </h2>
                          {singleOccasion && !card.brideName.trim() ? null : (
                            <>
                          <p className={cn('my-0.5 text-sm', selectedTheme.textGlow)}>&</p>
                          <h2 className={cn('w-full text-balance font-serif text-[clamp(1.35rem,8cqi,1.85rem)] font-semibold italic leading-tight', selectedTheme.textGlowHeading)}>
                            {card.brideName || occasionCopy.secondaryRole}
                          </h2>
                            </>
                          )}
                        </div>
                        )}
                        {envelopeCover ? null : selectedTheme.ornament ? (
                          <div className={cn('text-xl leading-none', selectedTheme.accent, selectedTheme.textGlow)}>
                            {selectedTheme.ornament}
                          </div>
                        ) : (
                          <Heart className={cn('mx-auto h-4 w-4 fill-current opacity-80', selectedTheme.accent, selectedTheme.textGlow)} />
                        )}
                        {card.loveQuote ? (
                          <p className={cn('w-full text-balance font-serif text-[0.92rem] italic leading-6', selectedTheme.accentText, selectedTheme.textGlow)}>
                            “{card.loveQuote}”
                          </p>
                        ) : null}
                        {envelopeCover || !(heroStack || (coverFrameMode === 'none' && !coverPhotoPreviewUrl)) ? (
                          <div className={cn('mx-auto w-full', coverFrameMode === 'preset' || coverFrameMode === 'library' || coverFrameMode === 'ai' || coverFrameMode === 'none' ? 'max-w-[22rem]' : '')}>
                            <WeddingCoverShellCard
                              frameOnly
                              presetId={coverPresetId}
                              aiFrame={coverFrameMode === 'preset' || coverFrameMode === 'none' ? null : coverAiFrame}
                              frameMode={coverFrameMode}
                              coverPhotoUrl={coverPhotoPreviewUrl}
                              coverPhotoObjectPosition={coverPhotoObjectPosition}
                              coverPhotoScale={coverPhotoScale}
                              frameScale={resolveCoverFrameScale(sectionConfig)}
                              frameScaleEdit={frameScaleEditFor('cover', resolveCoverFrameScale(sectionConfig))}
                              groomName={card.groomName || '—'}
                              brideName={card.brideName || '—'}
                              theme={selectedTheme}
                              invitationLabel={txCover.previewLabel}
                              cordiallyInvitesLabel={txCover.previewGuestPrefix}
                              openButtonLabel={txCover.previewOpenButton}
                              dateFallback={txPublic.dateFallback}
                              photoAlt={coverPhotoCopy.alt}
                            />
                          </div>
                        ) : null}
                        <WeddingGuestInviteBlock
                          className="w-full min-w-0"
                          guestName={previewDemo.guestDisplayName}
                          inviteVenue={previewDemoVenue}
                          cordiallyInvitesLabel={txCover.previewGuestPrefix}
                          venueLabel={previewDemoVenueLabel}
                          weddingDateLabel={previewWeddingDateLabel || weddingDateDisplay || card.weddingDate || undefined}
                          weddingTimeText={guestInviteLocationPreview.displayTime || card.weddingTime}
                          addressText={guestInviteLocationPreview.address}
                          mapUrl={guestInviteLocationPreview.mapUrl}
                          viewMapLabel={txPublic.guestInviteViewMap}
                          personalInviteText={previewDemo.personalInvite || card.invitationText || occasionCopy.previewInviteFallback}
                          personalInviteClassName={cn('text-xs leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}
                          panelClassName={selectedTheme.panelStrong}
                          cordiallyClassName={cn(selectedTheme.mutedText, selectedTheme.textGlow)}
                          nameClassName={cn(selectedTheme.text, selectedTheme.textGlowHeading)}
                          venueClassName={cn(selectedTheme.accentText, selectedTheme.textGlow)}
                          addressClassName={cn(selectedTheme.mutedText, selectedTheme.textGlow)}
                          weddingThemeId={selectedTheme.id}
                          buttonColor={buttonColor}
                          compact
                        />
                        {previewDateIso ? (
                          <div className="w-full pt-0.5">
                            <WeddingCountdownBlock
                              weddingDateIso={previewDateIso}
                              weddingTimeText={guestInviteLocationPreview.receptionTime || card.weddingTime}
                              partyStartTime={guestInviteLocationPreview.partyStartTime || card.partyStartTime}
                              locale={uiLocale}
                              tx={txCal}
                              compact
                              live={false}
                              className={cn(selectedTheme.textGlow, 'font-medium')}
                            />
                          </div>
                        ) : null}
                        {previewFamilies.visible ? (
                          <div className={cn('w-full rounded-xl px-2.5 py-2 text-center', selectedTheme.panelStrong)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.18em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                              {previewPublic.familiesIntro}
                            </p>
                            <div className="mt-2 grid gap-1.5">
                              {([
                                { label: previewPublic.groomFamily, parents: previewFamilies.groomParents, hometown: previewFamilies.groomHometown },
                                { label: previewPublic.brideFamily, parents: previewFamilies.brideParents, hometown: previewFamilies.brideHometown },
                              ] as const).map((side) =>
                                side.parents || side.hometown ? (
                                  <div key={side.label} className={cn('rounded-lg px-2 py-1.5', selectedTheme.panelGlass)}>
                                    <p className={cn('text-[10px]', selectedTheme.mutedText, selectedTheme.textGlow)}>{side.label}</p>
                                    {side.parents ? (
                                      <p className={cn('mt-0.5 whitespace-pre-line break-words font-serif text-sm leading-5', selectedTheme.text, selectedTheme.textGlow)}>
                                        {side.parents}
                                      </p>
                                    ) : null}
                                    {side.hometown ? (
                                      <p className={cn('mt-0.5 whitespace-pre-line break-words text-[11px] leading-4', selectedTheme.mutedText, selectedTheme.textGlow)}>
                                        {previewPublic.hometownLabel}: {side.hometown}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null,
                              )}
                            </div>
                          </div>
                        ) : null}
                        {heroStack ? null : (
                        <WeddingCouplePortraits
                          groomName={card.groomName || occasionCopy.primaryRole || occasionCopy.label}
                          brideName={singleOccasion ? card.brideName : card.brideName || occasionCopy.secondaryRole}
                          groomImageUrl={groomPortraitPreviewUrl}
                          brideImageUrl={bridePortraitPreviewUrl}
                          groomLabel={occasionKey === 'wedding' ? previewPublic.groomRole : occasionCopy.primaryRole}
                          brideLabel={occasionKey === 'wedding' ? previewPublic.brideRole : occasionCopy.secondaryRole}
                          groomFrame={groomPortraitFrame}
                          brideFrame={bridePortraitFrame}
                          groomShell={groomPortraitShell}
                          brideShell={bridePortraitShell}
                          onChoosePhoto={() => undefined}
                          groomFrameScale={pairPortraitFrameScale}
                          brideFrameScale={pairPortraitFrameScale}
                          pairFrameScaleEdit={stackPairFrameScale()}
                          theme={selectedTheme}
                          compact
                        />
                        )}
                        {previewIntro || previewStory ? (
                          <div className={cn('w-full rounded-xl px-3 py-2 text-left text-[11px]', selectedTheme.panelStrong)}>
                            {previewIntro ? (
                              <>
                                <p className={cn('text-[10px] uppercase tracking-[0.16em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                                  {previewPublic.coupleIntroTitle}
                                </p>
                                <p className={cn('mt-1 whitespace-pre-line leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>{previewIntro}</p>
                              </>
                            ) : null}
                            {previewStory && previewStory !== previewIntro ? (
                              <>
                                <p className={cn('text-[10px] uppercase tracking-[0.16em]', previewIntro ? 'mt-2' : '', selectedTheme.accentText, selectedTheme.textGlow)}>
                                  {previewPublic.storyTitle}
                                </p>
                                <p className={cn('mt-1 whitespace-pre-line leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>{previewStory}</p>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        {card.albumImageUrls.length > 0 ? (
                          <div className="w-full">
                            <p className={cn('mb-1 text-[10px] uppercase tracking-[0.16em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                              {previewPublic.albumTitle}
                            </p>
                            <div className="flex gap-1 overflow-x-auto pb-1">
                              {card.albumImageUrls.map((url, index) => (
                                <img
                                  key={`${url}-${index}`}
                                  src={url}
                                  alt=""
                                  className="h-14 w-11 shrink-0 rounded-md object-cover"
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {previewEvents.map((event) => {
                          const dateIso = resolveWeddingDateIso(event.loc.weddingDate)
                          const timeline = previewTimelineItems(event.loc.eventTimeline)
                          const hasDate = Boolean(dateIso || event.loc.weddingDate?.trim() || event.loc.displayTime.trim())
                          const hasPlace = Boolean(event.loc.address.trim() || event.loc.contact.trim())
                          if (!hasDate && !hasPlace && timeline.length === 0) return null
                          return (
                            <div key={event.id} className={cn('w-full min-w-0 rounded-xl px-2 py-2 text-xs', selectedTheme.panelGlass)}>
                              {previewEvents.length > 1 ? (
                                <p className={cn('mb-1 text-[10px] uppercase tracking-[0.16em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                                  {event.label}
                                </p>
                              ) : null}
                              {dateIso ? (
                                <WeddingEventCalendarBlock
                                  weddingDateIso={dateIso}
                                  weddingTimeText={event.loc.receptionTime || card.weddingTime}
                                  partyStartTime={event.loc.partyStartTime || card.partyStartTime}
                                  locale={uiLocale}
                                  tx={txCal}
                                  textGlow={selectedTheme.textGlow}
                                  onDarkPaper={Boolean(selectedTheme.darkPaper) && selectedTheme.contentCard !== 'scallop'}
                                  onCreamPaper={selectedTheme.contentCard === 'scallop'}
                                  compact
                                  countdownLive={false}
                                  className="mx-auto mb-2 w-full max-w-[240px]"
                                />
                              ) : hasDate ? (
                                <p className={cn('font-semibold', selectedTheme.textGlow)}>
                                  {[event.loc.weddingDate, event.loc.displayTime].filter(Boolean).join(' · ')}
                                </p>
                              ) : null}
                              {event.loc.address.trim() ? (
                                <p className={cn('mt-1 flex items-start justify-center gap-1 text-balance leading-5', selectedTheme.textGlow)}>
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0">{event.loc.address}</span>
                                </p>
                              ) : null}
                              {event.loc.contact.trim() ? (
                                <p className={cn('mt-1 leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>
                                  {previewPublic.contactLabel}: {event.loc.contact}
                                </p>
                              ) : null}
                              {timeline.length > 0 ? (
                                <>
                                  <p className={cn('mt-2 text-center text-[10px] uppercase tracking-[0.16em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                                    {previewPublic.timelineTitle}
                                  </p>
                                  <WeddingTimelineList
                                    compact
                                    className="mt-1"
                                    items={timeline.map((item, index) => {
                                      const content = weddingTimelineItemContent(item)
                                      return {
                                        key: `${event.label}-${item.time}-${index}`,
                                        time: item.time,
                                        label: content,
                                        content: content || null,
                                      }
                                    })}
                                    panelClassName={selectedTheme.panelStrong}
                                    textClassName={selectedTheme.text}
                                    mutedClassName={selectedTheme.mutedText}
                                    accentTextClassName={selectedTheme.accentText}
                                    textGlow={selectedTheme.textGlow}
                                  />
                                </>
                              ) : null}
                            </div>
                          )
                        })}
                        {previewDress || previewThanks ? (
                          <div className={cn('w-full rounded-xl px-3 py-2 text-left text-[11px]', selectedTheme.panelStrong)}>
                            {previewDress ? (
                              <>
                                <p className={cn('text-[10px] uppercase tracking-[0.16em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                                  {previewPublic.dressCodeTitle}
                                </p>
                                <p className={cn('mt-1 whitespace-pre-line leading-5', selectedTheme.text, selectedTheme.textGlow)}>{previewDress}</p>
                              </>
                            ) : null}
                            {previewThanks ? (
                              <>
                                <p className={cn('text-[10px] uppercase tracking-[0.16em]', previewDress ? 'mt-2' : '', selectedTheme.accentText, selectedTheme.textGlow)}>
                                  {previewPublic.thankYouTitle}
                                </p>
                                <p className={cn('mt-1 whitespace-pre-line leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>{previewThanks}</p>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex w-full flex-wrap justify-center gap-1.5 text-[10px]">
                          {card.rsvpEnabled ? <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>RSVP bật</span> : null}
                          {card.giftQrEnabled && (isInvitationGiftReady(card) || card.giftQrImageUrl.trim()) ? (
                            <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>{txGift.boxTitle}</span>
                          ) : null}
                          {(card.musicUrl || musicFile) && !musicClearOnSave ? (
                            <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>Có nhạc nền</span>
                          ) : null}
                        </div>
                      </div>
                    </WeddingReadableGlass>
                  </div>
                </div>
                )}
              </CardContent>
            </Card>
          </div>

            <Card className="min-w-0 lg:col-start-1">
              <CardHeader>
                <CardTitle>9. Link thiệp</CardTitle>
                <CardDescription>
                  Chọn dịp và bấm Tạo thiệp là có link công khai ngay. Điền tên rồi lưu cũng xuất link, không cần bấm thêm. RSVP, lời chúc, QR: 0 credit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {publishUrl ? null : (
                <Button onClick={publish} disabled={!card.id || saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Xuất link thiệp
                </Button>
                )}
                {card.id ? (
                  <>
                  <div className={singleOccasion ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-2'}>
                    <Button asChild variant="outline" className="w-full border-sky-600 bg-sky-200 font-semibold text-sky-950 hover:bg-sky-300">
                      <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(card.id)}&side=groom`}>
                        <Users className="mr-2 h-4 w-4" />
                        {occasionCopy.guestPrimary}
                      </Link>
                    </Button>
                    {singleOccasion ? null : (
                    <Button asChild variant="outline" className="w-full border-rose-600 bg-rose-200 font-semibold text-rose-950 hover:bg-rose-300">
                      <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(card.id)}&side=bride`}>
                        <Users className="mr-2 h-4 w-4" />
                        {occasionCopy.guestSecondary}
                      </Link>
                    </Button>
                    )}
                  </div>
                  </>
                ) : null}
                {publishUrl && (
                  <div className="rounded-2xl bg-muted p-3 text-sm">
                    <p className="break-all font-medium">{publishUrl}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => (singleOccasion ? openLetterView('groom') : setLetterAskOpen(true))}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Xem thiệp
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(publishUrl)}`} target="_blank" rel="noreferrer">
                          <QrCode className="mr-2 h-4 w-4" />
                          QR link thiệp
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border p-3">
                  <p className="font-semibold">RSVP đã nhận: {rsvps.length}</p>
                  <p className="text-sm text-muted-foreground">
                    Có mặt: {rsvps.filter((item) => item.attending).length} · Tổng khách: {rsvps.reduce((sum, item) => sum + item.guestCount, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
      <Dialog
        open={occasionPickerOpen}
        onOpenChange={(open) => {
          if (switchingCard) return
          setOccasionPickerOpen(open)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Thiệp này dùng cho dịp nào?</DialogTitle>
            <DialogDescription>
              Chọn một dịp rồi tạo. Tạo xong là có link công khai ngay. Form mở ra đúng tên và địa điểm của dịp đó.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {INVITATION_OCCASION_GROUPS.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.keys.map((key) => {
                    const copy = invitationEditorCopy(key)
                    const selected = pickedOccasion === key
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-left',
                          selected ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200' : 'border-slate-200 bg-white hover:bg-slate-50',
                        )}
                        onClick={() => setPickedOccasion(key)}
                      >
                        <span className="block text-sm font-medium text-slate-950">{copy.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{copy.blurb}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={switchingCard} onClick={() => setOccasionPickerOpen(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              disabled={switchingCard || saving}
              onClick={() =>
                void createFreshCard(pickedOccasion)
              }
            >
              {switchingCard ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Tạo thiệp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={occasionShapePrompt != null} onOpenChange={(open) => { if (!open) setOccasionShapePrompt(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi loại thiệp?</DialogTitle>
            <DialogDescription>
              {occasionShapePrompt
                ? `Từ «${invitationEditorCopy(occasionKey).label}» sang «${invitationEditorCopy(occasionShapePrompt).label}». ${invitationOccasionShapeChangeNote(occasionKey, occasionShapePrompt) ?? ''}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOccasionShapePrompt(null)}>
              Giữ loại hiện tại
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!occasionShapePrompt) return
                const next = occasionShapePrompt
                setCard((prev) => ({
                  ...prev,
                  occasionKey: next,
                  sectionConfig:
                    invitationOccasionShape(next) === 'single'
                      ? mergeWeddingSectionConfig(prev.sectionConfig, { heroPhotoLayout: 'single' })
                      : prev.sectionConfig,
                }))
                setOccasionShapePrompt(null)
              }}
            >
              Đổi loại thiệp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={letterAskOpen} onOpenChange={setLetterAskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xem thử</DialogTitle>
            <DialogDescription>
              {occasionKey === 'wedding'
                ? 'Chọn nhà trai hoặc nhà gái để mở xem thử.'
                : `Chọn ${occasionCopy.letterPrimary} hoặc ${occasionCopy.letterSecondary} để mở xem thử.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="border-sky-600 bg-sky-200 font-semibold text-sky-950 hover:bg-sky-300" onClick={() => openLetterView('groom')}>
              {occasionCopy.letterPrimary}
            </Button>
            <Button type="button" variant="outline" className="border-rose-600 bg-rose-200 font-semibold text-rose-950 hover:bg-rose-300" onClick={() => openLetterView('bride')}>
              {occasionCopy.letterSecondary}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {previewFab}
    </>
    </WeddingCreditTopUpProvider>
  )
}

function FrameSizeControl(props: {
  label: string
  zoomOutLabel: string
  zoomInLabel: string
  value: number
  onChange: (scale: number) => void
}) {
  const setScale = (value: number) => props.onChange(clampWeddingFrameScale(value))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{props.label}</span>
        <span>{Math.round(props.value * 100)}%</span>
      </div>
      <Input
        type="range"
        min={String(0.6)}
        max={String(1.4)}
        step="0.05"
        value={props.value}
        onChange={(event) => setScale(Number(event.target.value))}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setScale(props.value - 0.1)}>
          {props.zoomOutLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setScale(props.value + 0.1)}>
          {props.zoomInLabel}
        </Button>
      </div>
    </div>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input type={props.type ?? 'text'} value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} />
    </div>
  )
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border p-3">
      <Label>{props.label}</Label>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  )
}

function DeviceImagePicker(props: {
  label: ReactNode
  className?: string
  multiple?: boolean
  accept?: string
  disabled?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <WeddingDeviceFileInput
      className={cn('gap-2', props.className)}
      label={props.label}
      accept={props.accept}
      multiple={props.multiple}
      disabled={props.disabled}
      onFiles={props.onFiles}
    />
  )
}

function ImageUploadField(props: {
  label: string
  inputId?: string
  currentUrl: string
  file?: File | null
  frame?: 'wide' | 'portrait'
  crop?: {
    positionX: number
    positionY: number
    scale: number
    onChange: (patch: { positionX?: number; positionY?: number; scale?: number }) => void
  }
  onFileChange: (file: File | null) => void
  onRemove?: () => void
  choosePhotoLabel?: string
  chooseFrameLabel?: string
  onChooseFrame?: () => void
  shell?: WeddingPortraitShellFrame | null
  frameScale?: number
  frameScaleEdit?: FrameScaleEdit
}) {
  const previewUrl = props.file ? URL.createObjectURL(props.file) : props.currentUrl
  const portrait = props.frame === 'portrait'
  const shell = props.shell ?? null
  const photoActions = (
    <div
      className={cn(
        'pointer-events-auto flex justify-center gap-1.5',
        shell ? 'relative z-20 mt-2' : 'absolute inset-x-0 bottom-2 z-20 px-2',
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <WeddingDeviceFileInput
        inputId={props.inputId}
        className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-stone-800 shadow"
        label={props.choosePhotoLabel ?? 'Chọn ảnh'}
        onFiles={(files) => {
          const file = files[0]
          if (file) props.onFileChange(file)
        }}
      />
      {props.onChooseFrame ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={props.onChooseFrame}
          className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-stone-800 shadow"
        >
          {props.chooseFrameLabel}
        </button>
      ) : null}
    </div>
  )
  const framedClass = 'relative mx-auto w-full max-w-sm cursor-grab touch-none active:cursor-grabbing'
  return (
    <div className="space-y-2 rounded-2xl border p-3">
      <Label>{props.label}</Label>
      {previewUrl && props.crop ? (
        <CoverPhotoCropEditor
          bare
          imageUrl={previewUrl}
          alt={props.label}
          positionX={props.crop.positionX}
          positionY={props.crop.positionY}
          scale={props.crop.scale}
          onChange={props.crop.onChange}
          title="Kéo và zoom"
          hint="Kéo ảnh để đổi vị trí. Thanh Cỡ khung chỉ đổi khung. Thanh zoom chỉ phóng ảnh."
          ariaLabel={`Căn ${props.label}`}
          resetFrame={{ positionX: 50, positionY: 18, scale: 1 }}
          shell={shell}
          frameScale={props.frameScale}
          frameScaleEdit={props.frameScaleEdit}
          frameClassName={
            shell
              ? framedClass
              : 'relative mx-auto aspect-[3/4] max-h-72 w-full cursor-grab touch-none overflow-hidden rounded-xl bg-black/5 shadow-inner ring-1 ring-black/10 active:cursor-grabbing'
          }
          frameActions={photoActions}
        />
      ) : shell ? (
        <div className="mx-auto w-full max-w-sm">
          <div className="flex w-full justify-center">
          <div className="relative shrink-0" style={{ width: `${Math.round((props.frameScale ?? 1) * 1000) / 10}%` }}>
            <WeddingFramedPhoto
              frameSrc={shell.src}
              hole={shell.hole}
              photoUrl={previewUrl}
              alt={props.label}
              frameScale={1}
              className="w-full max-w-none"
            />
            {props.frameScaleEdit ? <FrameEdgeGrips edit={props.frameScaleEdit} /> : null}
            {photoActions}
          </div>
          </div>
          {props.frameScaleEdit ? <FrameScaleDragBar edit={props.frameScaleEdit} /> : null}
        </div>
      ) : (
        <>
        <div className="flex w-full justify-center">
        <div
          className={cn(
            'relative shrink-0 overflow-hidden rounded-xl',
            portrait ? 'aspect-[3/4] max-h-72' : 'h-36',
          )}
          style={{ width: `${Math.round((props.frameScale ?? 1) * 1000) / 10}%` }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={props.label}
              className={cn('h-full w-full object-cover', portrait && 'object-[center_18%]')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
              Chưa có ảnh
            </div>
          )}
          {props.frameScaleEdit ? <FrameEdgeGrips edit={props.frameScaleEdit} /> : null}
          {photoActions}
        </div>
        </div>
        {props.frameScaleEdit ? <FrameScaleDragBar edit={props.frameScaleEdit} /> : null}
        </>
      )}
      {props.onRemove && previewUrl ? (
        <Button type="button" variant="outline" size="sm" onClick={props.onRemove}>
          Gỡ ảnh
        </Button>
      ) : null}
    </div>
  )
}

function CoverPhotoCropEditor(props: {
  imageUrl: string
  alt: string
  positionX: number
  positionY: number
  scale: number
  onChange: (patch: { positionX?: number; positionY?: number; scale?: number }) => void
  title?: string
  hint?: string
  frameClassName?: string
  ariaLabel?: string
  bare?: boolean
  resetFrame?: { positionX: number; positionY: number; scale: number }
  frameActions?: ReactNode
  shell?: WeddingPortraitShellFrame | null
  frameScale?: number
  frameScaleEdit?: FrameScaleEdit
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    positionX: number
    positionY: number
  } | null>(null)

  const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
  const clampScale = (value: number) => Math.max(1, Math.min(3, Math.round(value * 100) / 100))
  const objectPosition = `${props.positionX}% ${props.positionY}%`

  const setScale = (value: number) => props.onChange({ scale: clampScale(value) })

  const resetFrame = props.resetFrame ?? { positionX: 50, positionY: 50, scale: 1 }

  return (
    <div className={props.bare ? 'space-y-3' : 'space-y-3 rounded-2xl border bg-muted/20 p-3'}>
      <div>
        <Label className="text-sm">{props.title ?? 'Căn ảnh trực tiếp trên vỏ thiệp'}</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {props.hint ??
            'Kéo ảnh để đổi vị trí. Lăn chuột hoặc dùng thanh zoom để phóng to/thu nhỏ. Double click để zoom nhanh.'}
        </p>
      </div>

      <div className="flex w-full justify-center">
      <div
        ref={frameRef}
        className={cn(
          'shrink-0',
          props.frameClassName ??
            'relative h-40 cursor-grab touch-none overflow-hidden rounded-2xl bg-black/5 shadow-inner ring-1 ring-black/10 active:cursor-grabbing sm:h-48',
        )}
        style={{ touchAction: 'none', width: `${Math.round((props.frameScale ?? 1) * 1000) / 10}%`, maxWidth: 'none' }}
        role="application"
        aria-label={props.ariaLabel ?? 'Căn ảnh vỏ thiệp'}
        onPointerDown={(event) => {
          const target = event.target
          if (target instanceof Element && target.closest('button, label, input, a, [data-wedding-file-anchor]')) return
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            positionX: props.positionX,
            positionY: props.positionY,
          }
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            /* kéo vẫn cập nhật vị trí khi trình duyệt không giữ pointer */
          }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          const frame = frameRef.current
          if (!drag || drag.pointerId !== event.pointerId || !frame) return
          const rect = frame.getBoundingClientRect()
          const sensitivity = 100 / Math.max(1, props.scale)
          const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * sensitivity
          const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * sensitivity
          props.onChange({
            positionX: clampPercent(drag.positionX - dx),
            positionY: clampPercent(drag.positionY - dy),
          })
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
          try {
            event.currentTarget.releasePointerCapture(event.pointerId)
          } catch {
            /* ignore */
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
        onWheel={(event) => {
          event.preventDefault()
          setScale(props.scale + (event.deltaY > 0 ? -0.08 : 0.08))
        }}
        onDoubleClick={() => setScale(props.scale >= 1.8 ? 1 : 2)}
      >
        {props.shell ? (
          <WeddingFramedPhoto
            frameSrc={props.shell.src}
            hole={props.shell.hole}
            photoUrl={props.imageUrl}
            alt={props.alt}
            objectPosition={objectPosition}
            scale={props.scale}
            frameScale={1}
            className="pointer-events-none w-full max-w-none"
          />
        ) : (
          <>
            <img
              src={props.imageUrl}
              alt={props.alt}
              draggable={false}
              className="h-full w-full select-none object-cover"
              style={{
                objectPosition,
                transform: `scale(${props.scale})`,
                transformOrigin: objectPosition,
              }}
            />
            <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/70" aria-hidden />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/65" aria-hidden />
            <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/65" aria-hidden />
          </>
        )}
        {props.frameScaleEdit ? <FrameEdgeGrips edit={props.frameScaleEdit} /> : null}
        {props.frameActions}
      </div>
      </div>
      {props.frameScaleEdit ? <FrameScaleDragBar edit={props.frameScaleEdit} /> : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Zoom</span>
          <span>{Math.round(props.scale * 100)}%</span>
        </div>
        <Input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={props.scale}
          onChange={(event) => setScale(Number(event.target.value))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setScale(props.scale - 0.1)}>
          Thu nhỏ
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setScale(props.scale + 0.1)}>
          Phóng to
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => props.onChange(resetFrame)}
        >
          Đưa về giữa ảnh
        </Button>
      </div>
    </div>
  )
}
