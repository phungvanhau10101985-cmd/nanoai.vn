'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Mic, MicOff, Send, Languages, Volume2 } from 'lucide-react'

type Accent = 'uk' | 'us'
type Gender = 'female' | 'male'
type VoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Autonoe' | 'Enceladus' | 'Sadachbia'
type Mode = 'chat' | 'story'
type LanguageCode = 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko'

type ChatMessage = {
  id: string
  role: 'teacher' | 'student'
  text: string
}

type Correction = {
  original: string
  fixed: string
  explanationVi: string
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string }
    isFinal: boolean
  }>
}

type SpeechCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechCtor
    SpeechRecognition?: SpeechCtor
  }
}

type TeacherProfile = {
  id: string
  label: string
  languageLabel: string
  locale: string
  voiceName: VoiceName
  accent?: Accent
  gender: Gender
}

const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'Tiếng Anh' },
  { code: 'zh', label: 'Tiếng Trung' },
  { code: 'hi', label: 'Tiếng Hindi (Ấn Độ)' },
  { code: 'th', label: 'Tiếng Thái' },
  { code: 'ja', label: 'Tiếng Nhật' },
  { code: 'ko', label: 'Tiếng Hàn' },
]

const TEACHERS_BY_LANGUAGE: Record<LanguageCode, TeacherProfile[]> = {
  en: [
    {
      id: 'en-us-f',
      label: 'Cô giáo người Mỹ (US)',
      languageLabel: 'English',
      locale: 'en-US',
      voiceName: 'Puck',
      accent: 'us',
      gender: 'female',
    },
    {
      id: 'en-us-m',
      label: 'Thầy giáo người Mỹ (US)',
      languageLabel: 'English',
      locale: 'en-US',
      voiceName: 'Sadachbia',
      accent: 'us',
      gender: 'male',
    },
    {
      id: 'en-uk-f',
      label: 'Cô giáo người Anh (UK)',
      languageLabel: 'English',
      locale: 'en-GB',
      voiceName: 'Kore',
      accent: 'uk',
      gender: 'female',
    },
    {
      id: 'en-uk-m',
      label: 'Thầy giáo người Anh (UK)',
      languageLabel: 'English',
      locale: 'en-GB',
      voiceName: 'Zephyr',
      accent: 'uk',
      gender: 'male',
    },
  ],
  zh: [
    {
      id: 'zh-cn-f',
      label: 'Cô giáo người Trung Quốc',
      languageLabel: 'Chinese (Mandarin)',
      locale: 'zh-CN',
      voiceName: 'Kore',
      gender: 'female',
    },
    {
      id: 'zh-cn-m',
      label: 'Thầy giáo người Trung Quốc',
      languageLabel: 'Chinese (Mandarin)',
      locale: 'zh-CN',
      voiceName: 'Zephyr',
      gender: 'male',
    },
  ],
  hi: [
    {
      id: 'hi-in-f',
      label: 'Cô giáo người Ấn Độ',
      languageLabel: 'Hindi',
      locale: 'hi-IN',
      voiceName: 'Autonoe',
      gender: 'female',
    },
    {
      id: 'hi-in-m',
      label: 'Thầy giáo người Ấn Độ',
      languageLabel: 'Hindi',
      locale: 'hi-IN',
      voiceName: 'Enceladus',
      gender: 'male',
    },
  ],
  th: [
    {
      id: 'th-th-f',
      label: 'Cô giáo người Thái',
      languageLabel: 'Thai',
      locale: 'th-TH',
      voiceName: 'Puck',
      gender: 'female',
    },
    {
      id: 'th-th-m',
      label: 'Thầy giáo người Thái',
      languageLabel: 'Thai',
      locale: 'th-TH',
      voiceName: 'Sadachbia',
      gender: 'male',
    },
  ],
  ja: [
    {
      id: 'ja-jp-f',
      label: 'Cô giáo người Nhật',
      languageLabel: 'Japanese',
      locale: 'ja-JP',
      voiceName: 'Kore',
      gender: 'female',
    },
    {
      id: 'ja-jp-m',
      label: 'Thầy giáo người Nhật',
      languageLabel: 'Japanese',
      locale: 'ja-JP',
      voiceName: 'Zephyr',
      gender: 'male',
    },
  ],
  ko: [
    {
      id: 'ko-kr-f',
      label: 'Cô giáo người Hàn',
      languageLabel: 'Korean',
      locale: 'ko-KR',
      voiceName: 'Puck',
      gender: 'female',
    },
    {
      id: 'ko-kr-m',
      label: 'Thầy giáo người Hàn',
      languageLabel: 'Korean',
      locale: 'ko-KR',
      voiceName: 'Sadachbia',
      gender: 'male',
    },
  ],
}

export default function HocTiengAnhAiClientPage() {
  const { toast } = useToast()
  const [languageCode, setLanguageCode] = useState<LanguageCode>('en')
  const [teacherId, setTeacherId] = useState<string>('en-us-f')
  const [mode, setMode] = useState<Mode>('chat')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [pronunciationTips, setPronunciationTips] = useState<string[]>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const teacherOptions = useMemo(() => TEACHERS_BY_LANGUAGE[languageCode], [languageCode])
  const selectedTeacher = useMemo(
    () => teacherOptions.find((t) => t.id === teacherId) || teacherOptions[0],
    [teacherId, teacherOptions]
  )
  const selectedVoice = selectedTeacher.voiceName
  const teacherLabel = selectedTeacher.label

  const appendMessage = (role: 'teacher' | 'student', text: string) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text }])
  }

  const playTts = async (text: string) => {
    const res = await fetch('/api/english-coach/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName: selectedVoice }),
    })
    const data = (await res.json().catch(() => ({}))) as { audioBase64?: string; mimeType?: string; error?: string }
    if (!res.ok || !data.audioBase64) {
      throw new Error(data.error || 'Không phát được giọng giáo viên.')
    }

    const binary = atob(data.audioBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' })
    const url = URL.createObjectURL(blob)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    const audio = new Audio(url)
    audioRef.current = audio
    await audio.play()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const handleSend = async (raw?: string) => {
    const studentText = String(raw ?? draft).trim()
    if (!studentText || busy) return

    setBusy(true)
    appendMessage('student', studentText)
    setDraft('')
    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }))
      const res = await fetch('/api/english-coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentText,
          history,
          accent: selectedTeacher.accent || 'us',
          gender: selectedTeacher.gender,
          mode,
          targetLanguage: selectedTeacher.languageLabel,
          teacherLabel: selectedTeacher.label,
          teacherLocale: selectedTeacher.locale,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        corrections?: Correction[]
        pronunciationTips?: string[]
        error?: string
      }
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Không nhận được phản hồi từ giáo viên AI.')
      }

      appendMessage('teacher', data.reply)
      setCorrections(Array.isArray(data.corrections) ? data.corrections : [])
      setPronunciationTips(Array.isArray(data.pronunciationTips) ? data.pronunciationTips : [])
      await playTts(data.reply)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi hội thoại', description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const startLesson = async () => {
    const opening =
      mode === 'story'
        ? `Hello! I'm your ${selectedTeacher.languageLabel} teacher today. Let's start with a gentle short story. Are you ready?`
        : `Hello! I'm your ${selectedTeacher.languageLabel} teacher. Let's have a natural conversation. How are you today?`
    appendMessage('teacher', opening)
    try {
      await playTts(opening)
    } catch {
      // keep chat usable even when TTS fails
    }
  }

  const handleMic = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast({
        title: 'Thiết bị chưa hỗ trợ',
        description: 'Trình duyệt này chưa hỗ trợ nhận diện giọng nói trực tiếp.',
        variant: 'destructive',
      })
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = selectedTeacher.locale || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const transcript = last?.[0]?.transcript?.trim() || ''
      if (transcript) {
        setDraft(transcript)
        void handleSend(transcript)
      }
    }
    recognition.onerror = () => {
      setListening(false)
      toast({ title: 'Mic lỗi', description: 'Không nhận được giọng nói. Vui lòng thử lại.', variant: 'destructive' })
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <>
      <Toaster />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Languages className="h-6 w-6 text-indigo-600" />
            Học ngoại ngữ tương tác cùng giáo viên bản địa AI
          </h1>
          <p className="mt-1 text-muted-foreground">
            Chọn ngôn ngữ muốn học và chọn giáo viên bản địa tương ứng. Nói chuyện trực tiếp và được sửa lỗi phát âm/ngữ pháp ngay sau mỗi lượt.
          </p>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Thiết lập buổi học</CardTitle>
            <CardDescription>Chọn kiểu giáo viên và phong cách học trước khi bắt đầu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Ngôn ngữ học</label>
                <select
                  value={languageCode}
                  onChange={(e) => {
                    const code = e.target.value as LanguageCode
                    setLanguageCode(code)
                    const firstTeacher = TEACHERS_BY_LANGUAGE[code]?.[0]
                    if (firstTeacher) setTeacherId(firstTeacher.id)
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Giáo viên bản địa</label>
                <select
                  value={selectedTeacher.id}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Chế độ học</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="chat">Hội thoại thường ngày</option>
                  <option value="story">Kể chuyện tiếng Anh nhẹ nhàng</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                Giáo viên đang chọn: <span className="font-semibold">{teacherLabel}</span>
              </p>
              <Button type="button" variant="outline" onClick={startLesson}>
                <Volume2 className="mr-2 h-4 w-4" /> Bắt đầu buổi học
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Hội thoại trực tiếp</CardTitle>
              <CardDescription>Nói qua mic hoặc gõ văn bản. Giáo viên sẽ phản hồi bằng giọng nói bản địa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-80 space-y-2 overflow-auto rounded-md border bg-slate-50 p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có hội thoại. Bấm &quot;Bắt đầu buổi học&quot; để bắt đầu.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md px-3 py-2 text-sm ${
                        m.role === 'teacher' ? 'bg-indigo-50 border border-indigo-100' : 'bg-white border'
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.role === 'teacher' ? 'Teacher' : 'Student'}
                      </p>
                      <p>{m.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Nhập câu hoặc bấm nút mic để nói..."
                  disabled={busy}
                />
                <Button type="button" variant={listening ? 'destructive' : 'outline'} onClick={handleMic} disabled={busy}>
                  {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {listening ? 'Dừng mic' : 'Nói'}
                </Button>
                <Button type="button" onClick={() => void handleSend()} disabled={busy || !draft.trim()}>
                  <Send className="mr-2 h-4 w-4" /> Gửi
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Sửa lỗi ngay</CardTitle>
              <CardDescription>Giáo viên sửa lỗi sai và gợi ý phát âm để bạn nói tự nhiên hơn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">Lỗi cần sửa</p>
                {corrections.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Chưa có lỗi nào gần đây.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {corrections.map((c, idx) => (
                      <div key={`${c.original}-${idx}`} className="rounded-md border bg-slate-50 p-2 text-xs">
                        <p><span className="font-semibold text-red-600">Bạn nói:</span> {c.original}</p>
                        <p><span className="font-semibold text-emerald-700">Nên nói:</span> {c.fixed}</p>
                        <p className="text-muted-foreground">{c.explanationVi}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">Mẹo phát âm</p>
                {pronunciationTips.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Chưa có mẹo phát âm mới.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {pronunciationTips.map((tip, idx) => (
                      <li key={`${tip}-${idx}`}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

