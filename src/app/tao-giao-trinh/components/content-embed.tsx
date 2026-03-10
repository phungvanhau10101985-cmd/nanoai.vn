'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Timer } from 'lucide-react'
import QRCode from 'qrcode'

/**
 * Nhúng nhiều loại nội dung vào slide: GeoGebra, Desmos, YouTube, PhET, Maps, Image, Audio, Quiz, Code, LaTeX
 */

const WRAPPER_CLASS = 'my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700'

export type EmbedType = 'geogebra' | 'desmos' | 'youtube' | 'phet' | 'maps' | 'image' | 'audio' | 'quiz' | 'code' | 'latex'

export interface ContentEmbedProps {
  type: EmbedType
  urlOrId: string
  width?: number
  height?: number
  className?: string
  /** Khi có curriculumId, quiz hiển thị chế độ live: Bắt đầu, QR, kết quả */
  liveQuizContext?: { curriculumId: string; slideIndex: number; blockIndex: number }
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
      return raw.includes('?embed') ? raw : raw + (raw.includes('?') ? '&embed' : '?embed')
    }
    const id = raw.match(/geogebra\.org\/(?:calculator|m)\/([a-zA-Z0-9]+)/)?.[1] ?? (raw.length < 25 ? raw : null)
    return id ? `https://www.geogebra.org/calculator/${id}?embed` : `https://www.geogebra.org/calculator/${raw}?embed`
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

  return null
}

function QuizContentWrapper({ urlOrId, liveQuizContext, tr }: { urlOrId: string; liveQuizContext?: ContentEmbedProps['liveQuizContext']; tr?: ContentEmbedProps['tr'] }) {
  const quizData = useMemo(() => {
    const parsed = parseQuizData(urlOrId)
    if (!parsed) return null
    const base = { ...parsed, correctIndex: Math.min(parsed.correctIndex, parsed.options.length - 1) }
    return shuffleQuizOptions(base)
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
        curriculumId={liveQuizContext.curriculumId || null}
        slideIndex={liveQuizContext.slideIndex}
        blockIndex={liveQuizContext.blockIndex}
        tr={tr}
      />
    )
  }
  return <QuizEmbed question={quizData.question} options={quizData.options} correctIndex={quizData.correctIndex} />
}

export function ContentEmbed({ type, urlOrId, width = 560, height = 350, className = '', liveQuizContext, tr, hideQuiz, fill }: ContentEmbedProps) {
  const src = getEmbedSrc(type, urlOrId)
  const wrapperClass = `${WRAPPER_CLASS} ${className} ${fill ? 'w-full h-full min-h-0' : ''}`.trim()

  if (type === 'geogebra' || type === 'desmos' || type === 'youtube' || type === 'phet' || type === 'maps' || type === 'code') {
    if (!src) return null
    return (
      <div className={wrapperClass}>
        <iframe
          src={src}
          {...(fill ? { style: { width: '100%', height: '100%' } } : { width, height })}
          className="w-full border-0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={type}
        />
      </div>
    )
  }

  if (type === 'image') {
    if (!src) return null
    return (
      <div className={wrapperClass}>
        <img src={src} alt="" className="w-full max-w-full h-auto" style={{ maxHeight: height }} />
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
  curriculumId,
  slideIndex,
  blockIndex,
  tr,
}: {
  quizData: { question: string; options: string[]; correctIndex: number }
  curriculumId: string | null
  slideIndex: number
  blockIndex: number
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}) {
  const t = (vi: string, en: string, zh: string, ja: string, ko: string) => (typeof tr === 'function' ? tr(vi, en, zh, ja, ko) : vi)
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [results, setResults] = useState<Record<number, number>>({})
  const [total, setTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [quizDurationSeconds, setQuizDurationSeconds] = useState(60)
  const [autoRevealOnTimerEnd, setAutoRevealOnTimerEnd] = useState(true)
  const [quizTimerSeconds, setQuizTimerSeconds] = useState(0)
  const [quizTimerRunning, setQuizTimerRunning] = useState(false)
  const [quizTimerEnded, setQuizTimerEnded] = useState(false)

  const formatTimer = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`

  const startSession = useCallback(async () => {
    if (!curriculumId) return
    setCreateError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/slide-quiz/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId,
          slideIndex,
          blockIndex,
          quizData,
        }),
      })
      const data = await res.json()
      if (data.code) {
        setSessionCode(data.code)
        setQuizTimerSeconds(quizDurationSeconds)
        setQuizTimerRunning(true)
        const url = typeof window !== 'undefined' ? `${window.location.origin}/quiz/${data.code}` : ''
        QRCode.toDataURL(url, { width: 140, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
      } else {
        setCreateError(data.error || (res.status === 401 ? t('Vui lòng đăng nhập.', 'Please sign in.', '请登录。', 'ログインしてください。', '로그인해 주세요.') : t('Không tạo được phiên.', 'Could not create session.', '无法创建会话。', 'セッションを作成できません。', '세션을 만들 수 없습니다.')))
      }
    } finally {
      setLoading(false)
    }
  }, [curriculumId, slideIndex, blockIndex, quizData, quizDurationSeconds, t])

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

  const revealAnswer = useCallback(async () => {
    if (!sessionCode) return
    await fetch(`/api/slide-quiz/${sessionCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revealed' }),
    })
    setRevealed(true)
  }, [sessionCode])

  const joinUrl = typeof window !== 'undefined' && sessionCode ? `${window.location.origin}/quiz/${sessionCode}` : ''

  return (
    <div className={WRAPPER_CLASS + ' p-4 bg-slate-50 dark:bg-slate-900/50'}>
      <p className="font-medium mb-3"><QuizMathText text={quizData.question} /></p>
      <div className="space-y-2 mb-4">
        {quizData.options.map((opt, i) => (
          <div key={i} className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            {String.fromCharCode(65 + i)}. <QuizMathText text={opt} />
          </div>
        ))}
      </div>

      {!sessionCode ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('Thời gian', 'Duration', '时间', '時間', '시간')}:</span>
            <div className="flex gap-1">
              {QUIZ_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setQuizDurationSeconds(opt.value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${quizDurationSeconds === opt.value ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('Khi hết giờ', 'When time ends', '时间到', '時間切れ', '시간 종료')}:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="quiz-reveal" checked={autoRevealOnTimerEnd} onChange={() => setAutoRevealOnTimerEnd(true)} className="rounded-full" />
              <span className="text-sm">{t('Tự mở đáp án', 'Auto reveal', '自动显示', '自動表示', '자동 공개')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="quiz-reveal" checked={!autoRevealOnTimerEnd} onChange={() => setAutoRevealOnTimerEnd(false)} className="rounded-full" />
              <span className="text-sm">{t('Giáo viên mở', 'Teacher reveals', '教师显示', '教師が表示', '교사가 공개')}</span>
            </label>
          </div>
          <button
            type="button"
            onClick={startSession}
            disabled={loading || !curriculumId}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...') : !curriculumId ? t('Lưu giáo trình để bắt đầu', 'Save curriculum to start', '保存课程以开始', '保存して開始', '저장 후 시작') : t('Bắt đầu – Học sinh làm bài', 'Start – Students answer', '开始 - 学生作答', '開始 - 生徒が回答', '시작 - 학생 답변')}
          </button>
          {!curriculumId && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t('Lưu giáo trình vào kho trước để bắt đầu phiên trắc nghiệm.', 'Save curriculum to library first to start quiz session.', '请先将课程保存到库以开始测验。', '先にカリキュラムを保存してください。', '먼저 교육과정을 저장하세요.')}
            </p>
          )}
          {createError && (
            <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 print:hidden">
          <div className="flex flex-wrap gap-4 items-start">
            {qrDataUrl && (
              <div className="flex flex-col items-center">
                <img src={qrDataUrl} alt="QR" className="w-[140px] h-[140px] rounded border" />
                <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">{t('Quét để làm bài', 'Scan to answer', '扫码作答', 'スキャンして回答', '스캔하여 답변')}</p>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('Mã', 'Code', '代码', 'コード', '코드')}: {sessionCode}</p>
              <p className="text-xs text-slate-500 mt-0.5 break-all">{joinUrl}</p>
              <p className="text-sm mt-2 font-medium">{t('Kết quả', 'Results', '结果', '結果', '결과')}: {total} {t('học sinh đã trả lời', 'students answered', '名学生已作答', '人が回答', '명 답변')}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {quizData.options.map((_, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                    {String.fromCharCode(65 + i)}: {results[i] ?? 0}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {!revealed && (
            <div className="space-y-2">
              {quizTimerSeconds > 0 && (
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400/50', quizTimerRunning && quizTimerSeconds <= 15 && 'animate-pulse')}>
                  <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{t('Đồng hồ cát', 'Sand timer', '沙漏', '砂時計', '모래시계')}:</span>
                  <span className={cn('font-mono font-bold', quizTimerSeconds <= 15 && 'text-amber-700 dark:text-amber-300')}>{formatTimer(quizTimerSeconds)}</span>
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
                {t('Đáp án đúng', 'Correct answer', '正确答案', '正解', '정답')}: {String.fromCharCode(65 + quizData.correctIndex)}
              </p>
              {total > 0 && (() => {
                const correctCount = results[quizData.correctIndex] ?? 0
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
      )}
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

function QuizEmbed({ question, options, correctIndex }: { question: string; options: string[]; correctIndex: number }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const isCorrect = selected === correctIndex
  return (
    <div className={WRAPPER_CLASS + ' p-4 bg-slate-50 dark:bg-slate-900/50'}>
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

const QUIZ_DELIM = '\x1f' // Unit Separator – không xuất hiện trong công thức toán

/** Parse quiz urlOrId – trả về dữ liệu nếu hợp lệ, null nếu lỗi. Hỗ trợ 2 format:
 * - Mới: question\\x1fopt1\\x1fopt2\\x1fopt3\\x1fopt4\\x1fcorrectIndex
 * - Cũ: question|opt1|opt2|opt3|opt4|correctIndex (parse từ cuối vì | có thể có trong công thức)
 */
export function parseQuizData(urlOrId: string): { question: string; options: string[]; correctIndex: number } | null {
  try {
    // Format mới: delimiter \x1f → question, opt1, opt2, opt3, opt4, correctIndex (đúng 6 phần)
    if (urlOrId.includes(QUIZ_DELIM)) {
      const parts = urlOrId.split(QUIZ_DELIM)
      if (parts.length === 6) {
        const question = String(parts[0] ?? '').trim()
        const options = parts.slice(1, 5).map((p) => String(p ?? '').trim()).filter(Boolean)
        const correctIdx = parseInt(parts[5], 10) || 0
        if (question && options.length >= 2) {
          return { question, options, correctIndex: Math.min(correctIdx, options.length - 1) }
        }
      }
    }
    // Format cũ: delimiter | (parse từ cuối)
    const parts = urlOrId.split('|')
    if (parts.length >= 6) {
      const correctIdx = parseInt(parts[parts.length - 1], 10) || 0
      const options = parts.slice(parts.length - 5, parts.length - 1).map((p) => String(p ?? '').trim()).filter(Boolean)
      const question = parts.slice(0, parts.length - 5).join('|').trim() || ''
      if (question && options.length >= 2) {
        return { question, options, correctIndex: Math.min(correctIdx, options.length - 1) }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Xáo trộn thứ tự đáp án để đáp án đúng không luôn ở A */
function shuffleQuizOptions(data: { question: string; options: string[]; correctIndex: number }): { question: string; options: string[]; correctIndex: number } {
  const opts = data.options.slice()
  const correctIdx = Math.max(0, Math.min(data.correctIndex, opts.length - 1))
  const indices = opts.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
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
