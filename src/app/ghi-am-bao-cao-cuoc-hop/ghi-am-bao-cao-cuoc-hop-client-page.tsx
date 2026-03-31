'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
  capMeetingDurationByFileSize,
  computeMeetingReportCredits,
} from '@/lib/meeting-report-pricing'
import { MEETING_RECORDING_RETENTION_DAYS } from '@/lib/meeting-recording-config'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TITLE_STORAGE = 'nanoai.meetingRecorder.title'

function readWebLocale(): WebLocale {
  if (typeof document === 'undefined') return 'vi'
  const v = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
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
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)
  const [serverRecordingId, setServerRecordingId] = useState<string | null>(null)
  const [savingServer, setSavingServer] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [liveElapsedSec, setLiveElapsedSec] = useState(0)

  const chunksRef = useRef<Blob[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const mimeRef = useRef('audio/webm')
  const { toast } = useToast()
  const { credits, fetchCredits, checkCreditsAndProceed } = useCredits()

  const mr = useMemo(() => getDictionary(uiLocale).meetingRecorder, [uiLocale])

  useEffect(() => {
    meetingTitleRef.current = meetingTitle
  }, [meetingTitle])

  useEffect(() => {
    setUiLocale(readWebLocale())
    setReportLocale(readWebLocale())
    try {
      const saved = localStorage.getItem(TITLE_STORAGE)
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

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const stopRecordingInternal = useCallback(() => {
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
    setRecording(false)
  }, [stopTracks])

  const saveRecordingToServer = useCallback(
    async (blob: Blob, duration: number) => {
      setSavingServer(true)
      setSaveFailed(false)
      setServerRecordingId(null)
      try {
        const fd = new FormData()
        fd.append('audio', blob, 'meeting.webm')
        fd.append('title', meetingTitleRef.current.trim())
        fd.append('durationSeconds', String(duration))
        fd.append('mimeType', blob.type || mimeRef.current)
        const res = await fetch('/api/meeting-recording/save', { method: 'POST', body: fd })
        const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string }
        if (!res.ok || !data.id) {
          throw new Error(typeof data.error === 'string' ? data.error : 'save failed')
        }
        setServerRecordingId(data.id)
      } catch {
        setSaveFailed(true)
        toast({ title: mr.saveRecordingFailed, variant: 'destructive' })
      } finally {
        setSavingServer(false)
      }
    },
    [mr.saveRecordingFailed, toast]
  )

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast({ title: mr.micError, variant: 'destructive' })
      return
    }
    try {
      localStorage.setItem(TITLE_STORAGE, meetingTitleRef.current.trim().slice(0, 200))
    } catch {
      // ignore
    }

    revokeAudioUrl()
    setAudioBlob(null)
    setServerRecordingId(null)
    setSaveFailed(false)
    setReportMd('')
    setTranscript('')
    setDurationSec(0)
    chunksRef.current = []
    mimeRef.current = pickRecorderMime()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream, { mimeType: mimeRef.current })
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        const dur = (Date.now() - startedAtRef.current) / 1000
        const clamped = Math.min(
          MEETING_REPORT_MAX_DURATION_SECONDS,
          Math.max(1, Math.floor(dur))
        )
        setDurationSec(clamped)
        setRecording(false)
        stopTracks()
        void saveRecordingToServer(blob, clamped)
      }
      startedAtRef.current = Date.now()
      rec.start(250)
      setRecording(true)
    } catch {
      toast({ title: mr.micError, variant: 'destructive' })
      stopTracks()
      setRecording(false)
    }
  }, [mr.micError, revokeAudioUrl, saveRecordingToServer, stopTracks, toast])

  const stopRecording = useCallback(() => {
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
  }, [stopRecordingInternal])

  useEffect(() => {
    return () => {
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
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setLiveElapsedSec(Math.min(Math.max(0, sec), MEETING_REPORT_MAX_DURATION_SECONDS))
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [recording])

  const billedPreview = useMemo(() => {
    if (!audioBlob || durationSec < 1) return { dur: 0, cost: 0 }
    const dur = capMeetingDurationByFileSize(audioBlob.size, durationSec)
    return { dur, cost: computeMeetingReportCredits(dur) }
  }, [audioBlob, durationSec])

  const canGenerateReport =
    Boolean(audioBlob && durationSec >= 1) &&
    !savingServer &&
    (Boolean(serverRecordingId) || saveFailed)

  const generateReport = useCallback(() => {
    if (!audioBlob || durationSec < 1) {
      toast({ title: mr.needRecording, variant: 'destructive' })
      return
    }
    if (savingServer) {
      toast({ title: mr.savingRecording, variant: 'destructive' })
      return
    }
    if (!serverRecordingId && !saveFailed) {
      toast({ title: mr.needServerRecording, variant: 'destructive' })
      return
    }
    if (audioBlob.size > MEETING_REPORT_MAX_FILE_BYTES) {
      toast({ title: mr.fileTooLarge, variant: 'destructive' })
      return
    }

    const cost = billedPreview.cost
    checkCreditsAndProceed(cost, async () => {
      setBusy(true)
      try {
        const fd = new FormData()
        if (serverRecordingId) {
          fd.append('recordingId', serverRecordingId)
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
        setTranscript(data.transcript || '')
        window.dispatchEvent(new Event('credits-updated'))
        await fetchCredits()
      } finally {
        setBusy(false)
      }
    })
  }, [
    audioBlob,
    billedPreview.cost,
    checkCreditsAndProceed,
    durationSec,
    meetingTitle,
    mr.fileTooLarge,
    mr.genericError,
    mr.insufficientCredits,
    mr.needRecording,
    mr.needServerRecording,
    mr.savingRecording,
    reportLocale,
    saveFailed,
    serverRecordingId,
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
    setTranscript('')
    setServerRecordingId(null)
    setSaveFailed(false)
    setSavingServer(false)
    chunksRef.current = []
  }

  const retryServerSave = () => {
    if (!audioBlob || durationSec < 1) return
    void saveRecordingToServer(audioBlob, durationSec)
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
              <Button type="button" variant="destructive" onClick={stopRecording} className="gap-2">
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

      {(reportMd || transcript) && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-lg">{mr.reportHeading}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => void copyText(reportMd)}
                disabled={!reportMd}
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
                disabled={!reportMd}
              >
                <Download className="h-3.5 w-3.5" />
                {mr.downloadMd}
              </Button>
              <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={createNewMeeting}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {mr.createNewMeeting}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {reportMd ? (
              <div className="space-y-2">
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

      <Toaster />
    </div>
  )
}
