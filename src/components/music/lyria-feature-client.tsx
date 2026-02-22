'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

const LANGUAGE_LABELS: Record<MusicLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'Tiếng Anh',
  ja: 'Tiếng Nhật',
  ko: 'Tiếng Hàn',
  zh: 'Tiếng Trung',
}

const MUSIC_STYLE_LABELS: Record<MusicStyle, string> = {
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

const VOICE_GENDER_LABELS: Record<VoiceGender, string> = {
  female: 'Giọng nữ',
  male: 'Giọng nam',
  neutral: 'Trung tính/phi giới tính',
}

const VOICE_TONE_LABELS: Record<VoiceTone, string> = {
  soprano: 'Soprano (nữ cao)',
  mezzo: 'Mezzo-soprano (nữ trung)',
  alto: 'Alto (nữ trầm)',
  tenor: 'Tenor (nam cao)',
  baritone: 'Baritone (nam trung)',
  bass: 'Bass (nam trầm)',
}

const VOICE_REGION_LABELS: Record<VoiceRegion, string> = {
  bac: 'Giọng Bắc',
  trung: 'Giọng Trung',
  nam: 'Giọng Nam',
  mix: 'Pha vùng (trung tính)',
}

const INSTRUMENT_LABELS: Record<InstrumentKey, string> = {
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
  play(): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  resetContext(): Promise<void>
}

const MODE_DEFAULTS: Record<Mode, { title: string; description: string; prompt: string }> = {
  background: {
    title: 'Nhạc nền AI',
    description: 'Tạo nhạc nền độc quyền theo mô tả, phát liên tục theo thời gian thực.',
    prompt: 'Lo-fi chill nhẹ nhàng, piano ấm, nhịp mượt, phù hợp làm nhạc nền video tập trung làm việc',
  },
  dj: {
    title: 'Bàn mix AI DJ',
    description: 'Điều khiển BPM, Density, Brightness theo thời gian thực như một DJ AI.',
    prompt: 'Techno tối giản, bass sâu, groove chặt, năng lượng cao nhưng vẫn sạch và hiện đại',
  },
  image: {
    title: 'Nhạc theo cảm xúc ảnh',
    description: 'Phân tích cảm xúc ảnh và chuyển thành prompt nhạc tự động.',
    prompt: 'Ambient điện ảnh, piano cảm xúc, dây nhẹ nhàng, chuyển động mượt',
  },
  realtime: {
    title: 'Điều khiển nhạc thời gian thực',
    description: 'Đang phát nhạc và chèn prompt mới ngay lập tức để biến đổi âm nhạc.',
    prompt: 'Electronic hiện đại, bass sạch, lớp synth rộng, cảm giác không gian thoáng',
  },
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

export function LyriaFeatureClient({ mode }: { mode: Mode }) {
  const config = MODE_DEFAULTS[mode]
  const { toast } = useToast()

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
    const stylePrompt = `Phong cách nhạc chính: ${MUSIC_STYLE_LABELS[musicStyle]}`
    const languagePrompt =
      vocalMode === 'vocal'
        ? `Ngôn ngữ lời hát ưu tiên: ${LANGUAGE_LABELS[musicLanguage]}`
        : `Ngôn ngữ mô tả mood: ${LANGUAGE_LABELS[musicLanguage]}`
    const vocalPrompt =
      vocalMode === 'vocal'
        ? [
            `Giọng hát rõ, giai điệu dễ nhớ`,
            `Giới tính giọng: ${VOICE_GENDER_LABELS[voiceGender]}`,
            `Tông giọng: ${VOICE_TONE_LABELS[voiceTone]}`,
            `Vùng giọng: ${VOICE_REGION_LABELS[voiceRegion]}`,
            lyricHint.trim() ? `Chủ đề lời: ${lyricHint.trim()}` : '',
            voiceStyle.trim() ? `Phong cách hát: ${voiceStyle.trim()}` : '',
          ]
            .filter(Boolean)
            .join(', ')
        : 'Chỉ nhạc không lời, không dùng giọng hát'
    const includePrompt =
      includeInstruments.length > 0
        ? `Ưu tiên nhạc cụ: ${includeInstruments.map((k) => INSTRUMENT_LABELS[k]).join(', ')}`
        : ''
    const excludePrompt =
      excludeInstruments.length > 0
        ? `Hạn chế hoặc không dùng: ${excludeInstruments.map((k) => INSTRUMENT_LABELS[k]).join(', ')}`
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
        const msg = e instanceof Error ? e.message : 'Không thể trừ credits.'
        toast({ title: 'Không đủ credits để tiếp tục', description: msg, variant: 'destructive' })
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
      title: 'Hoàn tất đoạn nhạc',
      description: `Đã đủ ${selectedDurationSeconds} giây theo thời lượng bạn chọn.`,
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
      throw new Error(data.error || (data.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits.' : 'Trừ credits thất bại.'))
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
      throw new Error(data.error || 'Không upload được audio lịch sử.')
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
      title: config.title,
      mode,
      style: MUSIC_STYLE_LABELS[musicStyle],
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
              const msg = e instanceof Error ? e.message : 'Không giải mã được gói âm thanh.'
              setLastStreamError(msg)
            }
          },
          onerror: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Lỗi luồng nhạc.'
            setLastStreamError(msg)
            toast({ title: 'Lyria lỗi', description: msg, variant: 'destructive' })
          },
          onclose: (ev: { code?: number; reason?: string } = {}) => {
            setIsPlaying(false)
            setIsConnected(false)
            sessionRef.current = null
            void finalizeMusicSession()
            if (ev.code && ev.code !== 1000) {
              setLastStreamError(`Socket đóng (${ev.code}): ${ev.reason || 'Không rõ lý do'}`)
            }
          },
        },
      })
      sessionRef.current = session as LyriaSessionLike
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
      })
      toast({ title: 'Đã kết nối Lyria', description: 'Sẵn sàng phát nhạc thời gian thực.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể kết nối Lyria.'
      toast({ title: 'Kết nối thất bại', description: msg, variant: 'destructive' })
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
      })
      await sessionRef.current.play()
      setIsPlaying(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể phát nhạc.'
      toast({ title: 'Phát nhạc thất bại', description: msg, variant: 'destructive' })
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
          title: 'Chưa nhận gói âm thanh',
          description:
            'Đã bấm phát nhưng chưa có dữ liệu âm thanh. Kiểm tra key có quyền Lyria RealTime và model models/lyria-realtime-exp.',
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
      toast({ title: 'Không thể tạm dừng', variant: 'destructive' })
    }
  }

  const handleStop = async () => {
    if (!sessionRef.current) return
    try {
      await sessionRef.current.stop()
      setIsPlaying(false)
      if (contextRef.current) nextPlayTimeRef.current = contextRef.current.currentTime
      void finalizeMusicSession()
    } catch {
      toast({ title: 'Không thể dừng nhạc', variant: 'destructive' })
    }
  }

  const handleDownloadMusic = () => {
    const chunks = recordedChunksRef.current
    if (!chunks.length) {
      toast({ title: 'Chưa có dữ liệu nhạc', description: 'Hãy phát nhạc một lúc rồi tải xuống.', variant: 'destructive' })
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
      toast({ title: 'Thiếu mô tả nhạc nền', variant: 'destructive' })
      return
    }
    if (!sessionRef.current) {
      toast({ title: 'Đã lưu mô tả', description: 'Bấm Phát để dùng mô tả này cho phiên nhạc mới.' })
      return
    }
    try {
      await sessionRef.current.setWeightedPrompts({ weightedPrompts })
      await sessionRef.current.resetContext()
      toast({ title: 'Đã gửi mô tả nhạc nền', description: 'Nhạc sẽ cập nhật theo mô tả mới trong vài giây.' })
    } catch {
      toast({ title: 'Không thể gửi mô tả nhạc nền', variant: 'destructive' })
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
        { text: `Phong cách nhạc chính: ${MUSIC_STYLE_LABELS[musicStyle]}`, weight: 0.9 },
        {
          text: vocalMode === 'vocal' ? `Ngôn ngữ lời hát ưu tiên: ${LANGUAGE_LABELS[musicLanguage]}` : `Ngôn ngữ mô tả mood: ${LANGUAGE_LABELS[musicLanguage]}`,
          weight: 0.8,
        },
        ...(includeInstruments.length > 0
          ? [{ text: `Ưu tiên nhạc cụ: ${includeInstruments.map((k) => INSTRUMENT_LABELS[k]).join(', ')}`, weight: 1.3 }]
          : []),
        ...(excludeInstruments.length > 0
          ? [{ text: `Hạn chế hoặc không dùng: ${excludeInstruments.map((k) => INSTRUMENT_LABELS[k]).join(', ')}`, weight: 1.3 }]
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
      toast({ title: 'Đã áp mô tả mới', description: 'Đã tăng lực prompt. Chờ 2-6 giây để nghe rõ thay đổi.' })
    } catch {
      toast({ title: 'Không thể cập nhật mô tả', variant: 'destructive' })
    }
  }

  const applyDjConfig = async () => {
    if (!sessionRef.current) return
    try {
      await sessionRef.current.setMusicGenerationConfig({
        musicGenerationConfig: buildMusicGenerationConfig(),
      })
      await sessionRef.current.resetContext()
      toast({ title: 'Đã cập nhật bàn mix', description: 'BPM và texture đã được làm mới.' })
    } catch {
      toast({ title: 'Không thể áp cấu hình DJ', variant: 'destructive' })
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
      if (!res.ok || !data?.prompt) throw new Error(data?.error || 'Không phân tích được ảnh')
      setBasePrompt(data.prompt)
      setPromptHistory([])
      toast({ title: 'Đã phân tích ảnh', description: `Gợi ý nhạc: ${data.prompt}` })
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
            {config.title}
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Thử nghiệm
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">{config.description}</p>
          <p className="mt-1 text-xs text-amber-700">
            Tính năng đang trong giai đoạn thử nghiệm, chất lượng và độ ổn định có thể thay đổi.
          </p>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-indigo-600" />
              Bảng điều khiển Lyria RealTime
            </CardTitle>
            <CardDescription>
              Nhạc chạy liên tục theo thời gian thực. Bạn có thể điều khiển mô tả và thông số ngay khi đang phát.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phong cách nhạc</label>
              <select
                value={musicStyle}
                onChange={(e) => setMusicStyle(e.target.value as MusicStyle)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(MUSIC_STYLE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ngôn ngữ nhạc/lời</label>
              <select
                value={musicLanguage}
                onChange={(e) => setMusicLanguage(e.target.value as MusicLanguage)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kiểu nhạc</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={vocalMode === 'instrumental' ? 'default' : 'outline'}
                  onClick={() => setVocalMode('instrumental')}
                  className={vocalMode === 'instrumental' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                >
                  Nhạc không lời
                </Button>
                <Button
                  type="button"
                  variant={vocalMode === 'vocal' ? 'default' : 'outline'}
                  onClick={() => setVocalMode('vocal')}
                  className={vocalMode === 'vocal' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                >
                  Nhạc có lời
                </Button>
              </div>
              {vocalMode === 'vocal' && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Giới tính giọng</label>
                      <select
                        value={voiceGender}
                        onChange={(e) => setVoiceGender(e.target.value as VoiceGender)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      >
                        {Object.entries(VOICE_GENDER_LABELS).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Tông giọng</label>
                      <select
                        value={voiceTone}
                        onChange={(e) => setVoiceTone(e.target.value as VoiceTone)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      >
                        {Object.entries(VOICE_TONE_LABELS).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Vùng giọng</label>
                      <select
                        value={voiceRegion}
                        onChange={(e) => setVoiceRegion(e.target.value as VoiceRegion)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      >
                        {Object.entries(VOICE_REGION_LABELS).map(([code, label]) => (
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
                    placeholder="Gợi ý nội dung lời (ví dụ: tình yêu, tuổi trẻ, động lực)"
                  />
                  <Input
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    placeholder="Phong cách hát (ví dụ: nhẹ nhàng, nội lực, bay bổng, da diết)"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {vocalMode === 'vocal'
                  ? 'Đang bật chế độ có lời: tạo nhạc có giọng hát.'
                  : 'Đang bật chế độ không lời: chỉ tạo nhạc nhạc cụ.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả nhạc nền</label>
              <Textarea
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Lo-fi chill với piano ấm, nhịp nhẹ cho video TikTok"
              />
              <div>
                <Button type="button" variant="outline" onClick={applyBasePrompt} disabled={isBusy || !basePrompt.trim()}>
                  Gửi mô tả nhạc nền
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Điều chỉnh nhạc cụ</label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIncludeInstruments([])
                    setExcludeInstruments([])
                  }}
                  className="h-8 px-2 text-xs"
                >
                  Xóa chọn nhạc cụ
                </Button>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-700">Ưu tiên thêm nhạc cụ</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(INSTRUMENT_LABELS).map(([key, label]) => {
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
                <p className="text-xs font-medium text-rose-700">Giảm/bỏ nhạc cụ</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(INSTRUMENT_LABELS).map(([key, label]) => {
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
                Chọn nhạc cụ ở một bên thôi. Nếu chọn “thêm”, nhạc cụ đó sẽ tự bỏ khỏi nhóm “giảm/bỏ” và ngược lại.
              </p>
            </div>

            {canUseImageMode && (
              <div className="space-y-3 rounded-lg border p-3">
                <label className="text-sm font-medium">Ảnh đầu vào để suy ra cảm xúc nhạc</label>
                <Input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0] || undefined)} />
                {imagePreview && (
                  <div className="h-48 overflow-hidden rounded-lg border">
                    <ImagePreview src={imagePreview} alt="Mood image preview" className="h-full w-full object-cover" />
                  </div>
                )}
                <Button type="button" variant="outline" onClick={analyzeImageMood} disabled={!imageFile || isBusy}>
                  <Upload className="mr-2 h-4 w-4" /> Phân tích ảnh thành mô tả nhạc
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
                    <WandSparkles className="mr-2 h-4 w-4" /> Áp cấu hình DJ
                  </Button>
                </div>
              </div>
            )}

            {showRealtimePromptBox && (
              <div className="space-y-2 rounded-lg border p-3">
                <label className="text-sm font-medium">Mô tả chèn realtime (không dừng nhạc)</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={livePrompt}
                    onChange={(e) => setLivePrompt(e.target.value)}
                    placeholder='Ví dụ: "thêm trống dày hơn và tiếng synth sáng hơn"'
                  />
                  <Button type="button" onClick={applyPromptBlend} disabled={!livePrompt.trim() || !isConnected}>
                    Chèn mô tả
                  </Button>
                </div>
                {promptHistory.length > 0 && (
                  <p className="text-xs text-muted-foreground">Mô tả gần đây: {promptHistory.slice(-3).join(' | ')}</p>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <label className="text-sm font-medium">Độ dài đoạn nhạc</label>
              <select
                value={selectedDurationSeconds}
                onChange={(e) => setSelectedDurationSeconds(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} giây
                  </option>
                ))}
                <option value={0}>Không giới hạn (phát đến khi bạn dừng)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Giá sơ bộ:{' '}
                {selectedDurationCredit === null
                  ? 'chưa giới hạn thời lượng'
                  : `${selectedDurationCredit.toFixed(1)} credit cho ${selectedDurationSeconds} giây`}.
              </p>
            </div>

            <div className="rounded-lg border bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">Thời gian chạy: {elapsedSeconds}s</p>
                <p className="text-sm font-semibold text-emerald-700">
                  Đã trừ: {chargedCredits} credit
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(ước tính: {estimatedTotalCredit})</span>
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-[width] duration-500"
                  style={{ width: `${blockProgressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Đơn giá: {PRICING_PER_10S[mode]} credit / 10 giây
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePlay} disabled={isBusy}>
                <Play className="mr-2 h-4 w-4" /> {isPlaying ? 'Đang phát' : 'Phát'}
              </Button>
              <Button type="button" variant="outline" onClick={handlePause} disabled={!isConnected || !isPlaying}>
                <Pause className="mr-2 h-4 w-4" /> Tạm dừng
              </Button>
              <Button type="button" variant="outline" onClick={handleStop} disabled={!isConnected}>
                <Square className="mr-2 h-4 w-4" /> Dừng
              </Button>
              <Button type="button" variant="outline" onClick={testSpeaker}>
                Test loa
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadMusic} disabled={chunksReceived === 0}>
                <Download className="mr-2 h-4 w-4" /> Tải nhạc xuống
              </Button>
            </div>

            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Lịch sử tạo nhạc</p>
                <p className="text-xs text-muted-foreground">Lưu theo tài khoản Supabase</p>
              </div>
              {musicHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có phiên tạo nhạc nào.</p>
              ) : (
                <div className="max-h-56 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Thời gian</th>
                        <th className="px-2 py-1.5 text-left font-medium">Tính năng</th>
                        <th className="px-2 py-1.5 text-left font-medium">Phong cách</th>
                        <th className="px-2 py-1.5 text-right font-medium">Thời lượng</th>
                        <th className="px-2 py-1.5 text-right font-medium">Credits</th>
                        <th className="px-2 py-1.5 text-left font-medium">Nghe lại</th>
                        <th className="px-2 py-1.5 text-left font-medium">Tải xuống</th>
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
                              <span className="text-muted-foreground">Chưa có file</span>
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
                                Tải WAV
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
              )}
            </div>

            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-muted-foreground">
              Trạng thái: {isConnected ? 'Đã kết nối Lyria' : 'Chưa kết nối'} • {isPlaying ? 'Đang phát' : 'Đang dừng'}.
              {' '}Để chạy tính năng này, cần cấu hình <code>GOOGLE_API_KEY</code> trên môi trường deploy.
              <br />
              Trạng thái âm thanh: <strong>{audioState}</strong>
              <br />
              Số gói âm thanh nhận được: <strong>{chunksReceived}</strong>
              {lastStreamError ? (
                <>
                  <br />
                  Lỗi luồng gần nhất: <span className="text-red-600">{lastStreamError}</span>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

