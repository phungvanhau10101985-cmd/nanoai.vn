'use client'

import { useEffect, useRef, useState } from 'react'
import { detectAnswerCards } from '@/lib/lop/answer-card-detect'
import {
  answerCardGivenName,
  choiceFromQrTopEdge,
  fillAnswerCardText,
  type AnswerChoice,
} from '@/lib/lop/answer-card'
import type { AnswerCardPhoneView } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Box = { points: Array<{ x: number; y: number }>; label: string }

function captureStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function drawShotLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number
) {
  let fontSize = size
  ctx.font = `600 ${fontSize}px sans-serif`
  while (fontSize > 15 && ctx.measureText(text).width > maxWidth) {
    fontSize -= 1
    ctx.font = `600 ${fontSize}px sans-serif`
  }
  ctx.fillText(text, x, y)
}

function shotFileName(date: Date, questionNumber: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `cau-${questionNumber}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.jpg`
}

async function saveShotOnPhone(blob: Blob, fileName: string): Promise<'saved' | 'cancelled' | 'failed'> {
  const file = new File([blob], fileName, { type: 'image/jpeg' })
  let canShare = false
  try {
    canShare = typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [file] }))
  } catch {
    canShare = false
  }
  if (canShare) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'saved'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    return 'saved'
  } catch {
    return 'failed'
  }
}

function phoneIsSideways(): boolean {
  const angle = window.screen?.orientation?.angle
  if (typeof angle === 'number' && Number.isFinite(angle)) {
    const norm = ((Math.round(angle) % 360) + 360) % 360
    if (norm === 90 || norm === 270) return true
  }
  const legacy = (window as Window & { orientation?: number }).orientation
  if (typeof legacy === 'number' && Number.isFinite(legacy)) {
    const norm = ((Math.round(legacy) % 360) + 360) % 360
    return norm === 90 || norm === 270
  }
  return false
}

export function QuetTheClient({
  token,
  initial,
  t,
}: {
  token: string
  initial: AnswerCardPhoneView
  t: Dictionary['classes']
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const sidewaysRef = useRef(false)
  const latestRef = useRef(new Map<string, AnswerChoice>())
  const sweepBand = useRef(0)
  const recordGen = useRef(0)
  const recordChain = useRef(Promise.resolve())
  const recordTimer = useRef<number | null>(null)
  const [view, setView] = useState(initial)
  const [latestCount, setLatestCount] = useState(0)
  const [resultModal, setResultModal] = useState<{ n: number; correct: number; wrong: number } | null>(null)
  const [sideways, setSideways] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const facing = 'environment'
  const [cameraError, setCameraError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [shotNote, setShotNote] = useState('')
  const [recordAck, setRecordAck] = useState(false)
  const rosterRef = useRef(initial.roster)
  const questionRef = useRef(initial.questionIndex)
  rosterRef.current = view.roster
  sidewaysRef.current = sideways

  useEffect(() => {
    const apply = () => setSideways(phoneIsSideways())
    apply()
    window.addEventListener('orientationchange', apply)
    window.addEventListener('resize', apply)
    window.screen?.orientation?.addEventListener('change', apply)
    return () => {
      window.removeEventListener('orientationchange', apply)
      window.removeEventListener('resize', apply)
      window.screen?.orientation?.removeEventListener('change', apply)
    }
  }, [])

  useEffect(() => {
    if (questionRef.current === view.questionIndex) return
    questionRef.current = view.questionIndex
    latestRef.current.clear()
    setLatestCount(0)
    setResultModal(null)
    if (recordTimer.current) window.clearTimeout(recordTimer.current)
  }, [view.questionIndex])

  useEffect(() => () => {
    if (recordTimer.current) window.clearTimeout(recordTimer.current)
  }, [])

  useEffect(() => {
    let stop = false
    let pending = false
    const tick = async () => {
      if (pending || stop) return
      pending = true
      try {
        const res = await fetch(`/api/lop/answer-cards/phone/${token}`, { cache: 'no-store' })
        if (!res.ok || stop) return
        const data = (await res.json()) as AnswerCardPhoneView
        if (!stop && data?.questionCount) setView(data)
      } finally {
        pending = false
      }
    }
    const timer = window.setInterval(() => { void tick() }, 1200)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [token])

  useEffect(() => {
    if (!cameraOn || view.showSummary) return
    const video = videoRef.current
    if (!video) return
    let stream: MediaStream | null = null
    let frame = 0
    let lastScan = 0
    let stopped = false
    const scratch = document.createElement('canvas')
    const ctx = scratch.getContext('2d', { willReadFrequently: true })

    const stopStream = () => {
      stopped = true
      window.cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }

    void (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(t.answerCardsCameraInsecure)
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        video.srcObject = stream
        await video.play()
        setCameraError('')
      } catch {
        setCameraError(t.answerCardsCameraDenied)
        return
      }

      const loop = (now: number) => {
        frame = window.requestAnimationFrame(loop)
        if (!ctx || video.readyState < 2 || now - lastScan < 220) return
        lastScan = now
        const scale = Math.min(1, 960 / video.videoWidth)
        const width = Math.max(1, Math.round(video.videoWidth * scale))
        const height = Math.max(1, Math.round(video.videoHeight * scale))
        scratch.width = width
        scratch.height = height
        ctx.drawImage(video, 0, 0, width, height)
        const bands: Array<{ x0: number; y0: number; x1: number; y1: number } | null> = [
          null,
          { x0: 0, y0: 0, x1: 1, y1: 0.62 },
          { x0: 0, y0: 0.38, x1: 1, y1: 1 },
          { x0: 0, y0: 0, x1: 0.62, y1: 1 },
          { x0: 0.38, y0: 0, x1: 1, y1: 1 },
        ]
        const band = bands[sweepBand.current % bands.length]
        sweepBand.current += 1
        const originX = band ? Math.floor(band.x0 * width) : 0
        const originY = band ? Math.floor(band.y0 * height) : 0
        const cropW = band ? Math.max(1, Math.floor((band.x1 - band.x0) * width)) : width
        const cropH = band ? Math.max(1, Math.floor((band.y1 - band.y0) * height)) : height
        const detected = detectAnswerCards(ctx.getImageData(originX, originY, cropW, cropH), band ? 24 : 16)
        const boxes: Box[] = []
        const roster = new Map(rosterRef.current.map((card) => [card.token, card]))
        let gathered = false
        for (const card of detected) {
          const known = roster.get(card.token)
          if (!known) continue
          const choice = choiceFromQrTopEdge(card.topLeft, card.topRight, 'portrait')
          if (!sidewaysRef.current && latestRef.current.get(card.token) !== choice) {
            latestRef.current.set(card.token, choice)
            gathered = true
          }
          const display = video.getBoundingClientRect()
          const scaleX = display.width / width
          const scaleY = display.height / height
          boxes.push({
            points: [card.topLeft, card.topRight, card.bottomRight, card.bottomLeft].map((point) => ({
              x: (point.x + originX) * scaleX,
              y: (point.y + originY) * scaleY,
            })),
            label: known
              ? `${fillAnswerCardText(t.answerCardsScanName, { name: answerCardGivenName(known.shortName) || String(known.cardNo) })} · ${choice}`
              : choice,
          })
        }
        if (gathered) setLatestCount(latestRef.current.size)
        const overlay = overlayRef.current
        if (overlay) {
          const display = video.getBoundingClientRect()
          overlay.width = display.width
          overlay.height = display.height
          const pen = overlay.getContext('2d')
          if (pen) {
            pen.clearRect(0, 0, overlay.width, overlay.height)
            pen.strokeStyle = '#4ade80'
            pen.lineWidth = 3
            pen.font = '16px sans-serif'
            for (const box of boxes) {
              const [first, ...rest] = box.points
              if (!first) continue
              pen.beginPath()
              pen.moveTo(first.x, first.y)
              for (const point of rest) pen.lineTo(point.x, point.y)
              pen.closePath()
              pen.stroke()
              pen.fillStyle = 'rgba(22,163,74,0.92)'
              const labelWidth = pen.measureText(box.label).width + 12
              pen.fillRect(first.x, first.y - 22, labelWidth, 20)
              pen.fillStyle = '#fff'
              pen.fillText(box.label, first.x + 6, first.y - 7)
            }
          }
        }
      }
      frame = window.requestAnimationFrame(loop)
    })()

    return stopStream
  }, [cameraOn, facing, view.showSummary, t.answerCardsCameraDenied, t.answerCardsCameraInsecure])

  function recordResult() {
    if (view.status === 'closed' || latestRef.current.size === 0 || recordAck) return
    setRecordAck(true)
    const gen = ++recordGen.current
    if (recordTimer.current) window.clearTimeout(recordTimer.current)
    setResultModal(null)
    const picks = [...latestRef.current.entries()].map(([cardToken, choice]) => ({ token: cardToken, choice }))
    const questionIndex = questionRef.current
    const run = recordChain.current.then(async () => {
      if (gen !== recordGen.current) return
      const res = await fetch(`/api/lop/answer-cards/phone/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ picks, questionIndex, replace: true }),
      })
      if (gen !== recordGen.current || !res.ok) {
        if (gen === recordGen.current) setRecordAck(false)
        return
      }
      const data = await res.json() as { saved?: number; total?: number; correct?: number; wrong?: number }
      if ((data.saved ?? 0) === 0) {
        if (gen === recordGen.current) setRecordAck(false)
        return
      }
      if (typeof data.saved === 'number' && typeof data.total === 'number') {
        setView((current) => ({ ...current, saved: data.saved ?? current.saved, total: data.total ?? current.total }))
      }
      setResultModal({
        n: questionIndex + 1,
        correct: data.correct ?? 0,
        wrong: data.wrong ?? 0,
      })
      if (gen === recordGen.current) setRecordAck(false)
    }).catch(() => {
      if (gen === recordGen.current) setRecordAck(false)
    })
    recordChain.current = run.catch(() => undefined)
  }

  async function finishOnBoard() {
    setResultModal(null)
    await fetch(`/api/lop/answer-cards/phone/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'summary' }),
    })
  }

  async function openPaperOnBoard() {
    await fetch(`/api/lop/answer-cards/phone/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'paper' }),
    })
  }

  async function captureShot() {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth < 2 || capturing || !cameraOn) return
    setCapturing(true)
    setShotNote('')
    try {
      const scale = Math.min(1, 1280 / Math.max(1, video.videoWidth))
      const width = Math.max(1, Math.round(video.videoWidth * scale))
      const height = Math.max(1, Math.round(video.videoHeight * scale))
      const bar = 112
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height + bar
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, width, height)
      const overlay = overlayRef.current
      if (overlay && overlay.width > 0 && overlay.height > 0) {
        ctx.drawImage(overlay, 0, 0, width, height)
      }
      ctx.fillStyle = 'rgba(7, 20, 37, 0.94)'
      ctx.fillRect(0, height, width, bar)
      ctx.fillStyle = '#ffffff'
      const questionLine = fillAnswerCardText(t.answerCardsQuestionWord, { n: questionRef.current + 1 })
      const when = captureStamp(new Date())
      const subject = (view.subjectName || '').trim()
      const paper = subject ? `${view.title} · ${subject}` : view.title
      drawShotLine(ctx, `${questionLine} · ${when}`, 20, height + 42, width - 40, 28)
      drawShotLine(ctx, paper, 20, height + 84, width - 40, 22)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72))
      if (!blob) {
        setShotNote(t.answerCardsCaptureFailed)
        window.setTimeout(() => setShotNote(''), 2200)
        return
      }
      const saved = await saveShotOnPhone(blob, shotFileName(new Date(), questionRef.current + 1))
      if (saved === 'cancelled') return
      setShotNote(saved === 'saved' ? t.answerCardsCaptured : t.answerCardsCaptureFailed)
      window.setTimeout(() => setShotNote(''), 2200)
    } finally {
      setCapturing(false)
    }
  }

  async function stepQuestion(action: 'next' | 'prev') {
    const res = await fetch(`/api/lop/answer-cards/phone/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) return
    const data = (await res.json()) as AnswerCardPhoneView
    if (data?.questionCount) setView(data)
  }

  if (view.showSummary && view.summary) {
    const summary = view.summary
    return (
      <div className="fixed inset-0 z-[80] overflow-auto bg-white text-slate-900">
        <div className="mx-auto w-full max-w-5xl px-3 py-4">
          <h1 className="text-xl font-semibold">{t.answerCardsExamSummary}</h1>
          <p className="mt-1 text-sm text-slate-500">{summary.className} · {summary.title}</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2" />
                  {Array.from({ length: summary.questionCount }, (_, index) => (
                    <th key={index} className="px-2 py-2 text-center">{index + 1}</th>
                  ))}
                  <th className="px-3 py-2 text-right">{t.answerCardsExamSummary}</th>
                </tr>
              </thead>
              <tbody>
                {summary.students.map((student) => (
                  <tr key={student.cardNo} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{String(student.cardNo).padStart(2, '0')}</td>
                    <td className="px-3 py-2">{student.name}</td>
                    {student.marks.map((mark, index) => (
                      <td
                        key={index}
                        className={`px-2 py-2 text-center font-semibold ${mark === 'correct' ? 'text-emerald-600' : mark === 'wrong' ? 'text-rose-600' : 'text-slate-400'}`}
                      >
                        {mark === 'correct' ? '✓' : mark === 'wrong' ? '×' : '—'}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right font-semibold ${student.attempted ? '' : 'font-medium text-slate-400'}`}>
                      {student.attempted
                        ? fillAnswerCardText(t.answerCardsScore, { points: student.points, total: student.total })
                        : t.answerCardsNotDone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/70">{[view.className, view.schoolName].filter(Boolean).join(' · ')}</p>
          <p className="font-semibold">
            {fillAnswerCardText(t.answerCardsScanTitle, { n: view.questionIndex + 1, total: view.questionCount })}
            {' · '}
            {view.status === 'closed' ? t.answerCardsEnded : t.answerCardsScanning}
          </p>
        </div>
        <p>{fillAnswerCardText(t.answerCardsGathered, { saved: latestCount, total: view.total })}</p>
      </header>
      <p className="bg-black px-3 py-1.5 text-center text-sm font-semibold text-red-500">
        {t.answerCardsNoLandscape}
      </p>
      <div className="relative min-h-0 flex-1 bg-slate-950">
        <video ref={videoRef} className="h-full w-full object-fill" playsInline muted autoPlay />
        <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0 h-full w-full" />
        {shotNote ? (
          <p className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-semibold ${
            shotNote === t.answerCardsCaptureFailed ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
          }`}
          >
            {shotNote}
          </p>
        ) : null}
        {recordAck ? (
          <p className="absolute left-1/2 top-4 z-10 -translate-x-1/2 animate-pulse rounded-full bg-white px-4 py-2 text-base font-semibold text-emerald-700 shadow-lg">
            {t.answerCardsRecordAck}
          </p>
        ) : null}
        {cameraError ? <p className="absolute inset-x-4 top-1/2 text-center text-sm">{cameraError}</p> : null}
        {!cameraOn ? <p className="absolute inset-x-4 top-1/2 text-center text-sm text-white/70">{t.answerCardsCameraOff}</p> : null}
        {resultModal ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-slate-900">
              <p className="text-lg font-semibold">
                {fillAnswerCardText(t.answerCardsResultTitle, { n: resultModal.n })}
              </p>
              <p className="mt-3 text-2xl font-semibold text-emerald-600">
                {fillAnswerCardText(t.answerCardsPeopleCorrect, { n: resultModal.correct })}
              </p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">
                {fillAnswerCardText(t.answerCardsPeopleWrong, { n: resultModal.wrong })}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => { void finishOnBoard() }}
                >
                  {t.answerCardsDone}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
                  disabled={view.questionIndex >= view.questionCount - 1}
                  onClick={() => {
                    setResultModal(null)
                    void stepQuestion('next')
                  }}
                >
                  {t.answerCardsRecordNext}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="space-y-2 px-3 py-3">
        <button
          type="button"
          className="w-full rounded-full bg-white px-3 py-3 text-base font-semibold text-slate-900 disabled:opacity-40"
          disabled={!cameraOn || capturing || Boolean(cameraError)}
          onClick={() => { void captureShot() }}
        >
          {capturing ? '…' : t.answerCardsCapture}
        </button>
        <button
          type="button"
          className={`w-full rounded-full px-3 py-3 text-base font-semibold transition active:scale-95 disabled:opacity-40 ${
            recordAck
              ? 'scale-95 bg-white text-emerald-700 ring-4 ring-white'
              : 'bg-emerald-400 text-slate-950'
          }`}
          disabled={view.status === 'closed' || latestCount === 0 || recordAck}
          onClick={recordResult}
        >
          {recordAck ? t.answerCardsRecordAck : `${t.answerCardsRecord} · ${latestCount}`}
        </button>
        {view.total > 0 && view.saved >= view.total ? (
          <p className="text-center text-sm font-semibold text-amber-200">{t.answerCardsAllScanned}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
            disabled={view.status === 'closed' || view.questionIndex <= 0}
            onClick={() => { void stepQuestion('prev') }}
          >
            {view.questionIndex > 0
              ? fillAnswerCardText(t.answerCardsQuestionWord, { n: view.questionIndex })
              : t.answerCardsPrev}
          </button>
          <button
            type="button"
            className="rounded-full bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
            disabled={view.status === 'closed' || view.questionIndex >= view.questionCount - 1}
            onClick={() => { void stepQuestion('next') }}
          >
            {view.questionIndex < view.questionCount - 1
              ? fillAnswerCardText(t.answerCardsQuestionWord, { n: view.questionIndex + 2 })
              : t.answerCardsNext}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
            disabled={view.status === 'closed'}
            onClick={() => { void openPaperOnBoard() }}
          >
            {t.answerCardsOpenPaper}
          </button>
          <button
            type="button"
            className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={() => setCameraOn((current) => !current)}
          >
            {cameraOn ? t.answerCardsCameraOff : t.answerCardsCameraOn}
          </button>
        </div>
      </div>
    </div>
  )
}
