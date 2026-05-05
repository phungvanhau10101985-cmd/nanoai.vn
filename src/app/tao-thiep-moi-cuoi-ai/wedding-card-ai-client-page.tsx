'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, ExternalLink, Heart, Loader2, MapPin, QrCode, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  generateWeddingCardImage,
  getOrCreateWeddingCard,
  publishCurrentWeddingCard,
  saveWeddingCardBrief,
} from './actions'
import type { WeddingAiImage, WeddingCard, WeddingRsvp, WeddingImageType } from '@/lib/db/wedding-cards-pg'
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
import { normalizeWeddingDateToIso } from '@/lib/wedding/wedding-date-normalize'
import { useVietQrBanks } from '@/hooks/use-vietqr-banks'

const STYLES = [
  {
    id: 'luxury',
    label: 'Luxury / Sang trọng',
    palette: 'champagne gold, ivory, blush pink',
    preview: 'from-amber-100 via-white to-rose-100',
    ornament: '✦',
  },
  {
    id: 'minimal',
    label: 'Minimal / Tối giản',
    palette: 'warm white, sage, charcoal',
    preview: 'from-stone-50 via-white to-emerald-100',
    ornament: '—',
  },
  {
    id: 'traditional_vietnamese',
    label: 'Traditional Vietnamese / Truyền thống Việt Nam',
    palette: 'red, gold, lotus pink',
    preview: 'from-red-600 via-rose-500 to-amber-300',
    ornament: '囍',
  },
  {
    id: 'floral',
    label: 'Floral / Hoa lá',
    palette: 'rose, cream, eucalyptus green',
    preview: 'from-pink-100 via-white to-emerald-100',
    ornament: '❀',
  },
  {
    id: 'vintage',
    label: 'Vintage / Hoài cổ',
    palette: 'sepia, dusty rose, antique gold',
    preview: 'from-amber-200 via-orange-50 to-rose-200',
    ornament: '❦',
  },
  {
    id: 'modern',
    label: 'Modern / Hiện đại',
    palette: 'white, black, metallic gold',
    preview: 'from-slate-950 via-slate-700 to-amber-300',
    ornament: '◇',
  },
] as const

const AUTO_SAVE_DEBOUNCE_MS = 1000

function buildPersistSnapshot(input: {
  card: WeddingCard
  weddingDateIso: string | null
  musicStartInput: string
  musicEndInput: string
  musicClearOnSave: boolean
  groomImageFile: File | null
  brideImageFile: File | null
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
    venue: card.venue,
    mapUrl: card.mapUrl,
    invitationText: card.invitationText,
    invitationTextEn: card.invitationTextEn,
    guestName: card.guestName,
    storyText: card.storyText,
    albumImageUrls: card.albumImageUrls,
    groomParents: card.groomParents,
    brideParents: card.brideParents,
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
    musicUrl: card.musicUrl,
    musicClearOnSave,
    musicPlayStartSec: card.musicPlayStartSec,
    musicPlayEndSec: card.musicPlayEndSec,
    musicStartInput,
    musicEndInput,
    groomFk: fk(input.groomImageFile),
    brideFk: fk(input.brideImageFile),
    musicFk: fk(input.musicFile),
    albumKeys,
  })
}

const CARD_FACES: Array<{ type: WeddingImageType; label: string; hint: string }> = [
  { type: 'cover', label: 'Bìa chính', hint: 'Ảnh chính + text hệ thống là miễn phí; nền riêng AI tốn 1 credit.' },
  { type: 'invitation', label: 'Lời mời', hint: 'Khoảng trống rộng cho typography tiếng Việt.' },
  { type: 'event', label: 'Thông tin sự kiện', hint: 'Nền nhẹ để hiển thị thời gian, địa điểm, Maps.' },
  { type: 'rsvp', label: 'RSVP', hint: 'Nền cho form xác nhận tham dự.' },
  { type: 'album', label: 'Album / Story', hint: 'Nền lãng mạn cho câu chuyện và ảnh cưới.' },
  { type: 'gift_qr', label: 'QR chia sẻ / mừng cưới', hint: 'Nền sạch quanh khu vực QR.' },
  { type: 'thanks', label: 'Lời cảm ơn', hint: 'Nền kết thúc trang nhã.' },
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
    venue: '',
    mapUrl: '',
    invitationText: '',
    invitationTextEn: '',
    guestName: '',
    storyText: '',
    albumImageUrls: [],
    groomParents: '',
    brideParents: '',
    groomImageUrl: '',
    brideImageUrl: '',
    musicUrl: '',
    musicPlayStartSec: null,
    musicPlayEndSec: null,
    selectedStyleId: styleId,
    colorPalette: STYLES.find((s) => s.id === styleId)?.palette ?? '',
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
  const [rsvps, setRsvps] = useState<WeddingRsvp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<WeddingImageType | null>(null)
  const [extraPrompt, setExtraPrompt] = useState('')
  const [origin, setOrigin] = useState('')
  const [groomImageFile, setGroomImageFile] = useState<File | null>(null)
  const [brideImageFile, setBrideImageFile] = useState<File | null>(null)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicClearOnSave, setMusicClearOnSave] = useState(false)
  const [musicStartInput, setMusicStartInput] = useState('')
  const [musicEndInput, setMusicEndInput] = useState('')
  const [pickedMusicPreviewUrl, setPickedMusicPreviewUrl] = useState<string | null>(null)
  const [albumImageFiles, setAlbumImageFiles] = useState<File[]>([])
  const musicPreviewAudioRef = useRef<WeddingInvitationAudioHandle>(null)
  const vietBanks = useVietQrBanks()

  useEffect(() => {
    setUiLocale(readWebLocaleFromDocumentCookie())
  }, [])
  const tMu = useMemo(() => getDictionary(uiLocale).weddingCardAiMusic, [uiLocale])
  const txCal = useMemo(() => getDictionary(uiLocale).weddingCardCalendar, [uiLocale])
  const txGift = useMemo(() => getDictionary(uiLocale).weddingGiftBox, [uiLocale])
  const tBrief = useMemo(() => getDictionary(uiLocale).weddingCardAiBrief, [uiLocale])

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

  useEffect(() => {
    setOrigin(window.location.origin)
    let mounted = true
    getOrCreateWeddingCard().then((result) => {
      if (!mounted) return
      if ('error' in result) {
        toast({ title: 'Không mở được thiệp', description: result.error, variant: 'destructive' })
      } else {
        setCard(result.card)
        setImages(result.images)
        setRsvps(result.rsvps)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [toast])

  const selectedStyle = STYLES.find((style) => style.id === card.selectedStyleId) ?? STYLES[0]
  const masterImage = images.find((image) => image.id === card.masterImageId) ?? images.find((image) => image.type === 'master')
  const publishUrl = card.isPublished && card.slug && origin ? `${origin}/thiep-moi-cuoi/${card.slug}` : ''
  const weddingDateIso = useMemo(
    () => normalizeWeddingDateToIso(card.weddingDate ?? '') || null,
    [card.weddingDate],
  )
  const missing = useMemo(() => {
    const items = []
    if (!card.groomName || !card.brideName) items.push('tên cô dâu/chú rể')
    if (!weddingDateIso) items.push('ngày cưới')
    if (!card.venue) items.push('địa điểm')
    if (!masterImage?.imageUrl) items.push('ảnh chính')
    if (!card.mapUrl) items.push('Google Maps')
    return items
  }, [card, masterImage, weddingDateIso])

  const update = <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => setCard((prev) => ({ ...prev, [key]: value }))

  const previewMusicStartSec = useMemo(() => parseWeddingMusicTimeToSeconds(musicStartInput.trim()) ?? null, [musicStartInput])
  const previewMusicEndSec = useMemo(() => parseWeddingMusicTimeToSeconds(musicEndInput.trim()) ?? null, [musicEndInput])
  const musicPreviewSrc = pickedMusicPreviewUrl ?? (!musicClearOnSave && card.musicUrl ? card.musicUrl : '')

  const persistInputsRef = useRef({
    card,
    weddingDateIso,
    musicStartInput,
    musicEndInput,
    musicClearOnSave,
    groomImageFile,
    brideImageFile,
    musicFile,
    albumImageFiles,
  })
  persistInputsRef.current = {
    card,
    weddingDateIso,
    musicStartInput,
    musicEndInput,
    musicClearOnSave,
    groomImageFile,
    brideImageFile,
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
        groomImageFile,
        brideImageFile,
        musicFile,
        albumImageFiles,
      }),
    [
      card,
      weddingDateIso,
      musicStartInput,
      musicEndInput,
      musicClearOnSave,
      groomImageFile,
      brideImageFile,
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
      const formData = new FormData()
      Object.entries({
        cardId: c.id,
        groomName: c.groomName,
        brideName: c.brideName,
        weddingDate: p.weddingDateIso ?? '',
        weddingTime: c.weddingTime,
        venue: c.venue,
        mapUrl: c.mapUrl,
        invitationText: c.invitationText,
        invitationTextEn: c.invitationTextEn,
        guestName: c.guestName,
        storyText: c.storyText,
        albumImageUrls: c.albumImageUrls.join('\n'),
        groomParents: c.groomParents,
        brideParents: c.brideParents,
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
      }).forEach(([key, value]) => formData.append(key, value))
      formData.append('musicPlayStartSec', p.musicStartInput.trim())
      formData.append('musicPlayEndSec', p.musicEndInput.trim())
      if (p.groomImageFile) formData.append('groomImage', p.groomImageFile)
      if (p.brideImageFile) formData.append('brideImage', p.brideImageFile)
      if (p.musicFile) formData.append('musicFile', p.musicFile)
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
      setCard(result.card)
      setGroomImageFile(null)
      setBrideImageFile(null)
      setMusicFile(null)
      setMusicClearOnSave(false)
      setAlbumImageFiles([])

      window.setTimeout(() => {
        lastSavedPersistRef.current = buildPersistSnapshot(persistInputsRef.current)
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

  const generateImage = async (type: WeddingImageType) => {
    if (!card.id || generating) return
    setGenerating(type)
    await waitForNextPaint()
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('type', type)
    formData.append('extraPrompt', extraPrompt)
    const result = await generateWeddingCardImage(formData)
    setGenerating(null)
    if ('error' in result) {
      toast({ title: 'Tạo ảnh thất bại', description: result.error, variant: 'destructive', duration: 6000 })
      return
    }
    const fresh = await getOrCreateWeddingCard()
    if (!('error' in fresh)) {
      setCard(fresh.card)
      setImages(fresh.images)
      setRsvps(fresh.rsvps)
    }
    toast({ title: type === 'master' ? 'Đã tạo ảnh chính' : 'Đã tạo nền riêng', description: 'Đã trừ 1 credit.' })
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
      setCard(result.card)
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
              <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Tạo thiệp mời cưới bằng AI</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Chọn preset miễn phí, preview nội dung bằng HTML/CSS, chỉ tốn credit khi AI sinh ảnh mới. Text tiếng Việt do hệ thống render riêng.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
              <b>Credit:</b> 1 ảnh AI = 1 credit. Sửa text, preview, QR, RSVP, tải ảnh, xuất bản = 0 credit.
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Chọn phong cách</CardTitle>
                <CardDescription>Chỉ chọn preset/thumbnail có sẵn, không gọi API và không tốn credit.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      update('selectedStyleId', style.id)
                      update('colorPalette', style.palette)
                    }}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition hover:border-rose-300 hover:bg-rose-50',
                      card.selectedStyleId === style.id && 'border-rose-500 bg-rose-50 ring-2 ring-rose-100'
                    )}
                  >
                    <div className={cn('relative h-28 overflow-hidden rounded-xl bg-gradient-to-br shadow-inner', style.preview)}>
                      <div className="absolute inset-3 rounded-xl border border-white/70" />
                      <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-white/35 blur-xl" />
                      <div className="absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-white/30 blur-xl" />
                      <div className="absolute inset-x-0 top-1/2 text-center font-serif text-4xl text-white/90 drop-shadow">
                        {style.ornament}
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 h-8 rounded-full bg-white/35 backdrop-blur-sm" />
                    </div>
                    <p className="mt-3 font-semibold">{style.label}</p>
                    <p className="text-xs text-muted-foreground">{style.palette}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle>2. Nhập thông tin cưới</CardTitle>
                    <CardDescription>{tBrief.step2Description}</CardDescription>
                  </div>
                  {autosaveBanner ? (
                    <p
                      role="status"
                      className={cn(
                        'shrink-0 text-xs sm:max-w-[240px] sm:text-right sm:text-sm',
                        autosaveBanner.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {autosaveBanner.message}
                    </p>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tên chú rể" value={card.groomName} onChange={(v) => update('groomName', v)} />
                  <Field label="Tên cô dâu" value={card.brideName} onChange={(v) => update('brideName', v)} />
                  <Field label="Ngày cưới" type="date" value={weddingDateIso ?? ''} onChange={(v) => update('weddingDate', v)} />
                  <Field label="Giờ cưới" value={card.weddingTime} onChange={(v) => update('weddingTime', v)} placeholder="17:30, Chủ nhật..." />
                </div>
                <Field label="Địa điểm" value={card.venue} onChange={(v) => update('venue', v)} />
                <Field label="Google Maps link" value={card.mapUrl} onChange={(v) => update('mapUrl', v)} placeholder="https://maps.google.com/..." />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tên bố mẹ nhà trai" value={card.groomParents} onChange={(v) => update('groomParents', v)} />
                  <Field label="Tên bố mẹ nhà gái" value={card.brideParents} onChange={(v) => update('brideParents', v)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ImageUploadField
                    label="Ảnh chú rể tham chiếu"
                    currentUrl={card.groomImageUrl}
                    file={groomImageFile}
                    onFileChange={setGroomImageFile}
                  />
                  <ImageUploadField
                    label="Ảnh cô dâu tham chiếu"
                    currentUrl={card.brideImageUrl}
                    file={brideImageFile}
                    onFileChange={setBrideImageFile}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ảnh cô dâu/chú rể chỉ dùng làm tham chiếu khi tạo ảnh AI; upload/lưu ảnh tham chiếu không tốn credit.
                </p>
                <div className="space-y-2">
                  <Label>Tên khách mời trên thiệp (tuỳ chọn)</Label>
                  <Input
                    value={card.guestName}
                    onChange={(e) => update('guestName', e.target.value)}
                    placeholder="Anh Chị Minh - Thanh"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lời mời</Label>
                  <Textarea
                    value={card.invitationText}
                    onChange={(e) => update('invitationText', e.target.value)}
                    placeholder="Trân trọng kính mời quý khách đến dự lễ thành hôn..."
                    className="min-h-28"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lời mời tiếng Anh</Label>
                  <Textarea
                    value={card.invitationTextEn}
                    onChange={(e) => update('invitationTextEn', e.target.value)}
                    placeholder="Cordially invites you to celebrate with our family..."
                    className="min-h-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Câu chuyện / album ngắn</Label>
                  <Textarea
                    value={card.storyText}
                    onChange={(e) => update('storyText', e.target.value)}
                    placeholder="Một đoạn ngắn về hành trình yêu thương, lời nhắn gửi hoặc album/story..."
                    className="min-h-24"
                  />
                </div>
                <div className="space-y-3 rounded-2xl border p-3">
                  <Label>Album ảnh cô dâu chú rể</Label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    Chọn nhiều ảnh album
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(event) => setAlbumImageFiles(Array.from(event.target.files ?? []))}
                    />
                  </label>
                  {(card.albumImageUrls.length > 0 || albumImageFiles.length > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      {card.albumImageUrls.map((url) => (
                        <img key={url} src={url} alt="Ảnh album đã lưu" className="h-24 rounded-xl object-cover" />
                      ))}
                      {albumImageFiles.map((file) => (
                        <img key={`${file.name}-${file.size}`} src={URL.createObjectURL(file)} alt="Ảnh album mới" className="h-24 rounded-xl object-cover" />
                      ))}
                    </div>
                  )}
                  <Textarea
                    value={card.albumImageUrls.join('\n')}
                    onChange={(e) => update('albumImageUrls', e.target.value.split('\n').map((url) => url.trim()).filter(Boolean))}
                    placeholder="Hoặc dán URL ảnh album, mỗi dòng một ảnh"
                    className="min-h-20"
                  />
                  <p className="text-xs text-muted-foreground">Thêm/sửa album ảnh không tốn credit.</p>
                </div>
                <Field label="Bảng màu AI" value={card.colorPalette} onChange={(v) => update('colorPalette', v)} />
                <div className="space-y-3 rounded-2xl border p-3">
                  <Label>Nhạc nền thiệp — tải file lên</Label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    Chọn file nhạc (.mp3, .m4a, .wav…)
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
                    Chỉ hỗ trợ nhạc tải lên; không nhập link Zing / Spotify. Thêm / đổi / nghe thử không tốn credit.
                  </p>
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
                  {masterImage?.imageUrl ? (
                    <img src={masterImage.imageUrl} alt="Ảnh chính thiệp cưới" className="max-h-96 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-muted text-center text-sm text-muted-foreground">
                      <Sparkles className="mb-2 h-8 w-8 text-rose-500" />
                      Chưa có ảnh chính. Preview nháp vẫn dùng HTML/CSS và chưa tốn credit.
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => generateImage('master')} disabled={Boolean(generating)}>
                      {generating === 'master' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {masterImage ? 'Tạo lại ảnh chính - 1 credit' : 'Tạo ảnh chính - 1 credit'}
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          disabled={Boolean(generating) || !masterImage?.imageUrl}
                          onClick={() => generateImage(face.type)}
                        >
                          {generating === face.type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Tạo nền riêng - 1 credit
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>3 & 8. Preview nháp</CardTitle>
                <CardDescription>Mobile/desktop đều render text thật bằng hệ thống, không tốn credit.</CardDescription>
              </CardHeader>
              <CardContent>
                {missing.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Cần kiểm tra thêm: {missing.join(', ')}.
                  </div>
                )}
                <div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] border bg-white shadow-xl">
                  <div
                    className="relative min-h-[560px] bg-cover bg-center p-6 text-center"
                    style={{
                      backgroundImage: masterImage?.imageUrl
                        ? `linear-gradient(to bottom, rgba(255,255,255,.35), rgba(255,255,255,.75)), url(${masterImage.imageUrl})`
                        : 'linear-gradient(135deg, #fff7ed, #fff1f2 45%, #fef3c7)',
                    }}
                  >
                    <div className="absolute inset-5 rounded-[1.5rem] border border-amber-300/70" />
                    <div className="relative z-10 flex min-h-[510px] flex-col items-center justify-center gap-5 text-slate-900">
                      <p className="text-xs uppercase tracking-[0.35em] text-rose-700">Wedding Invitation</p>
                      <Heart className="h-8 w-8 fill-rose-200 text-rose-500" />
                      <div>
                        <h2 className="font-serif text-4xl italic">{card.groomName || 'Chú rể'}</h2>
                        <p className="my-2 text-lg">&</p>
                        <h2 className="font-serif text-4xl italic">{card.brideName || 'Cô dâu'}</h2>
                      </div>
                      <p className="max-w-xs text-sm leading-6">
                        {card.invitationText || 'Trân trọng kính mời quý khách đến dự lễ thành hôn của chúng tôi.'}
                      </p>
                      {card.guestName && (
                        <div className="rounded-2xl bg-white/70 px-5 py-2 text-sm shadow-sm">
                          Thân mời / Cordially invites<br />
                          <b>{card.guestName}</b>
                        </div>
                      )}
                      <div className="rounded-2xl bg-white/70 px-3 py-3 text-sm shadow-sm backdrop-blur">
                        {weddingDateIso ? (
                          <WeddingEventCalendarBlock
                            weddingDateIso={weddingDateIso}
                            weddingTimeText={card.weddingTime}
                            locale={uiLocale}
                            tx={txCal}
                            compact
                            className="mx-auto mb-3 max-w-[260px]"
                          />
                        ) : (
                          <p className="font-semibold">{card.weddingDate || 'Ngày cưới'} · {card.weddingTime || 'Giờ cưới'}</p>
                        )}
                        <p className="mt-1 flex items-center justify-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {card.venue || 'Địa điểm tổ chức'}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        {card.rsvpEnabled && <span className="rounded-full bg-white/70 px-3 py-1">RSVP bật</span>}
                        {(card.giftQrEnabled && (isTwinVietGiftReady(card) || card.giftQrImageUrl.trim())) ? (
                          <span className="rounded-full bg-white/70 px-3 py-1">{txGift.boxTitle}</span>
                        ) : null}
                        {(card.musicUrl || musicFile) && !musicClearOnSave ? (
                          <span className="rounded-full bg-white/70 px-3 py-1">Có nhạc nền</span>
                        ) : null}
                        <span className="rounded-full bg-white/70 px-3 py-1">{selectedStyle.label}</span>
                      </div>
                    </div>
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
                {publishUrl && (
                  <div className="rounded-2xl bg-muted p-3 text-sm">
                    <p className="break-all font-medium">{publishUrl}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={publishUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Mở link
                        </a>
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
