'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type SetStateAction } from 'react'
import { Eye, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  applyWeddingBackgroundFromLibrary,
  saveWeddingCardOrnaments,
  createNewWeddingCard,
  deleteWeddingCard,
  loadWeddingCardFacts,
  loadWeddingCardWorkspace,
  publishCurrentWeddingCard,
  saveWeddingCardBrief,
  composeWeddingSampleCopy,
} from './actions'
import { DepositCreditPopup } from '@/components/deposit-credit-popup'
import { WeddingCreditTopUpProvider } from '@/components/wedding/wedding-credit-topup'
import { WeddingAiLibraryGrid } from '@/components/wedding/wedding-ai-library-grid'
import type { WeddingAiImage, WeddingBackgroundLibraryItem, WeddingCard, WeddingCardSummary, WeddingCoverFrameLibraryItem, WeddingMusicLibraryRow, WeddingRsvp } from '@/lib/db/wedding-cards-pg'
import { WeddingDraggableFab } from '@/components/wedding/wedding-draggable-fab'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { formatWeddingMusicSecondsForInput } from '@/lib/wedding/parse-music-play-time'
import { invitationComposeNamesReady } from '@/lib/wedding/invitation-compose'
import {
  INVITATION_OCCASION_GROUPS,
  INVITATION_OCCASION_KEYS,
  invitationCardStructure,
  invitationEditorCopy,
  invitationOccasionShape,
  invitationOccasionShapeChangeNote,
  invitationShowsSecondVenue,
  normalizeInvitationOccasion,
  type InvitationOccasionKey,
} from '@/lib/wedding/invitation-occasion'
import { omitWeddingAddressesFromSharedCopy, stripSharedWeddingCopy, weddingSharedCopyAddresses } from '@/lib/wedding/wedding-shared-copy'
import { resolveWeddingDateIso } from '@/lib/wedding/wedding-date-normalize'
import { WEDDING_MOBILE_HEIGHT, WEDDING_MOBILE_WIDTH } from '@/lib/wedding/wedding-design-viewport'
import { splitLibraryByRecommendation } from '@/lib/wedding/wedding-ai-library-match'
import { WeddingLandingThemes } from '@/components/wedding/wedding-landing-themes'
import { WeddingSampleGallery, WeddingSampleLookStrip } from '@/components/wedding/wedding-sample-card-picker'
import { WeddingSampleDemoFrame } from '@/components/wedding/wedding-sample-demo-bar'
import { weddingCardOrnamentLayoutKey, weddingOrnamentDeviceKey, weddingOrnamentLayoutKey, weddingOrnamentSurfaceKey } from '@/lib/wedding/wedding-background-ornament-store'
import { publishWeddingOrnamentTruth, subscribeWeddingOrnamentTruth } from '@/lib/wedding/wedding-ornament-sync'
import { findWeddingSampleCard, findWeddingSampleInUse, isWeddingSamplePhotoUrl, stripWeddingSamplePhotos, weddingLibrarySampleSectionPatch, weddingOccasionDemos, weddingSampleCardTitle, weddingSampleScrollStrip, weddingSamplesWithActiveFirst, WEDDING_SAMPLE_CARDS } from '@/lib/wedding/wedding-sample-cards'
import { clearPendingWeddingSampleUse, readPendingWeddingSampleUse, weddingSavedCardQueryId } from '@/lib/wedding/wedding-sample-use-target'
import { WeddingSampleComposeModal } from '@/components/wedding/wedding-sample-compose-modal'
import { capitalizeInvitationPersonName } from '@/lib/wedding/capitalize-person-name'
import {
  applyComposeCopyToCard,
  carryWeddingSampleFacts,
  newCardComposeSources,
  preferComposeFieldValue,
  resolveWeddingSampleNameReuse,
  weddingCardOpeningFromCompose,
  weddingComposeCopyHasWords,
  weddingComposeNamesOnly,
  type WeddingSampleComposeFields,
} from '@/lib/wedding/wedding-sample-compose'
import { isWeddingInsufficientCredit } from '@/lib/wedding/wedding-credit-shortfall'
import { findWeddingBackgroundPreset, findWeddingFrameForBackground, resolveWeddingChromeKit, weddingAiBackgroundKit, weddingAiKitSectionPatch, weddingPairedFrameSectionPatch, weddingReadyBackgroundSectionPatch, weddingUsesPairedAiFrame, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { weddingStyleIdFromPrompt } from '@/lib/wedding/build-wedding-image-prompt'
import {
  appendWeddingSideInviteSettingsToFormData,
  EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
  ownSidePartyFields,
  weddingSideInviteSettingsFromCard,
} from '@/lib/wedding/wedding-side-invite-settings'
import {
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  resolveCoverAiFrame,
  coverPhotoUrlUnlessBackground,
  resolveCoverPhotoUrl,
  resolvePortraitFrameScale,
  clearWeddingFrameChoice,
  resolveShownCoverFrame,
} from '@/lib/wedding/wedding-section-config'
import type { WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'
import { buildWeddingDemoPersonalInvite } from '@/lib/wedding/build-personal-wedding-invite'
import {
  getWeddingStylePreset,
  WEDDING_STYLE_PRESETS,
} from '@/lib/wedding/wedding-style-presets'
import { type WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
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

function mergeServerCardWithLocalDraft(serverCard: WeddingCard, draftCard: WeddingCard, draftSavedAt?: number): WeddingCard {
  const merged: WeddingCard = {
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
  const serverMs = Date.parse(serverCard.updatedAt || '')
  const draftOlder = Number.isFinite(serverMs) && draftSavedAt != null && draftSavedAt + 1000 < serverMs
  if (!draftOlder) return merged
  const keep = (key: 'groomName' | 'brideName' | 'coupleIntro' | 'loveQuote' | 'storyText' | 'thankYouText') => {
    if (!draftCard[key].trim() && serverCard[key].trim()) merged[key] = serverCard[key]
  }
  keep('groomName')
  keep('brideName')
  keep('coupleIntro')
  keep('loveQuote')
  keep('storyText')
  keep('thankYouText')
  return merged
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

function weddingQuickViewHref(slug: string, side: 'groom' | 'bride') {
  const params = new URLSearchParams({
    demo: '1',
    view: side,
    venue: side === 'bride' ? 'bride_home' : 'groom_home',
  })
  return `/thiep-moi-cuoi/${encodeURIComponent(slug)}?${params.toString()}`
}

function readComposeField(id: string, stateValue: string): string {
  if (typeof document === 'undefined') return stateValue.trim()
  const el = document.getElementById(id)
  const domValue = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : ''
  return preferComposeFieldValue(stateValue, domValue)
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

function forgetCardInUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('cardId')) return
  url.searchParams.delete('cardId')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

/** Giữ thiệp vừa tạo qua lần Next làm mới trang sau server action. Không sống qua F5. */
const LIVE_WORKSPACE_MS = 20000
type LiveWorkspace = {
  at: number
  epoch: number
  card: WeddingCard
  images: WeddingAiImage[]
  rsvps: WeddingRsvp[]
  library: WeddingBackgroundLibraryItem[]
  frameLibrary: WeddingCoverFrameLibraryItem[]
  musicLibrary: WeddingMusicLibraryRow[]
  cards: WeddingCardSummary[]
  ornamentLayouts: Record<string, WeddingBackgroundOrnament[]>
  sharedFrames: Record<string, WeddingSharedFrame>
  ornamentAdmin: boolean
}
let liveWorkspace: LiveWorkspace | null = null
const liveWorkspaceListeners = new Set<(snapshot: LiveWorkspace) => void>()
/** Id vừa xóa. Sống qua lần Next làm mới trang sau server action, để thiệp đã xóa không hiện lại. */
const tombstoneCardIds = new Set<string>()

function markWeddingCardDeleted(cardId: string) {
  if (!cardId) return
  tombstoneCardIds.add(cardId)
  if (!liveWorkspace) return
  if (liveWorkspace.card.id === cardId) {
    liveWorkspace = null
    return
  }
  liveWorkspace = {
    ...liveWorkspace,
    at: Date.now(),
    cards: liveWorkspace.cards.filter((item) => item.id !== cardId),
  }
}

function unmarkWeddingCardDeleted(cardId: string) {
  tombstoneCardIds.delete(cardId)
}

function visibleSavedCards(cards: WeddingCardSummary[]) {
  return cards.filter((item) => item.id && !tombstoneCardIds.has(item.id))
}
let savedCardListEpoch = 0
type SavedCardListSnap = { cards: WeddingCardSummary[]; epoch: number; seq: number }
const SAVED_CARD_LIST_SERVER: SavedCardListSnap = { cards: [], epoch: 0, seq: 0 }
let savedCardListSnap: SavedCardListSnap = SAVED_CARD_LIST_SERVER
const savedCardListListeners = new Set<() => void>()

function freshLiveWorkspace() {
  if (typeof window === 'undefined' || !liveWorkspace) return null
  if (Date.now() - liveWorkspace.at > LIVE_WORKSPACE_MS) return null
  if (tombstoneCardIds.has(liveWorkspace.card.id)) return null
  const cards = visibleSavedCards(liveWorkspace.cards)
  if (cards.length !== liveWorkspace.cards.length) liveWorkspace = { ...liveWorkspace, cards }
  return liveWorkspace
}

function beginSavedCardListWrite() {
  savedCardListEpoch += 1
  return savedCardListEpoch
}

function publishSavedCardList(cards: WeddingCardSummary[], epoch: number) {
  if (epoch < savedCardListSnap.epoch) return
  savedCardListSnap = { cards, epoch, seq: savedCardListSnap.seq + 1 }
  savedCardListListeners.forEach((listener) => listener())
}

function subscribeSavedCardList(listener: () => void) {
  savedCardListListeners.add(listener)
  return () => {
    savedCardListListeners.delete(listener)
  }
}

function getSavedCardListSnap() {
  return savedCardListSnap
}

function getSavedCardListServerSnap() {
  return SAVED_CARD_LIST_SERVER
}

/** Thiệp vừa tạo chưa có trong payload cũ thì giữ ở đầu danh sách. */
function mergeLocalCardsFirst(current: WeddingCardSummary[], incoming: WeddingCardSummary[]) {
  const incomingIds = new Set(incoming.map((item) => item.id))
  const onlyLocal = current.filter((item) => item.id && !incomingIds.has(item.id) && !tombstoneCardIds.has(item.id))
  return [...onlyLocal, ...incoming.filter((item) => !tombstoneCardIds.has(item.id))]
}

function publishLiveWorkspace(snapshot: Omit<LiveWorkspace, 'at' | 'epoch'>) {
  const next = { ...snapshot, at: Date.now(), epoch: savedCardListEpoch }
  liveWorkspace = next
  liveWorkspaceListeners.forEach((listener) => listener(next))
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
  const seededWorkspaceRef = useRef<LiveWorkspace | null | undefined>(undefined)
  if (seededWorkspaceRef.current === undefined) seededWorkspaceRef.current = freshLiveWorkspace()
  const seededWorkspace = seededWorkspaceRef.current
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<WebLocale>(DEFAULT_WEB_LOCALE)
  const [card, setCard] = useState<WeddingCard>(() => seededWorkspace?.card ?? emptyBrief())
  const [savedCards, setSavedCardsState] = useState<WeddingCardSummary[]>(() => {
    const initial = seededWorkspace?.cards ?? []
    if (typeof window !== 'undefined' && savedCardListSnap.seq === 0 && initial.length > 0) {
      savedCardListSnap = { cards: initial, epoch: savedCardListEpoch, seq: 1 }
    }
    return savedCardListSnap.seq > 0 ? savedCardListSnap.cards : initial
  })
  const savedCardsStateRef = useRef(savedCards)
  savedCardsStateRef.current = savedCards
  const liveSavedList = useSyncExternalStore(subscribeSavedCardList, getSavedCardListSnap, getSavedCardListServerSnap)
  const savedCardList = liveSavedList.seq > 0 ? liveSavedList.cards : savedCards
  const setSavedCards = (value: SetStateAction<WeddingCardSummary[]>, epoch = savedCardListEpoch) => {
    if (epoch < savedCardListEpoch) return
    const source = savedCardListSnap.seq > 0 ? savedCardListSnap.cards : savedCardsStateRef.current
    const next = typeof value === 'function' ? value(source) : value
    publishSavedCardList(next, epoch)
    setSavedCardsState(next)
  }
  const [switchingCard, setSwitchingCard] = useState(false)
  const [images, setImages] = useState<WeddingAiImage[]>(() => seededWorkspace?.images ?? [])
  const [library, setLibrary] = useState<WeddingBackgroundLibraryItem[]>(() => seededWorkspace?.library ?? [])
  const [, setOrnamentLayouts] = useState<Record<string, WeddingBackgroundOrnament[]>>(
    () => seededWorkspace?.ornamentLayouts ?? {},
  )
  const [coverDraft, setCoverDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [letterDraft, setLetterDraft] = useState<WeddingBackgroundOrnament[] | null>(null)
  const [, setOrnamentSaving] = useState(false)
  const [frameLibrary, setFrameLibrary] = useState<WeddingCoverFrameLibraryItem[]>(() => seededWorkspace?.frameLibrary ?? [])
  const [sharedFrames, setSharedFrames] = useState<Record<string, WeddingSharedFrame>>(() => seededWorkspace?.sharedFrames ?? {})
  const [ornamentAdmin, setOrnamentAdmin] = useState(() => Boolean(seededWorkspace?.ornamentAdmin))
  const [backgroundPageOpen, setBackgroundPageOpen] = useState(false)
  const [backgroundNotice, setBackgroundNotice] = useState<{
    title: string
    description?: string
    error?: boolean
  } | null>(null)
  const [backgroundConfirmOpen, setBackgroundConfirmOpen] = useState(false)
  const [backgroundPreviewLarge, setBackgroundPreviewLarge] = useState(false)
  const [samplePreviewId, setSamplePreviewId] = useState<string | null>(null)
  const [pickedSampleId, setPickedSampleId] = useState<string | null>(null)
  const pendingSampleUseRef = useRef('')
  const forceAskNamesRef = useRef(false)
  const sampleApplyLockRef = useRef(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeCreate, setComposeCreate] = useState(false)
  const [composeOccasion, setComposeOccasion] = useState<InvitationOccasionKey>('wedding')
  const [composeSampleId, setComposeSampleId] = useState('')
  const [composeReturnPreview, setComposeReturnPreview] = useState(false)
  const [composeGroom, setComposeGroom] = useState('')
  const [composeBride, setComposeBride] = useState('')
  const [composeDate, setComposeDate] = useState('')
  const [composeStory, setComposeStory] = useState('')
  const [composeNameError, setComposeNameError] = useState(false)
  const [composeBusy, setComposeBusy] = useState(false)
  const [applyingLibraryId, setApplyingLibraryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !seededWorkspace)
  const [saving, setSaving] = useState(false)
  const [previewLetterView, setPreviewLetterView] = useState<'groom' | 'bride'>('groom')
  const [letterAskOpen, setLetterAskOpen] = useState(false)
  const [quickViewAsk, setQuickViewAsk] = useState<{ slug: string; occasionKey: string } | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const previewBusyRef = useRef(false)
  const [occasionPickerOpen, setOccasionPickerOpen] = useState(false)
  const [pickedOccasion, setPickedOccasion] = useState<InvitationOccasionKey>('wedding')
  const [occasionShapePrompt, setOccasionShapePrompt] = useState<InvitationOccasionKey | null>(null)
  const [creditTopUpOpen, setCreditTopUpOpen] = useState(false)
  const creditTopUpOpenRef = useRef(false)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicClearOnSave, setMusicClearOnSave] = useState(false)
  const [musicStartInput, setMusicStartInput] = useState('')
  const [musicEndInput, setMusicEndInput] = useState('')
  const [albumImageFiles, setAlbumImageFiles] = useState<File[]>([])
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [coverClearOnSave, setCoverClearOnSave] = useState(false)
  const [groomPortraitFile, setGroomPortraitFile] = useState<File | null>(null)
  const [bridePortraitFile, setBridePortraitFile] = useState<File | null>(null)
  const [groomPortraitClear, setGroomPortraitClear] = useState(false)
  const [bridePortraitClear, setBridePortraitClear] = useState(false)

  useEffect(() => {
    setUiLocale(readWebLocaleFromDocumentCookie())
  }, [])
  const tBrief = useMemo(() => getDictionary(uiLocale).weddingCardAiBrief, [uiLocale])
  const tImage = useMemo(() => getDictionary(uiLocale).weddingCardAiImage, [uiLocale])
  const tLanding = useMemo(() => getDictionary(uiLocale).weddingCardAiLanding, [uiLocale])
  const txPublic = useMemo(() => getDictionary(uiLocale).weddingCardPublic, [uiLocale])
  const emptySampleThemes = useMemo(
    () =>
      INVITATION_OCCASION_KEYS.flatMap((occasionKey) =>
        weddingOccasionDemos(occasionKey).map((sample) => ({
          id: sample.id,
          title: weddingSampleCardTitle(uiLocale, sample),
          image: weddingSampleScrollStrip(sample),
          cover: sample.coverPhotoUrl,
          occasionKey,
        })),
      ).filter((item) => item.title && item.image),
    [uiLocale],
  )

  useEffect(() => {
    const fmt = (n: number | null) => (n != null && Number.isFinite(n) ? String(n) : '')
    setMusicStartInput(fmt(card.musicPlayStartSec))
    setMusicEndInput(fmt(card.musicPlayEndSec))
  }, [card.id, card.musicPlayStartSec, card.musicPlayEndSec])

  const applyLiveWorkspaceRef = useRef<(snapshot: LiveWorkspace) => void>(() => {})
  const showEmptyWorkspaceRef = useRef<(cards?: WeddingCardSummary[]) => void>(() => {})
  applyLiveWorkspaceRef.current = (snapshot) => {
    if (snapshot.epoch < savedCardListEpoch) return
    if (tombstoneCardIds.has(snapshot.card.id)) return
    setCard(snapshot.card)
    setImages(snapshot.images)
    setLibrary(snapshot.library)
    setOrnamentLayouts(snapshot.ornamentLayouts)
    setFrameLibrary(snapshot.frameLibrary)
    setSharedFrames(snapshot.sharedFrames)
    setOrnamentAdmin(snapshot.ornamentAdmin)
    setSavedCards(visibleSavedCards(snapshot.cards), snapshot.epoch)
    setLoading(false)
    rememberCardInUrl(snapshot.card.id)
  }
  useEffect(() => {
    const onLive = (snapshot: LiveWorkspace) => applyLiveWorkspaceRef.current(snapshot)
    liveWorkspaceListeners.add(onLive)
    return () => {
      liveWorkspaceListeners.delete(onLive)
    }
  }, [])

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const rawCardId = search.get('cardId')?.trim() || ''
    const requestedId = weddingSavedCardQueryId(rawCardId)
    const sampleCardLink = rawCardId.startsWith('sample:')
    const pendingSample = readPendingWeddingSampleUse(window.location.search, window.sessionStorage)
    const useSample = pendingSample.id
    const openSamples = search.get('openSamples') === '1'
    if (useSample || openSamples || sampleCardLink) {
      if (useSample) pendingSampleUseRef.current = useSample
      if (pendingSample.askNames) forceAskNamesRef.current = true
      if (openSamples) setBackgroundPageOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('useSample')
      url.searchParams.delete('askNames')
      url.searchParams.delete('openSamples')
      if (sampleCardLink) url.searchParams.delete('cardId')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
    const epochAtLoad = savedCardListEpoch
    const liveNow = freshLiveWorkspace()
    if (liveNow) {
      applyLiveWorkspaceRef.current(liveNow)
      return
    }
    let mounted = true
    const showLoadedWorkspace = (result: Exclude<Awaited<ReturnType<typeof loadWeddingCardWorkspace>>, { error: string } | { empty: true }>) => {
      if (epochAtLoad < savedCardListEpoch) return
      lastSavedPersistRef.current = buildSavedSnapshotForCard(result.card)
      baselineHydratedRef.current = true
      const localDraft = readWeddingLocalDraft(result.card.id)
      const baseCard = localDraft
        ? mergeServerCardWithLocalDraft(result.card, localDraft.card, localDraft.savedAt)
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
      setSavedCards((prev) => mergeLocalCardsFirst(prev, result.cards), epochAtLoad)
      rememberCardInUrl(result.card.id)
    }
    void (async () => {
      try {
        const openId = requestedId && !tombstoneCardIds.has(requestedId) ? requestedId : ''
        let result = await loadWeddingCardWorkspace(openId)
        if (!mounted) return
        if ('error' in result && requestedId && result.error?.includes('Không tìm thấy thiệp')) {
          clearWeddingLocalDraft(requestedId)
          forgetCardInUrl()
          result = await loadWeddingCardWorkspace('')
          if (!mounted) return
          if ('empty' in result) {
            toast({
              title: 'Thiệp trong link không còn',
              description: 'Chưa có thiệp nào. Bấm Tạo thiệp mới khi muốn làm thiệp.',
            })
          } else if (!('error' in result)) {
            const named = result.cards.some((item) => item.groomName.trim() || item.brideName.trim())
            toast({
              title: named ? 'Thiệp trong link không còn' : 'Đã mở trang tạo thiệp',
              description: named
                ? 'Đã mở thiệp gần nhất trong danh sách.'
                : 'Thiệp cũ đã xóa. Bấm Tạo thiệp mới khi muốn làm thiệp.',
            })
          }
        }
        if (!('error' in result) && !('empty' in result) && tombstoneCardIds.has(result.card.id)) {
          const rest = visibleSavedCards(result.cards)
          result = rest[0] ? await loadWeddingCardWorkspace(rest[0].id) : { empty: true as const, cards: [] }
          if (!mounted) return
        }
        const live = freshLiveWorkspace()
        if (live && ('error' in result || 'empty' in result || result.card.id !== live.card.id)) {
          applyLiveWorkspaceRef.current(live)
          return
        }
        if ('empty' in result) {
          if (pendingSampleUseRef.current) {
            const created = await createNewWeddingCard()
            if (!mounted) return
            if (!('error' in created)) {
              showLoadedWorkspace(created)
              return
            }
          }
          showEmptyWorkspaceRef.current(result.cards)
          return
        }
        if ('error' in result) {
          toast({ title: 'Không mở được thiệp', description: result.error, variant: 'destructive' })
          return
        }
        showLoadedWorkspace(result)
      } catch (error: unknown) {
        if (!mounted) return
        toast({
          title: 'Không mở được thiệp',
          description: error instanceof Error ? error.message : 'Không tải được danh sách thiệp.',
          variant: 'destructive',
        })
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- chỉ hydrate thiệp một lần khi mở trang

  const masterImage = images.find((image) => image.id === card.masterImageId) ?? images.find((image) => image.type === 'master')
  const sectionConfig = useMemo(() => parseWeddingSectionConfig(card.sectionConfig), [card.sectionConfig])
  const activeSample = useMemo(
    () => findWeddingSampleInUse({
      backgroundPresetId: sectionConfig.backgroundPresetId,
      backgroundKitStyleId: sectionConfig.backgroundKitStyleId,
      masterImageUrl: masterImage?.imageUrl,
      occasionKey: card.occasionKey,
    }),
    [sectionConfig.backgroundPresetId, sectionConfig.backgroundKitStyleId, masterImage?.imageUrl, card.occasionKey],
  )
  const sampleChoices = useMemo(
    () => weddingSamplesWithActiveFirst(weddingOccasionDemos(card.occasionKey), activeSample?.id),
    [activeSample?.id, card.occasionKey],
  )
  useEffect(() => {
    setPickedSampleId(null)
  }, [activeSample?.id])
  const demoSampleId = pickedSampleId || activeSample?.id || ''
  const readyBackground = resolveWeddingChromeKit(sectionConfig)
  const ornamentKey = weddingOrnamentLayoutKey({
    backgroundPresetId: sectionConfig.backgroundPresetId,
    backgroundKitStyleId: sectionConfig.backgroundKitStyleId,
    masterImageUrl: masterImage?.imageUrl,
  })
  const cardBaseKey = weddingCardOrnamentLayoutKey(card.id)
  const coverCardKey = weddingOrnamentSurfaceKey(cardBaseKey, 'mobile', 'cover')
  const letterCardKey = weddingOrnamentSurfaceKey(cardBaseKey, 'mobile', 'letter')
  const coverSharedKey = weddingOrnamentSurfaceKey(ornamentKey, 'mobile', 'cover')
  const letterSharedKey = weddingOrnamentSurfaceKey(ornamentKey, 'mobile', 'letter')
  const legacyCoverCardKey = weddingOrnamentDeviceKey(cardBaseKey, 'mobile')
  const coverDraftRef = useRef(coverDraft)
  const letterDraftRef = useRef(letterDraft)
  const ornamentSyncRef = useRef({ source: '', ornamentKey: '' })
  if (!ornamentSyncRef.current.source) ornamentSyncRef.current.source = Math.random().toString(36).slice(2)
  ornamentSyncRef.current.ornamentKey = ornamentKey
  coverDraftRef.current = coverDraft
  letterDraftRef.current = letterDraft
  const ornamentKeyRef = useRef(ornamentKey)
  useEffect(() => {
    if (ornamentKeyRef.current === ornamentKey) return
    ornamentKeyRef.current = ornamentKey
    setCoverDraft(null)
    setLetterDraft(null)
  }, [ornamentKey])
  useEffect(() => {
    if (!card.id || !coverDraft) return
    publishWeddingOrnamentTruth({
      source: ornamentSyncRef.current.source,
      cardId: card.id,
      surface: 'cover',
      template: ornamentAdmin,
      ornaments: coverDraft,
    })
  }, [card.id, coverDraft, ornamentAdmin])
  useEffect(() => {
    if (!card.id || !letterDraft) return
    publishWeddingOrnamentTruth({
      source: ornamentSyncRef.current.source,
      cardId: card.id,
      surface: 'letter',
      template: ornamentAdmin,
      ornaments: letterDraft,
    })
  }, [card.id, letterDraft, ornamentAdmin])
  useEffect(() => {
    if (!card.id) return
    return subscribeWeddingOrnamentTruth(card.id, ornamentSyncRef.current.source, (message) => {
      if (message.surface === 'cover' && coverDraftRef.current) return
      if (message.surface === 'letter' && letterDraftRef.current) return
      const cardKey = weddingOrnamentSurfaceKey(weddingCardOrnamentLayoutKey(card.id), 'mobile', message.surface)
      const sharedKey = weddingOrnamentSurfaceKey(ornamentSyncRef.current.ornamentKey, 'mobile', message.surface)
      const key = message.template ? sharedKey : cardKey
      if (!key) return
      setOrnamentLayouts((prev) => {
        const next = { ...prev }
        if (!message.ornaments) delete next[key]
        else next[key] = message.ornaments
        if (message.template && cardKey) delete next[cardKey]
        if (message.surface === 'cover' && message.template) {
          const legacy = weddingOrnamentDeviceKey(weddingCardOrnamentLayoutKey(card.id), 'mobile')
          if (legacy) delete next[legacy]
        }
        return next
      })
    })
  }, [card.id])
  useEffect(() => {
    if (!coverDraft || !card.id) return
    if (card.slug && !ornamentAdmin) return
    const snapshot = coverDraft
    const storeKey = ornamentAdmin && coverSharedKey ? coverSharedKey : coverCardKey
    const timer = window.setTimeout(() => {
      void (async () => {
        setOrnamentSaving(true)
        try {
          const result = await saveWeddingCardOrnaments(card.id, 'mobile', snapshot, 'cover')
          if ('error' in result) {
            toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
            return
          }
          setOrnamentLayouts((prev) => {
            const next = { ...prev, [storeKey]: result.ornaments }
            if (result.template && coverCardKey && coverCardKey !== storeKey) delete next[coverCardKey]
            if (result.template && legacyCoverCardKey) delete next[legacyCoverCardKey]
            return next
          })
          setCoverDraft((current) => (current === snapshot ? null : current))
          publishWeddingOrnamentTruth({
            source: ornamentSyncRef.current.source,
            cardId: card.id,
            surface: 'cover',
            template: Boolean(result.template),
            ornaments: result.ornaments,
          })
        } finally {
          setOrnamentSaving(false)
        }
      })()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [card.id, card.slug, coverCardKey, coverDraft, coverSharedKey, legacyCoverCardKey, ornamentAdmin, tImage.ornamentAdminFailed, toast])
  useEffect(() => {
    if (!letterDraft || !card.id) return
    if (card.slug && !ornamentAdmin) return
    const snapshot = letterDraft
    const storeKey = ornamentAdmin && letterSharedKey ? letterSharedKey : letterCardKey
    const timer = window.setTimeout(() => {
      void (async () => {
        setOrnamentSaving(true)
        try {
          const result = await saveWeddingCardOrnaments(card.id, 'mobile', snapshot, 'letter')
          if ('error' in result) {
            toast({ title: tImage.ornamentAdminFailed, variant: 'destructive' })
            return
          }
          setOrnamentLayouts((prev) => {
            const next = { ...prev, [storeKey]: result.ornaments }
            if (result.template && letterCardKey && letterCardKey !== storeKey) delete next[letterCardKey]
            return next
          })
          setLetterDraft((current) => (current === snapshot ? null : current))
          publishWeddingOrnamentTruth({
            source: ornamentSyncRef.current.source,
            cardId: card.id,
            surface: 'letter',
            template: Boolean(result.template),
            ornaments: result.ornaments,
          })
        } finally {
          setOrnamentSaving(false)
        }
      })()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [card.id, card.slug, letterCardKey, letterDraft, letterSharedKey, ornamentAdmin, tImage.ornamentAdminFailed, toast])
  const pairedAiFrame = weddingUsesPairedAiFrame(sectionConfig) ? resolveCoverAiFrame(sectionConfig) : null
  const kitFrameId = pairedAiFrame ? undefined : readyBackground?.coverPresetId
  const activeSharedFrame = pairedAiFrame ? null : sharedFrames[ornamentKey] ?? null
  const shownCover = resolveShownCoverFrame(sectionConfig, kitFrameId, activeSharedFrame)
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
  const coverBackgroundUrl = readyBackground?.plates[0] || masterImage?.imageUrl?.trim() || ''
  const storedCoverPhotoUrl = resolveCoverPhotoUrl(sectionConfig)
  const storedCoverIsBackground =
    Boolean(storedCoverPhotoUrl) &&
    (!coverPhotoUrlUnlessBackground(storedCoverPhotoUrl, coverBackgroundUrl) ||
      library.some((item) => item.imageUrl === storedCoverPhotoUrl))
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
  const weddingDateIso = useMemo(
    () => resolveWeddingDateIso(card.weddingDate),
    [card.weddingDate],
  )
  const occasionKey = normalizeInvitationOccasion(card.occasionKey)
  const occasionCopy = invitationEditorCopy(occasionKey)
  const cardStructure = invitationCardStructure(occasionKey)
  const secondVenueOpen = invitationShowsSecondVenue(occasionKey, {
    address: card.brideInviteAddress,
    date: card.brideInviteWeddingDate,
    time: card.brideInviteReceptionTime,
    partyTime: card.brideInvitePartyStartTime,
  })
  const oneVenue = cardStructure.venueLayout === 'one' || (cardStructure.venueLayout === 'optional-second' && !secondVenueOpen)

  const update = <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => setCard((prev) => ({ ...prev, [key]: value }))

  const groomLetterPreview = useMemo(() => resolveGuestInviteLocation(card, 'groom_home'), [card])
  const brideLetterPreview = useMemo(() => resolveGuestInviteLocation(card, 'bride_home'), [card])
  const guestInviteLocationPreview = !oneVenue && previewLetterView === 'bride' ? brideLetterPreview : groomLetterPreview
  const previewDemoVenue: WeddingGuestInviteVenue =
    card.guestInviteVenue || (!oneVenue && previewLetterView === 'bride' ? 'bride_home' : 'groom_home')
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
        occasionKey,
      }),
    [
      card.brideName,
      card.brideParents,
      card.groomName,
      card.groomParents,
      card.guestName,
      occasionKey,
      guestInviteLocationPreview.address,
      guestInviteLocationPreview.partyStartTime,
      guestInviteLocationPreview.receptionTime,
      guestInviteLocationPreview.weddingDate,
      previewDemoVenue,
      uiLocale,
    ],
  )
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

  const editSavedCard = (cardId: string) => {
    if (!cardId) return
    if (cardId !== persistInputsRef.current.card.id) {
      const url = new URL(window.location.href)
      url.searchParams.set('cardId', cardId)
      url.searchParams.set('xemThu', '1')
      window.location.assign(`${url.pathname}${url.search}`)
      return
    }
    if (oneVenue) void openLetterView('groom')
    else setLetterAskOpen(true)
  }

  const openLetterViewRef = useRef(openLetterView)
  openLetterViewRef.current = openLetterView
  useEffect(() => {
    if (loading || !card.id) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('xemThu') !== '1') return
    url.searchParams.delete('xemThu')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    if (oneVenue) void openLetterViewRef.current('groom')
    else setLetterAskOpen(true)
  }, [card.id, loading, oneVenue])

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
        if ('error' in result || 'empty' in result || persistInFlightRef.current) return
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
  const queuedSnapshotRef = useRef<null | typeof persistInputsRef.current>(null)
  const pendingOpenCardIdRef = useRef('')
  const persistEpochRef = useRef(0)
  const deletedCardIdsRef = useRef(new Set<string>())
  const deletingCardIdsRef = useRef(new Set<string>())
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
    if (deletedCardIdsRef.current.has(card.id)) return
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

  const commitSaveBrief = async (
    silent: boolean,
    options?: { hideSuccess?: boolean; ignoreNotFound?: boolean; snapshot?: typeof persistInputsRef.current },
  ): Promise<boolean> => {
    const p = options?.snapshot ?? persistInputsRef.current
    if (!p.card.id || deletedCardIdsRef.current.has(p.card.id) || tombstoneCardIds.has(p.card.id)) return false
    const startedEpoch = persistEpochRef.current

    if (!silent) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }

    if (persistInFlightRef.current) {
      if (options?.snapshot) queuedSnapshotRef.current = options.snapshot
      persistQueuedRef.current = true
      return Boolean(options?.snapshot)
    }
    persistInFlightRef.current = true
    if (!silent) setSaving(true)

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
        rsvpEnabled: 'true',
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
        if (deletedCardIdsRef.current.has(c.id) || tombstoneCardIds.has(c.id) || startedEpoch !== persistEpochRef.current) return false
        const missing = result.error?.includes('Không tìm thấy thiệp')
        if (missing && (silent || options?.ignoreNotFound)) return false
        if (!silent) {
          toast({ title: 'Lưu thất bại', description: result.error, variant: 'destructive' })
        } else {
          setAutosaveBanner({ message: tBrief.autoSaveFailedLabel, variant: 'destructive' })
        }
        return false
      }
      if (deletedCardIdsRef.current.has(c.id) || tombstoneCardIds.has(c.id) || deletedCardIdsRef.current.has(result.card.id) || tombstoneCardIds.has(result.card.id)) {
        return false
      }
      const stillEditing = persistInputsRef.current.card.id === result.card.id
      if (stillEditing && startedEpoch !== persistEpochRef.current) return false
      if (!stillEditing) {
        setSavedCards((prev) => [summaryFromCard(result.card), ...prev.filter((item) => item.id !== result.card.id)])
        return true
      }
      const latestFingerprint = buildPersistSnapshot(persistInputsRef.current)
      const hasNewerLocalChanges = latestFingerprint !== submittedFingerprint
      lastSavedPersistRef.current = hasNewerLocalChanges ? submittedFingerprint : buildSavedSnapshotForCard(result.card)
      if (hasNewerLocalChanges) {
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
      if (deletedCardIdsRef.current.has(p.card.id) || tombstoneCardIds.has(p.card.id) || startedEpoch !== persistEpochRef.current) return false
      const msg = e instanceof Error ? e.message : String(e)
      const missing = msg.includes('Không tìm thấy thiệp')
      if (missing && options?.ignoreNotFound) return false
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
      if (!silent) setSaving(false)
      if (persistQueuedRef.current) {
        const queued = queuedSnapshotRef.current
        queuedSnapshotRef.current = null
        persistQueuedRef.current = false
        window.setTimeout(() => {
          if (queued) {
            if (deletedCardIdsRef.current.has(queued.card.id) || tombstoneCardIds.has(queued.card.id)) return
            void commitSaveBrief(true, { snapshot: queued, hideSuccess: true, ignoreNotFound: true })
            return
          }
          const latestInputs = persistInputsRef.current
          const switchedCard = latestInputs.card.id !== p.card.id
          if (!switchedCard && startedEpoch !== persistEpochRef.current) return
          if (!latestInputs.card.id || deletedCardIdsRef.current.has(latestInputs.card.id) || tombstoneCardIds.has(latestInputs.card.id)) return
          const latest = buildPersistSnapshot(latestInputs)
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
      if (!p.card.id || deletedCardIdsRef.current.has(p.card.id) || tombstoneCardIds.has(p.card.id)) return
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
      if (!p.card.id || deletedCardIdsRef.current.has(p.card.id) || tombstoneCardIds.has(p.card.id)) return
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
    const epochAtLoad = savedCardListEpoch
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
      if ('error' in fresh || 'empty' in fresh || epochAtLoad < savedCardListEpoch) return null
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
      setSavedCards((prev) => mergeLocalCardsFirst(prev, fresh.cards), epochAtLoad)
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
    const withOccasion = (visual: WeddingCard) => ({
      ...visual,
      occasionKey: normalizeInvitationOccasion(sample.occasionKey || visual.occasionKey),
    })
    const withCopy = (visual: WeddingCard) =>
      copy
        ? {
            ...applyComposeCopyToCard(withOccasion(visual), copy, sample.dressCode),
            occasionKey: normalizeInvitationOccasion(sample.occasionKey || 'wedding'),
          }
        : withOccasion(visual)
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
      setComposeCreate(false)
      setComposeOccasion(normalizeInvitationOccasion(sample.occasionKey || 'wedding'))
      setComposeSampleId(sampleId)
      setComposeReturnPreview(returnToPreview)
      setComposeGroom(current.groomName)
      setComposeBride(current.brideName)
      setComposeDate(resolveWeddingDateIso(current.weddingDate) ?? persistInputsRef.current.weddingDateIso ?? '')
      setComposeStory('')
      setComposeNameError(false)
      if (returnToPreview) setSamplePreviewId(null)
      setComposeOpen(true)
    }
    const reuse = forceAskNamesRef.current
      ? { ask: true as const }
      : resolveWeddingSampleNameReuse({
          current: persistInputsRef.current.card,
          saved: savedCardList,
          occasionKey: normalizeInvitationOccasion(sample.occasionKey ?? persistInputsRef.current.card.occasionKey),
        })
    if (reuse.ask) {
      forceAskNamesRef.current = false
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
    clearPendingWeddingSampleUse(window.sessionStorage)
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

  const dismissComposeModal = () => {
    if (composeBusy) return
    const creating = composeCreate
    const sampleId = composeSampleId
    const back = composeReturnPreview
    setComposeOpen(false)
    setComposeCreate(false)
    if (creating) return
    if (back && sampleId) {
      setBackgroundPageOpen(true)
      setBackgroundConfirmOpen(false)
      setSamplePreviewId(sampleId)
    }
  }

  const skipComposeAndCreate = () => {
    if (composeBusy) return
    const creating = composeCreate
    const occasion = composeOccasion
    const groomName = readComposeField('wedding-compose-groom', composeGroom)
    const brideName = readComposeField('wedding-compose-bride', composeBride)
    const eventDate = readComposeField('wedding-compose-date', composeDate)
    const names = weddingComposeNamesOnly(groomName, brideName)
    setComposeOpen(false)
    setComposeCreate(false)
    if (creating) {
      void createBlankCard(occasion, names ?? undefined, eventDate)
      return
    }
    dismissComposeModal()
  }

  const confirmSampleCompose = async () => {
    const creating = composeCreate
    const occasion = creating
      ? composeOccasion
      : normalizeInvitationOccasion(findWeddingSampleCard(composeSampleId)?.occasionKey ?? composeOccasion)
    const sample = creating ? null : findWeddingSampleCard(composeSampleId)
    if (!creating && !sample) return
    if (composeBusy) return
    const groomName = capitalizeInvitationPersonName(readComposeField('wedding-compose-groom', composeGroom))
    const brideName = capitalizeInvitationPersonName(readComposeField('wedding-compose-bride', composeBride))
    const eventDate = readComposeField('wedding-compose-date', composeDate)
    const storyNotes = readComposeField('wedding-compose-story', composeStory)
    if (!invitationComposeNamesReady({ occasionKey: occasion, primaryName: groomName, secondaryName: brideName })) {
      setComposeNameError(true)
      return
    }
    setComposeNameError(false)
    setComposeBusy(true)
    const namesOnly = weddingComposeNamesOnly(groomName, brideName)
    const formData = new FormData()
    formData.append('occasionKey', occasion)
    formData.append('groomName', groomName)
    formData.append('brideName', brideName)
    formData.append('storyNotes', storyNotes)
    const openCard = persistInputsRef.current.card
    const sources = newCardComposeSources({
      creating,
      composeDate: eventDate,
      openDate: persistInputsRef.current.weddingDateIso || openCard.weddingDate,
      openAddresses: weddingSharedCopyAddresses(openCard),
    })
    formData.append('weddingDate', sources.weddingDate)
    let result: Awaited<ReturnType<typeof composeWeddingSampleCopy>>
    try {
      result = await composeWeddingSampleCopy(formData)
    } catch (error) {
      setComposeBusy(false)
      const message = error instanceof Error ? error.message.trim() : ''
      toast({
        title: 'AI chưa soạn được lời',
        description: message || 'Máy chủ không nhận lệnh soạn. Tên đã gõ vẫn được ghi vào thiệp mới.',
        variant: 'destructive',
      })
      if (creating) {
        setComposeOpen(false)
        setComposeCreate(false)
        await createBlankCard(occasion, namesOnly ?? undefined, eventDate)
      }
      return
    }
    if ('error' in result && result.error) {
      setComposeBusy(false)
      if (isWeddingInsufficientCredit(result)) {
        setCreditTopUpOpen(true)
        return
      }
      toast({ title: 'Chưa soạn được lời thiệp', description: result.error, variant: 'destructive' })
      if (creating) {
        setComposeOpen(false)
        setComposeCreate(false)
        await createBlankCard(occasion, namesOnly ?? undefined, eventDate)
      }
      return
    }
    if (!('coupleIntro' in result)) {
      setComposeBusy(false)
      if (creating) {
        setComposeOpen(false)
        setComposeCreate(false)
        await createBlankCard(occasion, namesOnly ?? undefined, eventDate)
      }
      return
    }
    const addresses = sources.addresses
    const copy: WeddingSampleComposeFields = {
      groomName,
      brideName,
      coupleIntro: omitWeddingAddressesFromSharedCopy(result.coupleIntro, addresses),
      loveQuote: omitWeddingAddressesFromSharedCopy(result.loveQuote, addresses),
      storyText: omitWeddingAddressesFromSharedCopy(result.storyText, addresses),
      thankYouText: omitWeddingAddressesFromSharedCopy(result.thankYouText, addresses),
    }
    setComposeReturnPreview(false)
    setComposeOpen(false)
    setComposeBusy(false)
    setComposeCreate(false)
    setBackgroundPageOpen(false)
    setBackgroundConfirmOpen(false)
    setSamplePreviewId(null)
    if (creating) {
      await createBlankCard(occasion, copy, eventDate)
      return
    }
    if (!sample) return
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
    const listEpoch = beginSavedCardListWrite()
    const serverCards = Array.isArray(result.cards) ? result.cards : []
    const immediateCards = serverCards.some((item) => item.id === result.card.id)
      ? serverCards
      : [summaryFromCard(result.card), ...serverCards]
    setSavedCards(immediateCards, listEpoch)
    persistEpochRef.current += 1
    persistQueuedRef.current = false
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
    setPreviewLetterView('groom')
    setLetterAskOpen(false)
    const localDraft = options?.restoreLocalDraft ? readWeddingLocalDraft(result.card.id) : null
    const loadedCard = localDraft
      ? ownSidePartyFields(mergeServerCardWithLocalDraft(result.card, localDraft.card, localDraft.savedAt))
      : ownSidePartyFields(result.card)
    const nextBase = stripSharedWeddingCopy(loadedCard)
    const nextCard = stripWeddingSamplePhotos(nextBase)
    if (isWeddingSamplePhotoUrl(nextBase.groomImageUrl)) setGroomPortraitClear(true)
    if (isWeddingSamplePhotoUrl(nextBase.brideImageUrl)) setBridePortraitClear(true)
    if (isWeddingSamplePhotoUrl(parseWeddingSectionConfig(nextBase.sectionConfig).coverPhotoUrl)) setCoverClearOnSave(true)
    baselineHydratedRef.current = false
    const shownCards = result.cards.some((item) => item.id === nextCard.id)
      ? result.cards
      : [summaryFromCard(nextCard), ...result.cards]
    const musicClock = (value: number | null) => (value != null && Number.isFinite(value) ? String(value) : '')
    const nextMusicStart = localDraft?.musicStartInput ?? musicClock(nextCard.musicPlayStartSec)
    const nextMusicEnd = localDraft?.musicEndInput ?? musicClock(nextCard.musicPlayEndSec)
    const nextMusicClear = localDraft?.musicClearOnSave ?? false
    persistInputsRef.current = {
      ...persistInputsRef.current,
      card: nextCard,
      musicStartInput: nextMusicStart,
      musicEndInput: nextMusicEnd,
      musicFile: null,
      musicClearOnSave: nextMusicClear,
      albumImageFiles: [],
      coverImageFile: null,
      coverClearOnSave: isWeddingSamplePhotoUrl(parseWeddingSectionConfig(nextBase.sectionConfig).coverPhotoUrl),
      groomPortraitFile: null,
      bridePortraitFile: null,
      groomPortraitClear: isWeddingSamplePhotoUrl(nextBase.groomImageUrl),
      bridePortraitClear: isWeddingSamplePhotoUrl(nextBase.brideImageUrl),
    }
    setMusicStartInput(nextMusicStart)
    setMusicEndInput(nextMusicEnd)
    if (localDraft) {
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
    setSavedCards(shownCards, listEpoch)
    setLoading(false)
    rememberCardInUrl(result.card.id)
    publishLiveWorkspace({
      card: nextCard,
      images: result.images,
      rsvps: result.rsvps,
      library: result.library,
      frameLibrary: result.frameLibrary,
      musicLibrary: result.musicLibrary,
      cards: shownCards,
      ornamentLayouts: result.ornamentLayouts ?? {},
      sharedFrames: result.sharedFrames ?? {},
      ornamentAdmin: Boolean(result.ornamentAdmin),
    })
  }

  const showEmptyWorkspace = (cards: WeddingCardSummary[] = []) => {
    const listEpoch = beginSavedCardListWrite()
    persistEpochRef.current += 1
    persistQueuedRef.current = false
    queuedSnapshotRef.current = null
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const blank = emptyBrief()
    baselineHydratedRef.current = true
    lastSavedPersistRef.current = buildSavedSnapshotForCard(blank)
    setMusicFile(null)
    setMusicClearOnSave(false)
    setAlbumImageFiles([])
    setCoverImageFile(null)
    setCoverClearOnSave(false)
    setGroomPortraitFile(null)
    setBridePortraitFile(null)
    setGroomPortraitClear(false)
    setBridePortraitClear(false)
    setPreviewLetterView('groom')
    setLetterAskOpen(false)
    persistInputsRef.current = {
      ...persistInputsRef.current,
      card: blank,
      musicStartInput: '',
      musicEndInput: '',
      musicFile: null,
      musicClearOnSave: false,
      albumImageFiles: [],
      coverImageFile: null,
      coverClearOnSave: false,
      groomPortraitFile: null,
      bridePortraitFile: null,
      groomPortraitClear: false,
      bridePortraitClear: false,
    }
    setMusicStartInput('')
    setMusicEndInput('')
    setCard(blank)
    setImages([])
    setSavedCards(visibleSavedCards(cards), listEpoch)
    setLoading(false)
    liveWorkspace = null
    forgetCardInUrl()
  }
  showEmptyWorkspaceRef.current = showEmptyWorkspace

  const openSavedCard = async (cardId: string) => {
    if (!cardId) return
    if (cardId === persistInputsRef.current.card.id) {
      document.getElementById('wedding-card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const current = persistInputsRef.current
    const dirty =
      Boolean(current.card.id) &&
      !deletedCardIdsRef.current.has(current.card.id) &&
      buildPersistSnapshot(current) !== lastSavedPersistRef.current
    if (dirty && !persistInFlightRef.current) {
      await Promise.race([
        commitSaveBrief(true, { hideSuccess: true, ignoreNotFound: true }),
        new Promise((resolve) => window.setTimeout(resolve, 1200)),
      ])
    }
    const url = new URL(window.location.href)
    url.searchParams.set('cardId', cardId)
    window.location.assign(`${url.pathname}${url.search}`)
  }

  const createFreshCard = async (nextOccasion: InvitationOccasionKey) => {
    if (switchingCard || composeBusy) return
    setPickedOccasion(nextOccasion)
    setComposeCreate(true)
    setComposeOccasion(nextOccasion)
    setComposeSampleId('')
    setComposeReturnPreview(false)
    setComposeGroom('')
    setComposeBride('')
    setComposeDate('')
    setComposeStory('')
    setComposeNameError(false)
    setOccasionPickerOpen(false)
    setComposeOpen(true)
  }

  const createBlankCard = async (
    nextOccasion: InvitationOccasionKey,
    copy?: WeddingSampleComposeFields,
    eventDate?: string,
  ) => {
    if (switchingCard) return
    setSwitchingCard(true)
    try {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      persistQueuedRef.current = false
      queuedSnapshotRef.current = null
      const current = persistInputsRef.current
      const currentId = current.card.id
      const canSaveCurrent = Boolean(currentId) && !deletedCardIdsRef.current.has(currentId)
      const unchanged = canSaveCurrent && buildPersistSnapshot(current) === lastSavedPersistRef.current
      if (canSaveCurrent && !unchanged && !persistInFlightRef.current) {
        await commitSaveBrief(true, { hideSuccess: true, ignoreNotFound: true })
      }
      const opening = weddingCardOpeningFromCompose(copy, resolveWeddingDateIso(eventDate ?? '') || eventDate)
      const result = await createNewWeddingCard(nextOccasion, 'single', opening)
      if ('error' in result) {
        toast({ title: 'Không tạo được thiệp mới', description: result.error, variant: 'destructive' })
        return
      }
      showWorkspace(result)
      setOccasionPickerOpen(false)
      document.getElementById('wedding-card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const wantedGroom = opening?.groomName.trim() ?? ''
      const wantedBride = opening?.brideName.trim() ?? ''
      const namesLanded =
        (!wantedGroom || result.card.groomName.trim() === wantedGroom) &&
        (!wantedBride || result.card.brideName.trim() === wantedBride)
      if ((wantedGroom || wantedBride) && !namesLanded) {
        toast({
          title: 'Chưa ghi được tên vào thiệp mới',
          description: 'Thiệp đã tạo. Bấm Sửa rồi lưu lại tên.',
          variant: 'destructive',
        })
      } else if (copy && weddingComposeCopyHasWords(copy)) {
        toast({
          title: tImage.sampleComposeSavedTitle,
          description: tImage.sampleComposeSavedHint,
        })
      } else if (wantedGroom || wantedBride) {
        toast({
          title: 'Đã tạo thiệp và ghi tên',
          description: 'AI chưa soạn lời mời. Tên đã lưu trên thiệp này.',
        })
      } else {
        toast({
          title: 'Đã tạo thiệp và xuất link',
          description: 'Link công khai có ngay. Thiệp vừa rồi vẫn nằm trong danh sách.',
        })
      }
    } finally {
      setSwitchingCard(false)
      const pending = pendingOpenCardIdRef.current
      pendingOpenCardIdRef.current = ''
      if (pending && pending !== persistInputsRef.current.card.id) void openSavedCard(pending)
    }
  }

  const removeSavedCard = async (cardId: string) => {
    if (!cardId || deletingCardIdsRef.current.has(cardId)) return
    const row = savedCardList.find((item) => item.id === cardId)
    const title = row ? weddingCardListTitle(row) : 'thiệp này'
    if (!window.confirm(`Xóa «${title}»? Link đã xuất bản và khách mời của thiệp này cũng mất.`)) return
    if (deletingCardIdsRef.current.has(cardId)) return
    deletingCardIdsRef.current.add(cardId)
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    deletedCardIdsRef.current.add(cardId)
    markWeddingCardDeleted(cardId)
    persistQueuedRef.current = false
    const wasCurrent = cardId === persistInputsRef.current.card.id
    if (wasCurrent) forgetCardInUrl()
    setSavedCards((prev) => prev.filter((item) => item.id !== cardId))
    const restoreDeletedRow = () => {
      unmarkWeddingCardDeleted(cardId)
      deletedCardIdsRef.current.delete(cardId)
      if (!row) return
      setSavedCards((prev) => (prev.some((item) => item.id === cardId) ? prev : [row, ...prev]))
    }
    const openRemainingOrEmpty = async (cards: WeddingCardSummary[]) => {
      const rest = visibleSavedCards(cards).filter((item) => item.id !== cardId)
      if (!wasCurrent) return
      if (!rest[0]) {
        showEmptyWorkspace([])
        return
      }
      const loaded = await loadWeddingCardWorkspace(rest[0].id)
      if ('error' in loaded || 'empty' in loaded) {
        showEmptyWorkspace(rest)
        return
      }
      showWorkspace(loaded)
    }
    const dropMissingCard = async () => {
      clearWeddingLocalDraft(cardId)
      if (!wasCurrent) {
        toast({ title: 'Đã xóa thiệp' })
        return
      }
      const loaded = await loadWeddingCardWorkspace('')
      if ('error' in loaded) {
        showEmptyWorkspace([])
        toast({ title: 'Đã xóa thiệp', description: loaded.error, variant: 'destructive' })
        return
      }
      await openRemainingOrEmpty(loaded.cards)
      toast({ title: 'Đã xóa thiệp' })
    }
    setSwitchingCard(true)
    try {
      const result = await deleteWeddingCard(cardId)
      if ('error' in result) {
        if ('error' in result && result.error?.includes('Không tìm thấy thiệp')) {
          await dropMissingCard()
          return
        }
        restoreDeletedRow()
        toast({ title: 'Không xóa được thiệp', description: result.error, variant: 'destructive' })
        return
      }
      clearWeddingLocalDraft(cardId)
      setSavedCards((prev) => mergeLocalCardsFirst(prev, result.cards).filter((item) => item.id !== cardId))
      if (!wasCurrent) {
        toast({ title: 'Đã xóa thiệp' })
        return
      }
      await openRemainingOrEmpty(result.cards)
      toast({ title: 'Đã xóa thiệp' })
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : ''
      if (message.includes('Không tìm thấy thiệp')) {
        await dropMissingCard()
        return
      }
      restoreDeletedRow()
      toast({
        title: 'Không xóa được thiệp',
        description: message || 'Máy chủ không phản hồi. Thử lại.',
        variant: 'destructive',
      })
    } finally {
      deletingCardIdsRef.current.delete(cardId)
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
        if (oneVenue) void openLetterView('groom')
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

        {savedCardList.length === 0 ? (
          <section aria-labelledby="wedding-empty-samples" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100 sm:p-5">
            <h2 id="wedding-empty-samples" className="text-lg font-semibold text-slate-950">{tLanding.samplesTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{tLanding.samplesHint}</p>
            <div className="mt-4">
              <WeddingLandingThemes
                locale={uiLocale}
                themes={emptySampleThemes}
                moreLabel={tLanding.themesMore}
                lessLabel={tLanding.themesLess}
                openLabel={tLanding.themesOpen}
              />
            </div>
          </section>
        ) : (
        <Card id="wedding-saved-cards">
          <CardHeader className="gap-1">
            <CardTitle>Thiệp đã lưu</CardTitle>
            <CardDescription>Mỗi thiệp giữ riêng. Bấm tên thiệp để xem demo. Sửa mở xem thử. Khách mời và Xem nhanh mở đúng thiệp. Xóa khi không dùng.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedCardList.map((item) => {
                const active = item.id === card.id
                return (
                  <div
                    key={item.id}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => void openSavedCard(item.id)}
                    className={cn(
                      'flex cursor-pointer flex-col gap-2 rounded-2xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
                      active ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-200',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-950">{weddingCardListTitle(item)}</p>
                      <p className="text-xs text-slate-500">
                        {invitationEditorCopy(item.occasionKey).label}
                        {' · '}
                        {item.isPublished ? 'Đã xuất bản' : 'Nháp'}
                        {active ? ' · Đang sửa' : ''}
                      </p>
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-1.5 sm:justify-end"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(item.id)}`}>
                          <Users className="mr-1 h-3.5 w-3.5" />
                          Khách mời
                        </Link>
                      </Button>
                      {item.isPublished && item.slug ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const slug = item.slug
                            if (!slug) return
                            if (invitationOccasionShape(item.occasionKey) === 'single') {
                              window.open(weddingQuickViewHref(slug, 'groom'), '_blank', 'noopener,noreferrer')
                              return
                            }
                            setQuickViewAsk({ slug, occasionKey: item.occasionKey })
                          }}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Xem nhanh
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" disabled title="Xuất bản thiệp để xem link">
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Xem nhanh
                        </Button>
                      )}
                    </div>
                    <div
                      className="flex shrink-0 gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => editSavedCard(item.id)}
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
              })}
          </CardContent>
        </Card>
        )}

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
              backgroundPicked
                ? 'max-h-[85vh] sm:max-w-lg'
                : 'h-[94dvh] max-h-[94dvh] w-[96vw] max-w-[96vw]',
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
                <WeddingSampleLookStrip
                  locale={uiLocale}
                  samples={sampleChoices}
                  activeId={activeSample?.id}
                  inUseLabel={tImage.sampleLookInUse}
                  disabled={Boolean(applyingLibraryId) || !card.id}
                  onOpen={(sample) => {
                    const params = new URLSearchParams()
                    if (card.id) params.set('cardId', card.id)
                    params.set('occasion', normalizeInvitationOccasion(card.occasionKey))
                    window.location.assign(`/thiep-mau/${encodeURIComponent(sample.id)}?${params}`)
                  }}
                />
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
              <WeddingSampleGallery
                locale={uiLocale}
                open={backgroundPageOpen}
                initialOccasion={card.occasionKey}
                cardOccasion={card.occasionKey}
                selectedId={activeSample?.id || sectionConfig.backgroundPresetId}
                heading={tImage.sampleCardsTitle}
                aiHeading={tImage.sampleAiCardsTitle}
                libraryHeading={tImage.libraryAllHeading}
                hint={tImage.sampleCardsHint}
                photoNote={tImage.sampleCardPhotos}
                columns={4}
                disabled={Boolean(applyingLibraryId) || !card.id}
                onPreview={(sample) => {
                  const params = new URLSearchParams()
                  if (card.id) params.set('cardId', card.id)
                  params.set('occasion', normalizeInvitationOccasion(sample.occasionKey || card.occasionKey))
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
          occasionKey={composeOccasion}
          busy={composeBusy}
          groomName={composeGroom}
          brideName={composeBride}
          eventDate={composeDate}
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
          onEventDate={setComposeDate}
          onStoryNotes={setComposeStory}
          onDismiss={dismissComposeModal}
          onSkip={skipComposeAndCreate}
          onConfirm={() => void confirmSampleCompose()}
        />
        {card.id ? (
        <div id="wedding-card-editor" className="w-full min-w-0 max-w-full space-y-6">
          <div className="w-full min-w-0 max-w-full space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{tImage.backgroundSectionTitle}</CardTitle>
                <CardDescription>{tImage.backgroundSectionHint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <WeddingSampleLookStrip
                  locale={uiLocale}
                  samples={sampleChoices}
                  activeId={activeSample?.id}
                  previewId={demoSampleId}
                  inUseLabel={tImage.sampleLookInUse}
                  disabled={Boolean(applyingLibraryId) || !card.id}
                  onOpen={(sample) => setPickedSampleId(sample.id)}
                />
                <Button type="button" className="w-full sm:w-auto" onClick={openBackgroundPicker}>
                  {coverBackgroundUrl ? tImage.chooseBackgroundAgain : tImage.chooseBackground}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle>{tImage.workspaceDemoTitle}</CardTitle>
                    <CardDescription>{tImage.workspaceDemoHint}</CardDescription>
                  </div>
                  <Button
                    type="button"
                    onClick={() => (oneVenue ? void openLetterView('groom') : setLetterAskOpen(true))}
                    disabled={previewBusy || !card.id}
                  >
                    {previewBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                    {txPublic.previewTryFab}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {demoSampleId || card.slug ? (
                  <WeddingCardPhoneDemo
                    slug={card.slug}
                    sampleId={demoSampleId}
                    view={oneVenue ? 'groom' : previewLetterView}
                    guestName={previewDemo.guestDisplayName}
                    title={tImage.workspaceDemoTitle}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{tImage.workspaceDemoEmpty}</p>
                )}
              </CardContent>
            </Card>


          </div>

        </div>
        ) : null}
      </div>
      <Dialog
        open={occasionPickerOpen}
        onOpenChange={(open) => {
          if (switchingCard) return
          setOccasionPickerOpen(open)
        }}
      >
        <DialogContent className="top-4 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-3 pr-12 pt-6">
            <DialogTitle>Thiệp này dùng cho dịp nào?</DialogTitle>
            <DialogDescription>
              Chọn một dịp rồi tạo. Tạo xong là có link công khai ngay. Form mở ra đúng tên và địa điểm của dịp đó.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-1">
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
          <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-4">
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
      <Dialog open={quickViewAsk != null} onOpenChange={(open) => { if (!open) setQuickViewAsk(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xem nhanh</DialogTitle>
            <DialogDescription>
              {quickViewAsk?.occasionKey === 'wedding'
                ? 'Chọn nhà trai hoặc nhà gái để mở xem nhanh.'
                : quickViewAsk
                  ? `Chọn ${invitationEditorCopy(quickViewAsk.occasionKey).letterPrimary} hoặc ${invitationEditorCopy(quickViewAsk.occasionKey).letterSecondary} để mở xem nhanh.`
                  : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-blue-700 bg-blue-100 font-semibold text-blue-950 hover:bg-blue-200"
              onClick={() => {
                if (!quickViewAsk) return
                window.open(weddingQuickViewHref(quickViewAsk.slug, 'groom'), '_blank', 'noopener,noreferrer')
                setQuickViewAsk(null)
              }}
            >
              {quickViewAsk ? invitationEditorCopy(quickViewAsk.occasionKey).letterPrimary : ''}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-pink-600 bg-pink-100 font-semibold text-pink-950 hover:bg-pink-200"
              onClick={() => {
                if (!quickViewAsk) return
                window.open(weddingQuickViewHref(quickViewAsk.slug, 'bride'), '_blank', 'noopener,noreferrer')
                setQuickViewAsk(null)
              }}
            >
              {quickViewAsk ? invitationEditorCopy(quickViewAsk.occasionKey).letterSecondary : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={letterAskOpen} onOpenChange={setLetterAskOpen}>
        <DialogContent overlayClassName="z-[270]" className="z-[270] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa thiệp</DialogTitle>
            <DialogDescription>
              {occasionKey === 'wedding'
                ? 'Chọn nhà trai hoặc nhà gái để sửa thiệp.'
                : `Chọn ${occasionCopy.letterPrimary} hoặc ${occasionCopy.letterSecondary} để sửa thiệp.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="border-blue-700 bg-blue-100 font-semibold text-blue-950 hover:bg-blue-200" onClick={() => openLetterView('groom')}>
              {occasionCopy.letterPrimary}
            </Button>
            <Button type="button" variant="outline" className="border-pink-600 bg-pink-100 font-semibold text-pink-950 hover:bg-pink-200" onClick={() => openLetterView('bride')}>
              {occasionCopy.letterSecondary}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {card.id ? previewFab : null}
    </>
    </WeddingCreditTopUpProvider>
  )
}


function WeddingCardPhoneDemo(props: {
  slug: string
  sampleId?: string
  view: 'groom' | 'bride'
  guestName: string
  title: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.72)
  const width = WEDDING_MOBILE_WIDTH
  const height = WEDDING_MOBILE_HEIGHT
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => setScale(box.clientWidth / width)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [width])
  const venue = props.view === 'bride' ? 'bride_home' : 'groom_home'
  const query = new URLSearchParams({
    view: props.view,
    venue,
    guest: props.guestName,
    device: 'mobile',
  })
  if (props.sampleId && props.slug) query.set('look', props.sampleId)
  const src = props.slug
    ? `/thiep-moi-cuoi/${encodeURIComponent(props.slug)}?${query.toString()}`
    : `/thiep-mau/${encodeURIComponent(props.sampleId || '')}?quiet=1&device=mobile`
  return (
    <div
      ref={boxRef}
      className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-[1.75rem] border bg-white shadow-sm"
      style={{ height: Math.max(240, Math.round(height * scale)) }}
    >
      <iframe
        key={src}
        title={props.title}
        src={src}
        scrolling="no"
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}
