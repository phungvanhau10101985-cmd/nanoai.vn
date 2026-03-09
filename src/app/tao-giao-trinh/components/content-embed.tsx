'use client'

import { useState, useEffect, useCallback } from 'react'
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

export function ContentEmbed({ type, urlOrId, width = 560, height = 350, className = '', liveQuizContext, tr, hideQuiz }: ContentEmbedProps) {
  const src = getEmbedSrc(type, urlOrId)
  const wrapperClass = `${WRAPPER_CLASS} ${className}`.trim()

  if (type === 'geogebra' || type === 'desmos' || type === 'youtube' || type === 'phet' || type === 'maps' || type === 'code') {
    if (!src) return null
    return (
      <div className={wrapperClass}>
        <iframe
          src={src}
          width={width}
          height={height}
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
    try {
      const parts = urlOrId.split('|')
      if (parts.length >= 3) {
        const question = parts[0]
        const options = parts.slice(1, -1)
        const correctIdx = parseInt(parts[parts.length - 1], 10) || 0
        const quizData = { question, options, correctIndex: correctIdx }
        if (liveQuizContext?.curriculumId) {
          return (
            <LiveQuizEmbed
              quizData={quizData}
              curriculumId={liveQuizContext.curriculumId}
              slideIndex={liveQuizContext.slideIndex}
              blockIndex={liveQuizContext.blockIndex}
              tr={tr}
            />
          )
        }
        return (
          <QuizEmbed question={question} options={options} correctIndex={correctIdx} />
        )
      }
    } catch {
      /* ignore */
    }
    return null
  }

  if (type === 'latex') {
    return <LatexEmbed formula={urlOrId} />
  }

  return null
}

function LiveQuizEmbed({
  quizData,
  curriculumId,
  slideIndex,
  blockIndex,
  tr,
}: {
  quizData: { question: string; options: string[]; correctIndex: number }
  curriculumId: string
  slideIndex: number
  blockIndex: number
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}) {
  const t = (vi: string, en: string, zh: string, ja: string, ko: string) => (tr ? tr(vi, en, zh, ja, ko) : vi)
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [results, setResults] = useState<Record<number, number>>({})
  const [total, setTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)

  const startSession = useCallback(async () => {
    setLoading(true)
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
    setLoading(false)
    if (data.code) {
      setSessionCode(data.code)
      const url = typeof window !== 'undefined' ? `${window.location.origin}/quiz/${data.code}` : ''
      QRCode.toDataURL(url, { width: 140, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
    }
  }, [curriculumId, slideIndex, blockIndex, quizData])

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
      <p className="font-medium mb-3">{quizData.question}</p>
      <div className="space-y-2 mb-4">
        {quizData.options.map((opt, i) => (
          <div key={i} className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            {String.fromCharCode(65 + i)}. {opt}
          </div>
        ))}
      </div>

      {!sessionCode ? (
        <button
          type="button"
          onClick={startSession}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? t('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...') : t('Bắt đầu – Học sinh làm bài', 'Start – Students answer', '开始 - 学生作答', '開始 - 生徒が回答', '시작 - 학생 답변')}
        </button>
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
            <button
              type="button"
              onClick={revealAnswer}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
            >
              {t('Hiện đáp án', 'Reveal answer', '显示答案', '答えを表示', '정답 공개')}
            </button>
          )}
          {revealed && (
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {t('Đáp án đúng', 'Correct answer', '正确答案', '正解', '정답')}: {String.fromCharCode(65 + quizData.correctIndex)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function QuizEmbed({ question, options, correctIndex }: { question: string; options: string[]; correctIndex: number }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const isCorrect = selected === correctIndex
  return (
    <div className={WRAPPER_CLASS + ' p-4 bg-slate-50 dark:bg-slate-900/50'}>
      <p className="font-medium mb-3">{question}</p>
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
            {String.fromCharCode(65 + i)}. {opt}
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

/** Parse tất cả embed trong content */
const EMBED_REGEXES: Array<{ type: EmbedType; re: RegExp }> = [
  { type: 'geogebra', re: /\[geogebra:\s*([^\]]+)\]/gi },
  { type: 'desmos', re: /\[desmos:\s*([^\]]+)\]/gi },
  { type: 'youtube', re: /\[youtube:\s*([^\]]+)\]/gi },
  { type: 'phet', re: /\[phet:\s*([^\]]+)\]/gi },
  { type: 'maps', re: /\[maps:\s*([^\]]+)\]/gi },
  { type: 'image', re: /\[image:\s*([^\]]+)\]/gi },
  { type: 'audio', re: /\[audio:\s*([^\]]+)\]/gi },
  { type: 'quiz', re: /\[quiz:\s*([^\]]+)\]/gi },
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

/** Backward compat: MathEmbed cho geogebra/desmos */
export function MathEmbed(props: { type: 'geogebra' | 'desmos'; urlOrId: string; width?: number; height?: number; className?: string }) {
  return <ContentEmbed {...props} />
}
