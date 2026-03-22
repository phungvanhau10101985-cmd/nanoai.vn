'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ImagePreview } from '@/components/ui/image-preview'
import { Download, Music, Pause, Play, Square, WandSparkles, Upload } from 'lucide-react'

type Mode = 'background' | 'dj' | 'image' | 'realtime'
type VocalMode = 'instrumental' | 'vocal'
type MusicLanguage = 'vi' | 'en' | 'ja' | 'ko' | 'zh'
type MusicStyle =
  | 'lofi'
  | 'rock'
  | 'pop'
  | 'ballad'
  | 'edm'
  | 'hiphop'
  | 'jazz'
  | 'acoustic'
  | 'cinematic'
  | 'techno'
  | 'ambient'
type VoiceGender = 'female' | 'male' | 'neutral'
type VoiceTone = 'soprano' | 'mezzo' | 'alto' | 'tenor' | 'baritone' | 'bass'
type VoiceRegion = 'bac' | 'trung' | 'nam' | 'mix'
type InstrumentKey =
  | 'piano'
  | 'guitar'
  | 'bass'
  | 'drums'
  | 'strings'
  | 'synth'
  | 'flute'
  | 'sax'
  | 'trumpet'
  | 'violin'
  | 'cello'
  | 'pad'
const LyriaSampleRate = 48000

// Vietnamese labels for API prompts (preserve behavior)
const LANGUAGE_LABELS_VI: Record<MusicLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'Tiếng Anh',
  ja: 'Tiếng Nhật',
  ko: 'Tiếng Hàn',
  zh: 'Tiếng Trung',
}
const MUSIC_STYLE_LABELS_VI: Record<MusicStyle, string> = {
  lofi: 'Lo-fi chill',
  rock: 'Nhạc rock',
  pop: 'Pop hiện đại',
  ballad: 'Nhạc ballad',
  edm: 'Nhạc EDM',
  hiphop: 'Nhạc hip hop',
  jazz: 'Nhạc jazz',
  acoustic: 'Nhạc acoustic',
  cinematic: 'Điện ảnh',
  techno: 'Techno điện tử',
  ambient: 'Ambient thư giãn',
}
const VOICE_GENDER_LABELS_VI: Record<VoiceGender, string> = {
  female: 'Giọng nữ',
  male: 'Giọng nam',
  neutral: 'Trung tính/phi giới tính',
}
const VOICE_TONE_LABELS_VI: Record<VoiceTone, string> = {
  soprano: 'Soprano (nữ cao)',
  mezzo: 'Mezzo-soprano (nữ trung)',
  alto: 'Alto (nữ trầm)',
  tenor: 'Tenor (nam cao)',
  baritone: 'Baritone (nam trung)',
  bass: 'Bass (nam trầm)',
}
const VOICE_REGION_LABELS_VI: Record<VoiceRegion, string> = {
  bac: 'Giọng Bắc',
  trung: 'Giọng Trung',
  nam: 'Giọng Nam',
  mix: 'Pha vùng (trung tính)',
}
const INSTRUMENT_LABELS_VI: Record<InstrumentKey, string> = {
  piano: 'Piano',
  guitar: 'Guitar',
  bass: 'Bass',
  drums: 'Trống',
  strings: 'Strings',
  synth: 'Synth',
  flute: 'Sáo',
  sax: 'Saxophone',
  trumpet: 'Trumpet',
  violin: 'Violin',
  cello: 'Cello',
  pad: 'Pad/Atmosphere',
}

// Display labels by locale
const LANGUAGE_LABELS: Record<UiLocale, Record<MusicLanguage, string>> = {
  vi: { vi: 'Tiếng Việt', en: 'Tiếng Anh', ja: 'Tiếng Nhật', ko: 'Tiếng Hàn', zh: 'Tiếng Trung' },
  en: { vi: 'Vietnamese', en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' },
  zh: { vi: '越南语', en: '英语', ja: '日语', ko: '韩语', zh: '中文' },
  ja: { vi: 'ベトナム語', en: '英語', ja: '日本語', ko: '韓国語', zh: '中国語' },
  ko: { vi: '베트남어', en: '영어', ja: '일본어', ko: '한국어', zh: '중국어' },
}
const MUSIC_STYLE_LABELS: Record<UiLocale, Record<MusicStyle, string>> = {
  vi: { lofi: 'Lo-fi chill', rock: 'Nhạc rock', pop: 'Pop hiện đại', ballad: 'Nhạc ballad', edm: 'Nhạc EDM', hiphop: 'Nhạc hip hop', jazz: 'Nhạc jazz', acoustic: 'Nhạc acoustic', cinematic: 'Điện ảnh', techno: 'Techno điện tử', ambient: 'Ambient thư giãn' },
  en: { lofi: 'Lo-fi chill', rock: 'Rock', pop: 'Modern pop', ballad: 'Ballad', edm: 'EDM', hiphop: 'Hip hop', jazz: 'Jazz', acoustic: 'Acoustic', cinematic: 'Cinematic', techno: 'Electronic techno', ambient: 'Relaxing ambient' },
  zh: { lofi: 'Lo-fi 放松', rock: '摇滚', pop: '流行', ballad: '民谣', edm: '电音', hiphop: '嘻哈', jazz: '爵士', acoustic: '原声', cinematic: '电影感', techno: '电子', ambient: '氛围' },
  ja: { lofi: 'Lo-fi chill', rock: 'ロック', pop: 'ポップ', ballad: 'バラード', edm: 'EDM', hiphop: 'ヒップホップ', jazz: 'ジャズ', acoustic: 'アコースティック', cinematic: 'シネマティック', techno: 'テクノ', ambient: 'アンビエント' },
  ko: { lofi: 'Lo-fi chill', rock: '락', pop: '팝', ballad: '발라드', edm: 'EDM', hiphop: '힙합', jazz: '재즈', acoustic: '어쿠스틱', cinematic: '시네마틱', techno: '테크노', ambient: '앰비언트' },
}
const VOICE_GENDER_LABELS: Record<UiLocale, Record<VoiceGender, string>> = {
  vi: { female: 'Giọng nữ', male: 'Giọng nam', neutral: 'Trung tính/phi giới tính' },
  en: { female: 'Female', male: 'Male', neutral: 'Neutral/androgynous' },
  zh: { female: '女声', male: '男声', neutral: '中性' },
  ja: { female: '女性', male: '男性', neutral: '中性' },
  ko: { female: '여성', male: '남성', neutral: '중성' },
}
const VOICE_TONE_LABELS: Record<UiLocale, Record<VoiceTone, string>> = {
  vi: { soprano: 'Soprano (nữ cao)', mezzo: 'Mezzo-soprano (nữ trung)', alto: 'Alto (nữ trầm)', tenor: 'Tenor (nam cao)', baritone: 'Baritone (nam trung)', bass: 'Bass (nam trầm)' },
  en: { soprano: 'Soprano (high)', mezzo: 'Mezzo-soprano (mid)', alto: 'Alto (low)', tenor: 'Tenor (high)', baritone: 'Baritone (mid)', bass: 'Bass (low)' },
  zh: { soprano: '女高音', mezzo: '次女高音', alto: '女低音', tenor: '男高音', baritone: '男中音', bass: '男低音' },
  ja: { soprano: 'ソプラノ', mezzo: 'メゾソプラノ', alto: 'アルト', tenor: 'テノール', baritone: 'バリトン', bass: 'バス' },
  ko: { soprano: '소프라노', mezzo: '메조소프라노', alto: '알토', tenor: '테너', baritone: '바리톤', bass: '베이스' },
}
const VOICE_REGION_LABELS: Record<UiLocale, Record<VoiceRegion, string>> = {
  vi: { bac: 'Giọng Bắc', trung: 'Giọng Trung', nam: 'Giọng Nam', mix: 'Pha vùng (trung tính)' },
  en: { bac: 'Northern', trung: 'Central', nam: 'Southern', mix: 'Mixed (neutral)' },
  zh: { bac: '北腔', trung: '中腔', nam: '南腔', mix: '混合' },
  ja: { bac: '北部', trung: '中部', nam: '南部', mix: '混合' },
  ko: { bac: '북부', trung: '중부', nam: '남부', mix: '혼합' },
}
const INSTRUMENT_LABELS: Record<UiLocale, Record<InstrumentKey, string>> = {
  vi: { piano: 'Piano', guitar: 'Guitar', bass: 'Bass', drums: 'Trống', strings: 'Strings', synth: 'Synth', flute: 'Sáo', sax: 'Saxophone', trumpet: 'Trumpet', violin: 'Violin', cello: 'Cello', pad: 'Pad/Atmosphere' },
  en: { piano: 'Piano', guitar: 'Guitar', bass: 'Bass', drums: 'Drums', strings: 'Strings', synth: 'Synth', flute: 'Flute', sax: 'Saxophone', trumpet: 'Trumpet', violin: 'Violin', cello: 'Cello', pad: 'Pad/Atmosphere' },
  zh: { piano: '钢琴', guitar: '吉他', bass: '贝斯', drums: '鼓', strings: '弦乐', synth: '合成器', flute: '长笛', sax: '萨克斯', trumpet: '小号', violin: '小提琴', cello: '大提琴', pad: 'Pad/氛围' },
  ja: { piano: 'ピアノ', guitar: 'ギター', bass: 'ベース', drums: 'ドラム', strings: 'ストリングス', synth: 'シンセ', flute: 'フルート', sax: 'サックス', trumpet: 'トランペット', violin: 'ヴァイオリン', cello: 'チェロ', pad: 'Pad/アトモスフィア' },
  ko: { piano: '피아노', guitar: '기타', bass: '베이스', drums: '드럼', strings: '스트링', synth: '신스', flute: '플루트', sax: '색소폰', trumpet: '트럼펫', violin: '바이올린', cello: '첼로', pad: 'Pad/분위기' },
}

interface LyriaSessionLike {
  setWeightedPrompts(input: { weightedPrompts: Array<{ text: string; weight: number }> }): Promise<void>
  setMusicGenerationConfig(input: {
    musicGenerationConfig: {
      bpm: number
      density: number
      brightness: number
      guidance: number
      musicGenerationMode: string
      temperature?: number
    }
  }): Promise<void>
  play(): void | Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  resetContext(): Promise<void>
}

const MODE_DEFAULTS: Record<Mode, { prompt: string }> = {
  background: { prompt: 'Lo-fi chill nhẹ nhàng, piano ấm, nhịp mượt, phù hợp làm nhạc nền video tập trung làm việc' },
  dj: { prompt: 'Techno tối giản, bass sâu, groove chặt, năng lượng cao nhưng vẫn sạch và hiện đại' },
  image: { prompt: 'Ambient điện ảnh, piano cảm xúc, dây nhẹ nhàng, chuyển động mượt' },
  realtime: { prompt: 'Electronic hiện đại, bass sạch, lớp synth rộng, cảm giác không gian thoáng' },
}

const PRICING_PER_10S: Record<Mode, number> = {
  background: 0.5,
  dj: 0.7,
  image: 0.5,
  realtime: 0.7,
}

const DURATION_OPTIONS = [30, 60, 120, 300, 600] as const
type MusicHistoryItem = {
  id: string
  title: string
  mode: Mode
  style: string
  durationSeconds: number
  chargedCredits: number
  audioUrl?: string | null
  createdAt: string
}

function toBytes(data: unknown): Uint8Array {
  if (typeof data === 'string') {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const bin = atob(padded)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(0)
}

function pcm16StereoToAudioBuffer(ctx: AudioContext, rawData: unknown, sampleRate = LyriaSampleRate): AudioBuffer | null {
  const bytes = toBytes(rawData)
  if (!bytes.length) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sampleCount = Math.floor(bytes.byteLength / 2)
  const frameCount = Math.max(1, Math.floor(sampleCount / 2))
  const audioBuffer = ctx.createBuffer(2, frameCount, sampleRate)
  const left = audioBuffer.getChannelData(0)
  const right = audioBuffer.getChannelData(1)

  let offset = 0
  for (let i = 0; i < frameCount; i++) {
    const l = offset + 1 < view.byteLength ? view.getInt16(offset, true) : 0
    const r = offset + 3 < view.byteLength ? view.getInt16(offset + 2, true) : l
    left[i] = l / 32768
    right[i] = r / 32768
    offset += 4
  }
  return audioBuffer
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.length
  }
  return merged
}

function pcm16StereoToWavBlob(pcm: Uint8Array, sampleRate = LyriaSampleRate): Blob {
  const channels = 2
  const bitsPerSample = 16
  const blockAlign = channels * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  new Uint8Array(buffer, 44).set(pcm)

  return new Blob([buffer], { type: 'audio/wav' })
}

const MODE_TITLES: Record<Mode, Record<UiLocale, string>> = {
  background: { vi: 'Nhạc nền AI', en: 'AI Background Music', zh: 'AI背景音乐', ja: 'AI BGM', ko: 'AI 배경 음악' },
  dj: { vi: 'Bàn mix AI DJ', en: 'AI DJ Mix Board', zh: 'AI DJ 混音台', ja: 'AI DJ ミキサーボード', ko: 'AI DJ 믹스 보드' },
  image: { vi: 'Nhạc theo cảm xúc ảnh', en: 'Music from Image Mood', zh: '根据图片情绪生成音乐', ja: '画像の感情から音楽', ko: '이미지 감정으로 음악' },
  realtime: { vi: 'Điều khiển nhạc thời gian thực', en: 'Realtime Music Control', zh: '实时音乐控制', ja: 'リアルタイム音楽制御', ko: '실시간 음악 제어' },
}
const MODE_DESCRIPTIONS: Record<Mode, Record<UiLocale, string>> = {
  background: { vi: 'Tạo nhạc nền độc quyền theo mô tả, phát liên tục theo thời gian thực.', en: 'Create exclusive background music from your description, plays continuously in real time.', zh: '根据描述创建专属背景音乐，实时连续播放。', ja: '説明に基づいて専用BGMを作成、リアルタイムで連続再生。', ko: '설명에 따라 독점 배경 음악을 만들고 실시간으로 연속 재생합니다.' },
  dj: { vi: 'Điều khiển BPM, Density, Brightness theo thời gian thực như một DJ AI.', en: 'Control BPM, Density, Brightness in real time like an AI DJ.', zh: '像AI DJ一样实时控制BPM、密度、亮度。', ja: 'AI DJのようにBPM、Density、Brightnessをリアルタイムで制御。', ko: 'AI DJ처럼 BPM, Density, Brightness를 실시간으로 제어합니다.' },
  image: { vi: 'Phân tích cảm xúc ảnh và chuyển thành prompt nhạc tự động.', en: 'Analyze image mood and convert to music prompt automatically.', zh: '分析图片情绪并自动转换为音乐提示。', ja: '画像の雰囲気を分析し、音楽プロンプトに自動変換。', ko: '이미지 분위기를 분석하여 음악 프롬프트로 자동 변환합니다.' },
  realtime: { vi: 'Đang phát nhạc và chèn prompt mới ngay lập tức để biến đổi âm nhạc.', en: 'Music is playing; inject new prompts instantly to transform the music.', zh: '正在播放音乐，即时插入新提示以改变音乐。', ja: '再生中に新しいプロンプトを即座に挿入して音楽を変化。', ko: '재생 중 새 프롬프트를 즉시 삽입하여 음악을 변형합니다.' },
}

export function LyriaFeatureClient({ mode, uiLocale: uiLocaleProp }: { mode: Mode; uiLocale?: UiLocale }) {
  const config = MODE_DEFAULTS[mode]
  const { toast } = useToast()
  const [uiLocaleInternal, setUiLocaleInternal] = useState<UiLocale>('vi')
  const uiLocale = uiLocaleProp ?? uiLocaleInternal
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    if (uiLocaleProp != null) return
    const syncLocale = () => setUiLocaleInternal(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [uiLocaleProp])

  const apiKeyRef = useRef<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [basePrompt, setBasePrompt] = useState(config.prompt)
  const [livePrompt, setLivePrompt] = useState('')
  const [vocalMode, setVocalMode] = useState<VocalMode>('instrumental')
  const [musicLanguage, setMusicLanguage] = useState<MusicLanguage>('vi')
  const [musicStyle, setMusicStyle] = useState<MusicStyle>('lofi')
  const [lyricHint, setLyricHint] = useState('')
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female')
  const [voiceTone, setVoiceTone] = useState<VoiceTone>('mezzo')
  const [voiceRegion, setVoiceRegion] = useState<VoiceRegion>('bac')
  const [voiceStyle, setVoiceStyle] = useState('')
  const [includeInstruments, setIncludeInstruments] = useState<InstrumentKey[]>([])
  const [excludeInstruments, setExcludeInstruments] = useState<InstrumentKey[]>([])
  const [bpm, setBpm] = useState(96)
  const [density, setDensity] = useState(0.55)
  const [brightness, setBrightness] = useState(0.55)
  const [promptHistory, setPromptHistory] = useState<string[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [chunksReceived, setChunksReceived] = useState(0)
  const [lastStreamError, setLastStreamError] = useState<string | null>(null)
  const [audioState, setAudioState] = useState<'none' | AudioContextState>('none')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [chargedCredits, setChargedCredits] = useState(0)
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState<number>(60)
  const [musicHistory, setMusicHistory] = useState<MusicHistoryItem[]>([])

  const sessionRef = useRef<LyriaSessionLike | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const recordedChunksRef = useRef<Uint8Array[]>([])
  const nextPlayTimeRef = useRef(0)
  const chargedBlocksRef = useRef(0)
  const chargeInFlightRef = useRef(false)
  const sessionLoggedRef = useRef(false)
  const elapsedRef = useRef(0)
  const chargedCreditsRef = useRef(0)

  const canUseImageMode = mode === 'image'
  const showDjControls = mode === 'dj' || mode === 'realtime'
  const showRealtimePromptBox = mode === 'realtime'

  useEffect(() => {
    let cancelled = false
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/music-history?limit=30', { method: 'GET' })
        const data = (await res.json().catch(() => ({}))) as { items?: MusicHistoryItem[]; error?: string }
        if (!res.ok || !Array.isArray(data.items)) return
        if (!cancelled) setMusicHistory(data.items)
      } catch {
        // ignore fetch lỗi, vẫn cho dùng tính năng
      }
    }
    void fetchHistory()
    return () => {
      cancelled = true
    }
  }, [])

  const pushHistory = async (item: MusicHistoryItem) => {
    try {
      await fetch('/api/music-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: item.mode,
          title: item.title,
          style: item.style,
          durationSeconds: item.durationSeconds,
          chargedCredits: item.chargedCredits,
          audioUrl: item.audioUrl || null,
        }),
      })
    } catch {
      // ignore
    }
    setMusicHistory((prev) => {
      const next = [item, ...prev].slice(0, 30)
      return next
    })
  }

  const toggleIncludeInstrument = (key: InstrumentKey) => {
    setIncludeInstruments((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]))
    setExcludeInstruments((prev) => prev.filter((x) => x !== key))
  }

  const toggleExcludeInstrument = (key: InstrumentKey) => {
    setExcludeInstruments((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]))
    setIncludeInstruments((prev) => prev.filter((x) => x !== key))
  }

  const weightedPrompts = useMemo(() => {
    const stylePrompt = `Phong cách nhạc chính: ${MUSIC_STYLE_LABELS_VI[musicStyle]}`
    const languagePrompt =
      vocalMode === 'vocal'
        ? `Ngôn ngữ lời hát ưu tiên: ${LANGUAGE_LABELS_VI[musicLanguage]}`
        : `Ngôn ngữ mô tả mood: ${LANGUAGE_LABELS_VI[musicLanguage]}`
    const vocalPrompt =
      vocalMode === 'vocal'
        ? [
            `Giọng hát rõ, giai điệu dễ nhớ`,
            `Giới tính giọng: ${VOICE_GENDER_LABELS_VI[voiceGender]}`,
            `Tông giọng: ${VOICE_TONE_LABELS_VI[voiceTone]}`,
            `Vùng giọng: ${VOICE_REGION_LABELS_VI[voiceRegion]}`,
            lyricHint.trim() ? `Chủ đề lời: ${lyricHint.trim()}` : '',
            voiceStyle.trim() ? `Phong cách hát: ${voiceStyle.trim()}` : '',
          ]
            .filter(Boolean)
            .join(', ')
        : 'Chỉ nhạc không lời, không dùng giọng hát'
    const includePrompt =
      includeInstruments.length > 0
        ? `Ưu tiên nhạc cụ: ${includeInstruments.map((k) => INSTRUMENT_LABELS_VI[k]).join(', ')}`
        : ''
    const excludePrompt =
      excludeInstruments.length > 0
        ? `Hạn chế hoặc không dùng: ${excludeInstruments.map((k) => INSTRUMENT_LABELS_VI[k]).join(', ')}`
        : ''
    const activePrompts = [
      basePrompt,
      stylePrompt,
      languagePrompt,
      vocalPrompt,
      includePrompt,
      excludePrompt,
      ...promptHistory.slice(-3),
    ].filter(Boolean)
    const weight = activePrompts.length > 0 ? 1 / activePrompts.length : 1
    return activePrompts.map((text) => ({ text, weight }))
  }, [
    basePrompt,
    promptHistory,
    vocalMode,
    lyricHint,
    musicLanguage,
    musicStyle,
    voiceGender,
    voiceTone,
    voiceRegion,
    voiceStyle,
    includeInstruments,
    excludeInstruments,
  ])

  const buildMusicGenerationConfig = () => ({
    bpm,
    density,
    brightness,
    guidance: 4,
    musicGenerationMode: vocalMode === 'vocal' ? 'VOCALIZATION' : 'QUALITY',
    temperature: 1.0,
  })

  const ensureAudio = async () => {
    if (!contextRef.current) {
      const ctx = new AudioContext({ sampleRate: LyriaSampleRate })
      const gain = ctx.createGain()
      gain.gain.value = 0.95
      gain.connect(ctx.destination)
      contextRef.current = ctx
      gainRef.current = gain
      nextPlayTimeRef.current = ctx.currentTime
    }
    setAudioState(contextRef.current.state)
    if (contextRef.current.state !== 'running') {
      await contextRef.current.resume()
      setAudioState(contextRef.current.state)
    }
  }

  useEffect(() => {
    const ctx = contextRef.current
    if (!ctx) return
    const id = window.setInterval(() => setAudioState(ctx.state), 1200)
    return () => window.clearInterval(id)
  }, [isConnected, isPlaying])

  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [isPlaying])

  useEffect(() => {
    elapsedRef.current = elapsedSeconds
  }, [elapsedSeconds])

  useEffect(() => {
    chargedCreditsRef.current = chargedCredits
  }, [chargedCredits])

  useEffect(() => {
    if (!isPlaying) return
    const currentBlock = Math.floor(elapsedSeconds / 10)
    if (currentBlock <= 0) return
    if (currentBlock <= chargedBlocksRef.current) return
    if (chargeInFlightRef.current) return

    chargeInFlightRef.current = true
    void chargeCredits()
      .then(() => {
        chargedBlocksRef.current = currentBlock
      })
      .catch(async (e) => {
        const msg = e instanceof Error ? e.message : tr('Không thể trừ credits.', 'Unable to deduct credits.', '无法扣除积分。', 'クレジットを差し引けません。', '크레딧을 차감할 수 없습니다.')
        toast({ title: tr('Không đủ credits để tiếp tục', 'Insufficient credits to continue', '积分不足，无法继续', 'クレジット不足で続行できません', '크레딧 부족으로 계속할 수 없습니다'), description: msg, variant: 'destructive' })
        await handleStop()
      })
      .finally(() => {
        chargeInFlightRef.current = false
      })
  }, [elapsedSeconds, isPlaying])

  useEffect(() => {
    if (!isPlaying) return
    if (selectedDurationSeconds <= 0) return
    if (elapsedSeconds < selectedDurationSeconds) return
    toast({
      title: tr('Hoàn tất đoạn nhạc', 'Music segment complete', '音乐片段完成', '音楽セグメント完了', '음악 세그먼트 완료'),
      description: tr('Đã đủ %s giây theo thời lượng bạn chọn.', 'Reached %s seconds as selected.', '已达到所选 %s 秒。', '選択した %s 秒に達しました。', '선택한 %s초에 도달했습니다.').replace('%s', String(selectedDurationSeconds)),
    })
    void handleStop()
  }, [isPlaying, elapsedSeconds, selectedDurationSeconds])

  const timeCredit = Math.ceil(elapsedSeconds / 10) * PRICING_PER_10S[mode]
  const estimatedTotalCredit = timeCredit
  const blockProgressPercent = ((elapsedSeconds % 10) / 10) * 100
  const selectedDurationCredit =
    selectedDurationSeconds === 0 ? null : Math.ceil(selectedDurationSeconds / 10) * PRICING_PER_10S[mode]

  const chargeCredits = async () => {
    const res = await fetch('/api/music-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, chargeType: 'time_block' }),
    })
    const data = (await res.json().catch(() => ({}))) as { charged?: number; error?: string; code?: string }
    if (!res.ok) {
      throw new Error(data.error || (data.code === 'INSUFFICIENT_CREDITS' ? tr('Không đủ credits.', 'Insufficient credits.', '积分不足。', 'クレジット不足。', '크레딧 부족.') : tr('Trừ credits thất bại.', 'Failed to deduct credits.', '扣除积分失败。', 'クレジット差し引き失敗。', '크레딧 차감 실패.')))
    }
    const charged = typeof data.charged === 'number' ? data.charged : 0
    if (charged > 0) {
      setChargedCredits((v) => v + charged)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
    }
  }

  const uploadSessionAudio = async () => {
    const chunks = recordedChunksRef.current
    if (!chunks.length) return null
    const pcm = concatUint8Arrays(chunks)
    const wavBlob = pcm16StereoToWavBlob(pcm, LyriaSampleRate)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const file = new File([wavBlob], `nhac-ai-${ts}.wav`, { type: 'audio/wav' })
    const form = new FormData()
    form.append('audio', file)
    const res = await fetch('/api/music-upload', { method: 'POST', body: form })
    const data = (await res.json().catch(() => ({}))) as { audioUrl?: string; error?: string }
    if (!res.ok) {
      throw new Error(data.error || tr('Không upload được audio lịch sử.', 'Failed to upload history audio.', '无法上传历史音频。', '履歴オーディオのアップロードに失敗。', '기록 오디오 업로드 실패.'))
    }
    return data.audioUrl || null
  }

  const finalizeMusicSession = async () => {
    if (sessionLoggedRef.current) return
    if (elapsedRef.current <= 0) return
    sessionLoggedRef.current = true
    let audioUrl: string | null = null
    try {
      audioUrl = await uploadSessionAudio()
    } catch {
      toast({
        title: 'Không lưu được file nhạc',
        description: 'Phiên vẫn được lưu lịch sử nhưng thiếu file nghe lại.',
        variant: 'destructive',
      })
    }
    await pushHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: MODE_TITLES[mode][uiLocale],
      mode,
      style: MUSIC_STYLE_LABELS[uiLocale][musicStyle],
      durationSeconds: elapsedRef.current,
      chargedCredits: chargedCreditsRef.current,
      audioUrl,
      createdAt: new Date().toISOString(),
    })
  }

  const connectSession = async () => {
    if (sessionRef.current) return
    if (!apiKeyRef.current) {
      try {
        const keyRes = await fetch('/api/music-lyria-key', { method: 'GET' })
        const keyData = await keyRes.json()
        if (keyRes.ok && keyData?.apiKey) {
          apiKeyRef.current = keyData.apiKey
        }
      } catch {
        // handled by validation below
      }
    }
    if (!apiKeyRef.current) {
      toast({
        title: 'Thiếu cấu hình',
        description: 'Cần đặt GOOGLE_API_KEY để dùng Lyria RealTime.',
        variant: 'destructive',
      })
      return
    }
    await ensureAudio()
    setIsBusy(true)
    try {
      const { GoogleGenAI } = await import('@google/genai')
      const client = new GoogleGenAI({ apiKey: apiKeyRef.current, apiVersion: 'v1alpha' })
      const session = await client.live.music.connect({
        model: 'models/lyria-realtime-exp',
        callbacks: {
          onmessage: async (message: unknown) => {
            try {
              const directPayload = message as {
                serverContent?: { audioChunks?: Array<{ data?: unknown } | unknown> }
                server_content?: { audio_chunks?: Array<{ data?: unknown } | unknown> }
              }
              const eventLike = message as { data?: string | object }
              const fromEvent = typeof eventLike?.data === 'string'
                ? (JSON.parse(eventLike.data) as typeof directPayload)
                : (eventLike?.data as typeof directPayload | undefined)
              const payload = directPayload?.serverContent || directPayload?.server_content
                ? directPayload
                : fromEvent

              const chunks = payload?.serverContent?.audioChunks ?? payload?.server_content?.audio_chunks ?? []
              if (!chunks.length || !contextRef.current || !gainRef.current) return
              const ctx = contextRef.current
              setChunksReceived((prev) => prev + chunks.length)
              setLastStreamError(null)

              for (const rawChunk of chunks) {
                const chunk = rawChunk as { data?: unknown }
                const rawBytes = toBytes(chunk?.data ?? rawChunk)
                if (rawBytes.length) recordedChunksRef.current.push(rawBytes)
                const audioBuffer = pcm16StereoToAudioBuffer(ctx, rawBytes, LyriaSampleRate)
                if (!audioBuffer) continue
                const source = ctx.createBufferSource()
                source.buffer = audioBuffer
                source.connect(gainRef.current)
                const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime + 0.015)
                source.start(startAt)
                nextPlayTimeRef.current = startAt + audioBuffer.duration
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : tr('Không giải mã được gói âm thanh.', 'Could not decode audio packet.', '无法解码音频包。', 'オーディオパケットをデコードできません。', '오디오 패킷 디코딩 실패.')
              setLastStreamError(msg)
            }
          },
          onerror: (err: unknown) => {
            const msg = err instanceof Error ? err.message : tr('Lỗi luồng nhạc.', 'Music stream error.', '音乐流错误。', '音楽ストリームエラー。', '음악 스트림 오류.')
            setLastStreamError(msg)
            toast({ title: tr('Lyria lỗi', 'Lyria error', 'Lyria 错误', 'Lyria エラー', 'Lyria 오류'), description: msg, variant: 'destructive' })
          },
          onclose: (ev: { code?: number; reason?: string } = {}) => {
            setIsPlaying(false)
            setIsConnected(false)
            sessionRef.current = null
            void finalizeMusicSession()
            if (ev.code && ev.code !== 1000) {
              setLastStreamError(`Socket đóng (${ev.code}): ${ev.reason || tr('Không rõ lý do', 'Unknown reason', '原因不明', '不明な理由', '알 수 없는 이유')}`)
            }
          },
        },
      })
      sessionRef.current = session as unknown as LyriaSessionLike
      setIsConnected(true)
      setChunksReceived(0)
      setElapsedSeconds(0)
      setChargedCredits(0)
      chargedBlocksRef.current = 0
      sessionLoggedRef.current = false
      recordedChunksRef.current = []
      setLastStreamError(null)
      await session.setWeightedPrompts({
        weightedPrompts: [{ text: basePrompt, weight: 1 }],
      })
      await session.setMusicGenerationConfig({
        musicGenerationConfig: buildMusicGenerationConfig(),
      } as never)
      toast({ title: tr('Đã kết nối Lyria', 'Lyria connected', 'Lyria 已连接', 'Lyria 接続完了', 'Lyria 연결됨'), description: tr('Sẵn sàng phát nhạc thời gian thực.', 'Ready to play realtime music.', '准备播放实时音乐。', 'リアルタイム音楽の再生準備完了。', '실시간 음악 재생 준비 완료.') })
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('Không thể kết nối Lyria.', 'Could not connect to Lyria.', '无法连接 Lyria。', 'Lyria に接続できません。', 'Lyria에 연결할 수 없습니다.')
      toast({ title: tr('Kết nối thất bại', 'Connection failed', '连接失败', '接続失敗', '연결 실패'), description: msg, variant: 'destructive' })
    } finally {
      setIsBusy(false)
    }
  }

  const handlePlay = async () => {
    await connectSession()
    if (!sessionRef.current) return
    setIsBusy(true)
    try {
      await sessionRef.current.setWeightedPrompts({ weightedPrompts })
      await sessionRef.current.setMusicGenerationConfig({
        musicGenerationConfig: buildMusicGenerationConfig(),
      } as never)
      await sessionRef.current.play()
      setIsPlaying(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('Không thể phát nhạc.', 'Could not play music.', '无法播放音乐。', '音楽を再生できません。', '음악을 재생할 수 없습니다.')
      toast({ title: tr('Phát nhạc thất bại', 'Play failed', '播放失败', '再生失敗', '재생 실패'), description: msg, variant: 'destructive' })
    } finally {
      setIsBusy(false)
    }
  }

  const testSpeaker = async () => {
    await ensureAudio()
    if (!contextRef.current || !gainRef.current) return
    const ctx = contextRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 660
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(gainRef.current)
    osc.start()
    osc.stop(ctx.currentTime + 0.18)
  }

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setTimeout(() => {
      if (isPlaying && chunksReceived === 0) {
        toast({
          title: tr('Chưa nhận gói âm thanh', 'No audio packets received', '未收到音频包', 'オーディオパケットを受信していません', '오디오 패킷 수신 없음'),
          description: tr('Đã bấm phát nhưng chưa có dữ liệu âm thanh. Kiểm tra key có quyền Lyria RealTime và model models/lyria-realtime-exp.', 'Play pressed but no audio data. Check key has Lyria RealTime access and model models/lyria-realtime-exp.', '已按播放但无音频数据。请检查密钥是否有 Lyria RealTime 权限和模型 models/lyria-realtime-exp。', '再生を押しましたがオーディオデータがありません。キーに Lyria RealTime 権限とモデル models/lyria-realtime-exp を確認してください。', '재생을 눌렀지만 오디오 데이터가 없습니다. 키에 Lyria RealTime 권한과 모델 models/lyria-realtime-exp를 확인하세요.'),
          variant: 'destructive',
          duration: 6000,
        })
      }
    }, 6500)
    return () => window.clearTimeout(timer)
  }, [isPlaying, chunksReceived, toast])

  const handlePause = async () => {
    if (!sessionRef.current) return
    try {
      await sessionRef.current.pause()
      setIsPlaying(false)
    } catch {
      toast({ title: tr('Không thể tạm dừng', 'Could not pause', '无法暂停', '一時停止できません', '일시정지 실패'), variant: 'destructive' })
    }
  }

  const handleStop = async () => {
    if (!sessionRef.current) return
    try {
      await sessionRef.current.stop()
      await sessionRef.current.resetContext()
      setIsPlaying(false)
      setIsConnected(false)
      sessionRef.current = null
      if (contextRef.current) nextPlayTimeRef.current = contextRef.current.currentTime
      void finalizeMusicSession()
      toast({ title: tr('Đã dừng phiên nhạc', 'Music session stopped', '音乐会话已停止', '音楽セッションを停止しました', '음악 세션 중지됨'), description: tr('Lần phát tiếp theo sẽ bắt đầu phiên mới.', 'Next play will start a new session.', '下次播放将开始新会话。', '次回再生で新しいセッションが開始されます。', '다음 재생 시 새 세션이 시작됩니다.') })
    } catch {
      toast({ title: tr('Không thể dừng nhạc', 'Could not stop music', '无法停止音乐', '音楽を停止できません', '음악 중지 실패'), variant: 'destructive' })
    }
  }

  const handleDownloadMusic = () => {
    const chunks = recordedChunksRef.current
    if (!chunks.length) {
      toast({ title: tr('Chưa có dữ liệu nhạc', 'No music data yet', '尚无音乐数据', 'まだ音楽データがありません', '아직 음악 데이터 없음'), description: tr('Hãy phát nhạc một lúc rồi tải xuống.', 'Play music for a while then download.', '请先播放音乐一段时间后再下载。', '音楽をしばらく再生してからダウンロードしてください。', '음악을 잠시 재생한 후 다운로드하세요.'), variant: 'destructive' })
      return
    }
    const pcm = concatUint8Arrays(chunks)
    const wavBlob = pcm16StereoToWavBlob(pcm, LyriaSampleRate)
    const url = URL.createObjectURL(wavBlob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.href = url
    a.download = `nhac-ai-${ts}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const applyBasePrompt = async () => {
    if (!basePrompt.trim()) {
      toast({ title: tr('Thiếu mô tả nhạc nền', 'Missing music description', '缺少音乐描述', '音楽の説明がありません', '음악 설명 누락'), variant: 'destructive' })
      return
    }
    if (!sessionRef.current) {
      toast({ title: tr('Đã lưu mô tả', 'Description saved', '描述已保存', '説明を保存しました', '설명 저장됨'), description: tr('Bấm Phát để dùng mô tả này cho phiên nhạc mới.', 'Click Play to use this description for a new session.', '点击播放以将此描述用于新会话。', '再生をクリックしてこの説明を新しいセッションで使用します。', '재생을 클릭하여 이 설명을 새 세션에 사용하세요.') })
      return
    }
    try {
      await sessionRef.current.setWeightedPrompts({ weightedPrompts })
      await sessionRef.current.resetContext()
      toast({ title: tr('Đã gửi mô tả nhạc nền', 'Music description sent', '音乐描述已发送', '音楽の説明を送信しました', '음악 설명 전송됨'), description: tr('Nhạc sẽ cập nhật theo mô tả mới trong vài giây.', 'Music will update to the new description in a few seconds.', '音乐将在几秒内根据新描述更新。', '数秒で新しい説明に合わせて音楽が更新されます。', '몇 초 내에 새 설명에 맞춰 음악이 업데이트됩니다.') })
    } catch {
      toast({ title: tr('Không thể gửi mô tả nhạc nền', 'Could not send music description', '无法发送音乐描述', '音楽の説明を送信できません', '음악 설명 전송 실패'), variant: 'destructive' })
    }
  }

  const applyPromptBlend = async () => {
    if (!sessionRef.current || !livePrompt.trim()) return
    const injectedPrompt = livePrompt.trim()
    const next = [...promptHistory, injectedPrompt].slice(-4)
    setPromptHistory(next)
    try {
      const boostedPrompts = [
        { text: basePrompt, weight: 0.7 },
        { text: `Phong cách nhạc chính: ${MUSIC_STYLE_LABELS_VI[musicStyle]}`, weight: 0.9 },
        {
          text: vocalMode === 'vocal' ? `Ngôn ngữ lời hát ưu tiên: ${LANGUAGE_LABELS_VI[musicLanguage]}` : `Ngôn ngữ mô tả mood: ${LANGUAGE_LABELS_VI[musicLanguage]}`,
          weight: 0.8,
        },
        ...(includeInstruments.length > 0
          ? [{ text: `Ưu tiên nhạc cụ: ${includeInstruments.map((k) => INSTRUMENT_LABELS_VI[k]).join(', ')}`, weight: 1.3 }]
          : []),
        ...(excludeInstruments.length > 0
          ? [{ text: `Hạn chế hoặc không dùng: ${excludeInstruments.map((k) => INSTRUMENT_LABELS_VI[k]).join(', ')}`, weight: 1.3 }]
          : []),
        ...next.slice(-2).map((text) => ({ text, weight: 1.1 })),
        // Prompt vừa chèn được tăng trọng số để nghe ra thay đổi rõ hơn.
        { text: injectedPrompt, weight: 1.8 },
      ]
      await sessionRef.current.setWeightedPrompts({
        weightedPrompts: boostedPrompts,
      })
      await sessionRef.current.resetContext()
      setLivePrompt('')
      toast({ title: tr('Đã áp mô tả mới', 'New description applied', '已应用新描述', '新しい説明を適用しました', '새 설명 적용됨'), description: tr('Đã tăng lực prompt. Chờ 2-6 giây để nghe rõ thay đổi.', 'Prompt weight increased. Wait 2-6 seconds to hear the change.', '已增加提示权重。等待 2-6 秒以听到变化。', 'プロンプトの重みを増加。2-6秒待って変化を確認してください。', '프롬프트 가중치 증가. 2-6초 후 변화를 들을 수 있습니다.') })
    } catch {
      toast({ title: tr('Không thể cập nhật mô tả', 'Could not update description', '无法更新描述', '説明を更新できません', '설명 업데이트 실패'), variant: 'destructive' })
    }
  }

  const applyDjConfig = async () => {
    if (!sessionRef.current) return
    try {
      await sessionRef.current.setMusicGenerationConfig({
        musicGenerationConfig: buildMusicGenerationConfig(),
      } as never)
      await sessionRef.current.resetContext()
      toast({ title: tr('Đã cập nhật bàn mix', 'Mix board updated', '混音台已更新', 'ミキサーボードを更新しました', '믹스 보드 업데이트됨'), description: tr('BPM và texture đã được làm mới.', 'BPM and texture have been refreshed.', 'BPM 和质感已刷新。', 'BPM とテクスチャを更新しました。', 'BPM과 텍스처가 새로고침되었습니다.') })
    } catch {
      toast({ title: tr('Không thể áp cấu hình DJ', 'Could not apply DJ config', '无法应用 DJ 配置', 'DJ設定を適用できません', 'DJ 설정 적용 실패'), variant: 'destructive' })
    }
  }

  const handleImageChange = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const analyzeImageMood = async () => {
    if (!imageFile) return
    setIsBusy(true)
    try {
      const form = new FormData()
      form.append('image', imageFile)
      form.append('language', musicLanguage)
      const res = await fetch('/api/music-image-mood', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data?.prompt) throw new Error(data?.error || tr('Không phân tích được ảnh', 'Could not analyze image', '无法分析图片', '画像を分析できません', '이미지 분석 실패'))
      setBasePrompt(data.prompt)
      setPromptHistory([])
      toast({ title: tr('Đã phân tích ảnh', 'Image analyzed', '图片已分析', '画像を分析しました', '이미지 분석 완료'), description: `${tr('Gợi ý nhạc', 'Music suggestion', '音乐建议', '音楽の提案', '음악 제안')}: ${data.prompt}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không phân tích được ảnh.'
      toast({ title: 'Phân tích thất bại', description: msg, variant: 'destructive' })
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      <Toaster />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            {MODE_TITLES[mode][uiLocale]}
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {tr('Thử nghiệm', 'Beta', '测试版', 'ベータ', '베타')}
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">{MODE_DESCRIPTIONS[mode][uiLocale]}</p>
          <p className="mt-1 text-xs text-amber-700">
            {tr('Tính năng đang trong giai đoạn thử nghiệm, chất lượng và độ ổn định có thể thay đổi.', 'Feature is in beta; quality and stability may vary.', '功能处于测试阶段，质量和稳定性可能有所变化。', '機能はベータ段階です。品質と安定性は変動する場合があります。', '기능이 베타 단계입니다. 품질과 안정성이 달라질 수 있습니다.')}
          </p>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-indigo-600" />
              {tr('Bảng điều khiển Lyria RealTime', 'Lyria RealTime Control Panel', 'Lyria RealTime 控制面板', 'Lyria RealTime コントロールパネル', 'Lyria RealTime 제어판')}
            </CardTitle>
            <CardDescription>
              {tr('Nhạc chạy liên tục theo thời gian thực. Bạn có thể điều khiển mô tả và thông số ngay khi đang phát.', 'Music runs continuously in real time. You can control description and parameters while playing.', '音乐实时连续播放。播放时可控制描述和参数。', '音楽はリアルタイムで連続再生。再生中に説明とパラメータを制御できます。', '음악이 실시간으로 연속 재생됩니다. 재생 중 설명과 매개변수를 제어할 수 있습니다.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Phong cách nhạc', 'Music style', '音乐风格', '音楽スタイル', '음악 스타일')}</label>
              <select
                value={musicStyle}
                onChange={(e) => setMusicStyle(e.target.value as MusicStyle)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(MUSIC_STYLE_LABELS[uiLocale]).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Ngôn ngữ nhạc/lời', 'Music/language', '音乐/语言', '音楽/言語', '음악/언어')}</label>
              <select
                value={musicLanguage}
                onChange={(e) => setMusicLanguage(e.target.value as MusicLanguage)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(LANGUAGE_LABELS[uiLocale]).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Kiểu nhạc', 'Music type', '音乐类型', '音楽タイプ', '음악 유형')}</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={vocalMode === 'instrumental' ? 'default' : 'outline'}
                  onClick={() => setVocalMode('instrumental')}
                  className={vocalMode === 'instrumental' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                >
                  {tr('Nhạc không lời', 'Instrumental', '纯音乐', 'インストゥルメンタル', '인스트루멘탈')}
                </Button>
                <Button
                  type="button"
                  variant={vocalMode === 'vocal' ? 'default' : 'outline'}
                  onClick={() => setVocalMode('vocal')}
                  className={vocalMode === 'vocal' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                >
                  {tr('Nhạc có lời', 'Vocal', '有歌词', 'ボーカル', '보컬')}
                </Button>
              </div>
              {vocalMode === 'vocal' && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Giới tính giọng', 'Voice gender', '嗓音性别', '声の性別', '목소리 성별')}</label>
                      <select
                        value={voiceGender}
                        onChange={(e) => setVoiceGender(e.target.value as VoiceGender)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      >
                        {Object.entries(VOICE_GENDER_LABELS[uiLocale]).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Tông giọng', 'Voice tone', '音调', '声のトーン', '목소리 톤')}</label>
                      <select
                        value={voiceTone}
                        onChange={(e) => setVoiceTone(e.target.value as VoiceTone)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      >
                        {Object.entries(VOICE_TONE_LABELS[uiLocale]).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Vùng giọng', 'Voice region', '嗓音区域', '声の地域', '목소리 지역')}</label>
                      <select
                        value={voiceRegion}
                        onChange={(e) => setVoiceRegion(e.target.value as VoiceRegion)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      >
                        {Object.entries(VOICE_REGION_LABELS[uiLocale]).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Input
                    value={lyricHint}
                    onChange={(e) => setLyricHint(e.target.value)}
                    placeholder={tr('Gợi ý nội dung lời (ví dụ: tình yêu, tuổi trẻ, động lực)', 'Lyric hint (e.g. love, youth, motivation)', '歌词提示（如：爱情、青春、动力）', '歌詞のヒント（例：愛、青春、モチベーション）', '가사 힌트 (예: 사랑, 청춘, 동기)')}
                  />
                  <Input
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    placeholder={tr('Phong cách hát (ví dụ: nhẹ nhàng, nội lực, bay bổng, da diết)', 'Singing style (e.g. soft, powerful, soaring, heartfelt)', '演唱风格（如：轻柔、有力、高亢、深情）', '歌唱スタイル（例：柔らか、力強い、高揚、切実）', '노래 스타일 (예: 부드럽게, 힘차게, 높이, 진심)')}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {vocalMode === 'vocal'
                  ? tr('Đang bật chế độ có lời: tạo nhạc có giọng hát.', 'Vocal mode on: music with vocals.', '已开启有歌词模式：带人声的音乐。', 'ボーカルモード: 歌声付きの音楽。', '보컬 모드: 보컬이 있는 음악.')
                  : tr('Đang bật chế độ không lời: chỉ tạo nhạc nhạc cụ.', 'Instrumental mode on: only instrumental music.', '已开启纯音乐模式：仅乐器音乐。', 'インストモード: 楽器のみの音楽。', '인스트 모드: 악기만 있는 음악.')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tr('Mô tả nhạc nền', 'Music description', '音乐描述', '音楽の説明', '음악 설명')}</label>
              <Textarea
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                rows={3}
                placeholder={tr('Ví dụ: Lo-fi chill với piano ấm, nhịp nhẹ cho video TikTok', 'E.g. Lo-fi chill with warm piano, light beat for TikTok', '例如：Lo-fi chill 配温暖钢琴、轻节奏 TikTok 视频', '例：TikTok用の温かいピアノと軽いビートのLo-fi chill', '예: Lo-fi chill, 따뜻한 피아노, 가벼운 비트 TikTok용')}
              />
              <div>
                <Button type="button" variant="outline" onClick={applyBasePrompt} disabled={isBusy || !basePrompt.trim()}>
                  {tr('Gửi mô tả nhạc nền', 'Send music description', '发送音乐描述', '音楽の説明を送信', '음악 설명 전송')}
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">{tr('Điều chỉnh nhạc cụ', 'Adjust instruments', '调整乐器', '楽器を調整', '악기 조정')}</label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIncludeInstruments([])
                    setExcludeInstruments([])
                  }}
                  className="h-8 px-2 text-xs"
                >
                  {tr('Xóa chọn nhạc cụ', 'Clear instrument selection', '清除乐器选择', '楽器選択をクリア', '악기 선택 지우기')}
                </Button>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-700">{tr('Ưu tiên thêm nhạc cụ', 'Prefer to add instruments', '优先添加乐器', '楽器を追加優先', '악기 추가 우선')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(INSTRUMENT_LABELS[uiLocale]).map(([key, label]) => {
                    const active = includeInstruments.includes(key as InstrumentKey)
                    return (
                      <Button
                        key={`inc-${key}`}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleIncludeInstrument(key as InstrumentKey)}
                        className={active ? 'h-8 bg-emerald-600 px-2 text-xs hover:bg-emerald-700' : 'h-8 px-2 text-xs'}
                      >
                        + {label}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-rose-700">{tr('Giảm/bỏ nhạc cụ', 'Reduce/remove instruments', '减少/移除乐器', '楽器を減らす/外す', '악기 줄이기/제거')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(INSTRUMENT_LABELS[uiLocale]).map(([key, label]) => {
                    const active = excludeInstruments.includes(key as InstrumentKey)
                    return (
                      <Button
                        key={`exc-${key}`}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleExcludeInstrument(key as InstrumentKey)}
                        className={active ? 'h-8 bg-rose-600 px-2 text-xs hover:bg-rose-700' : 'h-8 px-2 text-xs'}
                      >
                        - {label}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr('Chọn nhạc cụ ở một bên thôi. Nếu chọn “thêm”, nhạc cụ đó sẽ tự bỏ khỏi nhóm “giảm/bỏ” và ngược lại.', 'Choose instruments on one side only. Selecting "add" removes it from "reduce" and vice versa.', '只能在一侧选择乐器。选择“添加”会从“减少”中移除，反之亦然。', '片方のみ選択。追加を選ぶと減らすから外れ、その逆も同様。', '한쪽만 선택하세요. 추가를 선택하면 줄이기에서 제거되고 그 반대도 마찬가지입니다.')}
              </p>
            </div>

            {canUseImageMode && (
              <div className="space-y-3 rounded-lg border p-3">
                <label className="text-sm font-medium">{tr('Ảnh đầu vào để suy ra cảm xúc nhạc', 'Input image to infer music mood', '输入图片以推断音乐情绪', '画像を入力して音楽の雰囲気を推測', '이미지를 입력하여 음악 분위기 추론')}</label>
                <Input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0] || undefined)} />
                {imagePreview && (
                  <div className="h-48 overflow-hidden rounded-lg border">
                    <ImagePreview src={imagePreview} alt={tr('Mood image preview', 'Mood image preview', '情绪图片预览', '雰囲気画像プレビュー', '분위기 이미지 미리보기')} className="h-full w-full object-cover" />
                  </div>
                )}
                <Button type="button" variant="outline" onClick={analyzeImageMood} disabled={!imageFile || isBusy}>
                  <Upload className="mr-2 h-4 w-4" /> {tr('Phân tích ảnh thành mô tả nhạc', 'Analyze image to music description', '分析图片生成音乐描述', '画像を音楽の説明に変換', '이미지를 음악 설명으로 분석')}
                </Button>
              </div>
            )}

            {showDjControls && (
              <div className="grid gap-4 rounded-lg border p-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">BPM: {bpm}</label>
                  <input type="range" min={60} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Density: {density.toFixed(2)}</label>
                  <input type="range" min={0} max={1} step={0.01} value={density} onChange={(e) => setDensity(Number(e.target.value))} className="w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brightness: {brightness.toFixed(2)}</label>
                  <input type="range" min={0} max={1} step={0.01} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
                </div>
                <div className="sm:col-span-3">
                  <Button type="button" variant="outline" onClick={applyDjConfig} disabled={!isConnected || isBusy}>
                    <WandSparkles className="mr-2 h-4 w-4" /> {tr('Áp cấu hình DJ', 'Apply DJ config', '应用 DJ 配置', 'DJ設定を適用', 'DJ 설정 적용')}
                  </Button>
                </div>
              </div>
            )}

            {showRealtimePromptBox && (
              <div className="space-y-2 rounded-lg border p-3">
                <label className="text-sm font-medium">{tr('Mô tả chèn realtime (không dừng nhạc)', 'Realtime prompt (no stop)', '实时插入描述（不停止）', 'リアルタイムプロンプト（停止なし）', '실시간 프롬프트 (중지 없음)')}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={livePrompt}
                    onChange={(e) => setLivePrompt(e.target.value)}
                    placeholder={tr('Ví dụ: "thêm trống dày hơn và tiếng synth sáng hơn"', 'E.g. "add thicker drums and brighter synth"', '例如："加厚鼓声和更亮的合成器"', '例：「ドラムを厚く、シンセを明るく」', '예: "드럼 더 두껍게, 신스 더 밝게"')}
                  />
                  <Button type="button" onClick={applyPromptBlend} disabled={!livePrompt.trim() || !isConnected}>
                    {tr('Chèn mô tả', 'Insert description', '插入描述', '説明を挿入', '설명 삽입')}
                  </Button>
                </div>
                {promptHistory.length > 0 && (
                  <p className="text-xs text-muted-foreground">{tr('Mô tả gần đây', 'Recent descriptions', '最近描述', '最近の説明', '최근 설명')}: {promptHistory.slice(-3).join(' | ')}</p>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <label className="text-sm font-medium">{tr('Độ dài đoạn nhạc', 'Music segment length', '音乐片段长度', '音楽セグメントの長さ', '음악 세그먼트 길이')}</label>
              <select
                value={selectedDurationSeconds}
                onChange={(e) => setSelectedDurationSeconds(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} {tr('giây', 'sec', '秒', '秒', '초')}
                  </option>
                ))}
                <option value={0}>{tr('Không giới hạn (phát đến khi bạn dừng)', 'Unlimited (play until you stop)', '无限制（播放直到您停止）', '制限なし（停止するまで再生）', '제한 없음 (중지할 때까지 재생)')}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {tr('Giá sơ bộ', 'Est. price', '预估价格', '概算価格', '예상 가격')}:{' '}
                {selectedDurationCredit === null
                  ? tr('chưa giới hạn thời lượng', 'no duration limit', '未限制时长', '時間制限なし', '시간 제한 없음')
                  : `${selectedDurationCredit.toFixed(1)} credit ${tr('cho', 'for', '用于', 'で', '/')} ${selectedDurationSeconds} ${tr('giây', 'sec', '秒', '秒', '초')}`}.
              </p>
            </div>

            <div className="rounded-lg border bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{tr('Thời gian chạy', 'Runtime', '运行时间', '実行時間', '실행 시간')}: {elapsedSeconds}s</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {tr('Đã trừ', 'Charged', '已扣除', '差し引き済み', '차감됨')}: {chargedCredits} credit
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({tr('ước tính', 'est.', '预估', '概算', '예상')}: {estimatedTotalCredit})</span>
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-[width] duration-500"
                  style={{ width: `${blockProgressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {tr('Đơn giá', 'Unit price', '单价', '単価', '단가')}: {PRICING_PER_10S[mode]} credit / 10 {tr('giây', 'sec', '秒', '秒', '초')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePlay} disabled={isBusy}>
                <Play className="mr-2 h-4 w-4" /> {isPlaying ? tr('Đang phát', 'Playing', '播放中', '再生中', '재생 중') : isConnected ? tr('Phát tiếp', 'Resume', '继续播放', '再開', '재개') : tr('Phát', 'Play', '播放', '再生', '재생')}
              </Button>
              <Button type="button" variant="outline" onClick={handlePause} disabled={!isConnected || !isPlaying}>
                <Pause className="mr-2 h-4 w-4" /> {tr('Tạm dừng', 'Pause', '暂停', '一時停止', '일시정지')}
              </Button>
              <Button type="button" variant="outline" onClick={handleStop} disabled={!isConnected}>
                <Square className="mr-2 h-4 w-4" /> {tr('Dừng tạo mới', 'Stop & new session', '停止并新建', '停止して新規', '중지 및 새 세션')}
              </Button>
              <Button type="button" variant="outline" onClick={testSpeaker}>
                {tr('Test loa', 'Test speaker', '测试扬声器', 'スピーカーテスト', '스피커 테스트')}
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadMusic} disabled={chunksReceived === 0}>
                <Download className="mr-2 h-4 w-4" /> {tr('Tải nhạc xuống', 'Download music', '下载音乐', '音楽をダウンロード', '음악 다운로드')}
              </Button>
            </div>

            <div id="music-history" className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{tr('Lịch sử tạo nhạc', 'Music creation history', '音乐创作历史', '音楽作成履歴', '음악 생성 기록')}</p>
                <p className="text-xs text-muted-foreground">{tr('Lưu theo tài khoản Supabase', 'Saved to Supabase account', '保存到 Supabase 账户', 'Supabaseアカウントに保存', 'Supabase 계정에 저장')}</p>
              </div>
              {musicHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">{tr('Chưa có phiên tạo nhạc nào.', 'No music sessions yet.', '尚无音乐会话。', 'まだ音楽セッションがありません。', '아직 음악 세션이 없습니다.')}</p>
              ) : (
                <>
                  <div className="space-y-2 md:hidden">
                    {musicHistory.map((item) => (
                      <div key={item.id} className="rounded-md border p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-800">{item.title}</p>
                          <p className="font-semibold text-emerald-700">{Number(item.chargedCredits || 0).toFixed(1)} credit</p>
                        </div>
                        <p className="mt-1 text-muted-foreground">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                        <p className="text-muted-foreground">{tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}: {item.style}</p>
                        <p className="text-muted-foreground">{tr('Thời lượng', 'Duration', '时长', '時間', '시간')}: {Number(item.durationSeconds || 0)}s</p>
                        <div className="mt-2 flex flex-col gap-2">
                          {item.audioUrl ? (
                            <>
                              <audio controls preload="none" src={item.audioUrl} className="h-9 w-full" />
                              <a
                                href={item.audioUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-3 text-indigo-700"
                              >
                                {tr('Tải WAV', 'Download WAV', '下载 WAV', 'WAVをダウンロード', 'WAV 다운로드')}
                              </a>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{tr('Chưa có file', 'No file', '无文件', 'ファイルなし', '파일 없음')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden max-h-56 overflow-auto rounded border md:block">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">{tr('Thời gian', 'Time', '时间', '時間', '시간')}</th>
                          <th className="px-2 py-1.5 text-left font-medium">{tr('Tính năng', 'Feature', '功能', '機能', '기능')}</th>
                          <th className="px-2 py-1.5 text-left font-medium">{tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}</th>
                          <th className="px-2 py-1.5 text-right font-medium">{tr('Thời lượng', 'Duration', '时长', '時間', '시간')}</th>
                          <th className="px-2 py-1.5 text-right font-medium">Credits</th>
                          <th className="px-2 py-1.5 text-left font-medium">{tr('Nghe lại', 'Replay', '回放', '再生', '재생')}</th>
                          <th className="px-2 py-1.5 text-left font-medium">{tr('Tải xuống', 'Download', '下载', 'ダウンロード', '다운로드')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {musicHistory.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-2 py-1.5">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                            <td className="px-2 py-1.5">{item.title}</td>
                            <td className="px-2 py-1.5">{item.style}</td>
                            <td className="px-2 py-1.5 text-right">{Number(item.durationSeconds || 0)}s</td>
                            <td className="px-2 py-1.5 text-right font-medium text-emerald-700">{Number(item.chargedCredits || 0).toFixed(1)}</td>
                            <td className="px-2 py-1.5">
                              {item.audioUrl ? (
                                <audio controls preload="none" src={item.audioUrl} className="h-8 max-w-[220px]" />
                              ) : (
                                <span className="text-muted-foreground">{tr('Chưa có file', 'No file', '无文件', 'ファイルなし', '파일 없음')}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {item.audioUrl ? (
                                <a
                                  href={item.audioUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-600 hover:underline"
                                >
                                  {tr('Tải WAV', 'Download WAV', '下载 WAV', 'WAVをダウンロード', 'WAV 다운로드')}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-muted-foreground">
              {tr('Trạng thái', 'Status', '状态', '状態', '상태')}: {isConnected ? tr('Đã kết nối Lyria', 'Lyria connected', 'Lyria 已连接', 'Lyria 接続済み', 'Lyria 연결됨') : tr('Chưa kết nối', 'Not connected', '未连接', '未接続', '미연결')} • {isPlaying ? tr('Đang phát', 'Playing', '播放中', '再生中', '재생 중') : tr('Đang dừng', 'Stopped', '已停止', '停止中', '중지됨')}.
              {' '}{tr('Để chạy tính năng này, cần cấu hình', 'To run this feature, configure', '要运行此功能，请配置', 'この機能を実行するには設定が必要です', '이 기능을 실행하려면 구성이 필요합니다')} <code>GOOGLE_API_KEY</code> {tr('trên môi trường deploy.', 'on deploy environment.', '在部署环境中。', 'をデプロイ環境で設定してください。', '를 배포 환경에서 설정하세요.')}
              <br />
              {tr('Trạng thái âm thanh', 'Audio state', '音频状态', 'オーディオ状態', '오디오 상태')}: <strong>{audioState}</strong>
              <br />
              {tr('Số gói âm thanh nhận được', 'Audio packets received', '已接收音频包', '受信したオーディオパケット数', '수신한 오디오 패킷 수')}: <strong>{chunksReceived}</strong>
              {lastStreamError ? (
                <>
                  <br />
                  {tr('Lỗi luồng gần nhất', 'Latest stream error', '最新流错误', '最新のストリームエラー', '최근 스트림 오류')}: <span className="text-red-600">{lastStreamError}</span>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

