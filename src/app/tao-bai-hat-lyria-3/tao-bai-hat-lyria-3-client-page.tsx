'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ImagePreview } from '@/components/ui/image-preview'
import { Download, ListMusic, Loader2, Sparkles, X } from 'lucide-react'
import { TaoBaiHatLyria3Icon } from '@/components/icons/tao-bai-hat-lyria-3-icon'
import { parseLyriaModelNotes } from '@/lib/music/lyria-model-notes'
import { useHubPrefill } from '@/lib/hub-chat/use-hub-prefill'
import { tryAutoCompleteHubPlanStep } from '@/lib/hub-chat/hub-plan-auto-complete'
import { HubPlanStepBanner } from '@/components/hub-chat/hub-plan-step-banner'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

type LyriaGenre =
  | 'custom'
  | 'pop'
  | 'rap'
  | 'trap'
  | 'nhac_tre'
  | 'ballad'
  | 'tam_trang'
  | 'rock'
  | 'edm'
  | 'house'
  | 'remix'
  | 'lofi'
  | 'chill'
  | 'indie'
  | 'jazz'
  | 'rnb'
  | 'bolero'
  | 'folk'
  | 'cinematic'
  | 'synthwave'
  | 'nhac_che_hai'
  | 'c_pop'
  | 'j_pop'
  | 'k_pop'

type VoiceGenderId = 'auto' | 'female' | 'male' | 'neutral' | 'duet_mf'
type VoiceTimbreId = 'auto' | 'high' | 'bright' | 'warm' | 'soft' | 'deep' | 'rap'
type VoiceLangId = 'auto' | 'vi_north' | 'vi_central' | 'vi_south' | 'en_uk' | 'en_us' | 'zh' | 'ja' | 'ko'

const VOICE_GENDER_OPTIONS: { value: VoiceGenderId; label: Record<UiLocale, string> }[] = [
  {
    value: 'auto',
    label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' },
  },
  { value: 'female', label: { vi: 'Nữ', en: 'Female', zh: '女声', ja: '女性', ko: '여성' } },
  { value: 'male', label: { vi: 'Nam', en: 'Male', zh: '男声', ja: '男性', ko: '남성' } },
  {
    value: 'neutral',
    label: { vi: 'Trung tính', en: 'Neutral', zh: '中性', ja: '中性的', ko: '중성' },
  },
  {
    value: 'duet_mf',
    label: { vi: 'Song ca nam + nữ', en: 'Male + female duet', zh: '男女对唱', ja: '男女デュエット', ko: '남녀 듀엣' },
  },
]

const VOICE_TIMBRE_OPTIONS: { value: VoiceTimbreId; label: Record<UiLocale, string> }[] = [
  {
    value: 'auto',
    label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' },
  },
  {
    value: 'high',
    label: { vi: 'Cao, sáng', en: 'High, bright', zh: '高而亮', ja: '高く明るい', ko: '높고 밝게' },
  },
  {
    value: 'bright',
    label: { vi: 'Trẻ, pop sáng', en: 'Youthful pop', zh: '青春明亮', ja: '若いポップ', ko: '밝은 팝' },
  },
  {
    value: 'warm',
    label: { vi: 'Ấm, trầm-trung', en: 'Warm mid', zh: '温暖中音', ja: '温かい中音', ko: '따뜻한 중저음' },
  },
  {
    value: 'soft',
    label: { vi: 'Nhẹ, thở', en: 'Soft, breathy', zh: '轻柔气声', ja: 'ソフト・息多め', ko: '부드럽게' },
  },
  {
    value: 'deep',
    label: { vi: 'Trầm, vang', en: 'Deep, resonant', zh: '低沉浑厚', ja: '低く響く', ko: '깊고 울림' },
  },
  {
    value: 'rap',
    label: { vi: 'Rap / nói nhịp', en: 'Rap / rhythmic', zh: '说唱节奏', ja: 'ラップ調', ko: '랩·리듬' },
  },
]

const VOICE_LANG_OPTIONS: { value: VoiceLangId; label: Record<UiLocale, string> }[] = [
  {
    value: 'auto',
    label: { vi: 'Tự động (theo lời)', en: 'Auto (from lyrics)', zh: '自动（随歌词）', ja: '自動（歌詞に合わせる）', ko: '자동(가사에 맞춤)' },
  },
  {
    value: 'vi_north',
    label: { vi: 'Tiếng Việt — Bắc', en: 'Vietnamese — North', zh: '越南语—北方', ja: 'ベトナム語—北部', ko: '베트남어—북부' },
  },
  {
    value: 'vi_central',
    label: { vi: 'Tiếng Việt — Trung', en: 'Vietnamese — Central', zh: '越南语—中部', ja: 'ベトナム語—中部', ko: '베트남어—중부' },
  },
  {
    value: 'vi_south',
    label: { vi: 'Tiếng Việt — Nam', en: 'Vietnamese — South', zh: '越南语—南方', ja: 'ベトナム語—南部', ko: '베트남어—남부' },
  },
  {
    value: 'en_uk',
    label: { vi: 'Tiếng Anh — Anh (UK)', en: 'English — UK', zh: '英语—英式', ja: '英語—イギリス', ko: '영어—영국' },
  },
  {
    value: 'en_us',
    label: { vi: 'Tiếng Anh — Mỹ (US)', en: 'English — US', zh: '英语—美式', ja: '英語—米国', ko: '영어—미국' },
  },
  {
    value: 'zh',
    label: { vi: 'Tiếng Trung (Quan thoại)', en: 'Chinese (Mandarin)', zh: '中文（普通话）', ja: '中国語（標準語）', ko: '중국어(만다린)' },
  },
  {
    value: 'ja',
    label: { vi: 'Tiếng Nhật', en: 'Japanese', zh: '日语', ja: '日本語', ko: '일본어' },
  },
  {
    value: 'ko',
    label: { vi: 'Tiếng Hàn', en: 'Korean', zh: '韩语', ja: '韓国語', ko: '한국어' },
  },
]

const GENRE_OPTIONS: { value: LyriaGenre; label: Record<UiLocale, string> }[] = [
  { value: 'custom', label: { vi: 'Tự do theo mô tả', en: 'Custom', zh: '自定义', ja: '自由', ko: '사용자 정의' } },
  { value: 'pop', label: { vi: 'Pop', en: 'Pop', zh: '流行', ja: 'ポップ', ko: '팝' } },
  {
    value: 'c_pop',
    label: { vi: 'Nhạc pop Trung (C-pop)', en: 'Chinese pop (C-pop)', zh: '华语流行', ja: 'Cポップ', ko: 'C-pop' },
  },
  {
    value: 'j_pop',
    label: { vi: 'Nhạc pop Nhật (J-pop)', en: 'Japanese pop (J-pop)', zh: '日语流行', ja: 'Jポップ', ko: 'J-pop' },
  },
  {
    value: 'k_pop',
    label: { vi: 'Nhạc pop Hàn (K-pop)', en: 'Korean pop (K-pop)', zh: '韩语流行', ja: 'Kポップ', ko: 'K-pop' },
  },
  { value: 'nhac_tre', label: { vi: 'Nhạc trẻ (V-pop)', en: 'Youth pop (V-pop)', zh: '年轻流行', ja: 'Vポップ', ko: 'V-pop' } },
  { value: 'ballad', label: { vi: 'Ballad', en: 'Ballad', zh: '抒情', ja: 'バラード', ko: '발라드' } },
  {
    value: 'tam_trang',
    label: { vi: 'Nhạc tâm trạng', en: 'Mood / emotional', zh: '心情音乐', ja: '心情ミュージック', ko: '감성 무드' },
  },
  {
    value: 'nhac_che_hai',
    label: {
      vi: 'Nhạc chế / hài hước',
      en: 'Parody / humorous',
      zh: '改编搞笑',
      ja: 'パロディ・コミカル',
      ko: '패러디·유머',
    },
  },
  { value: 'bolero', label: { vi: 'Bolero / dân ca nhẹ', en: 'Bolero', zh: '波莱罗', ja: 'ボレロ', ko: '볼레로' } },
  { value: 'rap', label: { vi: 'Rap / Hip-hop', en: 'Rap / Hip-hop', zh: '说唱', ja: 'ラップ', ko: '랩' } },
  { value: 'trap', label: { vi: 'Trap', en: 'Trap', zh: '陷阱音乐', ja: 'トラップ', ko: '트랩' } },
  { value: 'rock', label: { vi: 'Rock', en: 'Rock', zh: '摇滚', ja: 'ロック', ko: '록' } },
  { value: 'edm', label: { vi: 'EDM / Điện tử', en: 'EDM', zh: '电子舞曲', ja: 'EDM', ko: 'EDM' } },
  { value: 'house', label: { vi: 'House', en: 'House', zh: '浩室', ja: 'ハウス', ko: '하우스' } },
  {
    value: 'remix',
    label: { vi: 'Remix / sàn (club)', en: 'Remix / club', zh: '混音/夜店', ja: 'リミックス', ko: '리믹스' },
  },
  { value: 'lofi', label: { vi: 'Lo-fi', en: 'Lo-fi', zh: 'Lo-fi', ja: 'Lo-fi', ko: 'Lo-fi' } },
  {
    value: 'chill',
    label: { vi: 'Chill / thư giãn', en: 'Chill / relax', zh: '弛放', ja: 'チル', ko: '칠' },
  },
  { value: 'synthwave', label: { vi: 'Synthwave (retro 80s)', en: 'Synthwave', zh: '合成器浪潮', ja: 'シンセウェーブ', ko: '신스웨이브' } },
  { value: 'indie', label: { vi: 'Indie', en: 'Indie', zh: '独立', ja: 'インディ', ko: '인디' } },
  { value: 'jazz', label: { vi: 'Jazz', en: 'Jazz', zh: '爵士', ja: 'ジャズ', ko: '재즈' } },
  { value: 'rnb', label: { vi: 'R&B', en: 'R&B', zh: 'R&B', ja: 'R&B', ko: 'R&B' } },
  { value: 'folk', label: { vi: 'Folk / Acoustic', en: 'Folk / Acoustic', zh: '民谣', ja: 'フォーク', ko: '포크' } },
  { value: 'cinematic', label: { vi: 'Điện ảnh (cinematic)', en: 'Cinematic', zh: '电影感', ja: 'シネマ', ko: '시네마틱' } },
]

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

/** Đồng bộ với `music-lyria3-generate`: Lyria 3 Pro ~3 phút. */
const LYRIA3_CREDITS = 3
const LYRIA3_TARGET_SEC = 180

type BpmPreset = 'auto' | 'slow' | 'medium' | 'fast'
type StructurePreset = 'auto' | 'verse_chorus' | 'verse_chorus_bridge' | 'short_hook' | 'through'
type DensityPreset = 'auto' | 'minimal' | 'balanced' | 'full'

const BPM_PRESET_OPTIONS: { value: BpmPreset; label: Record<UiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  {
    value: 'slow',
    label: {
      vi: 'Chậm (~72–88 BPM)',
      en: 'Slow (~72–88 BPM)',
      zh: '慢速（约72–88）',
      ja: '遅め（72–88付近）',
      ko: '느림(~72–88 BPM)',
    },
  },
  {
    value: 'medium',
    label: {
      vi: 'Vừa (~96–112 BPM)',
      en: 'Medium (~96–112 BPM)',
      zh: '中速（约96–112）',
      ja: '中速（96–112付近）',
      ko: '보통(~96–112 BPM)',
    },
  },
  {
    value: 'fast',
    label: {
      vi: 'Nhanh (~122–138 BPM)',
      en: 'Fast (~122–138 BPM)',
      zh: '快速（约122–138）',
      ja: '速め（122–138付近）',
      ko: '빠름(~122–138 BPM)',
    },
  },
]

const STRUCTURE_PRESET_OPTIONS: { value: StructurePreset; label: Record<UiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  {
    value: 'verse_chorus',
    label: {
      vi: 'Verse + điệp khúc',
      en: 'Verse + chorus',
      zh: '主歌+副歌',
      ja: 'ヴァース＋サビ',
      ko: '버스+후렴',
    },
  },
  {
    value: 'verse_chorus_bridge',
    label: {
      vi: 'Có bridge (đoạn chuyển)',
      en: 'With bridge',
      zh: '含桥段',
      ja: 'ブリッジあり',
      ko: '브리지 포함',
    },
  },
  {
    value: 'short_hook',
    label: {
      vi: 'Intro ngắn, hook rõ',
      en: 'Short intro, strong hook',
      zh: '短前奏、记忆点强',
      ja: '短いイントロ・フック重視',
      ko: '짧은 인트로·훅 강조',
    },
  },
  {
    value: 'through',
    label: {
      vi: 'Một mạch, ít lặp cứng',
      en: 'Flowing, few rigid repeats',
      zh: '连贯、少生硬重复',
      ja: '流れる展開・硬い反復少なめ',
      ko: '자연스러운 전개·기계적 반복 적게',
    },
  },
]

const DENSITY_PRESET_OPTIONS: { value: DensityPreset; label: Record<UiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  {
    value: 'minimal',
    label: {
      vi: 'Tối giản (ít nhạc cụ)',
      en: 'Minimal (sparse)',
      zh: '极简（少乐器）',
      ja: 'ミニマル',
      ko: '미니멀(악기 적게)',
    },
  },
  {
    value: 'balanced',
    label: {
      vi: 'Cân bằng',
      en: 'Balanced',
      zh: '平衡',
      ja: 'バランス',
      ko: '균형',
    },
  },
  {
    value: 'full',
    label: {
      vi: 'Đầy đặn (nhiều layer)',
      en: 'Full (layered)',
      zh: '饱满（多层）',
      ja: '厚み・レイヤー多め',
      ko: '풍성(레이어 많이)',
    },
  },
]

type SavedLyriaTrack = {
  id: string
  title: string
  style: string
  durationSeconds: number
  chargedCredits: number
  audioUrl?: string | null
  createdAt: string
}

export default function TaoBaiHatLyria3ClientPage() {
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [genre, setGenre] = useState<LyriaGenre>('custom')
  const [prompt, setPrompt] = useState('')
  const [songContent, setSongContent] = useState('')
  const [vocalMode, setVocalMode] = useState<'instrumental' | 'vocal'>('vocal')
  const [voiceGender, setVoiceGender] = useState<VoiceGenderId>('auto')
  const [voiceTimbre, setVoiceTimbre] = useState<VoiceTimbreId>('auto')
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLangId>('auto')
  const [bpmPreset, setBpmPreset] = useState<BpmPreset>('auto')
  const [structurePreset, setStructurePreset] = useState<StructurePreset>('auto')
  const [densityPreset, setDensityPreset] = useState<DensityPreset>('auto')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [notesKind, setNotesKind] = useState<'instrumental' | 'vocal' | null>(null)
  const [lastCharged, setLastCharged] = useState<number | null>(null)
  const [savedTracks, setSavedTracks] = useState<SavedLyriaTrack[]>([])
  const [savedLoading, setSavedLoading] = useState(false)

  useHubPrefill('/tao-bai-hat-lyria-3', setPrompt)

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const loadSavedTracks = useCallback(async () => {
    setSavedLoading(true)
    try {
      const res = await fetch('/api/music-history?limit=50&mode=lyria3')
      const data = (await res.json().catch(() => ({}))) as { items?: SavedLyriaTrack[] }
      if (res.ok && Array.isArray(data.items)) setSavedTracks(data.items)
      else setSavedTracks([])
    } catch {
      setSavedTracks([])
    } finally {
      setSavedLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSavedTracks()
  }, [loadSavedTracks])

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setImageFile(null)
  }

  const handleImagePick = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setImageFile(file)
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const handleGenerate = async () => {
    const p = prompt.trim()
    const song = songContent.trim()
    const hasImg = Boolean(imageFile)
    if (p.length < 4 && !hasImg && song.length < 10) {
      toast({
        title: tr('Thiếu đầu vào', 'Missing input', '缺少输入', '入力不足', '입력 부족'),
        description: tr(
          'Nhập mô tả từ 4 ký tự, hoặc tải ảnh, hoặc nội dung/lời bài từ 10 ký tự.',
          'Add a 4+ char description, or an image, or lyrics/content (10+ chars).',
          '请填写至少 4 字描述、或上传图片、或 10 字以上内容/歌词。',
          '説明4文字以上、画像、または歌詞・内容10文字以上のいずれかを入力してください。',
          '설명 4자 이상, 이미지, 또는 가사/내용 10자 이상 중 하나를 입력하세요.',
        ),
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    setAudioUrl(null)
    setNotes(null)
    setNotesKind(null)
    try {
      const form = new FormData()
      form.append('prompt', p)
      form.append('variant', 'pro')
      form.append('targetDurationSec', String(LYRIA3_TARGET_SEC))
      form.append('vocalMode', vocalMode)
      form.append('voiceGender', voiceGender)
      form.append('voiceTimbre', voiceTimbre)
      form.append('voiceLanguage', voiceLanguage)
      form.append('bpmPreset', bpmPreset)
      form.append('structurePreset', structurePreset)
      form.append('densityPreset', densityPreset)
      form.append('genre', genre)
      form.append('songContent', song)
      if (imageFile) form.append('image', imageFile)

      const res = await fetch('/api/music-lyria3-generate', { method: 'POST', body: form })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        code?: string
        audioUrl?: string
        lyricsOrNotes?: string
        charged?: number
        historySaved?: boolean
        historyError?: string
      }
      if (!res.ok) {
        throw new Error(data.error || tr('Tạo nhạc thất bại', 'Generation failed', '生成失败', '生成に失敗', '생성 실패'))
      }
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl)
        void tryAutoCompleteHubPlanStep('/tao-bai-hat-lyria-3', data.audioUrl)
      }
      if (data.lyricsOrNotes) {
        setNotes(data.lyricsOrNotes)
        setNotesKind(vocalMode)
      }
      if (typeof data.charged === 'number') setLastCharged(data.charged)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
      await loadSavedTracks()
      if (data.historySaved === false) {
        toast({
          title: tr('Đã tạo file nhạc', 'Audio file created', '已生成音频文件', '音楽ファイルを生成', '오디오 파일 생성됨'),
          description:
            data.historyError ||
            tr(
              'Chưa ghi được vào lịch sử (DB). Bạn vẫn tải được file ở ô «Nghe thử» phía trên.',
              'Could not save to history. You can still download from the preview above.',
              '未写入历史，仍可在上方试听区下载。',
              '履歴に保存できませんでした。上のプレビューからダウンロードできます。',
              '기록 저장 실패. 위 미리듣기에서 다운로드 가능.',
            ),
          variant: 'destructive',
        })
      } else {
        toast({
          title: tr('Đã tạo xong', 'Done', '完成', '完了', '완료'),
          description: tr(
            'Đã lưu — phát lại và tải xuống ở danh sách «Bài nhạc đã lưu» bên dưới.',
            'Saved — replay and download in the saved list below.',
            '已保存——在下方列表回放与下载。',
            '保存済み——下の一覧で再生・ダウンロード。',
            '저장됨 — 아래 목록에서 재생·다운로드.',
          ),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('Lỗi không xác định', 'Unknown error', '未知错误', '不明なエラー', '알 수 없는 오류')
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const cost = LYRIA3_CREDITS

  const parsedNotes = useMemo(() => (notes ? parseLyriaModelNotes(notes) : null), [notes])

  return (
    <>
      <Toaster />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <HubPlanStepBanner />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
              <TaoBaiHatLyria3Icon className="h-full w-full" />
            </span>
            {tr(
              'Tạo bài nhạc (có lời / không lời)',
              'Create music (vocal or instrumental)',
              '制作乐曲（人声或纯音乐）',
              '楽曲を作成（ボーカル／インスト）',
              '음악 만들기 (보컬/인스트루멘탈)',
            )}
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {tr('Thử nghiệm', 'Beta', '测试版', 'ベータ', '베타')}
            </span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {tr(
              'Chọn thể loại, có thể tải ảnh để nhạc bám mood ảnh, thêm lời/nội dung nếu cần.',
              'Pick a genre, optional image for mood, optional lyrics.',
              '可选风格、参考图与歌词。',
              'ジャンル、画像、歌詞を任意で指定。',
              '장르·이미지·가사 선택 가능.',
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link href="#lyria3-saved-music" className="text-indigo-600 hover:underline">
              {tr('Bài đã lưu', 'Saved tracks', '已保存', '保存済み', '저장된 곡')}
            </Link>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-violet-600" />
              {tr('Mô tả bài nhạc', 'Describe the track', '描述乐曲', '曲を説明', '곡 설명')}
            </CardTitle>
            <CardDescription>
              {tr(
                'Chọn thể loại (pop, rap, nhạc tâm trạng, remix, trap, chill…), có thể upload ảnh. Có lời: dán lời vào ô nội dung.',
                'Choose genre (pop, rap, mood music, remix, trap, chill…); optional image. With vocals: paste lyrics.',
                '选择风格；可上传图片。有歌词模式可在内容框粘贴歌词。',
                'ジャンル選択・画像任意。ボーカル時は歌詞を入力。',
                '장르 선택·이미지 선택. 보컬 시 가사 입력.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Thể loại nhạc', 'Music genre', '音乐风格', '音楽ジャンル', '음악 장르')}</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as LyriaGenre)}
                disabled={busy}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {GENRE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label[uiLocale]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Kiểu âm thanh', 'Sound type', '声音类型', '音声タイプ', '사운드 유형')}</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={vocalMode === 'vocal' ? 'default' : 'outline'}
                  onClick={() => setVocalMode('vocal')}
                  disabled={busy}
                  className={vocalMode === 'vocal' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                >
                  {tr('Có lời', 'With vocals', '有人声', 'ボーカルあり', '보컬')}
                </Button>
                <Button
                  type="button"
                  variant={vocalMode === 'instrumental' ? 'default' : 'outline'}
                  onClick={() => setVocalMode('instrumental')}
                  disabled={busy}
                  className={vocalMode === 'instrumental' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                >
                  {tr('Không lời', 'Instrumental', '纯音乐', 'インスト', '인스트루멘탈')}
                </Button>
              </div>
            </div>

            {vocalMode === 'vocal' && (
              <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                <p className="text-sm font-medium text-slate-800">
                  {tr('Giọng hát (3 lựa chọn)', 'Vocals (3 options)', '人声（三项）', 'ボーカル（3項目）', '보컬(3항목)')}
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      {tr('Giới tính giọng', 'Voice gender', '声部性别', '声の性別', '성별(보컬)')}
                    </label>
                    <select
                      value={voiceGender}
                      onChange={(e) => setVoiceGender(e.target.value as VoiceGenderId)}
                      disabled={busy}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                    >
                      {VOICE_GENDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label[uiLocale]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      {tr('Chất giọng', 'Timbre / tone', '音色', '音質・トーン', '음색·톤')}
                    </label>
                    <select
                      value={voiceTimbre}
                      onChange={(e) => setVoiceTimbre(e.target.value as VoiceTimbreId)}
                      disabled={busy}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                    >
                      {VOICE_TIMBRE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label[uiLocale]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      {tr('Ngôn ngữ phát âm', 'Singing language', '演唱语言', '歌詞の言語・発音', '발음·언어')}
                    </label>
                    <select
                      value={voiceLanguage}
                      onChange={(e) => setVoiceLanguage(e.target.value as VoiceLangId)}
                      disabled={busy}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                    >
                      {VOICE_LANG_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label[uiLocale]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    'Ba mục độc lập — gửi gợi ý tiếng Anh cho AI. Thể loại (C-pop, J-pop, K-pop…) chọn ở «Thể loại nhạc».',
                    'Three independent hints in English for the AI. Pick C-pop / J-pop / K-pop etc. under Music genre.',
                    '三项独立，英文提示发给模型。华语/日语/韩语流行等在「音乐风格」选择。',
                    '3項目は独立。英語ヒントを送信。C-pop/J-pop/K-popは「ジャンル」で。',
                    '3가지는 독립입니다. 장르는 C-pop/J-pop/K-pop 등을「음악 장르」에서.',
                  )}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700">
              {tr(
                'Bài nhạc ~3 phút (file MP3/WAV) — 3 credit/lần tạo.',
                '~3 minute audio track (MP3/WAV) — 3 credits per generation.',
                '约 3 分钟音频（MP3/WAV）— 每次 3 积分。',
                '約3分の音声（MP3/WAV）— 1回3クレジット。',
                '약 3분 음원(MP3/WAV) — 1회 3크레딧.',
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-sm font-medium text-slate-800">
                {tr('Nhịp, cấu trúc & dàn nhạc', 'Tempo, structure & arrangement', '节奏、结构与编曲', 'テンポ・構成・アレンジ', '템포·구성·편곡')}
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    {tr('Nhịp (BPM)', 'Tempo (BPM)', '节拍(BPM)', 'テンポ(BPM)', '템포(BPM)')}
                  </label>
                  <select
                    value={bpmPreset}
                    onChange={(e) => setBpmPreset(e.target.value as BpmPreset)}
                    disabled={busy}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                  >
                    {BPM_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label[uiLocale]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    {tr('Cấu trúc bài', 'Song structure', '歌曲结构', '曲構成', '곡 구성')}
                  </label>
                  <select
                    value={structurePreset}
                    onChange={(e) => setStructurePreset(e.target.value as StructurePreset)}
                    disabled={busy}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                  >
                    {STRUCTURE_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label[uiLocale]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    {tr('Mật độ dàn nhạc', 'Arrangement density', '编曲密度', '編成の密度', '편곡 밀도')}
                  </label>
                  <select
                    value={densityPreset}
                    onChange={(e) => setDensityPreset(e.target.value as DensityPreset)}
                    disabled={busy}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                  >
                    {DENSITY_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label[uiLocale]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr(
                  'Gửi kèm hướng dẫn tiếng Anh cho AI; nhịp và độ dài thực tế vẫn là ước lượng.',
                  'Sends English hints to the AI; actual tempo and length remain approximate.',
                  '以英文提示发给模型；实际节拍与时长仍为估算。',
                  '英語のヒントを送信。実際のテンポ・長さは目安です。',
                  'AI에 영어 힌트를 보냅니다. 실제 템포·길이는 추정입니다.',
                )}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">{tr('Ảnh tham chiếu (tuỳ chọn)', 'Reference image (optional)', '参考图（可选）', '参考画像（任意）', '참조 이미지(선택)')}</label>
                {imageFile && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={clearImage} disabled={busy}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => handleImagePick(e.target.files?.[0])} disabled={busy} />
              {imagePreview && (
                <div className="h-44 overflow-hidden rounded-md border">
                  <ImagePreview
                    src={imagePreview}
                    alt={tr('Ảnh tham chiếu', 'Reference image', '参考图', '参考画像', '참조 이미지')}
                    className="h-full w-full object-cover"
                    asImg
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {tr(
                  'JPEG/PNG/WebP/GIF, tối đa 8MB. Ảnh giúp AI bám mood.',
                  'JPEG/PNG/WebP/GIF, max 8MB. Image guides mood.',
                  '最大 8MB，可用图片引导情绪。',
                  '最大8MB。画像で雰囲気を指定できます。',
                  '최대 8MB. 이미지로 무드를 맞출 수 있습니다.',
                )}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Mô tả thêm', 'Extra description', '补充描述', '追加の説明', '추가 설명')}</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={busy}
                placeholder={tr(
                  'Tempo, mood, nhạc cụ, bối cảnh… (có thể để trống nếu chỉ dùng ảnh + thể loại)',
                  'Tempo, mood, instruments… (optional if image + genre is enough)',
                  '节奏、情绪、乐器…',
                  'テンポ、雰囲気、楽器…',
                  '템포, 분위기, 악기…',
                )}
                className="resize-y min-h-[96px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {vocalMode === 'vocal'
                  ? tr('Lời / nội dung bài hát (tuỳ chọn)', 'Lyrics / song text (optional)', '歌词/正文（可选）', '歌詞・本文（任意）', '가사·내용(선택)')
                  : tr('Ý tưởng chủ đề — gợi nhạc cụ (tuỳ chọn)', 'Theme text for instrumental (optional)', '主题参考（纯音乐，可选）', 'テーマ文（インスト用・任意）', '테마 텍스트(인스트·선택)')}
              </label>
              <Textarea
                value={songContent}
                onChange={(e) => setSongContent(e.target.value)}
                rows={5}
                disabled={busy}
                placeholder={
                  vocalMode === 'vocal'
                    ? tr(
                        '[Verse 1] … [Chorus] … hoặc mô tả từng đoạn cần có',
                        '[Verse] … [Chorus] … or section ideas',
                        '【主歌】…【副歌】…',
                        '【Aメロ】…【サビ】…',
                        '[Verse] … [Chorus] …',
                      )
                    : tr(
                        'Ví dụ chủ đề: hoàng hôn, biển, kỷ niệm — nhạc cụ thể hiện không lời',
                        'e.g. sunset, sea — instrumental mood only',
                        '例如：日落、海洋——纯器乐情绪',
                        '例：夕焼け、海——インストで表現',
                        '예: 석양, 바다 — 인스트루멘탈 무드',
                      )
                }
                className="resize-y min-h-[100px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void handleGenerate()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {tr('Tạo nhạc', 'Generate', '生成', '生成', '생성')}
                <span className="ml-2 text-xs opacity-90">({cost} credit)</span>
              </Button>
              {lastCharged != null && (
                <span className="text-sm text-muted-foreground">
                  {tr('Lần trước trừ', 'Last charged', '上次扣除', '前回の差引', '마지막 차감')}: {lastCharged}
                </span>
              )}
            </div>

            {audioUrl && (
              <div className="space-y-2 rounded-lg border bg-slate-50/80 p-4">
                <p className="text-sm font-medium">{tr('Nghe thử', 'Preview', '试听', '試聴', '미리듣기')}</p>
                <audio controls className="w-full" src={audioUrl} preload="metadata" />
                <a
                  href={audioUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm font-medium text-indigo-600 hover:underline"
                >
                  {tr('Tải file nhạc', 'Download audio', '下载音频', 'オーディオをダウンロード', '오디오 다운로드')}
                </a>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    'Link trên hệ thống thường chỉ dùng được khoảng 30 ngày — tải về máy nếu cần giữ lâu.',
                    'Hosted links usually work for about 30 days — download if you need to keep the file.',
                    '托管链接通常约 30 天内有效，如需长期保存请下载。',
                    'ホスト上のリンクは約30日程度が目安です。長期保管はダウンロードを。',
                    '호스트 링크는 보통 약 30일간 유효합니다. 오래 보관하려면 다운로드하세요.',
                  )}
                </p>
              </div>
            )}

            {notes && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium text-slate-800">
                  {notesKind === 'vocal'
                    ? tr('Lời / mô tả từ mô hình', 'Lyrics / model text', '歌词/模型文本', '歌詞・モデルテキスト', '가사·모델 텍스트')
                    : tr('Ghi chú từ mô hình', 'Model notes', '模型附注', 'モデルからの注記', '모델 메모')}
                </p>
                {parsedNotes ? (
                  <div className="mt-3 space-y-4">
                    {(parsedNotes.bpm != null || parsedNotes.musicScore != null) && (
                      <div className="flex flex-wrap gap-2">
                        {parsedNotes.bpm != null && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            BPM {parsedNotes.bpm}
                          </span>
                        )}
                        {parsedNotes.musicScore != null && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {tr('Điểm nhạc', 'Music score', '音乐评分', 'スコア', '음악 점수')} {parsedNotes.musicScore}
                          </span>
                        )}
                      </div>
                    )}
                    {parsedNotes.segments.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {tr('Lời theo thời gian', 'Timed lyrics', '分段歌词', 'タイムコード付き歌詞', '시간대별 가사')}
                        </p>
                        <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/80 p-2">
                          {parsedNotes.segments.map((seg, idx) => (
                            <li key={`${seg.start}-${seg.end}-${idx}`} className="text-xs text-slate-700">
                              <span className="font-mono text-[11px] text-indigo-600">
                                [{seg.start.toFixed(1)}–{seg.end.toFixed(1)}]
                              </span>{' '}
                              <span className="whitespace-pre-wrap">{seg.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsedNotes.caption && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {tr('Mô tả bản phối', 'Production notes', '编曲说明', 'プロダクション説明', '편곡 설명')}
                        </p>
                        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {parsedNotes.caption}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{notes}</pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="lyria3-saved-music" className="scroll-mt-24 border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListMusic className="h-5 w-5 text-indigo-600" />
              {tr('Bài nhạc đã lưu', 'Saved tracks', '已保存的乐曲', '保存済みの楽曲', '저장된 음악')}
            </CardTitle>
            <CardDescription>
              {tr(
                'Lưu theo tài khoản — nghe lại trình duyệt hoặc tải file (MP3/WAV).',
                'Stored per account — replay in browser or download.',
                '按账户保存——可在线播放或下载。',
                'アカウントに保存—再生またはダウンロード。',
                '계정에 저장 — 재생 또는 다운로드.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              role="note"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950"
            >
              {tr(
                'Lưu ý: file nhạc trên hệ thống thường chỉ giữ khoảng 30 ngày. Nên tải về máy sớm nếu bạn cần dùng lâu dài.',
                'Note: stored audio is usually kept for about 30 days. Download to your device if you need it longer.',
                '提示：系统保存的音频通常仅保留约 30 天，如需长期使用请及时下载到本地。',
                '注意：保存された音声は通常約30日で削除される場合があります。長期利用は早めにダウンロードしてください。',
                '안내: 저장된 음원은 보통 약 30일간 보관됩니다. 오래 쓰려면 미리 기기로 다운로드하세요.',
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSavedTracks()} disabled={savedLoading}>
                {savedLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tr('Làm mới danh sách', 'Refresh list', '刷新列表', '一覧を更新', '목록 새로고침')}
              </Button>
            </div>
            {savedLoading && savedTracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr('Đang tải…', 'Loading…', '加载中…', '読み込み中…', '불러오는 중…')}</p>
            ) : savedTracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr(
                  'Chưa có bản nhạc nào. Đăng nhập và tạo nhạc — bản mới sẽ xuất hiện ở đây.',
                  'No tracks yet. Sign in and generate — new items appear here.',
                  '暂无记录。登录并生成后即可在此查看。',
                  'まだありません。ログインして生成してください。',
                  '기록 없음. 로그인 후 생성하면 여기에 표시됩니다.',
                )}
              </p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {savedTracks.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-white p-3 text-sm shadow-sm">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.style}</p>
                      <p className="mt-1 text-xs text-emerald-700">
                        {Number(item.chargedCredits || 0).toFixed(1)} credit · {Number(item.durationSeconds || 0)}s
                      </p>
                      <div className="mt-2 flex flex-col gap-2">
                        {item.audioUrl ? (
                          <>
                            <audio controls preload="none" src={item.audioUrl} className="h-9 w-full" />
                            <a
                              href={item.audioUrl}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700"
                            >
                              <Download className="h-4 w-4" />
                              {tr('Tải xuống', 'Download', '下载', 'ダウンロード', '다운로드')}
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tr('Không có file', 'No file', '无文件', 'ファイルなし', '파일 없음')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden max-h-[28rem] overflow-auto rounded-lg border md:block">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-medium">{tr('Thời gian', 'Time', '时间', '日時', '시간')}</th>
                        <th className="px-3 py-2 font-medium">{tr('Tiêu đề', 'Title', '标题', 'タイトル', '제목')}</th>
                        <th className="px-3 py-2 font-medium">{tr('Mô tả ngắn', 'Notes', '摘要', 'メモ', '메모')}</th>
                        <th className="px-3 py-2 text-right font-medium">{tr('Credits', 'Credits', '积分', 'クレジット', '크레딧')}</th>
                        <th className="px-3 py-2 font-medium">{tr('Nghe', 'Play', '播放', '再生', '재생')}</th>
                        <th className="px-3 py-2 font-medium">{tr('Tải', 'DL', '下载', 'DL', '받기')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedTracks.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-xs font-medium">{item.title}</td>
                          <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-600" title={item.style}>
                            {item.style}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-emerald-700">
                            {Number(item.chargedCredits || 0).toFixed(1)}
                          </td>
                          <td className="px-3 py-2">
                            {item.audioUrl ? (
                              <audio controls preload="none" src={item.audioUrl} className="h-8 max-w-[200px]" />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {item.audioUrl ? (
                              <a
                                href={item.audioUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" />
                                {tr('Tải', 'DL', '下载', 'DL', '받기')}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
