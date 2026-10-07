'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Crop, Download, ExternalLink, Heart, Loader2, MapPin, QrCode, Sparkles, Upload, Users, X } from 'lucide-react'
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
  generateWeddingCardImage,
  uploadWeddingPrivateBackground,
  getOrCreateWeddingCard,
  publishCurrentWeddingCard,
  saveWeddingCardBrief,
} from './actions'
import { WeddingAiPolishTextarea } from './wedding-ai-polish-textarea'
import type { WeddingAiImage, WeddingBackgroundLibraryItem, WeddingCard, WeddingMusicLibraryRow, WeddingRsvp, WeddingImageType } from '@/lib/db/wedding-cards-pg'
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
import { isLegacySingleGiftImage, isTwinVietGiftReady } from '@/lib/wedding/wedding-gift-vietqr'
import { WEDDING_CARD_TEXT_TOKEN_HINT } from '@/lib/wedding/wedding-card-text-interpolate'
import { countWeddingEventTimelineItems } from '@/lib/wedding/wedding-event-timeline'
import { resolveWeddingDateIso, formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { useVietQrBanks } from '@/hooks/use-vietqr-banks'
import { getWeddingTheme, weddingBackgroundStyle, WEDDING_BG_OVERLAY } from '@/lib/wedding/wedding-theme'
import { DEFAULT_WEDDING_COVER_PRESET_ID } from '@/lib/wedding/wedding-cover-presets'
import {
  appendWeddingSideInviteSettingsToFormData,
  EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
  ownSidePartyFields,
  weddingSideInviteSettingsFromCard,
  type WeddingSideInviteSettings,
} from '@/lib/wedding/wedding-side-invite-settings'
import { WeddingSideInviteSettingsPanel } from './khach-moi/wedding-side-invite-settings-panel'
import {
  albumPhotoFrameStyle,
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  remapAlbumPhotoCrops,
  resolveAlbumPhotoFrame,
  resolveCoverPhotoObjectPosition,
  resolveCoverPhotoScale,
  resolveCoverPhotoUrl,
  shiftAlbumPhotoCropsAfterRemove,
  upsertAlbumPhotoCrop,
} from '@/lib/wedding/wedding-section-config'
import { WeddingCoverPresetPicker } from '@/components/wedding/wedding-cover-preset-picker'
import { WeddingAlbumLayoutPicker } from '@/components/wedding/wedding-album-stage'
import { WeddingStylePresetPicker } from '@/components/wedding/wedding-style-preset-picker'
import { WeddingCoverShellCard } from '@/components/wedding/wedding-cover-shell-card'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { guestInviteVenueLabel } from '@/lib/wedding/wedding-guest-invite-venue'
import { resolveGuestInviteLocation } from '@/lib/wedding/wedding-guest-invite-location'
import { getWeddingStylePreset, labelForWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'

/** Bản đồ từng preset vỏ thiệp → style AI + bảng màu, để chọn vỏ cũng đồng bộ phong cách sinh ảnh. */
const COVER_PRESET_STYLE_MAP: Record<string, { styleId: string; palette: string }> = {
  dragon_phoenix: { styleId: 'traditional_vietnamese', palette: 'red, gold, lotus pink' },
  red_photo_arch: { styleId: 'traditional_vietnamese', palette: 'red, gold, lotus pink' },
  classic_red: { styleId: 'traditional_vietnamese', palette: 'red, gold, lotus pink' },
  blush_floral: { styleId: 'floral', palette: 'rose, cream, eucalyptus green' },
  sage_garden: { styleId: 'minimal', palette: 'warm white, sage, charcoal' },
  gold_luxury: { styleId: 'luxury', palette: 'champagne gold, ivory, blush pink' },
  night_modern: { styleId: 'modern', palette: 'white, black, metallic gold' },
  lotus_viet: { styleId: 'traditional_vietnamese', palette: 'red, gold, lotus pink' },
}

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
  if (server.groomImageUrl) assignIfChanged('groomImageUrl', server.groomImageUrl)
  if (server.brideImageUrl) assignIfChanged('brideImageUrl', server.brideImageUrl)
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
  musicFile: File | null
  albumImageFiles: File[]
}): string {
  const { card, weddingDateIso, musicStartInput, musicEndInput, musicClearOnSave } = input
  const fk = (f: File | null) => (f ? `${f.name}:${f.size}:${f.lastModified}` : '')
  const albumKeys = input.albumImageFiles.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|')
  return JSON.stringify({
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
    musicFk: fk(input.musicFile),
    albumKeys,
  })
}

const CARD_FACES: Array<{ type: WeddingImageType; label: string; hint: string }> = [
  { type: 'cover', label: 'Bìa chính', hint: 'Dùng ở màn mở thiệp và hero đầu trang.' },
  { type: 'invitation', label: 'Gia đình / lời mời', hint: 'Dùng cho phần gia đình hai bên và câu chuyện mở đầu.' },
  { type: 'event', label: 'Lịch trình / địa điểm', hint: 'Dùng sau lịch tháng, timeline, dress code và bản đồ.' },
  { type: 'rsvp', label: 'RSVP', hint: 'Dùng quanh form xác nhận tham dự và lời chúc.' },
  { type: 'album', label: 'Album / Story', hint: 'Dùng làm nền cho câu chuyện và album ảnh cưới.' },
  { type: 'gift_qr', label: 'QR mừng cưới', hint: 'Dùng cho section hộp mừng cưới; giữ vùng QR thoáng.' },
  { type: 'thanks', label: 'Lời cảm ơn', hint: 'Dùng cho đoạn kết thiệp trang trọng.' },
]

function emptyBrief(styleId = 'luxury'): WeddingCard {
  return {
    id: '',
    userId: '',
    slug: '',
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

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export default function WeddingCardAiClientPage() {
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<WebLocale>(DEFAULT_WEB_LOCALE)
  const [card, setCard] = useState<WeddingCard>(() => emptyBrief())
  const [images, setImages] = useState<WeddingAiImage[]>([])
  const [library, setLibrary] = useState<WeddingBackgroundLibraryItem[]>([])
  const [musicLibrary, setMusicLibrary] = useState<WeddingMusicLibraryRow[]>([])
  const [applyingLibraryId, setApplyingLibraryId] = useState<string | null>(null)
  const [libraryTarget, setLibraryTarget] = useState<WeddingImageType>('master')
  const [uploadingOutside, setUploadingOutside] = useState(false)
  const outsideFileRef = useRef<HTMLInputElement | null>(null)
  const outsideTypeRef = useRef<WeddingImageType>('master')
  const [rsvps, setRsvps] = useState<WeddingRsvp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLetterView, setPreviewLetterView] = useState<'groom' | 'bride'>('groom')
  const [letterAskOpen, setLetterAskOpen] = useState(false)
  const [generating, setGenerating] = useState<WeddingImageType | null>(null)
  const [extraPrompt, setExtraPrompt] = useState('')
  const [styleReferenceFile, setStyleReferenceFile] = useState<File | null>(null)
  const [styleReferenceUrl, setStyleReferenceUrl] = useState('')
  const [origin, setOrigin] = useState('')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicClearOnSave, setMusicClearOnSave] = useState(false)
  const [musicStartInput, setMusicStartInput] = useState('')
  const [musicEndInput, setMusicEndInput] = useState('')
  const [pickedMusicPreviewUrl, setPickedMusicPreviewUrl] = useState<string | null>(null)
  const [albumImageFiles, setAlbumImageFiles] = useState<File[]>([])
  const [albumPendingPreviews, setAlbumPendingPreviews] = useState<string[]>([])
  const [albumCropIndex, setAlbumCropIndex] = useState<number | null>(null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [coverClearOnSave, setCoverClearOnSave] = useState(false)
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
  const txStyle = useMemo(() => getDictionary(uiLocale).weddingCardAiStyle, [uiLocale])
  const txCover = useMemo(() => getDictionary(uiLocale).weddingCardAiCover, [uiLocale])
  const txPublic = useMemo(() => getDictionary(uiLocale).weddingCardPublic, [uiLocale])
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

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
  useEffect(() => {
    if (!coverImageFile) {
      setPickedCoverPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(coverImageFile)
    setPickedCoverPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverImageFile])

  const styleReferencePreviewUrl = useMemo(() => {
    if (styleReferenceFile) return URL.createObjectURL(styleReferenceFile)
    const trimmed = styleReferenceUrl.trim()
    return trimmed || null
  }, [styleReferenceFile, styleReferenceUrl])

  useEffect(() => {
    if (!styleReferenceFile || !styleReferencePreviewUrl?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(styleReferencePreviewUrl)
  }, [styleReferenceFile, styleReferencePreviewUrl])

  const clearStyleReference = () => {
    setStyleReferenceFile(null)
    setStyleReferenceUrl('')
  }

  useEffect(() => {
    setOrigin(window.location.origin)
    let mounted = true
    getOrCreateWeddingCard().then((result) => {
      if (!mounted) return
      if ('error' in result) {
        toast({ title: 'Không mở được thiệp', description: result.error, variant: 'destructive' })
      } else {
        lastSavedPersistRef.current = buildSavedSnapshotForCard(result.card)
        baselineHydratedRef.current = true
        const localDraft = readWeddingLocalDraft(result.card.id)
        if (localDraft) {
          setCard(ownSidePartyFields(mergeServerCardWithLocalDraft(result.card, localDraft.card)))
          setMusicStartInput(localDraft.musicStartInput)
          setMusicEndInput(localDraft.musicEndInput)
          setMusicClearOnSave(localDraft.musicClearOnSave)
          setAutosaveBanner({ message: 'Đã khôi phục bản nháp chưa kịp lưu. Hệ thống sẽ tự lưu lại.', variant: 'success' })
        } else {
          setCard(ownSidePartyFields(result.card))
        }
        setImages(result.images)
        setLibrary(result.library)
        setMusicLibrary(result.musicLibrary)
        setRsvps(result.rsvps)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- chỉ hydrate thiệp một lần khi mở trang

  const selectedStylePreset = useMemo(() => getWeddingStylePreset(card.selectedStyleId), [card.selectedStyleId])
  const selectedTheme = useMemo(() => getWeddingTheme(card.selectedStyleId), [card.selectedStyleId])
  const masterImage = images.find((image) => image.id === card.masterImageId) ?? images.find((image) => image.type === 'master')
  const sectionConfig = useMemo(() => parseWeddingSectionConfig(card.sectionConfig), [card.sectionConfig])
  const coverPresetId = sectionConfig.coverPresetId || DEFAULT_WEDDING_COVER_PRESET_ID
  const coverPhotoPositionX = sectionConfig.coverPhotoPositionX ?? 50
  const coverPhotoPositionY = sectionConfig.coverPhotoPositionY ?? 50
  const coverPhotoObjectPosition = resolveCoverPhotoObjectPosition(sectionConfig)
  const coverPhotoScale = resolveCoverPhotoScale(sectionConfig)
  const coverAiImage = images.find((image) => image.type === 'cover' && image.status === 'completed')
  const coverPhotoPreviewUrl = coverClearOnSave
    ? ''
    : pickedCoverPreviewUrl || resolveCoverPhotoUrl(sectionConfig)
  const coverBackgroundUrl =
    (coverAiImage?.imageUrl?.trim() ? coverAiImage.imageUrl : '') ||
    (masterImage?.imageUrl?.trim() ? masterImage.imageUrl : '')
  const publishUrl = card.isPublished && card.slug && origin ? `${origin}/thiep-moi-cuoi/${card.slug}` : ''
  const weddingDateIso = useMemo(
    () => resolveWeddingDateIso(card.weddingDate),
    [card.weddingDate],
  )
  const missing = useMemo(() => {
    const items = []
    if (!card.groomName || !card.brideName) items.push('tên cô dâu/chú rể')
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
    if (!masterImage?.imageUrl) items.push('ảnh chính')
    if (!card.mapUrl && !card.groomInviteMapUrl && !card.brideInviteMapUrl) items.push('Google Maps')
    return items
  }, [card, masterImage, weddingDateIso])

  const update = <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => setCard((prev) => ({ ...prev, [key]: value }))
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
  const guestInviteVenueDisplay = useMemo(
    () => guestInviteVenueLabel(card.guestInviteVenue, txPublic),
    [card.guestInviteVenue, txPublic],
  )
  const groomLetterPreview = useMemo(() => resolveGuestInviteLocation(card, 'groom_home'), [card])
  const brideLetterPreview = useMemo(() => resolveGuestInviteLocation(card, 'bride_home'), [card])
  const guestInviteLocationPreview = previewLetterView === 'bride' ? brideLetterPreview : groomLetterPreview
  const openLetterView = (view: 'groom' | 'bride') => {
    setPreviewLetterView(view)
    setLetterAskOpen(false)
    if (!publishUrl) return
    const url = new URL(publishUrl)
    url.searchParams.set('view', view)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  const selectAlbumLayout = (albumLayoutId: string) => {
    update('sectionConfig', mergeWeddingSectionConfig(card.sectionConfig, { albumLayoutId }))
  }

  const selectCoverPreset = (presetId: string) => {
    update('sectionConfig', mergeWeddingSectionConfig(card.sectionConfig, { coverPresetId: presetId }))
    setCoverClearOnSave(false)
    const mapped = COVER_PRESET_STYLE_MAP[presetId]
    if (mapped) {
      update('selectedStyleId', mapped.styleId)
      update('colorPalette', mapped.palette)
    }
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
    setAlbumCropIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
  }

  const updateCoverPhotoCrop = (patch: {
    positionX?: number
    positionY?: number
    scale?: number
  }) => {
    update(
      'sectionConfig',
      mergeWeddingSectionConfig(card.sectionConfig, {
        coverPhotoPositionX: patch.positionX ?? coverPhotoPositionX,
        coverPhotoPositionY: patch.positionY ?? coverPhotoPositionY,
        coverPhotoScale: patch.scale ?? coverPhotoScale,
      }),
    )
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
      void getOrCreateWeddingCard().then((result) => {
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
      musicFile,
      albumImageFiles,
    ],
  )

  const lastSavedPersistRef = useRef('')
  const baselineHydratedRef = useRef(false)
  const autosaveTimerRef = useRef<number | null>(null)
  const persistInFlightRef = useRef(false)
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

  const commitSaveBrief = async (silent: boolean): Promise<boolean> => {
    const p = persistInputsRef.current
    if (!p.card.id) return false

    const giftInvalid =
      p.card.giftQrEnabled && !isTwinVietGiftReady(p.card) && !isLegacySingleGiftImage(p.card)
    if (giftInvalid) {
      if (!silent) {
        toast({
          title: 'Chưa đủ thông tin mừng cưới',
          description: txGift.saveNeedConfig,
          variant: 'destructive',
        })
      }
      return false
    }

    if (!silent) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }

    if (persistInFlightRef.current) return false
    persistInFlightRef.current = true
    if (!silent) setSaving(true)

    try {
      const c = p.card
      const submittedFingerprint = buildPersistSnapshot(p)
      const formData = new FormData()
      Object.entries({
        cardId: c.id,
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
        if (silent) {
          setAutosaveBanner({ message: tBrief.autoSavedLabel, variant: 'success' })
        } else {
          toast({ title: 'Đã lưu nội dung thiệp' })
        }
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
      setMusicFile(null)
      setMusicClearOnSave(false)
      setMusicLibrary(result.musicLibrary)
      setAlbumImageFiles([])

      window.setTimeout(() => {
        lastSavedPersistRef.current = buildPersistSnapshot(persistInputsRef.current)
        clearWeddingLocalDraft(result.card.id)
      }, 0)

      if (silent) {
        setAutosaveBanner({ message: tBrief.autoSavedLabel, variant: 'success' })
      } else {
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
      if (!silent) setSaving(false)
    }
  }

  useEffect(() => {
    if (loading || !card.id) return
    if (persistFingerprint === lastSavedPersistRef.current) return
    const giftBlocked =
      card.giftQrEnabled && !isTwinVietGiftReady(card) && !isLegacySingleGiftImage(card)
    if (giftBlocked) return

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(async () => {
      autosaveTimerRef.current = null
      const p = persistInputsRef.current
      if (!p.card.id) return
      const latest = buildPersistSnapshot(p)
      if (latest === lastSavedPersistRef.current) return

      const blocked =
        p.card.giftQrEnabled && !isTwinVietGiftReady(p.card) && !isLegacySingleGiftImage(p.card)
      if (blocked) return

      await commitSaveBrief(true)
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [loading, persistFingerprint, card.id]) // eslint-disable-line react-hooks/exhaustive-deps -- debounce theo fingerprint; commitSaveBrief đọc persistInputsRef

  const saveBrief = async (): Promise<boolean> => {
    return commitSaveBrief(false)
  }

  useEffect(() => {
    if (loading || !card.id) return
    const flushPendingSave = () => {
      const p = persistInputsRef.current
      if (!p.card.id) return
      const latest = buildPersistSnapshot(p)
      if (latest === lastSavedPersistRef.current) return
      const blocked =
        p.card.giftQrEnabled && !isTwinVietGiftReady(p.card) && !isLegacySingleGiftImage(p.card)
      if (blocked || persistInFlightRef.current) return
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

  const generateImage = async (type: WeddingImageType) => {
    if (!card.id || generating) return
    setGenerating(type)
    await waitForNextPaint()
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('type', type)
    formData.append('extraPrompt', extraPrompt)
    if (styleReferenceFile) formData.append('customReferenceImage', styleReferenceFile)
    if (styleReferenceUrl.trim()) formData.append('customReferenceImageUrl', styleReferenceUrl.trim())
    try {
      const result = await generateWeddingCardImage(formData)
      if ('error' in result) {
        toast({ title: 'Tạo ảnh thất bại', description: result.error, variant: 'destructive', duration: 6000 })
        return
      }
      const fresh = await getOrCreateWeddingCard()
      if (!('error' in fresh)) {
        setCard((prev) => ({
          ...fresh.card,
          weddingDate: prev.weddingDate,
        }))
        setImages(fresh.images)
        setLibrary(fresh.library)
        setMusicLibrary(fresh.musicLibrary)
        setRsvps(fresh.rsvps)
      }
      toast({
        title: type === 'master' ? 'Đã tạo ảnh chính' : 'Đã tạo nền riêng',
        description: 'Đã trừ 1 credit. Ảnh đã vào kho — khách khác chọn lại thì không mất credit.',
      })
    } catch {
      toast({
        title: 'Tạo ảnh thất bại',
        description: genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    } finally {
      setGenerating(null)
    }
  }

  const applyLibraryImage = async (libraryId: string) => {
    if (!card.id || applyingLibraryId || generating) return
    const type = libraryTarget
    setApplyingLibraryId(libraryId)
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('libraryId', libraryId)
    formData.append('type', type)
    try {
      const result = await applyWeddingBackgroundFromLibrary(formData)
      if ('error' in result && result.error) {
        toast({ title: 'Không chọn được ảnh', description: result.error, variant: 'destructive' })
        return
      }
      const fresh = await getOrCreateWeddingCard()
      if (!('error' in fresh)) {
        setCard((prev) => ({
          ...fresh.card,
          weddingDate: prev.weddingDate,
        }))
        setImages(fresh.images)
        setLibrary(fresh.library)
        setMusicLibrary(fresh.musicLibrary)
        setRsvps(fresh.rsvps)
      }
      const face = CARD_FACES.find((item) => item.type === type)
      toast({
        title: type === 'master' ? 'Đã chọn ảnh chính từ kho' : `Đã chọn nền ${face?.label ?? ''} từ kho`,
        description: 'Không trừ credit.',
      })
      setLibraryTarget('master')
    } catch {
      toast({ title: 'Không chọn được ảnh', description: 'Thử lại.', variant: 'destructive' })
    } finally {
      setApplyingLibraryId(null)
    }
  }

  const uploadOutsideBackground = async (file: File | null, type: WeddingImageType) => {
    if (!file || !card.id || uploadingOutside || generating || applyingLibraryId) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Không dùng được file này', description: 'Chọn file ảnh.', variant: 'destructive' })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Ảnh quá lớn', description: 'Chọn ảnh tối đa 8 MB.', variant: 'destructive' })
      return
    }
    setUploadingOutside(true)
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('type', type)
    formData.append('file', file)
    try {
      const result = await uploadWeddingPrivateBackground(formData)
      if ('error' in result && result.error) {
        toast({ title: 'Không gắn được ảnh', description: result.error, variant: 'destructive' })
        return
      }
      const fresh = await getOrCreateWeddingCard()
      if (!('error' in fresh)) {
        setCard((prev) => ({
          ...fresh.card,
          weddingDate: prev.weddingDate,
        }))
        setImages(fresh.images)
        setLibrary(fresh.library)
        setMusicLibrary(fresh.musicLibrary)
        setRsvps(fresh.rsvps)
      }
      const face = CARD_FACES.find((item) => item.type === type)
      toast({
        title: type === 'master' ? 'Đã dùng ảnh ngoài cho thiệp này' : `Đã dùng ảnh ngoài cho ${face?.label ?? 'nền này'}`,
        description: 'Ảnh chỉ gắn với thiệp này, không lưu kho chung. Không trừ credit.',
      })
    } catch {
      toast({ title: 'Không gắn được ảnh', description: 'Thử lại.', variant: 'destructive' })
    } finally {
      setUploadingOutside(false)
    }
  }

  const pickOutsideBackground = (type: WeddingImageType) => {
    outsideTypeRef.current = type
    outsideFileRef.current?.click()
  }

  const publish = async () => {
    const saved = await saveBrief()
    if (!saved) return
    const cardId = persistInputsRef.current.card.id
    if (!cardId) return
    const result = await publishCurrentWeddingCard(cardId)
    if ('error' in result) {
      toast({ title: 'Xuất bản thất bại', description: result.error, variant: 'destructive' })
    } else {
      setCard((prev) => ({
        ...result.card,
        weddingDate: prev.weddingDate,
      }))
      toast({ title: 'Đã xuất bản link thiệp', description: 'Xuất bản không tốn credit.' })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <div className="mx-auto max-w-6xl space-y-6 px-2 pb-10">
        <div className="rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm ring-1 ring-rose-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-rose-600">AI Wedding Invitation</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Tạo thiệp cưới AI – thiệp mời cưới online</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Chọn phong cách miễn phí, xem trước nội dung, chỉ tốn credit khi AI sinh ảnh mới. Chữ tiếng Việt do hệ thống render riêng.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
              <b>Credit:</b> Tạo ảnh mới = 1 credit. Chọn ảnh kho hoặc ảnh ngoài của riêng thiệp = 0 credit. Cải thiện Dress code hoặc lời cảm ơn = 0,1 credit/lần. Sửa text khác, preview, QR, RSVP, tải ảnh, xuất bản = 0 credit.
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{txStyle.sectionTitle}</CardTitle>
                <CardDescription>{txStyle.sectionDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <WeddingStylePresetPicker
                  locale={uiLocale}
                  selectedId={card.selectedStyleId}
                  onSelect={(styleId, palette) => {
                    update('selectedStyleId', styleId)
                    update('colorPalette', palette)
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{txCover.sectionTitle}</CardTitle>
                <CardDescription>{txCover.sectionDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeddingCoverPresetPicker
                  locale={uiLocale}
                  selectedId={coverPresetId}
                  onSelect={selectCoverPreset}
                  tagNewLabel={txCover.tagNew}
                  tagHotLabel={txCover.tagHot}
                />
                <div className="rounded-2xl border border-dashed p-4">
                  <div
                    className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-cover bg-center p-4"
                    style={weddingBackgroundStyle(coverBackgroundUrl, selectedTheme, WEDDING_BG_OVERLAY.cover)}
                  >
                    <WeddingCoverShellCard
                      presetId={coverPresetId}
                      coverPhotoUrl={coverPhotoPreviewUrl}
                      coverPhotoObjectPosition={coverPhotoObjectPosition}
                      coverPhotoScale={coverPhotoScale}
                      groomName={card.groomName || '—'}
                      brideName={card.brideName || '—'}
                      weddingDate={weddingDateDisplay || card.weddingDate}
                      weddingTimeText={guestInviteLocationPreview.displayTime || card.weddingTime}
                      guestName={card.guestName || undefined}
                      guestInviteVenue={card.guestInviteVenue}
                      guestInviteVenueLabel={guestInviteVenueDisplay || undefined}
                      addressText={guestInviteLocationPreview.address || undefined}
                      mapUrl={guestInviteLocationPreview.mapUrl || undefined}
                      viewMapLabel={txPublic.guestInviteViewMap}
                      theme={selectedTheme}
                      invitationLabel={txCover.previewLabel}
                      cordiallyInvitesLabel={txCover.previewGuestPrefix}
                      openButtonLabel={txCover.previewOpenButton}
                      dateFallback={txPublic.dateFallback}
                      photoAlt={txPublic.coverPhotoAlt}
                      compact
                    />
                  </div>
                </div>
                <ImageUploadField
                  label={txCover.uploadLabel}
                  currentUrl={coverPhotoPreviewUrl}
                  file={coverImageFile}
                  onFileChange={(file) => {
                    setCoverImageFile(file)
                    if (file) setCoverClearOnSave(false)
                  }}
                />
                {coverPhotoPreviewUrl ? (
                  <CoverPhotoCropEditor
                    imageUrl={coverPhotoPreviewUrl}
                    alt={txPublic.coverPhotoAlt}
                    positionX={coverPhotoPositionX}
                    positionY={coverPhotoPositionY}
                    scale={coverPhotoScale}
                    onChange={updateCoverPhotoCrop}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">{txCover.uploadHint}</p>
                {!coverImageFile && resolveCoverPhotoUrl(sectionConfig) ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setCoverClearOnSave(true)}>
                    {txCover.removeCustomCover}
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">{txCover.aiCoverHint}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle>2. Nhập thông tin cưới</CardTitle>
                    <CardDescription>{tBrief.step2Description}</CardDescription>
                  </div>
                  <div className="flex min-h-[1.25rem] shrink-0 items-start sm:max-w-[240px] sm:justify-end">
                    {autosaveBanner ? (
                      <p
                        role="status"
                        className={cn(
                          'text-xs sm:text-right sm:text-sm',
                          autosaveBanner.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {autosaveBanner.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tên chú rể" value={card.groomName} onChange={(v) => update('groomName', v)} />
                  <Field label="Tên cô dâu" value={card.brideName} onChange={(v) => update('brideName', v)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Phần này dùng cho cả nhà trai và nhà gái. Ngày tiệc, giờ, địa chỉ, bản đồ và lịch trình điền ở đúng nhà bên dưới.
                  Lời mời tiếng Việt tự viết theo xưng hô và tên từng khách.
                </p>
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
                    label="Intro cặp đôi / câu chuyện mở đầu"
                    field="coupleIntro"
                    value={card.coupleIntro}
                    onChange={(v) => update('coupleIntro', v)}
                    card={card}
                    weddingDateLabel={weddingDateDisplay}
                    placeholder="Một đoạn mở đầu tinh tế về cô dâu chú rể, gia đình hoặc lời nhắn riêng..."
                    className="min-h-28"
                  />
                  <WeddingAiPolishTextarea
                    label="Quote tình yêu"
                    field="loveQuote"
                    value={card.loveQuote}
                    onChange={(v) => update('loveQuote', v)}
                    card={card}
                    weddingDateLabel={weddingDateDisplay}
                    placeholder="Ví dụ: Và rồi chúng ta chọn cùng nhau đi hết những ngày bình yên..."
                    className="min-h-28"
                  />
                </div>
                <WeddingAiPolishTextarea
                  label="Dress code / lưu ý khách mời"
                  field="dressCode"
                  value={card.dressCode}
                  onChange={(v) => update('dressCode', v)}
                  card={card}
                  weddingDateLabel={weddingDateDisplay}
                  placeholder="Ví dụ: Tông màu kem, be, nâu nhạt. Vui lòng đến trước giờ làm lễ 15 phút."
                  className="min-h-32"
                />
                <WeddingAiPolishTextarea
                  label="Câu chuyện / album ngắn"
                  field="storyText"
                  value={card.storyText}
                  onChange={(v) => update('storyText', v)}
                  card={card}
                  weddingDateLabel={weddingDateDisplay}
                  placeholder="Một đoạn ngắn về hành trình yêu thương, lời nhắn gửi hoặc album/story..."
                  className="min-h-24"
                />
                <WeddingAiPolishTextarea
                  label="Lời cảm ơn cuối thiệp"
                  field="thankYouText"
                  value={card.thankYouText}
                  onChange={(v) => update('thankYouText', v)}
                  card={card}
                  weddingDateLabel={weddingDateDisplay}
                  placeholder="{couple} xin chân thành cảm ơn quý khách đã đến chung vui trong ngày trọng đại của chúng tôi."
                  hint={WEDDING_CARD_TEXT_TOKEN_HINT}
                  className="min-h-24"
                />
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-1">
                    <Label>Nhà trai và nhà gái</Label>
                    <p className="text-xs text-muted-foreground">
                      Mỗi nhà điền một lần. Trang khách mời dùng cùng các ô này.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-sky-800">Nhà trai</p>
                    <WeddingSideInviteSettingsPanel
                      side="groom"
                      card={card}
                      settings={weddingSideInviteSettingsFromCard(card)}
                      saving={saving}
                      onChange={applySideSettings}
                      onParentsChange={(value) => update('groomParents', value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-rose-700">Nhà gái</p>
                    <WeddingSideInviteSettingsPanel
                      side="bride"
                      card={card}
                      settings={weddingSideInviteSettingsFromCard(card)}
                      saving={saving}
                      onChange={applySideSettings}
                      onParentsChange={(value) => update('brideParents', value)}
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border p-3">
                  <Label>Album ảnh cô dâu chú rể</Label>
                  <p className="text-xs text-muted-foreground">
                    Bấm từng ảnh đã lưu để kéo và zoom, chọn góc nhìn đẹp trên thiệp. Ảnh mới cần lưu thiệp trước khi căn.
                  </p>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    Chọn nhiều ảnh album
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        const picked = Array.from(event.target.files ?? [])
                        event.target.value = ''
                        if (picked.length === 0) return
                        setAlbumImageFiles((prev) => {
                          const room = Math.max(0, 30 - card.albumImageUrls.length - prev.length)
                          return room > 0 ? [...prev, ...picked.slice(0, room)] : prev
                        })
                      }}
                    />
                  </label>
                  {(card.albumImageUrls.length > 0 || albumPendingPreviews.length > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      {card.albumImageUrls.map((url, index) => {
                        const frame = resolveAlbumPhotoFrame(sectionConfig.albumPhotoCrops, index)
                        return (
                          <div key={`${url}-${index}`} className="relative">
                            <button
                              type="button"
                              className="block w-full overflow-hidden rounded-xl text-left"
                              aria-label={`Căn ảnh album ${index + 1}`}
                              onClick={() => setAlbumCropIndex(index)}
                            >
                              <img
                                src={url}
                                alt="Ảnh album đã lưu"
                                draggable={false}
                                className="aspect-[3/4] w-full object-cover"
                                style={albumPhotoFrameStyle(frame)}
                              />
                              <span className="pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                                <Crop className="h-3 w-3" />
                                Căn ảnh
                              </span>
                            </button>
                            <button
                              type="button"
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                              aria-label={tImage.customReferenceRemove}
                              onClick={() => removeSavedAlbumPhoto(index)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                      {albumPendingPreviews.map((url, index) => (
                        <div key={url} className="relative">
                          <img src={url} alt="Ảnh album mới" className="h-24 w-full rounded-xl object-cover" />
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
                  <div className="space-y-2">
                    <Label>Kiểu xem album trên thiệp</Label>
                    <p className="text-xs text-muted-foreground">Ảnh hiện lớn ngay trên thiệp. Khách vuốt để xem từng ảnh.</p>
                    <WeddingAlbumLayoutPicker
                      locale={uiLocale}
                      selectedId={sectionConfig.albumLayoutId}
                      previewUrls={card.albumImageUrls}
                      crops={sectionConfig.albumPhotoCrops}
                      onSelect={selectAlbumLayout}
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
                      setAlbumCropIndex(null)
                    }}
                    placeholder="Hoặc dán URL ảnh album, mỗi dòng một ảnh"
                    className="min-h-20"
                  />
                  <p className="text-xs text-muted-foreground">Thêm/sửa album ảnh không tốn credit. Căn góc ảnh cũng không tốn credit — nhớ bấm Lưu thiệp.</p>
                </div>
                <Dialog open={albumCropIndex !== null} onOpenChange={(open) => { if (!open) setAlbumCropIndex(null) }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Căn ảnh album</DialogTitle>
                      <DialogDescription>Kéo và zoom từng ảnh album để chọn góc hiển thị trên thiệp.</DialogDescription>
                    </DialogHeader>
                    {albumCropIndex !== null && card.albumImageUrls[albumCropIndex] ? (
                      <CoverPhotoCropEditor
                        key={albumCropIndex}
                        imageUrl={card.albumImageUrls[albumCropIndex]}
                        alt="Ảnh album"
                        positionX={resolveAlbumPhotoFrame(sectionConfig.albumPhotoCrops, albumCropIndex).x}
                        positionY={resolveAlbumPhotoFrame(sectionConfig.albumPhotoCrops, albumCropIndex).y}
                        scale={resolveAlbumPhotoFrame(sectionConfig.albumPhotoCrops, albumCropIndex).scale}
                        title="Căn ảnh album"
                        hint="Kéo ảnh để đổi góc. Zoom để phóng phần muốn khách thấy. Khung dọc 3:4 giống lúc hiện trên thiệp."
                        ariaLabel="Căn ảnh album"
                        frameClassName="relative mx-auto aspect-[3/4] w-full max-w-[16rem] cursor-grab touch-none overflow-hidden rounded-2xl bg-black/5 shadow-inner ring-1 ring-black/10 active:cursor-grabbing"
                        onChange={(patch) => updateAlbumPhotoCrop(albumCropIndex, patch)}
                      />
                    ) : null}
                  </DialogContent>
                </Dialog>
                <Field label="Bảng màu AI" value={card.colorPalette} onChange={(v) => update('colorPalette', v)} />
                <div className="space-y-3 rounded-2xl border p-3">
                  <Label>{tMu.libraryHeading}</Label>
                  <p className="text-xs text-muted-foreground">{tMu.libraryHint}</p>
                  <WeddingMusicLibraryPicker
                    items={musicLibrary}
                    selectedUrl={!musicClearOnSave && !musicFile ? card.musicUrl : ''}
                    credit={tMu.seedCredit}
                    onSelect={(audioUrl) => {
                      update('musicUrl', audioUrl)
                      setMusicFile(null)
                      setMusicClearOnSave(false)
                    }}
                  />
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {tMu.uploadLabel}
                    <input
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={(event) => {
                        const f = event.target.files?.[0] ?? null
                        setMusicFile(f)
                        if (f) setMusicClearOnSave(false)
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">{tMu.sharedUploadNote}</p>
                  {!musicClearOnSave && !musicFile && !card.musicUrl ? (
                    <p className="text-xs text-muted-foreground">Chưa có nhạc. Chọn file để có nhạc nền trên thiệp sau khi lưu.</p>
                  ) : null}
                  {musicClearOnSave && card.musicUrl && !musicFile && (
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Đánh dấu gỡ nhạc đã lưu — nhấn «Lưu nội dung» để xóa file nhạc trên thiệp.
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
                      <WeddingGiftAccountsForm card={card} banks={vietBanks} tx={txGift} update={update} />
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
                <Button onClick={saveBrief} disabled={saving} className="w-full sm:w-auto">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu nội dung / cập nhật preview
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4-7. Tạo ảnh AI</CardTitle>
                <CardDescription>AI chỉ tạo visual/background. Chữ tiếng Việt được render bằng hệ thống.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="Prompt chỉnh thêm nếu cần, ví dụ: thêm hoa sen, ánh sáng vàng nhẹ..." />
                <div className="rounded-2xl border border-dashed p-4">
                  <Label>{tImage.customReferenceLabel}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{tImage.customReferenceHint}</p>
                  {styleReferencePreviewUrl ? (
                    <img
                      src={styleReferencePreviewUrl}
                      alt={tImage.customReferenceLabel}
                      className="mt-3 max-h-48 w-full rounded-xl object-contain bg-muted"
                    />
                  ) : (
                    <div className="mt-3 flex min-h-32 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
                      {tImage.customReferenceEmpty}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      {tImage.customReferenceChoose}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setStyleReferenceFile(file)
                          if (file) setStyleReferenceUrl('')
                          event.target.value = ''
                        }}
                      />
                    </label>
                    {(styleReferenceFile || styleReferenceUrl.trim()) && (
                      <Button type="button" variant="outline" size="sm" onClick={clearStyleReference}>
                        <X className="mr-2 h-4 w-4" />
                        {tImage.customReferenceRemove}
                      </Button>
                    )}
                  </div>
                  <Input
                    value={styleReferenceUrl}
                    onChange={(e) => {
                      setStyleReferenceUrl(e.target.value)
                      if (e.target.value.trim()) setStyleReferenceFile(null)
                    }}
                    placeholder={tImage.customReferenceUrlPlaceholder}
                    className="mt-3"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => generateImage('master')} disabled={Boolean(generating) || Boolean(applyingLibraryId) || uploadingOutside}>
                    {generating === 'master' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {masterImage ? 'Tạo lại ảnh chính - 1 credit' : 'Tạo ảnh chính - 1 credit'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(generating) || Boolean(applyingLibraryId) || uploadingOutside}
                    onClick={() => pickOutsideBackground('master')}
                  >
                    {uploadingOutside && outsideTypeRef.current === 'master' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Chọn ảnh ngoài · 0 credit
                  </Button>
                  {masterImage?.imageUrl && (
                    <Button asChild variant="outline">
                      <a href={masterImage.imageUrl} download target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Tải ảnh đã tạo
                      </a>
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Tạo nền riêng dùng prompt và ảnh tham khảo ngay phía trên.</p>
                  <div className="flex flex-wrap gap-2">
                    {CARD_FACES.map((face) => (
                      <Button
                        key={face.type}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(generating) || Boolean(applyingLibraryId) || uploadingOutside || !masterImage?.imageUrl}
                        onClick={() => generateImage(face.type)}
                      >
                        {generating === face.type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Tạo nền {face.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed p-4">
                  {masterImage?.imageUrl ? (
                    <img src={masterImage.imageUrl} alt="Ảnh chính thiệp cưới" className="max-h-96 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-muted text-center text-sm text-muted-foreground">
                      <Sparkles className="mb-2 h-8 w-8 text-rose-500" />
                      Chưa có ảnh chính. Preview nháp vẫn dùng HTML/CSS và chưa tốn credit.
                    </div>
                  )}
                  <div id="wedding-bg-library" className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Kho ảnh nền</p>
                    <p className="text-xs text-muted-foreground">
                      {libraryTarget === 'master'
                        ? 'Bấm một ảnh đã tạo để dùng làm ảnh chính. Không trừ credit. Tạo mới vẫn 1 credit và ảnh mới được lưu vào kho. Ảnh chọn từ máy chỉ dùng cho thiệp này, không vào kho.'
                        : `Bấm một ảnh để dùng cho «${CARD_FACES.find((face) => face.type === libraryTarget)?.label ?? 'nền này'}». Không trừ credit.`}
                      {libraryTarget !== 'master' ? (
                        <button type="button" className="ml-2 underline" onClick={() => setLibraryTarget('master')}>
                          Về ảnh chính
                        </button>
                      ) : null}
                    </p>
                    {library.length ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {library.map((item) => {
                          const currentUrl =
                            libraryTarget === 'master'
                              ? masterImage?.imageUrl
                              : images.find((image) => image.type === libraryTarget && image.status === 'completed')?.imageUrl
                          const active = Boolean(currentUrl && currentUrl === item.imageUrl)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={Boolean(generating) || Boolean(applyingLibraryId) || uploadingOutside}
                              onClick={() => void applyLibraryImage(item.id)}
                              className={cn(
                                'relative overflow-hidden rounded-xl border bg-muted',
                                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
                              )}
                              title={active ? 'Đang dùng' : 'Chọn ảnh này, 0 credit'}
                            >
                              <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" />
                              {applyingLibraryId === item.id ? (
                                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                                  <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-muted px-3 py-4 text-center text-xs text-muted-foreground">
                        Kho còn trống. Tạo ảnh mới để lưu vào kho — lần sau chọn lại không mất credit.
                      </p>
                    )}
                  </div>
                  <input
                    ref={outsideFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      event.target.value = ''
                      void uploadOutsideBackground(file, outsideTypeRef.current)
                    }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CARD_FACES.map((face) => {
                    const faceImage = images.find((image) => image.type === face.type && image.status === 'completed')
                    const masterBg = masterImage?.imageUrl?.trim() ? masterImage.imageUrl : ''
                    const displayBgUrl =
                      (faceImage?.imageUrl?.trim() ? faceImage.imageUrl : '') || masterBg
                    return (
                      <div key={face.type} className="rounded-2xl border p-4">
                        <p className="font-semibold">{face.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{face.hint}</p>
                        {displayBgUrl ? (
                          <img src={displayBgUrl} alt={face.label} className="mt-3 h-32 w-full rounded-xl object-cover" />
                        ) : (
                          <div className="mt-3 flex h-32 items-center justify-center rounded-xl bg-muted text-center text-xs text-muted-foreground">
                            Chưa có ảnh chính — tạo ảnh chính để có nền mặc định hoặc tạo nền riêng.
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={Boolean(generating) || Boolean(applyingLibraryId) || uploadingOutside || library.length === 0}
                            onClick={() => {
                              setLibraryTarget(face.type)
                              document.getElementById('wedding-bg-library')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }}
                          >
                            Chọn từ kho · 0 credit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={Boolean(generating) || Boolean(applyingLibraryId) || uploadingOutside}
                            onClick={() => pickOutsideBackground(face.type)}
                          >
                            Ảnh ngoài · 0 credit
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle>3 & 8. Preview nháp</CardTitle>
                    <CardDescription>Mobile/desktop đều render text thật bằng hệ thống, không tốn credit.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLetterAskOpen(true)}>
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
                <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[1.65rem] border border-white/60 shadow-lg">
                  <div
                    className={cn(
                      'max-h-[min(28rem,calc(100dvh-20rem))] overflow-y-auto overscroll-contain bg-cover bg-center px-3 py-3 text-center [scrollbar-width:thin]',
                      selectedTheme.text,
                    )}
                    style={weddingBackgroundStyle(masterImage?.imageUrl, selectedTheme, WEDDING_BG_OVERLAY.hero, { readingVignette: true })}
                  >
                    <WeddingReadableGlass
                      theme={selectedTheme}
                      strength="hero"
                      className="w-full rounded-2xl px-3 py-3.5"
                    >
                      <div className="flex w-full min-w-0 flex-col items-stretch gap-2 text-center">
                        <p className={cn('w-full text-[10px] uppercase tracking-[0.28em]', selectedTheme.accentText, selectedTheme.textGlow)}>
                          Wedding Invitation
                        </p>
                        <Heart className={cn('mx-auto h-5 w-5 fill-current opacity-80', selectedTheme.accent, selectedTheme.textGlow)} />
                        <div className="w-full min-w-0">
                          <h2 className={cn('w-full text-balance font-serif text-[clamp(1.35rem,8cqi,1.85rem)] font-semibold italic leading-tight', selectedTheme.textGlowHeading)}>
                            {card.groomName || 'Chú rể'}
                          </h2>
                          <p className={cn('my-0.5 text-sm', selectedTheme.textGlow)}>&</p>
                          <h2 className={cn('w-full text-balance font-serif text-[clamp(1.35rem,8cqi,1.85rem)] font-semibold italic leading-tight', selectedTheme.textGlowHeading)}>
                            {card.brideName || 'Cô dâu'}
                          </h2>
                        </div>
                        {card.loveQuote ? (
                          <p className={cn('w-full text-balance font-serif text-[0.92rem] italic leading-6', selectedTheme.accentText, selectedTheme.textGlow)}>
                            “{card.loveQuote}”
                          </p>
                        ) : null}
                        <p className={cn('w-full whitespace-pre-line text-xs leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>
                          {card.invitationText || 'Trân trọng kính mời quý khách đến dự lễ thành hôn của chúng tôi.'}
                        </p>
                        {(card.coupleIntro || groomLetterPreview.eventTimeline || brideLetterPreview.eventTimeline || card.dressCode) && (
                          <div className={cn('w-full rounded-xl px-3 py-2 text-left text-[11px]', selectedTheme.panelStrong)}>
                            {card.coupleIntro ? (
                              <p className={cn('line-clamp-3 leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>{card.coupleIntro}</p>
                            ) : null}
                            {(previewLetterView === 'bride' ? brideLetterPreview.eventTimeline : groomLetterPreview.eventTimeline) ? (
                              <p className={cn('mt-1.5 font-semibold', selectedTheme.accentText, selectedTheme.textGlow)}>
                                Lịch trình: {countWeddingEventTimelineItems(previewLetterView === 'bride' ? brideLetterPreview.eventTimeline : groomLetterPreview.eventTimeline)} mốc
                              </p>
                            ) : null}
                            {card.dressCode ? (
                              <p className={cn('mt-1 line-clamp-2 leading-5', selectedTheme.mutedText, selectedTheme.textGlow)}>{card.dressCode}</p>
                            ) : null}
                          </div>
                        )}
                        {card.guestName ? (
                          <WeddingGuestInviteBlock
                            className="w-full min-w-0"
                            guestName={card.guestName}
                            inviteVenue={card.guestInviteVenue}
                            cordiallyInvitesLabel="Thân mời / Cordially invites"
                            venueLabel={guestInviteVenueDisplay}
                            weddingDateLabel={weddingDateDisplay || card.weddingDate || undefined}
                            weddingTimeText={guestInviteLocationPreview.displayTime || card.weddingTime}
                            addressText={guestInviteLocationPreview.address}
                            mapUrl={guestInviteLocationPreview.mapUrl}
                            viewMapLabel={txPublic.guestInviteViewMap}
                            panelClassName={selectedTheme.panelStrong}
                            cordiallyClassName={cn(selectedTheme.mutedText, selectedTheme.textGlow)}
                            nameClassName={cn(selectedTheme.text, selectedTheme.textGlowHeading)}
                            venueClassName={cn(selectedTheme.accentText, selectedTheme.textGlow)}
                            addressClassName={cn(selectedTheme.mutedText, selectedTheme.textGlow)}
                            weddingThemeId={selectedTheme.id}
                            compact
                          />
                        ) : null}
                        <div className={cn('w-full min-w-0 rounded-xl px-2 py-2 text-xs', selectedTheme.panelGlass)}>
                          {resolveWeddingDateIso(guestInviteLocationPreview.weddingDate) ? (
                            <WeddingEventCalendarBlock
                              weddingDateIso={resolveWeddingDateIso(guestInviteLocationPreview.weddingDate)!}
                              weddingTimeText={guestInviteLocationPreview.receptionTime || card.weddingTime}
                              partyStartTime={guestInviteLocationPreview.partyStartTime || card.partyStartTime}
                              locale={uiLocale}
                              tx={txCal}
                              textGlow={selectedTheme.textGlow}
                              compact
                              countdownLive={false}
                              className="mx-auto mb-2 w-full max-w-[240px]"
                            />
                          ) : (
                            <p className={cn('font-semibold', selectedTheme.textGlow)}>
                              {guestInviteLocationPreview.weddingDate || 'Ngày tiệc'} · {guestInviteLocationPreview.displayTime || 'Giờ tiệc'}
                            </p>
                          )}
                          <p className={cn('mt-1 flex items-start justify-center gap-1 text-balance leading-5', selectedTheme.textGlow)}>
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="min-w-0">{guestInviteLocationPreview.address || 'Địa chỉ tiệc'}</span>
                          </p>
                        </div>
                        <div className="flex w-full flex-wrap justify-center gap-1.5 text-[10px]">
                          {card.rsvpEnabled ? <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>RSVP bật</span> : null}
                          {card.giftQrEnabled && (isTwinVietGiftReady(card) || card.giftQrImageUrl.trim()) ? (
                            <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>{txGift.boxTitle}</span>
                          ) : null}
                          {(card.musicUrl || musicFile) && !musicClearOnSave ? (
                            <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>Có nhạc nền</span>
                          ) : null}
                          <span className={cn('rounded-full px-2.5 py-1', selectedTheme.panelStrong)}>
                            {labelForWeddingStylePreset(uiLocale, selectedStylePreset)}
                          </span>
                        </div>
                      </div>
                    </WeddingReadableGlass>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. Xuất bản</CardTitle>
                <CardDescription>Tạo link thiệp, RSVP, lời chúc, QR link thiệp: 0 credit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={publish} disabled={!card.id || missing.includes('ảnh chính')} className="w-full">
                  Xuất bản link thiệp - 0 credit
                </Button>
                {card.id ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button asChild variant="outline" className="w-full border-sky-600 bg-sky-200 font-semibold text-sky-950 hover:bg-sky-300">
                      <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(card.id)}&side=groom`}>
                        <Users className="mr-2 h-4 w-4" />
                        Khách mời nhà trai
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full border-rose-600 bg-rose-200 font-semibold text-rose-950 hover:bg-rose-300">
                      <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(card.id)}&side=bride`}>
                        <Users className="mr-2 h-4 w-4" />
                        Khách mời nhà gái
                      </Link>
                    </Button>
                  </div>
                ) : null}
                {publishUrl && (
                  <div className="rounded-2xl bg-muted p-3 text-sm">
                    <p className="break-all font-medium">{publishUrl}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setLetterAskOpen(true)}>
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
      </div>
      <Dialog open={letterAskOpen} onOpenChange={setLetterAskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xem thiệp</DialogTitle>
            <DialogDescription>
              {publishUrl
                ? 'Chọn nhà trai hoặc nhà gái.'
                : 'Thiệp chưa xuất bản. Bản nháp bên cạnh sẽ đổi theo lựa chọn này.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="border-sky-600 bg-sky-200 font-semibold text-sky-950 hover:bg-sky-300" onClick={() => openLetterView('groom')}>
              Nhà trai
            </Button>
            <Button type="button" variant="outline" className="border-rose-600 bg-rose-200 font-semibold text-rose-950 hover:bg-rose-300" onClick={() => openLetterView('bride')}>
              Nhà gái
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

function ImageUploadField(props: {
  label: string
  currentUrl: string
  file: File | null
  onFileChange: (file: File | null) => void
}) {
  const previewUrl = props.file ? URL.createObjectURL(props.file) : props.currentUrl
  return (
    <div className="space-y-2 rounded-2xl border p-3">
      <Label>{props.label}</Label>
      {previewUrl ? (
        <img src={previewUrl} alt={props.label} className="h-36 w-full rounded-xl object-cover" />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
          Chưa có ảnh
        </div>
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
        <Upload className="h-4 w-4" />
        Chọn ảnh
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
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

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
      <div>
        <Label className="text-sm">{props.title ?? 'Căn ảnh trực tiếp trên vỏ thiệp'}</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {props.hint ??
            'Kéo ảnh để đổi vị trí. Lăn chuột hoặc dùng thanh zoom để phóng to/thu nhỏ. Double click để zoom nhanh.'}
        </p>
      </div>

      <div
        ref={frameRef}
        className={
          props.frameClassName ??
          'relative h-40 cursor-grab touch-none overflow-hidden rounded-2xl bg-black/5 shadow-inner ring-1 ring-black/10 active:cursor-grabbing sm:h-48'
        }
        style={{ touchAction: 'none' }}
        role="application"
        aria-label={props.ariaLabel ?? 'Căn ảnh vỏ thiệp'}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            positionX: props.positionX,
            positionY: props.positionY,
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
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
          Kéo ảnh để căn
        </div>
      </div>

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
          onClick={() => props.onChange({ positionX: 50, positionY: 50, scale: 1 })}
        >
          Đưa về giữa ảnh
        </Button>
      </div>
    </div>
  )
}
