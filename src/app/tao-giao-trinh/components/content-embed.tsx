'use client'
/* eslint-disable @next/next/no-img-element -- embeds/rendered content include dynamic and data URLs */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Timer } from 'lucide-react'
import QRCode from 'qrcode'

/**
 * Nhúng nhiều loại nội dung vào slide: GeoGebra, Desmos, YouTube, PhET, Maps, Image, Audio, Quiz, Code, LaTeX
 */

const WRAPPER_CLASS = 'my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700'

export type EmbedType = 'geogebra' | 'desmos' | 'youtube' | 'phet' | 'maps' | 'image' | 'audio' | 'quiz' | 'code' | 'latex' | 'plot'

export interface ContentEmbedProps {
  type: EmbedType
  urlOrId: string
  width?: number
  height?: number
  className?: string
  /** Khi có curriculumId, quiz hiển thị chế độ live: Bắt đầu, QR, kết quả */
  liveQuizContext?: {
    curriculumId: string
    slideIndex: number
    blockIndex: number
    initialSessionCode?: string | null
    /** Thời gian đồng hồ cát (giây) – đồng bộ từ giáo viên */
    initialQuizDurationSeconds?: number
    /** Chế độ mở đáp án khi hết giờ – đồng bộ từ giáo viên */
    initialAutoRevealOnTimerEnd?: boolean
    onSessionCreated?: (slideIndex: number, blockIndex: number, sessionCode: string, quizDurationSeconds?: number) => void
    onSettingsChange?: (slideIndex: number, blockIndex: number, settings: { quizDurationSeconds: number; autoRevealOnTimerEnd: boolean }) => void
    /** Chỉ giáo viên mới được tạo phiên – học sinh chờ sync */
    teacherMode?: boolean
  }
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  /** Ẩn quiz inline – dùng khi hiển thị quiz trong popup riêng */
  hideQuiz?: boolean
  /** Fill toàn bộ container (dùng cho fullscreen) */
  fill?: boolean
}

function getEmbedSrc(type: EmbedType, urlOrId: string): string | null {
  const raw = urlOrId.trim()
  if (!raw) return null

  if (type === 'geogebra') {
    if (raw.startsWith('http') && raw.includes('geogebra.org')) {
      try {
        const u = new URL(raw)
        if (u.pathname.startsWith('/classic')) u.pathname = '/calculator'
        u.searchParams.set('embed', 'true')
        u.searchParams.set('showToolBar', 'false')
        u.searchParams.set('showMenuBar', 'false')
        u.searchParams.set('showAlgebraInput', 'false')
        u.searchParams.set('showResetIcon', 'false')
        return u.toString()
      } catch {
        return raw.includes('?embed') ? raw : raw + (raw.includes('?') ? '&embed' : '?embed')
      }
    }
    const id = raw.match(/geogebra\.org\/(?:calculator|m)\/([a-zA-Z0-9]+)/)?.[1] ?? (raw.length < 25 ? raw : null)
    const base = id ? `https://www.geogebra.org/calculator/${id}` : `https://www.geogebra.org/calculator/${raw}`
    return `${base}?embed=true&showToolBar=false&showMenuBar=false&showAlgebraInput=false&showResetIcon=false`
  }

  if (type === 'desmos') {
    const id = raw.match(/desmos\.com\/calculator\/([a-zA-Z0-9]+)/)?.[1] ?? (raw.startsWith('http') ? null : raw)
    if (id) return `https://www.desmos.com/calculator/${id}?embed`
    if (raw.startsWith('https://www.desmos.com/')) return raw.includes('?embed') ? raw : `${raw}?embed`
    return null
  }

  if (type === 'youtube') {
    const id = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? (raw.length === 11 ? raw : null)
    return id ? `https://www.youtube.com/embed/${id}` : null
  }

  if (type === 'phet') {
    if (raw.startsWith('http') && raw.includes('phet')) return raw.includes('?embed') ? raw : raw + (raw.includes('?') ? '&embed' : '?embed')
    return raw.startsWith('http') ? raw : null
  }

  if (type === 'maps') {
    if (raw.startsWith('http') && (raw.includes('google.com/maps') || raw.includes('goo.gl/maps'))) return raw
    return raw.startsWith('http') ? raw : null
  }

  if (type === 'image' || type === 'audio') {
    return raw.startsWith('http') || raw.startsWith('data:') ? raw : null
  }

  if (type === 'code') {
    const penMatch = raw.match(/codepen\.io\/([^/]+)\/pen\/([a-zA-Z0-9]+)/)
    if (penMatch) return `https://codepen.io/${penMatch[1]}/embed/${penMatch[2]}`
    if (raw.includes('codepen.io') && raw.includes('/pen/')) return raw.includes('embed') ? raw : raw.replace('/pen/', '/embed/')
    return raw.startsWith('http') ? raw : null
  }

  if (type === 'plot') {
    return raw
  }

  return null
}

function QuizContentWrapper({ urlOrId, liveQuizContext, tr }: { urlOrId: string; liveQuizContext?: ContentEmbedProps['liveQuizContext']; tr?: ContentEmbedProps['tr'] }) {
  const quizVerified = useMemo(() => {
    // Marker mới do AI tạo/rewrite dùng delimiter \x1f và đã qua bước verify trong backend.
    return String(urlOrId ?? '').includes('\x1f')
  }, [urlOrId])
  const quizData = useMemo(() => {
    const parsed = parseQuizData(urlOrId)
    if (!parsed) return null
    const base = { ...parsed, correctIndex: Math.min(parsed.correctIndex, parsed.options.length - 1) }
    return shuffleQuizOptionsDeterministic(base, urlOrId)
  }, [urlOrId])
  if (!quizData) {
    const msg = typeof tr === 'function' ? tr('Câu hỏi chưa hiển thị được.', 'Quiz could not be displayed.', '题目无法显示。', 'クイズを表示できません。', '퀴즈를 표시할 수 없습니다.') : 'Câu hỏi chưa hiển thị được.'
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
        {msg}
      </div>
    )
  }
  if (liveQuizContext) {
    return (
      <LiveQuizEmbed
        quizData={quizData}
        quizVerified={quizVerified}
        curriculumId={liveQuizContext.curriculumId || null}
        slideIndex={liveQuizContext.slideIndex}
        blockIndex={liveQuizContext.blockIndex}
        tr={tr}
        initialSessionCode={liveQuizContext.initialSessionCode}
        initialQuizDurationSeconds={liveQuizContext.initialQuizDurationSeconds}
        initialAutoRevealOnTimerEnd={liveQuizContext.initialAutoRevealOnTimerEnd}
        onSessionCreated={liveQuizContext.onSessionCreated}
        onSettingsChange={liveQuizContext.onSettingsChange}
        teacherMode={liveQuizContext.teacherMode}
      />
    )
  }
  return <QuizEmbed question={quizData.question} options={quizData.options} correctIndex={quizData.correctIndex} quizVerified={quizVerified} tr={tr} />
}

export function ContentEmbed({ type, urlOrId, width = 560, height = 350, className = '', liveQuizContext, tr, hideQuiz, fill }: ContentEmbedProps) {
  const src = getEmbedSrc(type, urlOrId)
  const wrapperClass = `${WRAPPER_CLASS} ${className} ${fill ? 'flex h-full w-full min-h-0 flex-col' : ''}`.trim()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isIframeEmbed = type === 'geogebra' || type === 'desmos' || type === 'youtube' || type === 'phet' || type === 'maps' || type === 'code'
  const [iframeInViewport, setIframeInViewport] = useState(() => !isIframeEmbed)

  useEffect(() => {
    if (!isIframeEmbed) return
    const node = wrapperRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setIframeInViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        setIframeInViewport(entry.isIntersecting)
      },
      { root: null, rootMargin: '450px 0px', threshold: 0.01 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [isIframeEmbed, src, fill])

  if (isIframeEmbed) {
    if (!src) return null
    return (
      <div ref={wrapperRef} className={wrapperClass} style={{ pointerEvents: 'auto' }}>
        {iframeInViewport ? (
          <iframe
            src={src}
            {...(fill
              ? { className: 'min-h-0 w-full flex-1 border-0', style: { pointerEvents: 'auto' as const } }
              : { width, height, className: 'w-full border-0' })}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={type}
          />
        ) : (
          <div
            aria-hidden
            className={fill ? 'min-h-0 w-full flex-1 bg-slate-100/60 dark:bg-slate-800/60' : 'w-full bg-slate-100/60 dark:bg-slate-800/60'}
            style={fill ? undefined : { height }}
          />
        )}
      </div>
    )
  }

  if (type === 'image') {
    if (!src) return null
    return (
      <div className={wrapperClass}>
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={fill ? 'h-full w-full max-h-full object-contain' : 'h-auto w-full max-w-full object-contain'}
          style={fill ? undefined : { maxHeight: height }}
        />
      </div>
    )
  }

  if (type === 'audio') {
    if (!src) return null
    return (
      <div className={wrapperClass + ' p-4'}>
        <audio controls className="w-full" src={src}>
          {urlOrId}
        </audio>
      </div>
    )
  }

  if (type === 'quiz') {
    if (hideQuiz) return null
    return <QuizContentWrapper urlOrId={urlOrId} liveQuizContext={liveQuizContext} tr={tr} />
  }

  if (type === 'latex') {
    return <LatexEmbed formula={urlOrId} />
  }

  if (type === 'plot') {
    return <PlotEmbed spec={urlOrId} />
  }

  return null
}

function playQuizTimerEndBell() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
      // Giải phóng audio context sau khi phát để tránh giữ tài nguyên không cần thiết.
      window.setTimeout(() => {
        void ctx.close().catch(() => {})
      }, 700)
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
    else play()
  } catch {
    /* ignore */
  }
}

const QUIZ_DURATION_OPTIONS = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 phút' },
  { value: 90, label: '1.5 phút' },
  { value: 120, label: '2 phút' },
  { value: 180, label: '3 phút' },
] as const

function LiveQuizEmbed({
  quizData,
  quizVerified,
  curriculumId,
  slideIndex,
  blockIndex,
  tr,
  initialSessionCode,
  initialQuizDurationSeconds,
  initialAutoRevealOnTimerEnd,
  onSessionCreated,
  onSettingsChange,
  teacherMode = true,
}: {
  quizData: { question: string; options: string[]; correctIndex: number }
  quizVerified: boolean
  curriculumId: string | null
  slideIndex: number
  blockIndex: number
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  initialSessionCode?: string | null
  initialQuizDurationSeconds?: number
  initialAutoRevealOnTimerEnd?: boolean
  onSessionCreated?: (slideIndex: number, blockIndex: number, sessionCode: string, quizDurationSeconds?: number) => void
  onSettingsChange?: (slideIndex: number, blockIndex: number, settings: { quizDurationSeconds: number; autoRevealOnTimerEnd: boolean }) => void
  teacherMode?: boolean
}) {
  const t = (vi: string, en: string, zh: string, ja: string, ko: string) => (typeof tr === 'function' ? tr(vi, en, zh, ja, ko) : vi)
  const [sessionCode, setSessionCode] = useState<string | null>(initialSessionCode ?? null)
  const [sessionQuizData, setSessionQuizData] = useState<{ question: string; options: string[]; correctIndex: number } | null>(null)
  const [displayQuizData, setDisplayQuizData] = useState<{ question: string; options: string[]; correctIndex: number } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  useEffect(() => {
    if (initialSessionCode) {
      setSessionCode(initialSessionCode)
      setSessionQuizData(null)
      setDisplayQuizData(null)
      const url = typeof window !== 'undefined' ? `${window.location.origin}/quiz/${initialSessionCode}` : ''
      QRCode.toDataURL(url, { width: 140, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
      if (typeof initialQuizDurationSeconds === 'number' && initialQuizDurationSeconds > 0) {
        setQuizTimerSeconds(initialQuizDurationSeconds)
        setQuizTimerRunning(true)
      }
      fetch(`/api/slide-quiz/${initialSessionCode}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.options?.length) {
            let correctIdx = d.correctIndex ?? 0
            const idxByMarker = d.options.findIndex((o: string) => /\(Đáp án đúng\)/i.test(String(o ?? '')))
            if (idxByMarker >= 0) correctIdx = idxByMarker
            const qd = { question: d.question ?? '', options: d.options, correctIndex: correctIdx }
            setSessionQuizData(qd)
            setDisplayQuizData(qd)
          }
        })
        .catch(() => {})
    } else {
      setSessionCode(null)
      setSessionQuizData(null)
      setDisplayQuizData(null)
      setQrDataUrl(null)
      setResults({})
      setTotal(0)
      setRevealed(false)
    }
  }, [initialSessionCode, initialQuizDurationSeconds])

  useEffect(() => {
    if (!sessionCode && quizData) {
      const opts = quizData.options.slice()
      const indices = opts.map((_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      const shuffledOpts = indices.map((i) => opts[i])
      const newCorrectIdx = indices.indexOf(quizData.correctIndex)
      setDisplayQuizData({ question: quizData.question, options: shuffledOpts, correctIndex: newCorrectIdx })
    }
  }, [sessionCode, quizData])

  const [results, setResults] = useState<Record<number, number>>({})
  const [total, setTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [quizDurationSeconds, setQuizDurationSeconds] = useState(initialQuizDurationSeconds ?? 60)
  const [autoRevealOnTimerEnd, setAutoRevealOnTimerEnd] = useState(initialAutoRevealOnTimerEnd ?? true)
  const [quizTimerSeconds, setQuizTimerSeconds] = useState(0)
  const [quizTimerRunning, setQuizTimerRunning] = useState(false)
  const [quizTimerEnded, setQuizTimerEnded] = useState(false)
  const lastSentSettingsRef = useRef<string>('')

  const formatTimer = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`

  useEffect(() => {
    if (typeof initialQuizDurationSeconds === 'number' && initialQuizDurationSeconds > 0) {
      setQuizDurationSeconds(initialQuizDurationSeconds)
    }
  }, [initialQuizDurationSeconds])

  useEffect(() => {
    if (typeof initialAutoRevealOnTimerEnd === 'boolean') {
      setAutoRevealOnTimerEnd(initialAutoRevealOnTimerEnd)
    }
  }, [initialAutoRevealOnTimerEnd])

  useEffect(() => {
    if (!teacherMode) return
    const nextKey = `${slideIndex}-${blockIndex}-${quizDurationSeconds}-${autoRevealOnTimerEnd ? 1 : 0}`
    if (lastSentSettingsRef.current === nextKey) return
    lastSentSettingsRef.current = nextKey
    onSettingsChange?.(slideIndex, blockIndex, { quizDurationSeconds, autoRevealOnTimerEnd })
  }, [teacherMode, onSettingsChange, slideIndex, blockIndex, quizDurationSeconds, autoRevealOnTimerEnd])

  const startSession = useCallback(async () => {
    if (!curriculumId) return
    setCreateError(null)
    setLoading(true)
    try {
      const shuffledQuizData = displayQuizData ?? (() => {
        const opts = quizData.options.slice()
        const indices = opts.map((_, i) => i)
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[indices[i], indices[j]] = [indices[j], indices[i]]
        }
        const shuffledOpts = indices.map((i) => opts[i])
        const newCorrectIdx = indices.indexOf(quizData.correctIndex)
        return { question: quizData.question, options: shuffledOpts, correctIndex: newCorrectIdx }
      })()
      const res = await fetch('/api/slide-quiz/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId,
          slideIndex,
          blockIndex,
          quizData: shuffledQuizData,
        }),
      })
      const data = await res.json()
      if (data.code) {
        setSessionCode(data.code)
        setSessionQuizData(shuffledQuizData)
        setDisplayQuizData(shuffledQuizData)
        setQuizTimerSeconds(quizDurationSeconds)
        setQuizTimerRunning(true)
        onSessionCreated?.(slideIndex, blockIndex, data.code, quizDurationSeconds)
        const url = typeof window !== 'undefined' ? `${window.location.origin}/quiz/${data.code}` : ''
        QRCode.toDataURL(url, { width: 140, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
      } else {
        setCreateError(data.error || (res.status === 401 ? t('Vui lòng đăng nhập.', 'Please sign in.', '请登录。', 'ログインしてください。', '로그인해 주세요.') : t('Không tạo được phiên.', 'Could not create session.', '无法创建会话。', 'セッションを作成できません。', '세션을 만들 수 없습니다.')))
      }
    } finally {
      setLoading(false)
    }
  }, [curriculumId, slideIndex, blockIndex, quizData, displayQuizData, quizDurationSeconds, t, onSessionCreated])

  useEffect(() => {
    if (!quizTimerRunning || quizTimerSeconds <= 0 || revealed) return
    const id = setInterval(() => {
      setQuizTimerSeconds((s) => {
        if (s <= 1) {
          setQuizTimerRunning(false)
          setQuizTimerEnded(true)
          playQuizTimerEndBell()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [quizTimerRunning, quizTimerSeconds, revealed])

  const revealAnswer = useCallback(async () => {
    if (!sessionCode) return
    const res = await fetch(`/api/slide-quiz/${sessionCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revealed' }),
    })
    if (res.ok) {
      setRevealed(true)
      // Refetch để lấy correctIndex từ DB (API chỉ trả về correctIndex khi status=revealed)
      fetch(`/api/slide-quiz/${sessionCode}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.options?.length && typeof d.correctIndex === 'number') {
            let correctIdx = d.correctIndex
            const idxByMarker = d.options.findIndex((o: string) => /\(Đáp án đúng\)/i.test(String(o ?? '')))
            if (idxByMarker >= 0) correctIdx = idxByMarker
            setSessionQuizData((prev) => (prev ? { ...prev, correctIndex: correctIdx } : prev))
            setDisplayQuizData((prev) => (prev ? { ...prev, correctIndex: correctIdx } : prev))
          }
        })
        .catch(() => {})
    }
  }, [sessionCode])

  useEffect(() => {
    if (!quizTimerEnded || !sessionCode || revealed) return
    if (autoRevealOnTimerEnd) {
      revealAnswer()
      setQuizTimerEnded(false)
    }
  }, [quizTimerEnded, sessionCode, revealed, autoRevealOnTimerEnd, revealAnswer])

  useEffect(() => {
    if (!sessionCode) return
    const poll = async () => {
      const res = await fetch(`/api/slide-quiz/${sessionCode}/results`)
      if (res.ok) {
        const d = await res.json()
        setResults(d.counts || {})
        setTotal(d.total || 0)
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [sessionCode])

  const joinUrl = typeof window !== 'undefined' && sessionCode ? `${window.location.origin}/quiz/${sessionCode}` : ''

  const canCreateSession = teacherMode && curriculumId
  return (
    <div className={WRAPPER_CLASS + ' p-4 bg-slate-50 dark:bg-slate-900/50'}>
      {!sessionCode ? (
        <div className="space-y-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Cài đặt', 'Settings', '设置', '設定', '설정')}</p>
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('Thời gian', 'Duration', '时间', '時間', '시간')}:</span>
            <div className="flex gap-1 flex-wrap">
              {QUIZ_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { if (canCreateSession) setQuizDurationSeconds(opt.value) }}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium ${quizDurationSeconds === opt.value ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('Khi hết giờ', 'When time ends', '时间到', '時間切れ', '시간 종료')}:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`quiz-reveal-${slideIndex}-${blockIndex}`} checked={autoRevealOnTimerEnd} onChange={() => { if (canCreateSession) setAutoRevealOnTimerEnd(true) }} className="rounded-full" />
              <span className="text-sm">{t('Tự mở đáp án', 'Auto reveal', '自动显示', '自動表示', '자동 공개')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`quiz-reveal-${slideIndex}-${blockIndex}`} checked={!autoRevealOnTimerEnd} onChange={() => { if (canCreateSession) setAutoRevealOnTimerEnd(false) }} className="rounded-full" />
              <span className="text-sm">{t('Giáo viên mở', 'Teacher reveals', '教师显示', '教師が表示', '교사가 공개')}</span>
            </label>
          </div>
          <button
            type="button"
            onClick={startSession}
            disabled={loading || !curriculumId || !canCreateSession}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-100 disabled:cursor-not-allowed"
          >
            {loading
              ? t('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
              : !canCreateSession
                ? t('Bắt đầu – Học sinh làm bài', 'Start – Students answer', '开始 - 学生作答', '開始 - 生徒が回答', '시작 - 학생 답변')
                : !curriculumId
                  ? t('Lưu giáo trình để bắt đầu', 'Save curriculum to start', '保存课程以开始', '保存して開始', '저장 후 시작')
                  : t('Bắt đầu – Học sinh làm bài', 'Start – Students answer', '开始 - 学生作答', '開始 - 生徒が回答', '시작 - 학생 답변')}
          </button>
          {!curriculumId && canCreateSession && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t('Lưu giáo trình vào kho trước để bắt đầu phiên trắc nghiệm.', 'Save curriculum to library first to start quiz session.', '请先将课程保存到库以开始测验。', '先にカリキュラムを保存してください。', '먼저 교육과정을 저장하세요.')}
            </p>
          )}
          {createError && (
            <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
          )}
        </div>
      ) : null}

      {(() => {
        const dataToShow = displayQuizData ?? quizData
        return (
          <>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
        <span className={quizVerified
          ? 'inline-flex px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
          : 'inline-flex px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'}>
          {quizVerified
            ? t('Đã verify', 'Verified', '已验证', '検証済み', '검증됨')
            : t('Chưa verify', 'Not verified', '未验证', '未検証', '미검증')}
        </span>
      </p>
      <p className="font-medium mb-3"><QuizMathText text={dataToShow.question} /></p>
      <div className="space-y-2 mb-4">
        {dataToShow.options.map((opt, i) => (
          <div key={i} className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            {String.fromCharCode(65 + i)}. <QuizMathText text={opt} />
          </div>
        ))}
      </div>
          </>
        )
      })()}

      {sessionCode ? (
        <div className="space-y-3 print:hidden mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-4 items-start">
            {qrDataUrl && (
              <div className="flex flex-col items-center">
                <img src={qrDataUrl} alt="QR" className="w-[140px] h-[140px] rounded border" />
                <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">{t('Quét để làm bài', 'Scan to answer', '扫码作答', 'スキャンして回答', '스캔하여 답변')}</p>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md ring-2 ring-red-500 bg-red-50 dark:bg-red-950/40 dark:ring-red-400">
                  {t('Mã', 'Code', '代码', 'コード', '코드')}: <span className="font-bold text-red-600 dark:text-red-400">{sessionCode}</span>
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5 break-all">{joinUrl}</p>
              <p className="text-sm mt-2 font-medium">{t('Kết quả', 'Results', '结果', '結果', '결과')}: {total} {t('học sinh đã trả lời', 'students answered', '名学生已作答', '人が回答', '명 답변')}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {(displayQuizData ?? quizData).options.map((opt, i) => {
                  const sessionOpts = sessionQuizData ?? displayQuizData ?? quizData
                  const origIdx = sessionOpts.options.indexOf(opt)
                  return (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                      {String.fromCharCode(65 + i)}: {results[origIdx >= 0 ? origIdx : i] ?? 0}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
          {!revealed && (
            <div className="space-y-2">
              {quizTimerSeconds > 0 && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400/50 ${quizTimerRunning && quizTimerSeconds <= 15 ? 'animate-pulse' : ''}`}>
                  <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{t('Đồng hồ cát', 'Sand timer', '沙漏', '砂時計', '모래시계')}:</span>
                  <span className={`font-mono font-bold ${quizTimerSeconds <= 15 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{formatTimer(quizTimerSeconds)}</span>
                </div>
              )}
              {quizTimerSeconds === 0 && quizTimerEnded && !autoRevealOnTimerEnd && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  {t('Hết giờ! Bấm nút bên dưới để mở đáp án.', 'Time\'s up! Click the button below to reveal.', '时间到！点击下方按钮显示答案。', '時間切れ！下のボタンで答えを表示。', '시간 종료! 아래 버튼으로 정답 공개.')}
                </p>
              )}
              <button
                type="button"
                onClick={revealAnswer}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                {t('Hiện đáp án', 'Reveal answer', '显示答案', '答えを表示', '정답 공개')}
              </button>
            </div>
          )}
          {revealed && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {t('Đáp án đúng', 'Correct answer', '正确答案', '正解', '정답')}: {String.fromCharCode(65 + (displayQuizData ?? quizData).correctIndex)}
              </p>
              {total > 0 && (() => {
                const data = displayQuizData ?? quizData
                const sessionOpts = sessionQuizData ?? displayQuizData ?? quizData
                const correctOpt = data.options[data.correctIndex]
                const origCorrectIdx = sessionOpts.options.indexOf(correctOpt)
                const correctCount = results[origCorrectIdx >= 0 ? origCorrectIdx : data.correctIndex] ?? 0
                const wrongCount = total - correctCount
                const correctPct = Math.round((correctCount / total) * 100)
                const wrongPct = 100 - correctPct
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('Thống kê', 'Statistics', '统计', '統計', '통계')}: {correctCount}/{total} {t('đúng', 'correct', '正确', '正解', '정답')} ({correctPct}%) · {wrongCount} {t('sai', 'wrong', '错误', '不正解', '오답')} ({wrongPct}%)
                    </p>
                    <div className="h-4 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${correctPct}%` }}
                      />
                      <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${wrongPct}%` }}
                      />
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Render text với LaTeX (KaTeX): \(...\), \[...\], $...$, $$...$$ – export để dùng ở quiz-join-client */
export function QuizMathText({ text }: { text: string }) {
  const [html, setHtml] = useState<string>(() => escapeHtml(text))
  useEffect(() => {
    import('katex').then((katex) => {
      try {
        const parts: string[] = []
        // \(...\) | \[...\] | $$...$$ | $...$ (non-greedy)
        const re = /(\\\((.+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$)/g
        let last = 0
        let m
        while ((m = re.exec(text)) !== null) {
          if (m.index > last) parts.push(escapeHtml(text.slice(last, m.index)))
          const formula = (m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').trim()
          const displayMode = !!(m[3] || m[4])
          try {
            parts.push(katex.default.renderToString(formula, { throwOnError: false, displayMode }))
          } catch {
            parts.push(escapeHtml(m[0]))
          }
          last = m.index + m[0].length
        }
        if (last < text.length) parts.push(escapeHtml(text.slice(last)))
        setHtml(parts.join('') || escapeHtml(text))
      } catch {
        setHtml(escapeHtml(text))
      }
    }).catch(() => setHtml(escapeHtml(text)))
  }, [text])
  return <span dangerouslySetInnerHTML={{ __html: html }} className="[&_.katex]:text-inherit" />
}

function QuizEmbed({
  question,
  options,
  correctIndex,
  quizVerified,
  tr,
}: {
  question: string
  options: string[]
  correctIndex: number
  quizVerified: boolean
  tr?: ContentEmbedProps['tr']
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const isCorrect = selected === correctIndex
  const t = (vi: string, en: string, zh: string, ja: string, ko: string) => (typeof tr === 'function' ? tr(vi, en, zh, ja, ko) : vi)
  return (
    <div className={WRAPPER_CLASS + ' p-4 bg-slate-50 dark:bg-slate-900/50'}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
        <span className={quizVerified
          ? 'inline-flex px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
          : 'inline-flex px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'}>
          {quizVerified
            ? t('Đã verify', 'Verified', '已验证', '検証済み', '검증됨')
            : t('Chưa verify', 'Not verified', '未验证', '未検証', '미검증')}
        </span>
      </p>
      <p className="font-medium mb-3"><QuizMathText text={question} /></p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setSelected(i); setRevealed(true) }}
            disabled={revealed}
            className={`w-full text-left px-3 py-2 rounded border transition-colors ${
              !revealed ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''
            } ${revealed && i === correctIndex ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''} ${
              revealed && selected === i && i !== correctIndex ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''
            }`}
          >
            {String.fromCharCode(65 + i)}. <QuizMathText text={opt} />
          </button>
        ))}
      </div>
      {revealed && (
        <p className={`mt-2 text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          {isCorrect ? '✓ Đúng!' : `Sai. Đáp án đúng: ${String.fromCharCode(65 + correctIndex)}`}
        </p>
      )}
    </div>
  )
}

function LatexEmbed({ formula }: { formula: string }) {
  const [html, setHtml] = useState<string>('')
  useEffect(() => {
    import('katex').then((katex) => {
      try {
        setHtml(katex.default.renderToString(formula, { throwOnError: false, displayMode: true }))
      } catch {
        setHtml(formula)
      }
    }).catch(() => setHtml(formula))
  }, [formula])
  return (
    <div className={WRAPPER_CLASS + ' p-4 flex justify-center overflow-x-auto'}>
      <div dangerouslySetInnerHTML={{ __html: html || formula }} className="katex-display" />
    </div>
  )
}

import { parseQuizData } from '@/lib/parse-quiz-data'
export { parseQuizData }

/** Xáo trộn thứ tự đáp án – dùng seed để giáo viên và học sinh cùng thứ tự */
function shuffleQuizOptionsDeterministic(data: { question: string; options: string[]; correctIndex: number }, seed: string): { question: string; options: string[]; correctIndex: number } {
  const opts = data.options.slice()
  const correctIdx = Math.max(0, Math.min(data.correctIndex, opts.length - 1))
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  const seededRandom = (n: number) => {
    h = (h * 1664525 + 1013904223) | 0
    return (Math.abs(h) % n)
  }
  const indices = opts.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = seededRandom(i + 1)
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const newOpts = indices.map((i) => opts[i])
  const newCorrectIdx = indices.indexOf(correctIdx)
  return { question: data.question, options: newOpts, correctIndex: newCorrectIdx }
}

/** Parse tất cả embed trong content */
const EMBED_REGEXES: Array<{ type: EmbedType; re: RegExp }> = [
  { type: 'geogebra', re: /\[geogebra:\s*([^\]]+)\]/gi },
  { type: 'desmos', re: /\[desmos:\s*([^\]]+)\]/gi },
  { type: 'youtube', re: /\[youtube:\s*([^\]]+)\]/gi },
  { type: 'phet', re: /\[phet:\s*([^\]]+)\]/gi },
  { type: 'maps', re: /\[maps:\s*([^\]]+)\]/gi },
  { type: 'image', re: /\[image:\s*([^\]]+)\]/gi },
  { type: 'audio', re: /\[audio:\s*([^\]]+)\]/gi },
  // Quiz: nội dung có thể chứa ] (vd [f(x)]²) – kết thúc bằng delim + digit (0-3)
  { type: 'quiz', re: /\[quiz:\s*(.+[\x1f|][0-3])\]/gi },
  { type: 'code', re: /\[code:\s*([^\]]+)\]/gi },
  { type: 'latex', re: /\[latex:\s*([^\]]+)\]/gi },
  { type: 'plot', re: /\[plot:\s*([^\]]+)\]/gi },
]

export function parseContentEmbeds(content: string): Array<{ type: EmbedType; urlOrId: string; index: number; rawMarker: string }> {
  const all: Array<{ type: EmbedType; urlOrId: string; index: number; rawMarker: string }> = []
  for (const { type, re } of EMBED_REGEXES) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(content)) !== null) {
      all.push({ type, urlOrId: m[1].trim(), index: m.index, rawMarker: m[0] })
    }
  }
  return all.sort((a, b) => a.index - b.index)
}

export function splitContentWithEmbeds(content: string): Array<
  | { type: 'text'; value: string }
  | { type: 'embed'; embedType: EmbedType; urlOrId: string; rawMarker: string }
> {
  const embeds = parseContentEmbeds(content)
  if (embeds.length === 0) return [{ type: 'text', value: content }]

  const allMatches: Array<{ start: number; end: number; type: EmbedType; urlOrId: string; rawMarker: string }> = []
  for (const { type, re } of EMBED_REGEXES) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(content)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length, type, urlOrId: m[1].trim(), rawMarker: m[0] })
    }
  }
  allMatches.sort((a, b) => a.start - b.start)

  const parts: Array<{ type: 'text'; value: string } | { type: 'embed'; embedType: EmbedType; urlOrId: string; rawMarker: string }> = []
  let lastEnd = 0
  for (const match of allMatches) {
    if (match.start > lastEnd) {
      parts.push({ type: 'text', value: content.slice(lastEnd, match.start) })
    }
    parts.push({ type: 'embed', embedType: match.type, urlOrId: match.urlOrId, rawMarker: match.rawMarker })
    lastEnd = match.end
  }
  if (lastEnd < content.length) {
    parts.push({ type: 'text', value: content.slice(lastEnd) })
  }
  return parts
}

/** Tách nội dung block tại ranh giới quiz: phần trước + quiz → before, phần sau → after.
 * Dùng khi tách slide có 1 block chứa cả quiz và nội dung sau quiz. */
export function splitBlockContentAtQuizBoundary(content: string): { before: string; after: string } | null {
  const embeds = parseContentEmbeds(content)
  const quizEmbeds = embeds.filter((e) => e.type === 'quiz')
  if (quizEmbeds.length === 0) return null
  const firstQuiz = quizEmbeds[0]
  const endOfQuiz = firstQuiz.index + firstQuiz.rawMarker.length
  const afterContent = content.slice(endOfQuiz)
  const afterTrimmed = afterContent.replace(/^\s*\n+/, '').trim()
  if (!afterTrimmed) return null
  const before = content.slice(0, endOfQuiz).trim()
  return { before, after: afterTrimmed }
}

/** Kiểm tra block có quiz và có nội dung sau quiz (có thể tách tại ranh giới quiz) */
export function canSplitBlockAtQuiz(content: string): boolean {
  return splitBlockContentAtQuizBoundary(content) !== null
}

/** Backward compat: MathEmbed cho geogebra/desmos */
export function MathEmbed(props: { type: 'geogebra' | 'desmos'; urlOrId: string; width?: number; height?: number; className?: string }) {
  return <ContentEmbed {...props} />
}

function PlotEmbed({ spec }: { spec: string }) {
  const cfg = useMemo(() => parsePlotSpec(spec), [spec])
  if (!cfg) return null

  const width = 560
  const height = 320
  const pad = 28
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const toX = (x: number) => pad + ((x - cfg.xMin) / (cfg.xMax - cfg.xMin)) * innerW
  const toY = (y: number) => pad + (1 - (y - cfg.yMin) / (cfg.yMax - cfg.yMin)) * innerH

  const points: Array<{ x: number; y: number }> = []
  const n = 140
  for (let i = 0; i <= n; i++) {
    const x = cfg.xMin + (i / n) * (cfg.xMax - cfg.xMin)
    const y = evalFn(cfg.expr, x)
    if (Number.isFinite(y)) points.push({ x, y })
  }

  const path = points
    .filter((p) => p.y >= cfg.yMin - 1e6 && p.y <= cfg.yMax + 1e6)
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(' ')

  const axisX = cfg.yMin <= 0 && cfg.yMax >= 0 ? toY(0) : toY(cfg.yMin)
  const axisY = cfg.xMin <= 0 && cfg.xMax >= 0 ? toX(0) : toX(cfg.xMin)

  return (
    <div className={WRAPPER_CLASS + ' p-2 bg-white dark:bg-slate-900/50'}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <line x1={pad} y1={axisX} x2={width - pad} y2={axisX} stroke="#64748b" strokeWidth="1.2" />
        <line x1={axisY} y1={pad} x2={axisY} y2={height - pad} stroke="#64748b" strokeWidth="1.2" />
        {path ? <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2.2" /> : null}
        <text x={width - pad + 4} y={axisX + 4} fontSize="11" fill="#0f172a">x</text>
        <text x={axisY - 8} y={pad - 6} fontSize="11" fill="#0f172a">y</text>
        <text x={pad + 4} y={pad + 14} fontSize="11" fill="#0ea5e9">{cfg.label}</text>
      </svg>
    </div>
  )
}

function parsePlotSpec(raw: string): { expr: string; label: string; xMin: number; xMax: number; yMin: number; yMax: number } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const parts = s.split(';').map((p) => p.trim()).filter(Boolean)
  const kv = new Map<string, string>()
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx <= 0) continue
    kv.set(p.slice(0, idx).trim().toLowerCase(), p.slice(idx + 1).trim())
  }
  const exprRaw = kv.get('y') || kv.get('expr') || s
  const expr = normalizeExpr(exprRaw)
  if (!expr) return null
  const xMin = Number(kv.get('xmin') ?? -4)
  const xMax = Number(kv.get('xmax') ?? 4)
  const yMin = Number(kv.get('ymin') ?? -4)
  const yMax = Number(kv.get('ymax') ?? 8)
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) return null
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin >= yMax) return null
  const label = `y=${exprRaw.replace(/\s+/g, '')}`
  return { expr, label, xMin, xMax, yMin, yMax }
}

function normalizeExpr(input: string): string {
  let out = String(input || '')
    .replace(/^\s*[a-zA-Z]\s*\(\s*[xt]\s*\)\s*=\s*/i, '')
    .replace(/^\s*y\s*=\s*/i, '')
    .replace(/^\s*f\s*\(\s*[xt]\s*\)\s*=\s*/i, '')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/\|([^|]+)\|/g, 'abs($1)')
    .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
    .replace(/x²/g, 'x^2')
    .replace(/x³/g, 'x^3')
    .trim()
  const superscriptMap: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
  }
  for (const [k, v] of Object.entries(superscriptMap)) {
    out = out.replace(new RegExp(k, 'g'), `^${v}`)
  }
  out = out.replace(/(?<![A-Za-z])[tT](?![A-Za-z])/g, 'x')
  return out
}

function evalFn(expr: string, x: number): number {
  const safe = expr
    .replace(/(\d)([xX])/g, '$1*$2')
    .replace(/([xX])(\d)/g, '$1*$2')
    .replace(/([xX])\(/g, '$1*(')
    .replace(/\)([xX])/g, ')*$1')
    .replace(/\)\(/g, ')*(')
    .replace(/\^/g, '**')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/\babs\s*\(/gi, 'Math.abs(')
    .replace(/\bsqrt\s*\(/gi, 'Math.sqrt(')
    .replace(/\bsin\s*\(/gi, 'Math.sin(')
    .replace(/\bcos\s*\(/gi, 'Math.cos(')
    .replace(/\btan\s*\(/gi, 'Math.tan(')
    .replace(/\bexp\s*\(/gi, 'Math.exp(')
    .replace(/\bln\s*\(/gi, 'Math.log(')
    .replace(/\blog\s*\(/gi, 'Math.log10(')
  if (!/^[0-9xX+\-*/().,\s*MathabsinqrtcoetplogPI]*$/.test(safe.replace(/\*\*/g, '*'))) return NaN
  try {
    const fn = new Function('x', `return (${safe});`) as (x: number) => number
    const y = fn(x)
    return Number.isFinite(y) ? y : NaN
  } catch {
    return NaN
  }
}
