'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ImagePreview } from '@/components/ui/image-preview'
import { Clapperboard, Loader2, Mic2, Sparkles, Upload } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  createMusicVideoVeo8s,
  generateMusicVideoLyricsNextSegment,
  mergeFlowMusicVeoClips,
} from '@/app/flow-nhac-video-veo/actions'
import { buildMusicClipVisualNotesBlock, describeGenreForLyricsEn } from '@/lib/music/music-video-veo-prompt'
import {
  MV_BPM,
  MV_DENSITY,
  MV_GENRE_OPTIONS,
  MV_STRUCTURE,
  MV_VOICE_GENDER,
  MV_VOICE_LANG,
  MV_VOICE_TIMBRE,
  type MvUiLocale,
} from '@/lib/music/music-video-flow-ui-constants'
import { preloadImageUrl } from '@/lib/preload-image-url'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = { copy: Dictionary['flowMusicVeo'] }

type Aspect = '16:9' | '9:16'

const LYRICS_CREDITS = 1
const CLIP_CREDITS = 8
const MAX_SEGMENTS = 20
const MIN_SEGMENT_CHARS = 8

/** Tắt toàn bộ khối tạo clip Veo / xem video / ghép MP4 — chỉ còn bước lời. */
const SHOW_MUSIC_VEO_VIDEO_UI = false

/** Giọng / tempo / cấu trúc — chỉ cho prompt Veo, không gửi Flash sinh lời. */
function FlowVeoStyleFieldsNoGenre({
  t,
  L,
  voiceGender,
  setVoiceGender,
  voiceTimbre,
  setVoiceTimbre,
  voiceLang,
  setVoiceLang,
  bpm,
  setBpm,
  structure,
  setStructure,
  density,
  setDensity,
  intro,
  compact,
}: {
  t: Dictionary['flowMusicVeo']
  L: (row: { label: Record<MvUiLocale, string> }) => string
  voiceGender: (typeof MV_VOICE_GENDER)[number]['value']
  setVoiceGender: (v: (typeof MV_VOICE_GENDER)[number]['value']) => void
  voiceTimbre: (typeof MV_VOICE_TIMBRE)[number]['value']
  setVoiceTimbre: (v: (typeof MV_VOICE_TIMBRE)[number]['value']) => void
  voiceLang: (typeof MV_VOICE_LANG)[number]['value']
  setVoiceLang: (v: (typeof MV_VOICE_LANG)[number]['value']) => void
  bpm: (typeof MV_BPM)[number]['value']
  setBpm: (v: (typeof MV_BPM)[number]['value']) => void
  structure: (typeof MV_STRUCTURE)[number]['value']
  setStructure: (v: (typeof MV_STRUCTURE)[number]['value']) => void
  density: (typeof MV_DENSITY)[number]['value']
  setDensity: (v: (typeof MV_DENSITY)[number]['value']) => void
  intro?: ReactNode
  compact?: boolean
}) {
  const ts = compact ? 'mt-1 h-9' : 'mt-1'
  return (
    <div className="space-y-2">
      {intro ? <div className="text-xs text-muted-foreground">{intro}</div> : null}
      <div className={`grid gap-2 sm:grid-cols-2 ${compact ? '' : ''}`}>
        <div>
          <Label className={compact ? 'text-xs' : ''}>{t.voiceGenderLabel}</Label>
          <Select value={voiceGender} onValueChange={(v) => setVoiceGender(v as (typeof MV_VOICE_GENDER)[number]['value'])}>
            <SelectTrigger className={ts}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MV_VOICE_GENDER.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {L(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={compact ? 'text-xs' : ''}>{t.voiceTimbreLabel}</Label>
          <Select value={voiceTimbre} onValueChange={(v) => setVoiceTimbre(v as (typeof MV_VOICE_TIMBRE)[number]['value'])}>
            <SelectTrigger className={ts}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MV_VOICE_TIMBRE.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {L(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={compact ? 'text-xs' : ''}>{t.voiceLangLabel}</Label>
          <Select value={voiceLang} onValueChange={(v) => setVoiceLang(v as (typeof MV_VOICE_LANG)[number]['value'])}>
            <SelectTrigger className={ts}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MV_VOICE_LANG.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {L(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={compact ? 'text-xs' : ''}>{t.bpmLabel}</Label>
          <Select value={bpm} onValueChange={(v) => setBpm(v as (typeof MV_BPM)[number]['value'])}>
            <SelectTrigger className={ts}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MV_BPM.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {L(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={compact ? 'text-xs' : ''}>{t.structureLabel}</Label>
          <Select value={structure} onValueChange={(v) => setStructure(v as (typeof MV_STRUCTURE)[number]['value'])}>
            <SelectTrigger className={ts}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MV_STRUCTURE.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {L(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className={compact ? 'text-xs' : ''}>{t.densityLabel}</Label>
          <Select value={density} onValueChange={(v) => setDensity(v as (typeof MV_DENSITY)[number]['value'])}>
            <SelectTrigger className={ts}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MV_DENSITY.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {L(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

function getWebLocaleFromCookie(): MvUiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

export default function FlowNhacVideoVeoClientPage({ copy: t }: Props) {
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const [uiLocale, setUiLocale] = useState<MvUiLocale>('vi')

  const [hint, setHint] = useState('')
  const [lyricsImage, setLyricsImage] = useState<File | null>(null)
  const [lyricsImagePreview, setLyricsImagePreview] = useState<string | null>(null)
  const [genre, setGenre] = useState(MV_GENRE_OPTIONS[1]!.value)
  const [voiceGender, setVoiceGender] = useState(MV_VOICE_GENDER[0]!.value)
  const [voiceTimbre, setVoiceTimbre] = useState(MV_VOICE_TIMBRE[0]!.value)
  const [voiceLang, setVoiceLang] = useState(MV_VOICE_LANG[0]!.value)
  const [bpm, setBpm] = useState(MV_BPM[0]!.value)
  const [structure, setStructure] = useState(MV_STRUCTURE[0]!.value)
  const [density, setDensity] = useState(MV_DENSITY[0]!.value)

  const [progAspect, setProgAspect] = useState<Aspect>('16:9')
  const [progFrameFiles, setProgFrameFiles] = useState<File[]>([])
  const [progFramePreviews, setProgFramePreviews] = useState<string[]>([])
  const [progCamera, setProgCamera] = useState('')
  const [progCharacter, setProgCharacter] = useState('')

  const [segmentTexts, setSegmentTexts] = useState<string[]>([''])
  const [chainHistory, setChainHistory] = useState<{ url: string }[]>([])
  const [videoWizardOpenThrough, setVideoWizardOpenThrough] = useState(1)

  const [busyLyrics, setBusyLyrics] = useState(false)
  /** 1 = đang tạo clip đoạn 1, ≥2 = đang tạo clip đoạn tương ứng, null = rảnh */
  const [creatingSegmentIndex, setCreatingSegmentIndex] = useState<number | null>(null)
  const [mergingClips, setMergingClips] = useState(false)
  const [mergedResultUrl, setMergedResultUrl] = useState<string | null>(null)

  const L = (row: { label: Record<MvUiLocale, string> }) => row.label[uiLocale]

  useEffect(() => {
    const sync = () => setUiLocale(getWebLocaleFromCookie())
    sync()
    const id = window.setInterval(sync, 1200)
    return () => window.clearInterval(id)
  }, [])

  const lyricsStyleContextEn = useMemo(() => describeGenreForLyricsEn(genre), [genre])

  const nextProgressiveSegmentOneBased = useMemo(() => {
    const n = Math.min(MAX_SEGMENTS, Math.max(1, segmentTexts.length))
    for (let i = 0; i < n; i++) {
      const s = (segmentTexts[i] ?? '').trim()
      if (s.length < MIN_SEGMENT_CHARS) {
        for (let j = 0; j < i; j++) {
          if ((segmentTexts[j] ?? '').trim().length < MIN_SEGMENT_CHARS) return null
        }
        return i + 1
      }
    }
    return null
  }, [segmentTexts])

  const clearLyricsImage = useCallback(() => {
    if (lyricsImagePreview) URL.revokeObjectURL(lyricsImagePreview)
    setLyricsImagePreview(null)
    setLyricsImage(null)
  }, [lyricsImagePreview])

  const onLyricsImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setLyricsImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setLyricsImage(file)
  }

  const resetProgressiveClipForm = useCallback((opts?: { keepAspect?: boolean }) => {
    setProgCamera('')
    setProgCharacter('')
    setProgFrameFiles([])
    setProgFramePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u))
      return []
    })
    if (!opts?.keepAspect) setProgAspect('16:9')
  }, [])

  const onProgFramesPick = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    const imgs = list.filter((f) => f.type.startsWith('image/')).slice(0, 3)
    setProgFramePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u))
      return imgs.map((f) => URL.createObjectURL(f))
    })
    setProgFrameFiles(imgs)
  }

  useEffect(() => {
    return () => {
      progFramePreviews.forEach((u) => URL.revokeObjectURL(u))
      if (lyricsImagePreview) URL.revokeObjectURL(lyricsImagePreview)
    }
  }, [progFramePreviews, lyricsImagePreview])

  const appendStyleForm = (fd: FormData) => {
    fd.append('genre', genre)
    fd.append('voiceGender', voiceGender)
    fd.append('voiceTimbre', voiceTimbre)
    fd.append('voiceLanguage', voiceLang)
    fd.append('bpmPreset', bpm)
    fd.append('structurePreset', structure)
    fd.append('densityPreset', density)
  }

  const runLyricsNextSegment = async () => {
    if (hint.trim().length < 4 && !lyricsImage) {
      toast({ title: t.lyricsNeedHintOrImage, variant: 'destructive' })
      return
    }
    const n = Math.min(MAX_SEGMENTS, Math.max(1, segmentTexts.length))
    const k = nextProgressiveSegmentOneBased
    if (k == null) {
      toast({ title: t.stepLyricsBody, variant: 'destructive' })
      return
    }
    const prior = segmentTexts.slice(0, k - 1).map((s) => s.trim())
    const ok = checkCreditsAndProceed(LYRICS_CREDITS, () => {
      void (async () => {
        setBusyLyrics(true)
        try {
          const fd = new FormData()
          fd.append('hint', hint.trim())
          fd.append('locale', uiLocale)
          fd.append('blockCount', String(n))
          fd.append('segmentOneBased', String(k))
          fd.append('priorSegmentsJson', JSON.stringify(prior))
          fd.append('styleContextEn', lyricsStyleContextEn)
          if (lyricsImage) fd.append('lyricsImage', lyricsImage)
          const res = await generateMusicVideoLyricsNextSegment(fd)
          if (res.error) {
            toast({ title: res.error, variant: 'destructive', duration: 8000 })
            return
          }
          if (res.success && res.lyrics) {
            const line = res.lyrics.trim()
            const nextSegs = [...segmentTexts]
            while (nextSegs.length < n) nextSegs.push('')
            nextSegs[k - 1] = line
            setSegmentTexts(nextSegs)
            toast({
              title: t.successLyricsOneSegment.replace('{k}', String(k)).replace('{n}', String(n)),
            })
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
          }
        } finally {
          setBusyLyrics(false)
        }
      })()
    })
    if (!ok) return
  }

  const runSegment1Video = async () => {
    const n = Math.min(MAX_SEGMENTS, Math.max(1, segmentTexts.length))
    const composedFull = segmentTexts
      .slice(0, n)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n\n')
    if (composedFull.length < 12) {
      toast({ title: t.stepLyricsBody, variant: 'destructive' })
      return
    }
    const open0 = (segmentTexts[0] ?? '').trim()
    if (open0.length < MIN_SEGMENT_CHARS) {
      toast({
        title: t.segmentIndexLabel.replace('{n}', '1'),
        description: t.openingLyricsHelp,
        variant: 'destructive',
      })
      return
    }
    if (progFrameFiles.length === 0) {
      toast({ title: t.needImage, variant: 'destructive' })
      return
    }
    const visualForClip = buildMusicClipVisualNotesBlock({
      camera: progCamera,
      character: progCharacter,
    })
    const ok = checkCreditsAndProceed(CLIP_CREDITS, () => {
      void (async () => {
        setCreatingSegmentIndex(1)
        try {
          const fd = new FormData()
          fd.append('aspectRatio', progAspect)
          fd.append('fullLyrics', composedFull)
          fd.append('openingLyrics', open0)
          fd.append('visualExtra', visualForClip)
          fd.append('segmentTotal', String(n))
          fd.append('segmentIndex', '0')
          appendStyleForm(fd)
          progFrameFiles.forEach((f) => fd.append('frames', f))
          const res = await createMusicVideoVeo8s(fd)
          if (res.error) {
            toast({ title: res.error, variant: 'destructive', duration: 8000 })
            return
          }
          if (res.success && res.resultUrl) {
            await preloadImageUrl(res.resultUrl)
            setChainHistory([{ url: res.resultUrl }])
            setMergedResultUrl(null)
            setVideoWizardOpenThrough(1)
            toast({ title: t.successClip })
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
          }
        } finally {
          setCreatingSegmentIndex(null)
        }
      })()
    })
    if (!ok) return
  }

  const runStandaloneSegmentVideo = async (segmentOneBased: number) => {
    const n = Math.min(MAX_SEGMENTS, Math.max(1, segmentTexts.length))
    if (segmentOneBased < 2 || segmentOneBased > n) return
    if (chainHistory.length < segmentOneBased - 1) {
      toast({
        title: t.segmentIndexLabel.replace('{n}', String(segmentOneBased - 1)),
        description: t.createSegment1VideoButton,
        variant: 'destructive',
      })
      return
    }
    const composedFull = segmentTexts
      .slice(0, n)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n\n')
    const lyrics = (segmentTexts[segmentOneBased - 1] ?? '').trim()
    if (lyrics.length < MIN_SEGMENT_CHARS) {
      toast({
        title: t.segmentIndexLabel.replace('{n}', String(segmentOneBased)),
        description: t.openingLyricsHelp,
        variant: 'destructive',
      })
      return
    }
    if (progFrameFiles.length === 0) {
      toast({ title: t.needImage, variant: 'destructive' })
      return
    }
    const visualForClip = buildMusicClipVisualNotesBlock({
      camera: progCamera,
      character: progCharacter,
    })
    const ok = checkCreditsAndProceed(CLIP_CREDITS, () => {
      void (async () => {
        setCreatingSegmentIndex(segmentOneBased)
        try {
          const fd = new FormData()
          fd.append('aspectRatio', progAspect)
          fd.append('fullLyrics', composedFull)
          fd.append('openingLyrics', lyrics)
          fd.append('visualExtra', visualForClip)
          fd.append('segmentTotal', String(n))
          fd.append('segmentIndex', String(segmentOneBased - 1))
          appendStyleForm(fd)
          progFrameFiles.forEach((f) => fd.append('frames', f))
          const res = await createMusicVideoVeo8s(fd)
          if (res.error) {
            toast({
              title: res.error,
              variant: 'destructive',
              duration: 10000,
            })
            return
          }
          if (!res.success || !res.resultUrl) {
            toast({
              title: t.partialSegmentsFail.replace('{n}', String(segmentOneBased)),
              variant: 'destructive',
              duration: 10000,
            })
            return
          }
          await preloadImageUrl(res.resultUrl)
          setMergedResultUrl(null)
          setChainHistory((prev) => {
            const next = [...prev.slice(0, segmentOneBased - 1), { url: res.resultUrl }]
            return next
          })
          toast({
            title: t.successExtendSegment.replace('{k}', String(segmentOneBased)),
          })
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
        } finally {
          setCreatingSegmentIndex(null)
        }
      })()
    })
    if (!ok) return
  }

  const runMergeClips = async () => {
    if (chainHistory.length < 2) return
    setMergingClips(true)
    try {
      const fd = new FormData()
      fd.append('clipUrlsJson', JSON.stringify(chainHistory.map((c) => c.url)))
      fd.append('aspectRatio', progAspect)
      const res = await mergeFlowMusicVeoClips(fd)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive', duration: 10000 })
        return
      }
      if ('success' in res && res.success && res.resultUrl) {
        await preloadImageUrl(res.resultUrl)
        setMergedResultUrl(res.resultUrl)
        toast({ title: t.successMergedClip, duration: 6000 })
      }
    } finally {
      setMergingClips(false)
    }
  }

  const startOver = () => {
    clearLyricsImage()
    setHint('')
    setProgAspect('16:9')
    setProgFrameFiles([])
    setProgFramePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u))
      return []
    })
    setProgCamera('')
    setProgCharacter('')
    setChainHistory([])
    setMergedResultUrl(null)
    setVideoWizardOpenThrough(1)
    setSegmentTexts([''])
  }

  const optBtn = (active: boolean) =>
    active
      ? 'border-violet-500 bg-violet-50 text-violet-800'
      : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'

  const nSeg = Math.min(MAX_SEGMENTS, Math.max(1, segmentTexts.length))
  const videoWizardVisibleThrough = Math.min(Math.max(1, videoWizardOpenThrough), nSeg)

  const lyricsRowReady = (segOneBased: number) =>
    (segmentTexts[segOneBased - 1] ?? '').trim().length >= MIN_SEGMENT_CHARS

  const openNextVideoSegment = (nextThrough: number) => {
    resetProgressiveClipForm({ keepAspect: true })
    setVideoWizardOpenThrough(nextThrough)
  }

  /** Sau video đoạn `segOneBased`: mở ô lời + wizard đoạn tiếp theo để sinh lời / chỉnh Veo rồi nối. */
  const addEightMoreAfterSegment = (segOneBased: number) => {
    const next = segOneBased + 1
    if (next > MAX_SEGMENTS) return
    setSegmentTexts((prev) => {
      if (prev.length >= next) return prev
      const copy = [...prev]
      while (copy.length < next) copy.push('')
      return copy
    })
    openNextVideoSegment(next)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Clapperboard className="h-8 w-8 text-violet-600" />
            {t.headline}
          </h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
          {SHOW_MUSIC_VEO_VIDEO_UI ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">{t.veoAudioNote}</p>
          ) : null}
          <DepositCreditButton className="justify-center" />
        </div>

        <Card className="border-violet-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic2 className="h-5 w-5 text-violet-600" />
              {t.stepLyricsTitle}
            </CardTitle>
            <CardDescription className="text-xs">{t.stepLyricsBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-violet-900">{t.styleBlockTitle}</p>
              <div className="max-w-md">
                <Label className="text-sm">{t.genreLabel}</Label>
                <Select value={genre} onValueChange={(v) => setGenre(v as (typeof MV_GENRE_OPTIONS)[number]['value'])}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MV_GENRE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {L(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">{t.lyricsGenreOnlyHelp}</p>
              </div>
            </div>
            <div>
              <Label className="text-sm">{t.lyricsImageHelp}</Label>
              <Input type="file" accept="image/*" onChange={onLyricsImagePick} className="mt-1" />
              {lyricsImagePreview ? (
                <div className="mt-2 max-w-xs relative">
                  <ImagePreview src={lyricsImagePreview} alt="" />
                  <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={clearLyricsImage}>
                    ×
                  </Button>
                </div>
              ) : null}
            </div>
            <div>
              <Label className="text-sm">{t.hintLabel}</Label>
              <Textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={t.hintPlaceholder}
                className="mt-1 min-h-[80px]"
                maxLength={2000}
              />
            </div>
          </CardContent>
        </Card>

        {(busyLyrics ||
          (SHOW_MUSIC_VEO_VIDEO_UI && (creatingSegmentIndex !== null || mergingClips))) && (
          <Card className="border-violet-200/60">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
              <p className="text-sm text-muted-foreground text-center">
                {SHOW_MUSIC_VEO_VIDEO_UI && mergingClips
                  ? t.mergingClips
                  : SHOW_MUSIC_VEO_VIDEO_UI && creatingSegmentIndex !== null
                    ? t.extendingVeoSegmentBusy.replace('{k}', String(creatingSegmentIndex))
                    : busyLyrics
                      ? t.generatingLyrics
                      : t.creatingClip}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-violet-200/60">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-6">
              {segmentTexts.map((text, idx) => {
                const segNum = idx + 1
                const isFirst = idx === 0
                const lyricsK = (segmentTexts[idx] ?? '').trim()
                const doneThis = chainHistory.length >= segNum
                const busyThisSegment = creatingSegmentIndex === segNum
                const videoUnlocked = isFirst || videoWizardVisibleThrough >= segNum
                const showProgressiveGen = nextProgressiveSegmentOneBased === segNum
                const showOpenNextLyricsBox =
                  segNum === segmentTexts.length &&
                  lyricsRowReady(segNum) &&
                  segmentTexts.length < MAX_SEGMENTS

                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-violet-200/70 bg-background/40 p-3 space-y-3"
                  >
                    <Label className="text-sm">{t.segmentIndexLabel.replace('{n}', String(segNum))}</Label>
                    <Textarea
                      value={text}
                      onChange={(e) => {
                        const v = e.target.value
                        setSegmentTexts((prev) => {
                          const next = [...prev]
                          next[idx] = v
                          return next
                        })
                      }}
                      className="min-h-[72px]"
                      maxLength={4000}
                    />

                    {(showProgressiveGen || showOpenNextLyricsBox) ? (
                      <div className="space-y-2 rounded-md border border-amber-200/70 bg-amber-50/40 p-2">
                        {showProgressiveGen ? (
                          <Button
                            type="button"
                            disabled={
                              busyLyrics ||
                              (hint.trim().length < 4 && !lyricsImage)
                            }
                            onClick={() => void runLyricsNextSegment()}
                          >
                            {busyLyrics ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            {t.generateNextSegmentButton
                              .replace('{k}', String(segNum))
                              .replace('{n}', String(nSeg))}
                          </Button>
                        ) : null}
                        {showOpenNextLyricsBox ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSegmentTexts((prev) => [...prev, ''])
                            }}
                          >
                            {t.openNextLyricsSegmentButton.replace('{k}', String(segNum + 1))}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    {SHOW_MUSIC_VEO_VIDEO_UI ? (
                      !videoUnlocked ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">{t.segmentVideoSubBlockHint}</p>
                          <p className="text-xs text-muted-foreground border-l-2 border-violet-200 pl-2">
                            {t.videoForSegmentLockedNote}
                          </p>
                        </div>
                      ) : isFirst ? (
                        <div className="space-y-2">
                          {chainHistory.length < 1 ? (
                            <>
                              <p className="text-sm font-medium text-violet-900">
                                {t.progressiveVideoSectionTitle.replace('{k}', '1')}
                              </p>
                              <p className="text-xs text-muted-foreground">{t.videoBlockBody}</p>
                              <div className="rounded-md border border-violet-100 bg-violet-50/25 p-3 space-y-3">
                                <FlowVeoStyleFieldsNoGenre
                                  t={t}
                                  L={L}
                                  voiceGender={voiceGender}
                                  setVoiceGender={setVoiceGender}
                                  voiceTimbre={voiceTimbre}
                                  setVoiceTimbre={setVoiceTimbre}
                                  voiceLang={voiceLang}
                                  setVoiceLang={setVoiceLang}
                                  bpm={bpm}
                                  setBpm={setBpm}
                                  structure={structure}
                                  setStructure={setStructure}
                                  density={density}
                                  setDensity={setDensity}
                                  intro={t.veoStyleFieldsIntro}
                                  compact
                                />
                                <div>
                                  <p className="text-sm font-medium mb-2">{t.aspectLabel}</p>
                                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                                    <button
                                      type="button"
                                      className={`rounded-md border px-3 py-2 text-sm font-medium ${optBtn(progAspect === '16:9')}`}
                                      onClick={() => setProgAspect('16:9')}
                                    >
                                      {t.aspect169}
                                    </button>
                                    <button
                                      type="button"
                                      className={`rounded-md border px-3 py-2 text-sm font-medium ${optBtn(progAspect === '9:16')}`}
                                      onClick={() => setProgAspect('9:16')}
                                    >
                                      {t.aspect916}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <Label className="flex items-center gap-2 text-sm">
                                    <Upload className="h-4 w-4" />
                                    {t.framesLabel}
                                  </Label>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={onProgFramesPick}
                                    className="mt-1"
                                  />
                                  {progFramePreviews.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {progFramePreviews.map((src) => (
                                        <div key={src} className="w-24 h-24 rounded border overflow-hidden">
                                          <ImagePreview src={src} alt="" className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                <div>
                                  <Label className="text-sm">{t.cameraHintLabel}</Label>
                                  <Textarea
                                    value={progCamera}
                                    onChange={(e) => setProgCamera(e.target.value)}
                                    placeholder={t.cameraHintPlaceholder}
                                    className="mt-1 min-h-[48px]"
                                    maxLength={800}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">{t.characterStoryLabel}</Label>
                                  <Textarea
                                    value={progCharacter}
                                    onChange={(e) => setProgCharacter(e.target.value)}
                                    placeholder={t.characterStoryPlaceholder}
                                    className="mt-1 min-h-[48px]"
                                    maxLength={800}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  disabled={
                                    creatingSegmentIndex !== null ||
                                    busyLyrics ||
                                    mergingClips ||
                                    progFrameFiles.length === 0
                                  }
                                  onClick={() => void runSegment1Video()}
                                >
                                  {creatingSegmentIndex === 1 ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                  )}
                                  {t.createSegment1VideoButton}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="space-y-3 pt-1">
                              <p className="text-xs font-medium text-violet-800">
                                {t.videoAfterSegmentLabel.replace('{n}', '1').replace('{seconds}', '8')}
                              </p>
                              <video
                                src={chainHistory[0]!.url}
                                controls
                                className="w-full max-h-[360px] rounded-md bg-black"
                                playsInline
                              />
                              <Button asChild variant="link" className="h-auto p-0 text-sm">
                                <a href={chainHistory[0]!.url} download target="_blank" rel="noreferrer">
                                  {t.downloadMp4Step.replace('{n}', '1')}
                                </a>
                              </Button>
                              {chainHistory.length === 1 && chainHistory.length < MAX_SEGMENTS ? (
                                <div className="space-y-2 rounded-md border border-violet-200/80 bg-violet-50/40 p-3">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                    disabled={
                                      creatingSegmentIndex !== null || busyLyrics || mergingClips
                                    }
                                    onClick={() => addEightMoreAfterSegment(1)}
                                  >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {t.addEightMoreVideoButton}
                                  </Button>
                                  <p className="text-xs text-muted-foreground">{t.addEightMoreVideoHelp}</p>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-violet-900">
                            {t.progressiveVideoSectionTitle.replace('{k}', String(segNum))}
                          </p>
                          <div className="rounded-md border border-violet-100 bg-violet-50/25 p-3 space-y-3">
                            {!doneThis ? (
                              <>
                                <p className="text-sm font-medium text-violet-900">
                                  {t.extendBridgeLabel.replace('{to}', String(segNum))}
                                </p>
                                <p className="text-xs text-muted-foreground">{t.standaloneFramesNote}</p>
                                <div>
                                  <Label className="text-sm">{t.cameraHintLabel}</Label>
                                  <Textarea
                                    value={progCamera}
                                    onChange={(e) => setProgCamera(e.target.value)}
                                    placeholder={t.cameraHintPlaceholder}
                                    className="mt-1 min-h-[48px]"
                                    maxLength={800}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">{t.characterStoryLabel}</Label>
                                  <Textarea
                                    value={progCharacter}
                                    onChange={(e) => setProgCharacter(e.target.value)}
                                    placeholder={t.characterStoryPlaceholder}
                                    className="mt-1 min-h-[48px]"
                                    maxLength={800}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  disabled={
                                    creatingSegmentIndex !== null ||
                                    busyLyrics ||
                                    mergingClips ||
                                    chainHistory.length < segNum - 1 ||
                                    lyricsK.length < MIN_SEGMENT_CHARS ||
                                    progFrameFiles.length === 0
                                  }
                                  onClick={() => void runStandaloneSegmentVideo(segNum)}
                                >
                                  {busyThisSegment ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                  )}
                                  {t.extendSegmentVideoButton.replace('{k}', String(segNum))}
                                </Button>
                              </>
                            ) : (
                              <div className="space-y-3 pt-1">
                                <p className="text-xs font-medium text-violet-800">
                                  {t.videoAfterSegmentLabel
                                    .replace('{n}', String(segNum))
                                    .replace('{seconds}', String(segNum * 8))}
                                </p>
                                <video
                                  src={chainHistory[segNum - 1]!.url}
                                  controls
                                  className="w-full max-h-[360px] rounded-md bg-black"
                                  playsInline
                                />
                                <Button asChild variant="link" className="h-auto p-0 text-sm">
                                  <a
                                    href={chainHistory[segNum - 1]!.url}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {t.downloadMp4Step.replace('{n}', String(segNum))}
                                  </a>
                                </Button>
                                {chainHistory.length === segNum && segNum < MAX_SEGMENTS ? (
                                  <div className="space-y-2 rounded-md border border-violet-200/80 bg-violet-50/40 p-3">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="w-full sm:w-auto"
                                      disabled={
                                        creatingSegmentIndex !== null || busyLyrics || mergingClips
                                      }
                                      onClick={() => addEightMoreAfterSegment(segNum)}
                                    >
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      {t.addEightMoreVideoButton}
                                    </Button>
                                    <p className="text-xs text-muted-foreground">{t.addEightMoreVideoHelp}</p>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ) : null}
                  </div>
                )
              })}
            </div>

            {SHOW_MUSIC_VEO_VIDEO_UI && chainHistory.length >= 2 ? (
              <div className="rounded-lg border border-violet-300/60 bg-violet-50/30 p-4 space-y-3">
                <p className="text-sm font-medium text-violet-900">{t.mergeClipsSectionTitle}</p>
                <p className="text-xs text-muted-foreground">{t.mergeClipsSectionHelp}</p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mergingClips || creatingSegmentIndex !== null || busyLyrics}
                  onClick={() => void runMergeClips()}
                >
                  {mergingClips ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {t.mergeClipsButton}
                </Button>
                {mergedResultUrl ? (
                  <div className="space-y-2 pt-2 border-t border-violet-200/60">
                    <p className="text-xs font-medium text-violet-800">{t.successMergedClip}</p>
                    <video
                      src={mergedResultUrl}
                      controls
                      className="w-full max-h-[360px] rounded-md bg-black"
                      playsInline
                    />
                    <Button asChild variant="link" className="h-auto p-0 text-sm">
                      <a href={mergedResultUrl} download target="_blank" rel="noreferrer">
                        {t.downloadMp4}
                      </a>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-violet-100">
              <Button type="button" variant="outline" onClick={startOver}>
                {t.startOver}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
