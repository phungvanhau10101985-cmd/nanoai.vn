'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { normalizeClassJoinCode } from '@/lib/lop/join-code'
import { normalizeStudentCode } from '@/lib/lop/class-roster'

export function VaoMaForm({
  t,
  initialCode = '',
  returnPath = null,
}: {
  t: Dictionary['classes']
  initialCode?: string
  returnPath?: string | null
}) {
  const [joinCode, setJoinCode] = useState(initialCode)
  const [studentCode, setStudentCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSummary, setPreviewSummary] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)

  useEffect(() => {
    const raw = normalizeClassJoinCode(joinCode)
    if (raw.length < 4) {
      setPreviewSummary(null)
      setPreviewError(false)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(false)
    const timer = window.setTimeout(() => {
      void fetch(`/api/lop/join-preview?code=${encodeURIComponent(raw)}`, { cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (cancelled) return
          if (response.status === 401) {
            setPreviewSummary(null)
            setPreviewError(false)
            return
          }
          if (!response.ok || data?.error || !data?.found) {
            setPreviewSummary(null)
            setPreviewError(Boolean(data?.reason === 'not_found' || data?.error || !response.ok))
            return
          }
          const parts = [String(data.className ?? '').trim()].filter(Boolean)
          const subject = String(data.subjectLabel ?? '').trim()
          const teacher = String(data.teacherDisplayName ?? '').trim()
          if (subject) parts.push(subject)
          if (teacher) parts.push(teacher)
          setPreviewSummary(parts.join(' — '))
          setPreviewError(false)
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewSummary(null)
            setPreviewError(true)
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [joinCode])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/lop/vao-ma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinCode: normalizeClassJoinCode(joinCode),
          studentCode: normalizeStudentCode(studentCode),
          password,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(
          data?.error === 'locked'
            ? t.entryLocked
            : data?.error === 'not_ready'
              ? t.entryNotReady
              : t.entryFailed
        )
        return
      }
      window.location.assign(returnPath || `/lop/${data.classId}`)
    } catch {
      setError(t.entryFailed)
    } finally {
      setBusy(false)
    }
  }

  const codeReady = normalizeClassJoinCode(joinCode).length >= 4

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.joinByCodeLead}</p>
      <div>
        <label htmlFor="join-class-code" className="mb-2 block text-sm font-medium text-foreground">
          {t.answerCardJoinCodeLabel}
        </label>
        <Input
          id="join-class-code"
          value={joinCode}
          onChange={(event) => setJoinCode(normalizeClassJoinCode(event.target.value))}
          placeholder="ABC123"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          required
          disabled={busy}
          className="font-mono tracking-wider"
        />
        {codeReady ? (
          <div className="mt-2 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm" aria-live="polite">
            {previewLoading ? (
              <p className="text-muted-foreground">{t.joinClassPreviewLoading}</p>
            ) : previewSummary ? (
              <>
                <p className="font-medium text-foreground">{t.joinClassPreviewTitle}</p>
                <p className="mt-1 text-foreground">{previewSummary}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.joinClassPreviewCheckHint}</p>
              </>
            ) : previewError ? (
              <p className="text-destructive">{t.joinClassPreviewNotFound}</p>
            ) : (
              <p className="text-muted-foreground">{t.joinClassPreviewNeedCode}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t.joinClassPreviewNeedCode}</p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="entry-code" className="text-sm font-medium text-foreground">
          {t.entryCodeLabel}
        </label>
        <Input
          id="entry-code"
          value={studentCode}
          onChange={(event) => setStudentCode(normalizeStudentCode(event.target.value))}
          autoComplete="off"
          spellCheck={false}
          required
          disabled={busy}
          className="font-mono"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="entry-password" className="text-sm font-medium text-foreground">
          {t.entryPasswordLabel}
        </label>
        <Input
          id="entry-password"
          inputMode="numeric"
          value={password}
          onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="off"
          required
          disabled={busy}
          className="font-mono tracking-widest"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? t.entrySubmitting : t.entrySubmit}
      </Button>
    </form>
  )
}
