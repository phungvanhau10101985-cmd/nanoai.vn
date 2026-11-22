'use client'

import { useEffect, useRef, useState } from 'react'
import { detectAnswerCards } from '@/lib/lop/answer-card-detect'
import {
  choiceFromQrTopEdge,
  fillAnswerCardText,
  type AnswerChoice,
  type CameraHold,
} from '@/lib/lop/answer-card'
import type { AnswerCardPhoneView } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Box = { points: Array<{ x: number; y: number }>; label: string }

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
  const holdRef = useRef<CameraHold>('portrait')
  const stableRef = useRef(new Map<string, { choice: AnswerChoice; hits: number }>())
  const lastPostRef = useRef('')
  const [view, setView] = useState(initial)
  const [hold, setHold] = useState<CameraHold>('portrait')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [cameraOn, setCameraOn] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [toast, setToast] = useState('')
  const rosterRef = useRef(initial.roster)
  const questionRef = useRef(initial.questionIndex)
  rosterRef.current = view.roster
  holdRef.current = hold

  useEffect(() => {
    if (questionRef.current === view.questionIndex) return
    questionRef.current = view.questionIndex
    lastPostRef.current = ''
    stableRef.current.clear()
  }, [view.questionIndex])

  useEffect(() => {
    let stop = false
    const tick = async () => {
      const res = await fetch(`/api/lop/answer-cards/phone/${token}`, { cache: 'no-store' })
      if (!res.ok || stop) return
      const data = (await res.json()) as AnswerCardPhoneView
      if (!stop && data?.questionCount) setView(data)
    }
    const timer = window.setInterval(() => { void tick() }, 1200)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [token])

  useEffect(() => {
    if (!cameraOn) return
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
        const detected = detectAnswerCards(ctx.getImageData(0, 0, width, height))
        const seen = new Set<string>()
        const boxes: Box[] = []
        const roster = new Map(rosterRef.current.map((card) => [card.token, card]))
        for (const card of detected) {
          const known = roster.get(card.token)
          if (!known) continue
          const choice = choiceFromQrTopEdge(card.topLeft, card.topRight, holdRef.current)
          seen.add(card.token)
          const prev = stableRef.current.get(card.token)
          if (prev && prev.choice === choice) prev.hits += 1
          else stableRef.current.set(card.token, { choice, hits: 1 })
          const display = video.getBoundingClientRect()
          const scaleX = display.width / width
          const scaleY = display.height / height
          boxes.push({
            points: [card.topLeft, card.topRight, card.bottomRight, card.bottomLeft].map((point) => ({
              x: point.x * scaleX,
              y: point.y * scaleY,
            })),
            label: known ? `#${known.cardNo} · ${choice}` : choice,
          })
        }
        for (const key of [...stableRef.current.keys()]) {
          if (!seen.has(key)) stableRef.current.delete(key)
        }
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
  }, [cameraOn, facing, t.answerCardsCameraDenied, t.answerCardsCameraInsecure])

  useEffect(() => {
    if (!cameraOn || view.status === 'closed') return
    const timer = window.setInterval(() => {
      const picks = [...stableRef.current.entries()]
        .filter(([, row]) => row.hits >= 2)
        .map(([cardToken, row]) => ({ token: cardToken, choice: row.choice }))
      const signature = JSON.stringify(picks)
      if (!picks.length || signature === lastPostRef.current) return
      lastPostRef.current = signature
      void fetch(`/api/lop/answer-cards/phone/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ picks, questionIndex: questionRef.current }),
      }).then(async (res) => {
        if (!res.ok) return
        const data = await res.json() as { changed?: number; saved?: number; total?: number }
        if ((data.changed ?? 0) > 0) {
          setToast(fillAnswerCardText(t.answerCardsSavedToast, { n: data.changed ?? 0 }))
          window.setTimeout(() => setToast(''), 1600)
        }
        if (typeof data.saved === 'number' && typeof data.total === 'number') {
          setView((current) => ({ ...current, saved: data.saved ?? current.saved, total: data.total ?? current.total }))
        }
      }).catch(() => {
        lastPostRef.current = ''
      })
    }, 700)
    return () => window.clearInterval(timer)
  }, [cameraOn, token, view.status, t.answerCardsSavedToast])

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

  const holds: Array<{ id: CameraHold; label: string }> = [
    { id: 'portrait', label: t.answerCardsHoldPortrait },
    { id: 'landscape-left', label: t.answerCardsHoldLeft },
    { id: 'landscape-right', label: t.answerCardsHoldRight },
  ]

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
        <p>{fillAnswerCardText(t.answerCardsSavedOf, { saved: view.saved, total: view.total })}</p>
      </header>
      <div className="relative min-h-0 flex-1 bg-slate-950">
        <video ref={videoRef} className="h-full w-full object-fill" playsInline muted autoPlay />
        <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0 h-full w-full" />
        {toast ? (
          <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-sm font-semibold text-slate-950">
            {toast}
          </p>
        ) : null}
        {cameraError ? <p className="absolute inset-x-4 top-1/2 text-center text-sm">{cameraError}</p> : null}
        {!cameraOn ? <p className="absolute inset-x-4 top-1/2 text-center text-sm text-white/70">{t.answerCardsCameraOff}</p> : null}
      </div>
      <div className="space-y-2 px-3 py-3">
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
        <p className="text-center text-xs text-white/70">{t.answerCardsHoldHint}</p>
        <div className="grid grid-cols-3 gap-1">
          {holds.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-xl px-2 py-2 text-[11px] leading-tight ${hold === item.id ? 'bg-lime-300 font-semibold text-slate-900' : 'bg-white text-slate-900'}`}
              onClick={() => setHold(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
          >
            {t.answerCardsSwitchCamera}
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
