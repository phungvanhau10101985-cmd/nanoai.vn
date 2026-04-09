'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Mic, Square, Loader2, Download, Copy, Plus } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import {
  MEETING_REPORT_MAX_FILE_BYTES,
  MEETING_REPORT_MAX_DURATION_SECONDS,
  MEETING_REPORT_TRANSCRIBE_CHUNK_SECONDS,
  capMeetingDurationByFileSize,
  computeMeetingReportCredits,
} from '@/lib/meeting-report-pricing'
import {
  MEETING_RECORDING_RETENTION_DAYS,
  MEETING_RECORDING_SILENCE_AUTO_STOP_MS,
  MEETING_RECORDING_SILENCE_CHECK_MS,
  MEETING_RECORDING_VOICE_RMS_THRESHOLD,
} from '@/lib/meeting-recording-config'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TITLE_STORAGE = 'app.meetingRecorder.title'
const TITLE_STORAGE_LEGACY = 'nanoai.meetingRecorder.title'

function readWebLocale(): WebLocale {
  if (typeof document === 'undefined') return 'vi'
  const v = readWebLocaleFromDocumentCookie()
  if (v === 'en' || v === 'zh' || v === 'ja' || v === 'ko') return v
  return 'vi'
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function pickRecorderMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return 'audio/webm'
}

const REPORT_LANG: { value: WebLocale; label: string }[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

export default function GhiAmBaoCaoCuocHopClientPage() {
  const [uiLocale, setUiLocale] = useState<WebLocale>('vi')
  const [meetingTitle, setMeetingTitle] = useState('')
  const meetingTitleRef = useRef('')
  const [reportLocale, setReportLocale] = useState<WebLocale>('vi')
  const [recording, setRecording] = useState(false)
  const [durationSec, setDurationSec] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [reportMd, setReportMd] = useState('')
  const [reportBriefMd, setReportBriefMd] = useState('')
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)
  const [serverRecordingIds, setServerRecordingIds] = useState<string[]>([])
  const [savingServer, setSavingServer] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [liveElapsedSec, setLiveElapsedSec] = useState(0)
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false)
  /** Tổng byte các đoạn gốc — khớp server khi tính cap; blob gộp có thể khác tổng WebM. */
  const [bytesForBillingCap, setBytesForBillingCap] = useState(0)

  const chunksRef = useRef<Blob[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mimeRef = useRef('audio/webm')
  const pendingSegmentRotationRef = useRef(false)
  const recordingSegmentsRef = useRef<{ blob: Blob; durationSec: number }[]>([])
  const segmentStartedAtRef = useRef(0)
  const sessionStartedAtRef = useRef(0)
  const lastSegmentsForRetryRef = useRef<{ blob: Blob; durationSec: number }[]>([])
  const discardSessionRef = useRef(false)
  const silenceMsRef = useRef(0)
  const silenceMonitorIntervalRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const stopRecordingRef = useRef<(() => void) | undefined>(undefined)
  const { toast } = useToast()
  const { credits, fetchCredits, checkCreditsAndProceed } = useCredits()

  const mr = useMemo(() => getDictionary(uiLocale).meetingRecorder, [uiLocale])
  const mrRef = useRef(mr)
  mrRef.current = mr

  useEffect(() => {
    meetingTitleRef.current = meetingTitle
  }, [meetingTitle])

  useEffect(() => {
    setUiLocale(readWebLocale())
    setReportLocale(readWebLocale())
    try {
      const saved =
        localStorage.getItem(TITLE_STORAGE) ?? localStorage.getItem(TITLE_STORAGE_LEGACY)
      if (saved) setMeetingTitle(saved)
    } catch {
      // ignore
    }
  }, [])

  const revokeAudioUrl = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
  }, [audioUrl])

  const clearSilenceMonitor = useCallback(() => {
    if (silenceMonitorIntervalRef.current != null) {
      window.clearInterval(silenceMonitorIntervalRef.current)
      silenceMonitorIntervalRef.current = null
    }
    const ctx = audioContextRef.current
    audioContextRef.current = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close()
    }
    silenceMsRef.current = 0
  }, [])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const stopRecordingInternal = useCallback(() => {
    clearSilenceMonitor()
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    stopTracks()
    recordingSegmentsRef.current = []
    pendingSegmentRotationRef.current = false
    setRecording(false)
  }, [clearSilenceMonitor, stopTracks])

  const saveAllSegmentsToServer = useCallback(
    async (segments: { blob: Blob; durationSec: number }[]) => {
      lastSegmentsForRetryRef.current = segments
      setSavingServer(true)
      setSaveFailed(false)
      setServerRecordingIds([])
      try {
        const ids: string[] = []
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]!
          const fd = new FormData()
          fd.append('audio', seg.blob, `meeting-part-${i + 1}.webm`)
          fd.append('title', meetingTitleRef.current.trim())
          fd.append('durationSeconds', String(seg.durationSec))
          fd.append('mimeType', seg.blob.type || mimeRef.current)
          const res = await fetch('/api/meeting-recording/save', { method: 'POST', body: fd })
          const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string }
          if (!res.ok || !data.id) {
            throw new Error(typeof data.error === 'string' ? data.error : 'save failed')
          }
          ids.push(data.id)
        }
        setServerRecordingIds(ids)
      } catch {
        setSaveFailed(true)
        toast({ title: mr.saveRecordingFailed, variant: 'destructive' })
      } finally {
        setSavingServer(false)
      }
    },
    [mr.saveRecordingFailed, toast]
  )

  const finalizeRecordingSession = useCallback(
    async (segments: { blob: Blob; durationSec: number }[]) => {
      discardSessionRef.current = false
      clearSilenceMonitor()
      recorderRef.current = null
      stopTracks()
      setRecording(false)

      const totalDur = Math.min(
        MEETING_REPORT_MAX_DURATION_SECONDS,
        segments.reduce((s, x) => s + x.durationSec, 0)
      )
      const merged = new Blob(
        segments.map((x) => x.blob),
        { type: mimeRef.current }
      )
      setBytesForBillingCap(segments.reduce((s, x) => s + x.blob.size, 0))
      revokeAudioUrl()
      setAudioBlob(merged)
      setAudioUrl(URL.createObjectURL(merged))
      setDurationSec(totalDur)
      await saveAllSegmentsToServer(segments)
    },
    [clearSilenceMonitor, revokeAudioUrl, saveAllSegmentsToServer, stopTracks]
  )

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast({ title: mr.micError, variant: 'destructive' })
      return
    }
    try {
      const t = meetingTitleRef.current.trim().slice(0, 200)
      localStorage.setItem(TITLE_STORAGE, t)
      localStorage.setItem(TITLE_STORAGE_LEGACY, t)
    } catch {
      // ignore
    }

    clearSilenceMonitor()
    discardSessionRef.current = false
    revokeAudioUrl()
    setAudioBlob(null)
    setBytesForBillingCap(0)
    setServerRecordingIds([])
    setSaveFailed(false)
    setReportMd('')
    setReportBriefMd('')
    setTranscript('')
    setDurationSec(0)
    chunksRef.current = []
    recordingSegmentsRef.current = []
    pendingSegmentRotationRef.current = false
    mimeRef.current = pickRecorderMime()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      sessionStartedAtRef.current = Date.now()

      const onRecorderStop = () => {
        if (discardSessionRef.current) {
          discardSessionRef.current = false
          chunksRef.current = []
          recordingSegmentsRef.current = []
          recorderRef.current = null
          stopTracks()
          setRecording(false)
          return
        }

        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        chunksRef.current = []
        const segDur = Math.max(1, Math.floor((Date.now() - segmentStartedAtRef.current) / 1000))

        if (pendingSegmentRotationRef.current) {
          pendingSegmentRotationRef.current = false
          recordingSegmentsRef.current.push({ blob, durationSec: segDur })
          toast({ title: mrRef.current.segmentRotatedToast })
          const s = streamRef.current
          if (!s) {
            setRecording(false)
            return
          }
          const rec2 = new MediaRecorder(s, { mimeType: mimeRef.current })
          recorderRef.current = rec2
          rec2.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
          }
          rec2.onstop = onRecorderStop
          segmentStartedAtRef.current = Date.now()
          rec2.start(250)
          return
        }

        recordingSegmentsRef.current.push({ blob, durationSec: segDur })
        const all = [...recordingSegmentsRef.current]
        recordingSegmentsRef.current = []
        void finalizeRecordingSession(all)
      }

      const rec = new MediaRecorder(stream, { mimeType: mimeRef.current })
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = onRecorderStop
      segmentStartedAtRef.current = Date.now()
      rec.start(250)
      setRecording(true)

      silenceMsRef.current = 0
      try {
        const AC =
          typeof window !== 'undefined' &&
          (window.AudioContext ||
            (
              window as unknown as {
                webkitAudioContext?: typeof AudioContext
              }
            ).webkitAudioContext)
        if (AC) {
          const audioCtx = new AC()
          audioContextRef.current = audioCtx
          await audioCtx.resume()
          const source = audioCtx.createMediaStreamSource(stream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 2048
          analyser.smoothingTimeConstant = 0.88
          source.connect(analyser)
          const buf = new Uint8Array(analyser.frequencyBinCount)
          silenceMonitorIntervalRef.current = window.setInterval(() => {
            const recInst = recorderRef.current
            if (!recInst || recInst.state !== 'recording') return
            analyser.getByteTimeDomainData(buf)
            let sum = 0
            for (let i = 0; i < buf.length; i++) {
              const x = (buf[i]! - 128) / 128
              sum += x * x
            }
            const rms = Math.sqrt(sum / buf.length)
            if (rms >= MEETING_RECORDING_VOICE_RMS_THRESHOLD) {
              silenceMsRef.current = 0
            } else {
              silenceMsRef.current += MEETING_RECORDING_SILENCE_CHECK_MS
              if (silenceMsRef.current >= MEETING_RECORDING_SILENCE_AUTO_STOP_MS) {
                clearSilenceMonitor()
                toast({ title: mrRef.current.autoStoppedBySilence })
                stopRecordingRef.current?.()
              }
            }
          }, MEETING_RECORDING_SILENCE_CHECK_MS)
        }
      } catch {
        // Ghi âm vẫn chạy; chỉ không có tự dừng theo im lặng
      }
    } catch {
      toast({ title: mr.micError, variant: 'destructive' })
      clearSilenceMonitor()
      stopTracks()
      setRecording(false)
    }
  }, [clearSilenceMonitor, finalizeRecordingSession, mr.micError, revokeAudioUrl, stopTracks, toast])

  const stopRecording = useCallback(() => {
    clearSilenceMonitor()
    discardSessionRef.current = false
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch {
        stopRecordingInternal()
      }
    } else {
      stopRecordingInternal()
    }
  }, [clearSilenceMonitor, stopRecordingInternal])

  stopRecordingRef.current = stopRecording

  useEffect(() => {
    return () => {
      discardSessionRef.current = true
      stopRecordingInternal()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl, stopRecordingInternal])

  useEffect(() => {
    if (!recording) {
      setLiveElapsedSec(0)
      return
    }
    const tick = () => {
      const sec = Math.floor((Date.now() - sessionStartedAtRef.current) / 1000)
      setLiveElapsedSec(Math.min(Math.max(0, sec), MEETING_REPORT_MAX_DURATION_SECONDS))
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [recording])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      const recInst = recorderRef.current
      if (!recInst || recInst.state !== 'recording') return
      const totalMs = Date.now() - sessionStartedAtRef.current
      if (totalMs >= MEETING_REPORT_MAX_DURATION_SECONDS * 1000) {
        pendingSegmentRotationRef.current = false
        stopRecordingRef.current?.()
        return
      }
      if (Date.now() - segmentStartedAtRef.current < MEETING_REPORT_TRANSCRIBE_CHUNK_SECONDS * 1000) return
      pendingSegmentRotationRef.current = true
      try {
        recInst.stop()
      } catch {
        pendingSegmentRotationRef.current = false
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [recording])

  const billedPreview = useMemo(() => {
    if (!audioBlob || durationSec < 1) return { dur: 0, cost: 0 }
    const bytes = bytesForBillingCap > 0 ? bytesForBillingCap : audioBlob.size
    const dur = capMeetingDurationByFileSize(bytes, durationSec)
    return { dur, cost: computeMeetingReportCredits(dur) }
  }, [audioBlob, bytesForBillingCap, durationSec])

  const canGenerateReport =
    Boolean(audioBlob && durationSec >= 1) &&
    !savingServer &&
    (serverRecordingIds.length > 0 || saveFailed)

  const generateReport = useCallback(() => {
    if (!audioBlob || durationSec < 1) {
      toast({ title: mr.needRecording, variant: 'destructive' })
      return
    }
    if (savingServer) {
      toast({ title: mr.savingRecording, variant: 'destructive' })
      return
    }
    if (serverRecordingIds.length === 0 && !saveFailed) {
      toast({ title: mr.needServerRecording, variant: 'destructive' })
      return
    }
    if (
      serverRecordingIds.length === 0 &&
      audioBlob.size > MEETING_REPORT_MAX_FILE_BYTES
    ) {
      toast({ title: mr.fileTooLarge, variant: 'destructive' })
      return
    }

    const capBytes = bytesForBillingCap > 0 ? bytesForBillingCap : audioBlob.size
    const billedDurationAtClick = capMeetingDurationByFileSize(capBytes, durationSec)
    const costAtClick = computeMeetingReportCredits(billedDurationAtClick)
    checkCreditsAndProceed(costAtClick, async () => {
      setBusy(true)
      try {
        const fd = new FormData()
        if (serverRecordingIds.length > 0) {
          fd.append('recordingIds', JSON.stringify(serverRecordingIds))
        } else {
          fd.append('audio', audioBlob, 'meeting.webm')
          fd.append('durationSeconds', String(durationSec))
        }
        fd.append('title', meetingTitle.trim())
        fd.append('reportLocale', reportLocale)

        const res = await fetch('/api/meeting-report-from-audio', {
          method: 'POST',
          body: fd,
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          reportMarkdown?: string
          reportBriefMarkdown?: string
          transcript?: string
        }

        if (!res.ok) {
          toast({
            title: res.status === 402 ? mr.insufficientCredits : mr.genericError,
            description: data.error || `HTTP ${res.status}`,
            variant: 'destructive',
          })
          return
        }

        setReportMd(data.reportMarkdown || '')
        setReportBriefMd(data.reportBriefMarkdown || '')
        setTranscript(data.transcript || '')
        window.dispatchEvent(new Event('credits-updated'))
        await fetchCredits()
      } finally {
        setBusy(false)
      }
    })
  }, [
    audioBlob,
    checkCreditsAndProceed,
    durationSec,
    meetingTitle,
    bytesForBillingCap,
    mr.fileTooLarge,
    mr.genericError,
    mr.insufficientCredits,
    mr.needRecording,
    mr.needServerRecording,
    mr.savingRecording,
    reportLocale,
    saveFailed,
    serverRecordingIds,
    savingServer,
    toast,
    fetchCredits,
  ])

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: mr.copied })
    } catch {
      toast({ title: mr.genericError, variant: 'destructive' })
    }
  }

  const downloadBlobText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAudio = () => {
    if (!audioBlob) return
    const url = URL.createObjectURL(audioBlob)
    const a = document.createElement('a')
    a.href = url
    const safe = meetingTitle.trim().replace(/[^\w\u00C0-\u024f\-]+/g, '_').slice(0, 80) || 'meeting'
    a.download = `${safe}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const createNewMeeting = () => {
    stopRecordingInternal()
    revokeAudioUrl()
    setAudioBlob(null)
    setDurationSec(0)
    setReportMd('')
    setReportBriefMd('')
    setTranscript('')
    setServerRecordingIds([])
    setBytesForBillingCap(0)
    setSaveFailed(false)
    setSavingServer(false)
    chunksRef.current = []
    lastSegmentsForRetryRef.current = []
  }

  const retryServerSave = () => {
    const segs = lastSegmentsForRetryRef.current
    if (segs.length < 1) return
    void saveAllSegmentsToServer(segs)
  }

  const sessionNoteText = mr.sessionNote.replace('{days}', String(MEETING_RECORDING_RETENTION_DAYS))

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-xl sm:text-2xl">{mr.cardTitle}</CardTitle>
            <CardDescription>{mr.cardDescription}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 self-start sm:self-auto"
            disabled={recording}
            title={recording ? mr.stopBeforeNewMeeting : undefined}
            onClick={createNewMeeting}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {mr.createNewMeeting}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>{mr.freeRecordingNote}</li>
            <li>{mr.segmentAutoSplitNote}</li>
            <li>{mr.silenceAutoStopNote}</li>
            <li>{mr.chargeNote}</li>
            <li>{sessionNoteText}</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="meeting-title">{mr.meetingTitleLabel}</Label>
            <Input
              id="meeting-title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder={mr.meetingTitlePlaceholder}
              maxLength={200}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!recording ? (
              <Button type="button" onClick={() => void startRecording()} className="gap-2">
                <Mic className="h-4 w-4" />
                {mr.startRecording}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setStopConfirmOpen(true)}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                {mr.stopRecording}
              </Button>
            )}
            <span
              className={cn(
                'text-sm font-medium',
                recording ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {recording ? mr.recording : mr.idleHint}
            </span>
          </div>

          {recording && (
            <p
              className="text-2xl font-semibold tabular-nums tracking-tight text-primary sm:text-3xl"
              aria-live="polite"
            >
              {mr.recordingTimeLabel.replace(
                '{duration}',
                formatDuration(liveElapsedSec)
              )}
            </p>
          )}

          {!recording && durationSec > 0 && (
            <p className="text-sm text-muted-foreground">
              {mr.durationLabel.replace('{duration}', formatDuration(durationSec))}
            </p>
          )}

          {savingServer && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {mr.savingRecording}
            </p>
          )}

          {saveFailed && !savingServer && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={retryServerSave}>
                {mr.retrySaveRecording}
              </Button>
            </div>
          )}

          {audioUrl && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <audio controls src={audioUrl} className="w-full max-w-full" />
              <Button type="button" variant="outline" size="sm" onClick={downloadAudio} className="gap-2">
                <Download className="h-4 w-4" />
                {mr.downloadRecording}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>{mr.reportLanguageLabel}</Label>
            <Select
              value={reportLocale}
              onValueChange={(v) => setReportLocale(v as WebLocale)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_LANG.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {audioBlob && durationSec >= 1 && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] p-4 space-y-2">
              <p className="text-sm font-medium">
                {mr.estimatedCost.replace(
                  '{credits}',
                  String(billedPreview.cost)
                )}
              </p>
              <p className="text-xs text-muted-foreground">{mr.costExplain}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  onClick={generateReport}
                  disabled={busy || !canGenerateReport}
                  className="gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {mr.generateReport}
                </Button>
                <DepositCreditButton />
              </div>
              <p className="text-xs text-muted-foreground">
                {getDictionary(uiLocale).menu.credits}: {credits.toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {(reportMd || reportBriefMd || transcript) && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-lg">{mr.reportHeading}</CardTitle>
            <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={createNewMeeting}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {mr.createNewMeeting}
            </Button>
          </CardHeader>
          <CardContent className="space-y-8">
            {reportBriefMd ? (
              <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/[0.06] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-primary">{mr.briefReportHeading}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 bg-background/80"
                      onClick={() => void copyText(reportBriefMd)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {mr.copy}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 bg-background/80"
                      onClick={() =>
                        downloadBlobText(
                          reportBriefMd,
                          `${meetingTitle.trim().slice(0, 40) || 'meeting'}-brief.md`
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      {mr.downloadBriefMd}
                    </Button>
                  </div>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {reportBriefMd}
                </pre>
              </div>
            ) : null}
            {reportMd ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{mr.fullReportHeading}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => void copyText(reportMd)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {mr.copy}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        downloadBlobText(
                          reportMd,
                          `${meetingTitle.trim().slice(0, 40) || 'meeting'}-report.md`
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      {mr.downloadMd}
                    </Button>
                  </div>
                </div>
                <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                  {reportMd}
                </pre>
              </div>
            ) : null}
            {transcript ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{mr.transcriptHeading}</h3>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 p-3 text-sm">
                  {transcript}
                </pre>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyText(transcript)}
                >
                  {mr.copy}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mr.stopRecordingConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{mr.stopRecordingConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{mr.stopRecordingConfirmContinue}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={cn(buttonVariants({ variant: 'destructive' }))}
              onClick={() => {
                setStopConfirmOpen(false)
                stopRecording()
              }}
            >
              {mr.stopRecordingConfirmOk}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  )
}
